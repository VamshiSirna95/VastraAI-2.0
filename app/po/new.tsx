import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import GlassPicker from '../../components/ui/GlassPicker';
import SizeQtyMatrix from '../../components/SizeQtyMatrix';
import { DeliveryCard } from '../../components/DeliveryCard';
import {
  createPO, updatePO, getPOById, addPOItem, updatePOItem, removePOItem,
  getVendors, getTrips, updateTripSpent,
} from '../../db/database';
import { calculateDelivery, type DeliverySchedule } from '../../services/delivery';
import type { PurchaseOrder, POItem, Vendor, PurchaseTrip } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN');
}

// ── Delivery Calculator inline ────────────────────────────────────────────────

interface DeliveryCalcProps {
  onSchedule: (s: DeliverySchedule | null) => void;
  initialSchedule: DeliverySchedule | null;
}

function DeliveryCalc({ onSchedule, initialSchedule }: DeliveryCalcProps) {
  const [stock, setStock] = useState('');
  const [dailySales, setDailySales] = useState('');
  const [schedule, setSchedule] = useState<DeliverySchedule | null>(initialSchedule);

  const calculate = useCallback(async () => {
    const s = parseFloat(stock) || 0;
    const d = parseFloat(dailySales) || 0;
    const result = await calculateDelivery(s, d);
    setSchedule(result);
    onSchedule(result);
  }, [stock, dailySales, onSchedule]);

  useEffect(() => {
    if (stock || dailySales) { calculate(); }
  }, [stock, dailySales, calculate]);

  return (
    <View style={styles.deliveryCalcArea}>
      <Text style={styles.sectionLabel}>DELIVERY CALCULATOR</Text>
      <View style={styles.deliveryInputRow}>
        <View style={styles.deliveryInputWrap}>
          <Text style={styles.fieldLabel}>Current Stock</Text>
          <TextInput
            style={styles.smallInput}
            value={stock}
            onChangeText={setStock}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
        </View>
        <View style={styles.deliveryInputWrap}>
          <Text style={styles.fieldLabel}>Daily Avg Sales</Text>
          <TextInput
            style={styles.smallInput}
            value={dailySales}
            onChangeText={setDailySales}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
        </View>
      </View>
      {schedule && <DeliveryCard schedule={schedule} />}
    </View>
  );
}

// ── Article card ──────────────────────────────────────────────────────────────

interface ArticleCardProps {
  item: POItem & { design_name?: string; garment_type?: string; purchase_price?: number };
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (sizes: Record<string, number>, totalQty: number, totalPrice: number) => void;
  onRemove: () => void;
  unitPrice: number;
  onUnitPriceChange: (val: number) => void;
}

