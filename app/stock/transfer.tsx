import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import * as Haptics from 'expo-haptics';
import {
  getStores, getProductStockAcrossStores, createTransfer,
} from '../../db/database';
import type { Store, StoreStock } from '../../db/types';
import { SIZE_TEMPLATES } from '../../db/types';

export default function TransferScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();

  const [stores, setStores] = useState<Store[]>([]);
  const [stockRows, setStockRows] = useState<StoreStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fromStoreId, setFromStoreId] = useState<number | null>(null);
  const [toStoreId, setToStoreId] = useState<number | null>(null);
  const [transferQtys, setTransferQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [storeList, stock] = await Promise.all([
        getStores(),
        getProductStockAcrossStores(productId),
      ]);
      setStores(storeList);
      setStockRows(stock);
      // Default from-store: store with highest stock
      if (stock.length > 0 && fromStoreId === null) {
        setFromStoreId(stock[0].store_id);
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Derived state
  const fromStockRow = stockRows.find((r) => r.store_id === fromStoreId);
  const fromStock: Record<string, number> = fromStockRow?.size_stock ?? {};
  const garmentType = fromStockRow?.garment_type ?? stockRows[0]?.garment_type ?? '';
  const productName = fromStockRow?.design_name ?? stockRows[0]?.design_name ?? productId ?? '—';
  const sizeLabels = SIZE_TEMPLATES[garmentType] ?? SIZE_TEMPLATES['default'];

  // Init transferQtys when fromStore changes
  const resetQtys = useCallback(() => {
    const init: Record<string, string> = {};
    sizeLabels.forEach((s) => { init[s] = '0'; });
    setTransferQtys(init);
  }, [sizeLabels.join(',')]);

  // When fromStoreId changes, reset quantities
  React.useEffect(() => {
    resetQtys();
  }, [fromStoreId]);

  const availableToStores = stores.filter((s) => s.id !== fromStoreId && s.is_active);

  const totalTransferQty = sizeLabels.reduce(
    (sum, s) => sum + (parseInt(transferQtys[s] || '0', 10) || 0),
    0,
  );

  // Validate
  const sizeErrors: Record<string, string> = {};
  for (const size of sizeLabels) {
    const requested = parseInt(transferQtys[size] || '0', 10) || 0;
    const available = fromStock[size] ?? 0;
    if (requested > available) {
      sizeErrors[size] = `Max ${available}`;
    }
  }
  const hasErrors = Object.keys(sizeErrors).length > 0;
  const canSubmit = !hasErrors && totalTransferQty > 0 && fromStoreId != null && toStoreId != null;

  const handleSubmit = async () => {
    if (!canSubmit || !productId || fromStoreId == null || toStoreId == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sizeMap: Record<string, number> = {};
    for (const s of sizeLabels) {
      const v = parseInt(transferQtys[s] || '0', 10) || 0;
      if (v > 0) sizeMap[s] = v;
    }
    setSaving(true);
    try {
      await createTransfer(fromStoreId, toStoreId, productId, sizeMap, reason.trim() || undefined);
      Alert.alert('Transfer Requested', `${totalTransferQty} units requested for transfer.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to create transfer request.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.loader}><ActivityIndicator color={colors.teal} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PRODUCT</Text>
          <View style={styles.productPill}>
            <Text style={styles.productPillText} numberOfLines={1}>{productName}</Text>
            {garmentType ? <Text style={styles.productPillType}>{garmentType}</Text> : null}
          </View>
        </View>

        {/* From Store */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FROM STORE</Text>
          <View style={styles.storeGrid}>
            {stores.filter((s) => s.is_active).map((s) => {
              const sRow = stockRows.find((r) => r.store_id === s.id);
              const qty = sRow?.total_qty ?? 0;
              const active = fromStoreId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.storeChip, active && styles.storeChipActive]}
                  onPress={() => { setFromStoreId(s.id); setToStoreId(null); }}
                >
                  <Text style={[styles.storeChipName, active && styles.storeChipNameActive]}>{s.name}</Text>
                  <Text style={[styles.storeChipQty, { color: qty === 0 ? colors.red : qty < 5 ? colors.amber : colors.teal }]}>
                    {qty} units
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* To Store */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TO STORE</Text>
          {availableToStores.length === 0 ? (
            <Text style={styles.noStoreText}>Select a different From store first.</Text>
          ) : (
            <View style={styles.storeGrid}>
              {availableToStores.map((s) => {
                const sRow = stockRows.find((r) => r.store_id === s.id);
                const qty = sRow?.total_qty ?? 0;
                const active = toStoreId === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.storeChip, active && styles.storeChipBlue]}
                    onPress={() => setToStoreId(s.id)}
                  >
                    <Text style={[styles.storeChipName, active && styles.storeChipNameBlue]}>{s.name}</Text>
                    <Text style={[styles.storeChipQty, { color: qty === 0 ? colors.red : qty < 5 ? colors.amber : colors.teal }]}>
                      {qty} units
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Size-wise quantities */}
        {fromStoreId != null && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TRANSFER QUANTITIES</Text>
            <View style={styles.sizeGrid}>
              {sizeLabels.map((size) => {
                const available = fromStock[size] ?? 0;
                const val = transferQtys[size] ?? '0';
                const err = sizeErrors[size];
                return (
                  <View key={size} style={styles.sizeCell}>
                    <Text style={styles.sizeLabelText}>{size}</Text>
                    <Text style={styles.availableText}>/{available}</Text>
                    <TextInput
                      style={[styles.sizeInput, err ? styles.sizeInputError : null]}
                      value={val}
                      onChangeText={(v) => {
                        const cleaned = v.replace(/[^0-9]/g, '');
                        setTransferQtys((prev) => ({ ...prev, [size]: cleaned }));
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      maxLength={3}
                    />
                    {err ? <Text style={styles.errText}>{err}</Text> : null}
                  </View>
                );
              })}
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Transfer</Text>
              <Text style={[styles.totalQty, { color: totalTransferQty > 0 ? colors.teal : 'rgba(255,255,255,0.3)' }]}>
                {totalTransferQty} units
              </Text>
            </View>
          </View>
        )}

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REASON (OPTIONAL)</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Low stock at destination store"
            placeholderTextColor="rgba(255,255,255,0.2)"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Request Transfer</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      <View style={styles.headerBody}>
        <Text style={styles.screenLabel}>INVENTORY</Text>
        <Text style={styles.screenTitle}>Transfer Stock</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  screenLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },

  productPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productPillText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  productPillType: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },

  storeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  storeChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 90,
  },
  storeChipActive: {
    backgroundColor: colors.teal + '22',
    borderColor: colors.teal + '55',
  },
  storeChipBlue: {
    backgroundColor: colors.blue + '22',
    borderColor: colors.blue + '55',
  },
  storeChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_700Bold',
  },
  storeChipNameActive: { color: colors.teal },
  storeChipNameBlue: { color: colors.blue },
  storeChipQty: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  noStoreText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
  },

  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sizeCell: { alignItems: 'center', minWidth: 52 },
  sizeLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 2,
  },
  availableText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  sizeInput: {
    width: 52,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    padding: 0,
  },
  sizeInputError: {
    borderColor: colors.red + '88',
    backgroundColor: colors.red + '11',
  },
  errText: {
    fontSize: 9,
    color: colors.red,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    textAlign: 'center',
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  totalLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  totalQty: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  reasonInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
    minHeight: 72,
  },

  submitBtn: {
    backgroundColor: colors.blue + '33',
    borderWidth: 1,
    borderColor: colors.blue + '66',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: 'Inter_700Bold',
  },
});
