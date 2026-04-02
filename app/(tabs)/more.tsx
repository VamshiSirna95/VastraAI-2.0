import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { getOllamaUrl, setOllamaUrl, testConnection } from '../../services/ollama';
import {
  getGeminiApiKey, setGeminiApiKey, testGeminiConnection,
  getAIPriorityOrder, setAIPriorityOrder,
} from '../../services/geminiAI';
import { getCurrentUser, logout } from '../../services/auth';
import { getProductCount, getVendors, getStores, getDb, verifyPin, updateUserPin, getUnreadCount, getDeletedPOCount } from '../../db/database';
import { colors } from '../../constants/theme';
import GlassInput from '../../components/ui/GlassInput';
import PinInput from '../../components/PinInput';
import GlobalSearch from '../../components/GlobalSearch';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';
type PinFlow = 'off' | 'verify' | 'new' | 'confirm';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Row helpers ───────────────────────────────────────────────────────────────

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent ? { color: accent } : {}]}>{value}</Text>
    </View>
  );
}

function StatusDot({ color }: { color: string }) {
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

function CascadeRow({
  dotColor, label, badge, badgeColor,
}: { dotColor: string; label: string; badge: string; badgeColor: string }) {
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

// ── NavRow ────────────────────────────────────────────────────────────────────

function NavRow({
  label, iconPath, iconColor, badge, badgeColor, onPress,
}: {
  label: string;
  iconPath: string;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d={iconPath} stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={styles.actionRowText}>{label}</Text>
      {badge ? (
        <View style={[styles.navBadge, { backgroundColor: (badgeColor ?? iconColor) + '22', borderColor: (badgeColor ?? iconColor) + '44' }]}>
          <Text style={[styles.navBadgeText, { color: badgeColor ?? iconColor }]}>{badge}</Text>
        </View>
      ) : null}
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: colors.teal,
  manager: colors.blue,
  staff: colors.amber,
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();

  // Profile
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userId, setUserId] = useState<number | null>(null);

  // Counts
  const [productCount, setProductCount] = useState(0);
  const [vendorCount, setVendorCount] = useState(0);
  const [storeCount, setStoreCount] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [deletedPoCount, setDeletedPoCount] = useState(0);

  // Ollama
  const [ollamaUrl, setOllamaUrlState] = useState('');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle');
  const [connModel, setConnModel] = useState('');
  const [connError, setConnError] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  // Gemini AI
  const [geminiKey, setGeminiKeyState] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<ConnectionStatus>('idle');
  const [geminiError, setGeminiError] = useState('');
  const [savingGemini, setSavingGemini] = useState(false);
  const [aiPriority, setAiPriority] = useState<'gemini_first' | 'ollama_first'>('gemini_first');

  const [showSearch, setShowSearch] = useState(false);

  // Change PIN flow
  const [pinFlow, setPinFlow] = useState<PinFlow>('off');
  const [pinNewValue, setPinNewValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinEntry, setPinEntry] = useState('');

  useEffect(() => {
    (async () => {
      const [session, url, pc, vs, stores, unread, deletedPOs] = await Promise.all([
        getCurrentUser(),
        getOllamaUrl().catch(() => ''),
        getProductCount(),
        getVendors(),
        getStores(false),
        getUnreadCount(),
        getDeletedPOCount(),
      ]);
      setUnreadNotifs(unread);
      setDeletedPoCount(deletedPOs);
      if (session) {
        setUserName(session.name);
        setUserRole(session.role);
        setUserPhone(session.phone);
        setUserId(session.userId);
      }
      setOllamaUrlState(url);
      setProductCount(pc);
      setVendorCount(vs.length);
      setStoreCount(stores.length);

      // Gemini + AI priority
      const [gemKey, priority] = await Promise.all([
        getGeminiApiKey(),
        getAIPriorityOrder(),
      ]);
      setGeminiKeyState(gemKey ?? '');
      setAiPriority(priority);
    })();
  }, []);

  // ── Gemini AI ──────────────────────────────────────────────────────────────

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) { Alert.alert('API Key Required', 'Enter your Gemini API key first.'); return; }
    setGeminiStatus('testing');
    setGeminiError('');
    try {
      const result = await testGeminiConnection(geminiKey.trim());
      if (result.connected) {
        setGeminiStatus('connected');
      } else {
        setGeminiStatus('failed');
        setGeminiError(result.error ?? 'Connection failed');
      }
    } catch (e: unknown) {
      setGeminiStatus('failed');
      setGeminiError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleSaveGeminiKey = async () => {
    setSavingGemini(true);
    try {
      await setGeminiApiKey(geminiKey.trim());
      setGeminiStatus('idle');
    } finally {
      setSavingGemini(false);
    }
  };

  const handleToggleAIPriority = async () => {
    const next: 'gemini_first' | 'ollama_first' = aiPriority === 'gemini_first' ? 'ollama_first' : 'gemini_first';
    await setAIPriorityOrder(next);
    setAiPriority(next);
  };

  // ── Ollama ─────────────────────────────────────────────────────────────────

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
    setSavingUrl(true);
    try {
      await setOllamaUrl(ollamaUrl.trim());
      setConnStatus('idle');
    } finally {
      setSavingUrl(false);
    }
  };

  // ── Change PIN ─────────────────────────────────────────────────────────────

  const handlePinVerify = async (pin: string) => {
    if (!userId) return;
    const ok = await verifyPin(userId, pin);
    if (!ok) {
      setPinError('Incorrect PIN');
      return;
    }
    setPinError('');
    setPinFlow('new');
  };

  const handlePinNew = (pin: string) => {
    setPinNewValue(pin);
    setPinFlow('confirm');
  };

  const handlePinConfirm = async (pin: string) => {
    if (pin !== pinNewValue) {
      setPinError('PINs do not match');
      setPinFlow('new');
      setPinNewValue('');
      return;
    }
    if (!userId) return;
    await updateUserPin(userId, pin);
    setPinFlow('off');
    setPinError('');
    setPinNewValue('');
    Alert.alert('PIN Changed', 'Your PIN has been updated successfully.');
  };

  // ── Data management ────────────────────────────────────────────────────────

  const handleClearDemoData = () => {
    Alert.alert(
      'Reset Demo Data',
      'This will permanently delete all products and vendors. Cannot be undone.',
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

  // ── Logout ─────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  // ── Connection status helpers ──────────────────────────────────────────────

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

  const roleColor = ROLE_COLORS[userRole] ?? colors.amber;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <GlobalSearch visible={showSearch} onClose={() => setShowSearch(false)} />

        <View style={styles.header}>
          <Text style={styles.screenLabel}>SETTINGS</Text>
          <Text style={styles.screenTitle}>Profile & Settings</Text>
        </View>

        {/* ── Search ─── */}
        <TouchableOpacity style={styles.searchRow} onPress={() => setShowSearch(true)}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.searchRowText}>Search products, vendors, POs…</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>

        {/* ── Profile Card ─── */}
        {userName ? (
          <View style={styles.profileCard}>
            <View style={[styles.profileAvatar, { backgroundColor: roleColor + '22' }]}>
              <Text style={[styles.profileInitial, { color: roleColor }]}>
                {(userName[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileBody}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profilePhone}>{userPhone}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '22', borderColor: roleColor + '44' }]}>
                <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Change PIN ─── */}
        <Section label="SECURITY">
          {pinFlow === 'off' && (
            <TouchableOpacity style={styles.actionRow} onPress={() => { setPinFlow('verify'); setPinError(''); setPinEntry(''); }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.actionRowText}>Change PIN</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}

          {pinFlow === 'verify' && (
            <View style={styles.pinFlowContainer}>
              <Text style={styles.pinFlowTitle}>Enter Current PIN</Text>
              {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
              <PinInput
                value={pinEntry}
                onChange={(v) => { setPinEntry(v); if (pinError) setPinError(''); }}
                onComplete={async (pin) => { setPinEntry(''); await handlePinVerify(pin); }}
                error={!!pinError}
              />
              <TouchableOpacity onPress={() => { setPinFlow('off'); setPinEntry(''); setPinError(''); }} style={styles.pinCancelBtn}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {pinFlow === 'new' && (
            <View style={styles.pinFlowContainer}>
              <Text style={styles.pinFlowTitle}>Enter New PIN</Text>
              <PinInput
                value={pinEntry}
                onChange={(v) => setPinEntry(v)}
                onComplete={(pin) => { setPinEntry(''); handlePinNew(pin); }}
                error={false}
              />
              <TouchableOpacity onPress={() => { setPinFlow('off'); setPinEntry(''); }} style={styles.pinCancelBtn}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {pinFlow === 'confirm' && (
            <View style={styles.pinFlowContainer}>
              <Text style={styles.pinFlowTitle}>Confirm New PIN</Text>
              {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
              <PinInput
                value={pinEntry}
                onChange={(v) => { setPinEntry(v); if (pinError) setPinError(''); }}
                onComplete={async (pin) => { setPinEntry(''); await handlePinConfirm(pin); }}
                error={!!pinError}
              />
              <TouchableOpacity onPress={() => { setPinFlow('off'); setPinEntry(''); setPinError(''); setPinNewValue(''); }} style={styles.pinCancelBtn}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* ── Business Info ─── */}
        <Section label="BUSINESS INFO">
          <InfoRow label="Stores" value={String(storeCount)} accent={colors.blue} />
          <View style={styles.divider} />
          <InfoRow label="Products" value={String(productCount)} accent={colors.teal} />
          <View style={styles.divider} />
          <InfoRow label="Vendors" value={String(vendorCount)} accent={colors.teal} />
        </Section>

        {/* ── AI Engine ─── */}
        <Section label="AI ENGINE">

          {/* Google Gemini card */}
          <View style={styles.aiSubCard}>
            <View style={styles.aiSubHeader}>
              <StatusDot color={geminiStatus === 'connected' ? colors.teal : geminiKey ? colors.amber : 'rgba(255,255,255,0.15)'} />
              <Text style={styles.aiSubTitle}>Google Gemini</Text>
              <View style={[styles.aiSubBadge, { backgroundColor: geminiStatus === 'connected' ? `${colors.teal}20` : `${colors.amber}15` }]}>
                <Text style={[styles.aiSubBadgeText, { color: geminiStatus === 'connected' ? colors.teal : colors.amber }]}>
                  {geminiStatus === 'connected' ? 'Active' : geminiKey ? 'Key saved' : 'Not configured'}
                </Text>
              </View>
            </View>
            <Text style={styles.aiSubInfo}>Free tier: ~200 detections/day · Recommended for best accuracy.</Text>

            <View style={styles.geminiKeyRow}>
              <GlassInput
                style={styles.geminiKeyInput}
                label="API Key"
                value={geminiKey}
                onChangeText={(v) => { setGeminiKeyState(v); setGeminiStatus('idle'); }}
                placeholder="AIza..."
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showGeminiKey}
              />
              <TouchableOpacity style={styles.showHideBtn} onPress={() => setShowGeminiKey((v) => !v)}>
                <Text style={styles.showHideBtnText}>{showGeminiKey ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {geminiStatus !== 'idle' && (
              <View style={styles.connStatusRow}>
                <StatusDot color={geminiStatus === 'connected' ? colors.teal : geminiStatus === 'testing' ? colors.amber : colors.red} />
                <Text style={styles.connStatusText}>
                  {geminiStatus === 'testing' ? 'Testing…'
                    : geminiStatus === 'connected' ? '✓ Connected to Gemini'
                    : `Failed — ${geminiError}`}
                </Text>
                {geminiStatus === 'testing' && <ActivityIndicator size="small" color={colors.amber} style={styles.connSpinner} />}
              </View>
            )}

            <View style={styles.aiButtonsRow}>
              <TouchableOpacity style={styles.testBtn} onPress={handleTestGemini} disabled={geminiStatus === 'testing'}>
                <Text style={styles.testBtnText}>Test</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveUrlBtn, savingGemini && styles.saveBtnDisabled]} onPress={handleSaveGeminiKey} disabled={savingGemini}>
                <Text style={styles.saveUrlBtnText}>{savingGemini ? 'Saving…' : 'Save Key'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.getKeyBtn} onPress={() => Linking.openURL('https://aistudio.google.com/apikey').catch(() => {})}>
                <Text style={styles.getKeyBtnText}>Get Free Key →</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Ollama card */}
          <View style={styles.aiSubCard}>
            <View style={styles.aiSubHeader}>
              <StatusDot color={connStatus === 'connected' ? colors.teal : 'rgba(255,255,255,0.15)'} />
              <Text style={styles.aiSubTitle}>Ollama (Offline/Enterprise)</Text>
            </View>
            <Text style={styles.aiSubInfo}>For bulk processing without internet.</Text>

            <GlassInput
              label="Server URL"
              value={ollamaUrl}
              onChangeText={setOllamaUrlState}
              placeholder="http://192.168.1.100:11434"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={styles.connStatusRow}>
              <StatusDot color={connDotColor} />
              <Text style={styles.connStatusText}>{connStatusText}</Text>
              {connStatus === 'testing' && <ActivityIndicator size="small" color={colors.amber} style={styles.connSpinner} />}
            </View>

            <View style={styles.aiButtonsRow}>
              <TouchableOpacity style={styles.testBtn} onPress={handleTestConnection} disabled={connStatus === 'testing'}>
                <Text style={styles.testBtnText}>Test Connection</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveUrlBtn, savingUrl && styles.saveBtnDisabled]} onPress={handleSaveUrl} disabled={savingUrl}>
                <Text style={styles.saveUrlBtnText}>{savingUrl ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* ── Detection Cascade ─── */}
        <Section label="DETECTION CASCADE">
          <Text style={styles.cascadeInfo}>
            {aiPriority === 'gemini_first'
              ? 'VASTRA tries Gemini first, then Ollama, then manual entry.'
              : 'VASTRA tries Ollama first, then Gemini, then manual entry.'}
          </Text>
          {aiPriority === 'gemini_first' ? (
            <>
              <CascadeRow dotColor={geminiStatus === 'connected' ? colors.teal : geminiKey ? colors.amber : 'rgba(255,255,255,0.2)'} label="1. Google Gemini" badge={geminiStatus === 'connected' ? 'Connected' : geminiKey ? 'Key saved' : 'Not set'} badgeColor={geminiStatus === 'connected' ? colors.teal : geminiKey ? colors.amber : 'rgba(255,255,255,0.3)'} />
              <CascadeRow dotColor={connStatus === 'connected' ? colors.teal : 'rgba(255,255,255,0.2)'} label="2. Ollama Server" badge={connStatus === 'connected' ? 'Connected' : 'Offline'} badgeColor={connStatus === 'connected' ? colors.teal : 'rgba(255,255,255,0.3)'} />
            </>
          ) : (
            <>
              <CascadeRow dotColor={connStatus === 'connected' ? colors.teal : 'rgba(255,255,255,0.2)'} label="1. Ollama Server" badge={connStatus === 'connected' ? 'Connected' : 'Offline'} badgeColor={connStatus === 'connected' ? colors.teal : 'rgba(255,255,255,0.3)'} />
              <CascadeRow dotColor={geminiStatus === 'connected' ? colors.teal : geminiKey ? colors.amber : 'rgba(255,255,255,0.2)'} label="2. Google Gemini" badge={geminiStatus === 'connected' ? 'Connected' : geminiKey ? 'Key saved' : 'Not set'} badgeColor={geminiStatus === 'connected' ? colors.teal : geminiKey ? colors.amber : 'rgba(255,255,255,0.3)'} />
            </>
          )}
          <CascadeRow dotColor={colors.blue} label="On-Device AI" badge="Active" badgeColor={colors.blue} />
          <CascadeRow dotColor={colors.amber} label="Manual Entry" badge="Always available" badgeColor={colors.amber} />

          <TouchableOpacity style={styles.priorityToggleBtn} onPress={handleToggleAIPriority}>
            <Text style={styles.priorityToggleText}>
              Switch to {aiPriority === 'gemini_first' ? 'Ollama-first' : 'Gemini-first'} mode
            </Text>
          </TouchableOpacity>
        </Section>

        {/* ── Data Management ─── */}
        <Section label="DATA MANAGEMENT">
          <NavRow
            label="Import Data"
            iconPath="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
            iconColor={colors.teal}
            onPress={() => router.push('/data/upload' as never)}
          />

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/po/deleted' as never)}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.actionRowText}>Deleted POs</Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.clearBtn} onPress={handleClearDemoData}>
            <Text style={styles.clearBtnText}>Reset Demo Data</Text>
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
          <InfoRow label="Version" value="v1.0.0-beta" accent={colors.teal} />
          <InfoRow label="Build" value="2026-04-01" />
          <Text style={styles.brandCredit}>Built with The Architect</Text>
        </Section>

        {/* ── Procurement ─── */}
        <Section label="PROCUREMENT">
          <NavRow
            label="Seasonal Planning"
            iconPath="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
            iconColor={colors.amber}
            onPress={() => router.push('/seasonal' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Refill Engine"
            iconPath="M4 4h16v16H4zM4 12h16M12 4v16"
            iconColor={colors.teal}
            onPress={() => router.push('/refill' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Purchase Trips"
            iconPath="M3 21l1.9-5.7a8.5 8.5 0 113.8 3.8L3 21"
            iconColor={colors.purple}
            onPress={() => router.push('/trips' as never)}
          />
          {deletedPoCount > 0 && (
            <>
              <View style={styles.divider} />
              <NavRow
                label="Deleted POs"
                iconPath="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                iconColor={colors.red}
                badge={String(deletedPoCount)}
                badgeColor={colors.red}
                onPress={() => router.push('/po/deleted' as never)}
              />
            </>
          )}
        </Section>

        {/* ── Warehouse ─── */}
        <Section label="WAREHOUSE">
          <NavRow
            label="Stock Pool"
            iconPath="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            iconColor={colors.blue}
            onPress={() => router.push('/stock' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Dispatch Notes"
            iconPath="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7v5l3 3"
            iconColor={colors.teal}
            onPress={() => router.push('/stock/dispatch' as never)}
          />
        </Section>

        {/* ── Intelligence ─── */}
        <Section label="INTELLIGENCE">
          <NavRow
            label="Pricing Intelligence"
            iconPath="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            iconColor={colors.amber}
            onPress={() => router.push('/pricing' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Price Watch"
            iconPath="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            iconColor={colors.amber}
            onPress={() => router.push('/competition' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Similar Products"
            iconPath="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            iconColor={colors.blue}
            onPress={() => router.push('/similarity' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Reports"
            iconPath="M18 20V10M12 20V4M6 20v-6"
            iconColor={colors.purple}
            onPress={() => router.push('/reports' as never)}
          />
        </Section>

        {/* ── People ─── */}
        <Section label="PEOPLE">
          <NavRow
            label="Customer Demands"
            iconPath="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z"
            iconColor={colors.purple}
            onPress={() => router.push('/demand' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Notifications"
            iconPath="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
            iconColor={colors.teal}
            badge={unreadNotifs > 0 ? String(unreadNotifs) : undefined}
            badgeColor={colors.red}
            onPress={() => router.push('/notifications' as never)}
          />
        </Section>

        {/* ── Data ─── */}
        <Section label="DATA">
          <NavRow
            label="Export Center"
            iconPath="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            iconColor={colors.amber}
            onPress={() => router.push('/exports' as never)}
          />
          <View style={styles.divider} />
          <NavRow
            label="Data Upload"
            iconPath="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4-4 4M12 4v12"
            iconColor={colors.teal}
            onPress={() => router.push('/data/upload' as never)}
          />
        </Section>

        {/* ── Logout ─── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={colors.red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 60,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.teal + '33',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchRowText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  header: { marginBottom: 20, marginTop: 8 },
  screenLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  profileBody: { flex: 1 },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  // Section
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

  // Action rows (tappable)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  actionRowText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_500Medium',
  },
  navBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    marginRight: 4,
  },
  navBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  // PIN flow
  pinFlowContainer: { alignItems: 'center', paddingVertical: 8 },
  pinFlowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  pinError: {
    fontSize: 13,
    color: colors.red,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  pinCancelBtn: { marginTop: 12, padding: 8 },
  pinCancelText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },

  // Ollama connection
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
  connSpinner: { marginLeft: 4 },
  aiButtonsRow: { flexDirection: 'row', gap: 10 },
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
  saveUrlBtn: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveUrlBtnText: {
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

  // Data management
  clearBtn: {
    marginTop: 10,
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
    marginTop: 4,
  },

  // AI sub-cards
  aiSubCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  aiSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiSubTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  aiSubBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiSubBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  aiSubInfo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    lineHeight: 18,
  },
  geminiKeyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  geminiKeyInput: {
    flex: 1,
  },
  showHideBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  showHideBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_500Medium',
  },
  getKeyBtn: {
    backgroundColor: 'rgba(93,202,165,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getKeyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
  priorityToggleBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  priorityToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_700Bold',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(226,75,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.red,
    fontFamily: 'Inter_700Bold',
  },
});
