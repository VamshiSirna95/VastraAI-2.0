import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getOllamaUrl, setOllamaUrl, testConnection } from '../../services/ollama';
import { getProductCount, getVendors, getDb } from '../../db/database';
import { colors } from '../../constants/theme';
import GlassInput from '../../components/ui/GlassInput';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <View style={[styles.statusDot, { backgroundColor: color }]} />
  );
}

// ── Cascade row ───────────────────────────────────────────────────────────────

function CascadeRow({
  dotColor,
  label,
  badge,
  badgeColor,
}: {
  dotColor: string;
  label: string;
  badge: string;
  badgeColor: string;
}) {
  return (
    <View style={styles.cascadeRow}>
      <StatusDot color={dotColor} />
      <Text style={styles.cascadeLabel}>{label}</Text>
      <View style={[styles.cascadeBadge, { backgroundColor: `${badgeColor}20` }]}>
        <Text style={[styles.cascadeBadgeText, { color: badgeColor }]}>{badge}</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [ollamaUrl, setOllamaUrlState] = useState('');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle');
  const [connModel, setConnModel] = useState('');
  const [connError, setConnError] = useState('');
  const [productCount, setProductCount] = useState(0);
  const [vendorCount, setVendorCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOllamaUrl().then(setOllamaUrlState).catch(() => {});
    getProductCount().then(setProductCount).catch(() => {});
    getVendors().then((v) => setVendorCount(v.length)).catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setConnStatus('testing');
    setConnModel('');
    setConnError('');
    try {
      const result = await testConnection();
      if (result.connected) {
        setConnStatus('connected');
        setConnModel(result.model ?? 'unknown');
      } else {
        setConnStatus('failed');
        setConnError(result.error ?? 'Connection refused');
      }
    } catch (e: unknown) {
      setConnStatus('failed');
      setConnError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleSaveUrl = async () => {
    setSaving(true);
    try {
      await setOllamaUrl(ollamaUrl.trim());
      setConnStatus('idle');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDemoData = () => {
    Alert.alert(
      'Clear Demo Data',
      'This will permanently delete all products and vendors. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDb();
              await db.execAsync('DELETE FROM product_custom_attrs');
              await db.execAsync('DELETE FROM product_photos');
              await db.execAsync('DELETE FROM products');
              await db.execAsync('DELETE FROM vendors');
              setProductCount(0);
              setVendorCount(0);
            } catch {
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ]
    );
  };

  // Connection status display
  const connDotColor =
    connStatus === 'idle' ? 'rgba(255,255,255,0.2)'
    : connStatus === 'testing' ? colors.amber
    : connStatus === 'connected' ? colors.teal
    : colors.red;

  const connStatusText =
    connStatus === 'idle' ? 'Not tested'
    : connStatus === 'testing' ? 'Testing…'
    : connStatus === 'connected' ? `Connected — model: ${connModel}`
    : `Connection failed — ${connError}`;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenLabel}>SETTINGS</Text>

        {/* ── AI Configuration ─── */}
        <Section label="AI ENGINE">
          <GlassInput
            label="Ollama Server URL"
            value={ollamaUrl}
            onChangeText={setOllamaUrlState}
            placeholder="http://192.168.1.100:11434"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {/* Connection status */}
          <View style={styles.connStatusRow}>
            <StatusDot color={connDotColor} />
            <Text style={styles.connStatusText}>{connStatusText}</Text>
            {connStatus === 'testing' && (
              <ActivityIndicator size="small" color={colors.amber} style={styles.connSpinner} />
            )}
          </View>

          {/* Buttons row */}
          <View style={styles.aiButtonsRow}>
            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestConnection}
              disabled={connStatus === 'testing'}
            >
              <Text style={styles.testBtnText}>Test Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveUrl}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ── Detection Priority ─── */}
        <Section label="DETECTION CASCADE">
          <Text style={styles.cascadeInfo}>
            VASTRA tries Ollama first, falls back to on-device detection, then manual entry.
          </Text>
          <CascadeRow
            dotColor={connStatus === 'connected' ? colors.teal : 'rgba(255,255,255,0.2)'}
            label="Ollama Server"
            badge={connStatus === 'connected' ? 'Connected' : 'Offline'}
            badgeColor={connStatus === 'connected' ? colors.teal : 'rgba(255,255,255,0.3)'}
          />
          <CascadeRow
            dotColor={colors.blue}
            label="On-Device AI"
            badge="Active"
            badgeColor={colors.blue}
          />
          <CascadeRow
            dotColor={colors.amber}
            label="Manual Entry"
            badge="Always available"
            badgeColor={colors.amber}
          />
        </Section>

        {/* ── App Info ─── */}
        <Section label="APP INFO">
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>VASTRA v0.1.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Products</Text>
            <Text style={[styles.infoValue, { color: colors.teal }]}>{productCount}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vendors</Text>
            <Text style={[styles.infoValue, { color: colors.teal }]}>{vendorCount}</Text>
          </View>

          <TouchableOpacity style={styles.clearBtn} onPress={handleClearDemoData}>
            <Text style={styles.clearBtnText}>Clear Demo Data</Text>
          </TouchableOpacity>
        </Section>

        {/* ── About ─── */}
        <Section label="ABOUT">
          <View style={styles.brandRow}>
            <Text style={styles.brandName}>VASTRA</Text>
            <View style={styles.brandDot} />
          </View>
          <Text style={styles.brandSub}>Merchandise Intelligence Platform</Text>
          <Text style={styles.brandOrg}>K.M. Fashions / MGBT</Text>
          <Text style={styles.brandCredit}>Built with The Architect</Text>
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
  },

  screenLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginTop: 10,
    marginBottom: 20,
  },

  section: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
  },

  // Connection
  connStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  connStatusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  connSpinner: {
    marginLeft: 4,
  },
  aiButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  testBtn: {
    flex: 1,
    backgroundColor: 'rgba(93,202,165,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.25)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  testBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
  saveBtn: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },

  // Cascade
  cascadeInfo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
    lineHeight: 20,
  },
  cascadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  cascadeLabel: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_500Medium',
  },
  cascadeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cascadeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  clearBtn: {
    marginTop: 14,
    backgroundColor: 'rgba(226,75,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.red,
    fontFamily: 'Inter_700Bold',
  },

  // About
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter_900Black',
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  brandSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  brandOrg: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 10,
  },
  brandCredit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.15)',
    fontFamily: 'Inter_400Regular',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