function ArticleCard({ item, expanded, onToggle, onUpdate, onRemove, unitPrice, onUnitPriceChange }: ArticleCardProps) {
  const [schedule, setSchedule] = useState<DeliverySchedule | null>(null);
  const name = item.design_name ?? 'Unknown product';
  const garmentType = item.garment_type ?? 'default';

  const currentSizes: Record<string, number> = {
    S: item.size_s, M: item.size_m, L: item.size_l,
    XL: item.size_xl, XXL: item.size_xxl, Free: item.size_free,
  };

  return (
    <View style={styles.articleCard}>
      <TouchableOpacity style={styles.articleHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={[styles.articleThumb, { backgroundColor: hexToRgba(colors.teal, 0.12) }]}>
          <Text style={[styles.thumbInitial, { color: colors.teal }]}>
            {name[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.articleHeaderBody}>
          <Text style={styles.articleName} numberOfLines={1}>{name}</Text>
          <Text style={styles.articleSub}>{garmentType}</Text>
          {item.total_qty > 0 && (
            <Text style={styles.articleQtySummary}>{item.total_qty} pcs · {formatINR(item.total_price)}</Text>
          )}
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.articleExpanded}>
          <View style={styles.unitPriceRow}>
            <Text style={styles.fieldLabel}>Unit Price (₹)</Text>
            <TextInput
              style={styles.unitPriceInput}
              value={String(unitPrice || '')}
              onChangeText={(v) => onUnitPriceChange(parseFloat(v) || 0)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </View>
          <SizeQtyMatrix
            garmentType={garmentType}
            sizes={currentSizes}
            unitPrice={unitPrice}
            onChange={onUpdate}
          />
          <DeliveryCalc onSchedule={setSchedule} initialSchedule={schedule} />
          <View style={styles.itemNotesWrap}>
            <Text style={styles.fieldLabel}>Item Notes</Text>
            <TextInput
              style={styles.itemNotesInput}
              value={item.notes ?? ''}
              placeholder="e.g. Shorten sleeve 2 inches"
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NewPOScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ selectedProductIds?: string }>();

  const [poId, setPoId] = useState<string | null>(null);
  const [po, setPo] = useState<Partial<PurchaseOrder>>({ status: 'draft' });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [trips, setTrips] = useState<PurchaseTrip[]>([]);
  const [items, setItems] = useState<(POItem & { design_name?: string; garment_type?: string; purchase_price?: number })[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [vs, ts] = await Promise.all([getVendors(), getTrips('active')]);
      setVendors(vs);
      setTrips(ts);
    })();
  }, []);

  // Handle products returned from product picker
  useEffect(() => {
    if (!params.selectedProductIds || !poId) return;
    const ids: string[] = JSON.parse(params.selectedProductIds);
    (async () => {
      for (const productId of ids) {
        const alreadyAdded = items.some((i) => i.product_id === productId);
        if (!alreadyAdded) {
          await addPOItem({ po_id: poId, product_id: productId });
        }
      }
      await reloadItems();
    })();
  }, [params.selectedProductIds]);

  const reloadItems = async () => {
    if (!poId) return;
    const updated = await getPOById(poId);
    if (updated?.items) {
      const enriched = updated.items as (POItem & { design_name?: string; garment_type?: string; purchase_price?: number })[];
      setItems(enriched);
      const prices: Record<string, number> = {};
      enriched.forEach((i) => { prices[i.id] = i.unit_price; });
      setUnitPrices((prev) => ({ ...prices, ...prev }));
    }
  };

  const ensurePO = async (): Promise<string> => {
    if (poId) return poId;
    if (!po.vendor_id) throw new Error('Select a vendor first');
    const id = await createPO({ ...po, notes });
    setPoId(id);
    return id;
  };

  const handleSaveDraft = async () => {
    if (!po.vendor_id) { Alert.alert('Required', 'Please select a vendor'); return; }
    setSaving(true);
    try {
      const id = await ensurePO();
      await updatePO(id, { ...po, notes, status: 'draft' });
      if (po.trip_id) await updateTripSpent(po.trip_id);
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePO = async () => {
    if (!po.vendor_id) { Alert.alert('Required', 'Please select a vendor'); return; }
    setSaving(true);
    try {
      const id = await ensurePO();
      await updatePO(id, { ...po, notes, status: 'sent' });
      if (po.trip_id) await updateTripSpent(po.trip_id);
      router.push(`/po/${id}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  const totalValue = items.reduce((sum, i) => sum + i.total_price, 0);
  const totalQty = items.reduce((sum, i) => sum + i.total_qty, 0);
  const selectedTrip = trips.find((t) => t.id === po.trip_id);
  const spentAfter = (selectedTrip?.spent ?? 0) + totalValue;
  const budgetPct = selectedTrip ? Math.round((spentAfter / selectedTrip.budget) * 100) : 0;
  const overBudget = selectedTrip && spentAfter > selectedTrip.budget;

  const vendorNames = vendors.map((v) => v.name);
  const tripNames = ['No trip', ...trips.map((t) => t.name)];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Purchase Order</Text>
        </View>

        {/* PO Info */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>PO INFO</Text>
          <View style={styles.poNumberRow}>
            <Text style={styles.fieldLabel}>PO Number</Text>
            <Text style={styles.poNumberValue}>Auto-generated on save</Text>
          </View>
          <GlassPicker
            label="Vendor"
            options={vendorNames}
            value={vendors.find((v) => v.id === po.vendor_id)?.name}
            placeholder="Select vendor…"
            onChange={(name) => {
              const v = vendors.find((vv) => vv.name === name);
              if (v) setPo((prev) => ({ ...prev, vendor_id: v.id }));
            }}
          />
          <GlassPicker
            label="Purchase Trip"
            options={tripNames}
            value={po.trip_id ? trips.find((t) => t.id === po.trip_id)?.name : 'No trip'}
            placeholder="No trip"
            onChange={(name) => {
              if (name === 'No trip') {
                setPo((prev) => ({ ...prev, trip_id: undefined }));
              } else {
                const t = trips.find((tt) => tt.name === name);
                if (t) setPo((prev) => ({ ...prev, trip_id: t.id }));
              }
            }}
          />
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes…"
            placeholderTextColor="rgba(255,255,255,0.2)"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Articles */}
        <View style={styles.glassCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>ARTICLES</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{items.length}</Text>
            </View>
          </View>

          {items.map((item) => (
            <ArticleCard
              key={item.id}
              item={item}
              expanded={expandedItemId === item.id}
              onToggle={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
              unitPrice={unitPrices[item.id] ?? item.unit_price}
              onUnitPriceChange={(val) => {
                setUnitPrices((prev) => ({ ...prev, [item.id]: val }));
                updatePOItem(item.id, { unit_price: val }).then(reloadItems);
              }}
              onUpdate={(sizes, totalQty, totalPrice) => {
                updatePOItem(item.id, {
                  size_s: sizes['S'] ?? 0,
                  size_m: sizes['M'] ?? 0,
                  size_l: sizes['L'] ?? 0,
                  size_xl: sizes['XL'] ?? 0,
                  size_xxl: sizes['XXL'] ?? 0,
                  size_free: sizes['Free'] ?? 0,
                  unit_price: unitPrices[item.id] ?? item.unit_price,
                }).then(reloadItems);
              }}
              onRemove={() => {
                removePOItem(item.id).then(reloadItems);
              }}
            />
          ))}

          <TouchableOpacity
            style={styles.addArticleBtn}
            onPress={async () => {
              try {
                const id = await ensurePO();
                router.push(`/po/select-products?poId=${id}`);
              } catch (e) {
                Alert.alert('Required', 'Please select a vendor first');
              }
            }}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={colors.amber} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
            <Text style={styles.addArticleText}>Add Article</Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={[styles.glassCard, styles.summaryCard]}>
          <Text style={styles.sectionLabel}>SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Articles</Text>
            <Text style={styles.summaryValue}>{items.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Quantity</Text>
            <Text style={styles.summaryValue}>{totalQty} pcs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={[styles.summaryValue, { color: colors.teal }]}>{formatINR(totalValue)}</Text>
          </View>

          {selectedTrip && (
            <View style={styles.budgetSection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Trip Budget</Text>
                <Text style={styles.summaryValue}>{formatINR(selectedTrip.budget)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Spent (incl. this PO)</Text>
                <Text style={[styles.summaryValue, { color: overBudget ? colors.red : colors.amber }]}>
                  {formatINR(spentAfter)}
                </Text>
              </View>
              <View style={styles.budgetBarBg}>
                <View style={[styles.budgetBarFill, {
                  width: `${Math.min(budgetPct, 100)}%`,
                  backgroundColor: budgetPct > 100 ? colors.red : budgetPct > 80 ? colors.amber : colors.teal,
                }]} />
              </View>
              <Text style={styles.budgetPct}>{budgetPct}% of budget used</Text>
              {overBudget && (
                <Text style={styles.overBudgetText}>
                  Over budget by {formatINR(spentAfter - selectedTrip.budget)}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Bottom buttons */}
        <View style={styles.bottomBtns}>
          <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft} disabled={saving}>
            <Text style={styles.draftBtnText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.generateBtn} onPress={handleGeneratePO} disabled={saving}>
            <Text style={styles.generateBtnText}>Generate PO</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  glassCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: 'rgba(93,202,165,0.04)',
    borderColor: 'rgba(93,202,165,0.12)',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  poNumberRow: { marginBottom: 12 },
  poNumberValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    minHeight: 72,
    textAlignVertical: 'top',
  },

  countBadge: {
    backgroundColor: 'rgba(93,202,165,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },

  articleCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  articleThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbInitial: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  articleHeaderBody: { flex: 1 },
  articleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  articleSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  articleQtySummary: {
    fontSize: 12,
    color: colors.teal,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  removeBtn: { padding: 4 },

  articleExpanded: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    gap: 12,
  },
  unitPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitPriceInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    width: 100,
    textAlign: 'right',
  },

  deliveryCalcArea: { marginTop: 4 },
  deliveryInputRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  deliveryInputWrap: { flex: 1 },
  smallInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  itemNotesWrap: { marginTop: 4 },
  itemNotesInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    minHeight: 56,
    textAlignVertical: 'top',
  },

  addArticleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
    backgroundColor: hexToRgba(colors.amber, 0.08),
    borderWidth: 1,
    borderColor: hexToRgba(colors.amber, 0.2),
    borderRadius: 10,
  },
  addArticleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.amber,
    fontFamily: 'Inter_700Bold',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  budgetSection: { marginTop: 8 },
  budgetBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 8,
  },
  budgetBarFill: {
    height: 6,
    borderRadius: 3,
  },
  budgetPct: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
  },
  overBudgetText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.red,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
    textAlign: 'right',
  },

  bottomBtns: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  draftBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  draftBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_700Bold',
  },
  generateBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.teal,
    alignItems: 'center',
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },
});
