import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/theme';
import { globalSearch } from '../db/database';
import type { GlobalSearchResults } from '../db/database';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const RESULT_ICON: Record<string, string> = {
  product:  'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z',
  vendor:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
  po:       'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z',
  demand:   'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
};

const RESULT_COLOR: Record<string, string> = {
  product: colors.teal,
  vendor:  colors.blue,
  po:      colors.amber,
  demand:  colors.purple,
};

export default function GlobalSearch({ visible, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await globalSearch(q);
      setResults(r);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(text), 300);
  };

  const navigate = (path: string, params?: Record<string, string>) => {
    onClose();
    setTimeout(() => router.push({ pathname: path as never, params }), 150);
  };

  const hasResults = results && (
    results.products.length + results.vendors.length +
    results.pos.length + results.demands.length > 0
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={handleChange}
            placeholder="Search products, vendors, POs, demands…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {loading ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : query.length > 0 ? (
            <TouchableOpacity onPress={() => { setQuery(''); setResults(null); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        <ScrollView
          style={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {query.trim().length >= 2 && !loading && !hasResults && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nothing found for "{query}"</Text>
            </View>
          )}

          {results && results.products.length > 0 && (
            <ResultSection title="PRODUCTS">
              {results.products.map((p) => (
                <ResultRow
                  key={p.id}
                  type="product"
                  title={p.name || 'Unnamed'}
                  subtitle={[p.garment_type, p.primary_color].filter(Boolean).join(' · ')}
                  onPress={() => navigate('/product/[id]', { id: p.id })}
                />
              ))}
            </ResultSection>
          )}

          {results && results.vendors.length > 0 && (
            <ResultSection title="VENDORS">
              {results.vendors.map((v) => (
                <ResultRow
                  key={v.id}
                  type="vendor"
                  title={v.name}
                  subtitle={[v.area, v.city].filter(Boolean).join(', ')}
                  onPress={() => navigate('/vendors/[id]', { id: v.id })}
                />
              ))}
            </ResultSection>
          )}

          {results && results.pos.length > 0 && (
            <ResultSection title="PURCHASE ORDERS">
              {results.pos.map((p) => (
                <ResultRow
                  key={p.id}
                  type="po"
                  title={p.po_number}
                  subtitle={[p.vendor_name, p.status].filter(Boolean).join(' · ')}
                  onPress={() => navigate('/po/[id]', { id: p.id })}
                />
              ))}
            </ResultSection>
          )}

          {results && results.demands.length > 0 && (
            <ResultSection title="CUSTOMER DEMANDS">
              {results.demands.map((d) => (
                <ResultRow
                  key={d.id}
                  type="demand"
                  title={d.customer_name ?? d.description.slice(0, 40)}
                  subtitle={d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                  onPress={() => { onClose(); setTimeout(() => router.push('/demand' as never), 150); }}
                />
              ))}
            </ResultSection>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ResultRow({
  type, title, subtitle, onPress,
}: {
  type: keyof typeof RESULT_ICON;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const iconPath = RESULT_ICON[type];
  const iconColor = RESULT_COLOR[type];
  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.resultIcon, { backgroundColor: iconColor + '22', borderColor: iconColor + '33' }]}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d={iconPath} stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.resultSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.typeBadge, { backgroundColor: iconColor + '15', borderColor: iconColor + '30' }]}>
        <Text style={[styles.typeBadgeText, { color: iconColor }]}>{type}</Text>
      </View>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  clearBtn: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 4,
  },
  closeBtn: { paddingLeft: 4 },
  closeBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_400Regular',
  },

  resultsList: { flex: 1, paddingHorizontal: 16 },

  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 6,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultBody: { flex: 1 },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  resultSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
