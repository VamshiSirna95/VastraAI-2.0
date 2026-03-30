import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import GlassPicker from '../../components/ui/GlassPicker';
import SizeQtyMatrix from '../../components/SizeQtyMatrix';
import { DeliveryCard } from '../../components/DeliveryCard';
import {
  createPO, updatePO, getPOById, addPOItem, updatePOItem, removePOItem,
  getVendors, getTrips, updateTripSpent,
} from '../../db/database';
import { calculateDelivery, formatDate, type DeliverySchedule } from '../../services/delivery';
import type { PurchaseOrder, POItem, Vendor, PurchaseTrip } from '../../db/types';
import { SIZE_TEMPLATES } from '../../db/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN');
}

const SIZE_COLS = ['size_s', 'size_m', 'size_l', 'size_xl', 'size_xxl', 'size_free'] as const;
type SizeCol = typeof SIZE_COLS[number];

/** Map garment-type size labels → DB columns by positional index */
function sizesToDB(garmentType: string, sizes: Record<string, number>): Pick<POItem, SizeCol> {
  const labels = SIZE_TEMPLATES[garmentType] ?? SIZE_TEMPLATES['default'];
  const result: Pick<POItem, SizeCol> = { size_s: 0, size_m: 0, size_l: 0, size_xl: 0, size_xxl: 0, size_free: 0 };
  if (labels.length === 1 && labels[0] === 'Free') {
    result.size_free = sizes['Free'] ?? 0;
    return result;
  }
  labels.forEach((label, idx) => {
    if (idx < SIZE_COLS.length) {
      result[SIZE_COLS[idx]] = sizes[label] ?? 0;
    }
  });
  return result;
}

/** Map DB columns → garment-type size labels by positional index */
function dbToSizes(garmentType: string, item: POItem): Record<string, number> {
  const labels = SIZE_TEMPLATES[garmentType] ?? SIZE_TEMPLATES['default'];
  if (labels.length === 1 && labels[0] === 'Free') return { 'Free': item.size_free };
  const colValues = [item.size_s, item.size_m, item.size_l, item.size_xl, item.size_xxl, item.size_free];
  const out: Record<string, number> = {};
  labels.forEach((label, idx) => { out[label] = colValues[idx] ?? 0; });
  return out;
}

type EnrichedItem = POItem & { design_name?: string; garment_type?: string; purchase_price?: number };

// ── Article card ──────────────────────────────────────────────────────────────

interface ArticleCardProps {
  item: EnrichedItem;
  expanded: boolean;
  onToggle: () => void;
  localSizes: Record<string, number>;
  onSizesChange: (sizes: Record<string, number>, totalQty: number, totalPrice: number) => void;
  onRemove: () => void;
  unitPrice: number;
  onUnitPriceChange: (val: number) => void;
}

function ArticleCard({
  item, expanded, onToggle, localSizes, onSizesChange, onRemove, unitPrice, onUnitPriceChange,
}: ArticleCardProps) {
  const name = item.design_name ?? 'Unknown product';
  const garmentType = item.garment_type ?? 'default';
  const totalQty = Object.values(localSizes).reduce((a, b) => a + b, 0);
  const totalPrice = totalQty * unitPrice;

  return (
    <View style={styles.articleCard}>
      <TouchableOpacity style={styles.articleHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={[styles.articleThumb, { backgroundColor: hexToRgba(colors.teal, 0.12) }]}>
          <Text style={[styles.thumbInitial, { color: colors.teal }]}>
            {(name[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={styles.articleHeaderBody}>
          <Text style={styles.articleName} numberOfLines={1}>{name}</Text>
          <Text style={styles.articleSub}>{garmentType}</Text>
          {totalQty > 0 && (
            <Text style={styles.articleQtySummary}>{totalQty} pcs · {formatINR(totalPrice)}</Text>
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
              value={unitPrice ? String(unitPrice) : ''}
              onChangeText={(v) => onUnitPriceChange(parseFloat(v) || 0)}
              keyboardType="numeric"
              placeholder="Enter price"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </View>
          <SizeQtyMatrix
            garmentType={garmentType}
            sizes={localSizes}
            unitPrice={unitPrice}
            onChange={onSizesChange}
          />
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NewPOScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string; tripId?: string }>();

  const isEditing = !!params.editId;
  const [poId, setPoId] = useState<string | null>(params.editId ?? null);
  const [po, setPo] = useState<Partial<PurchaseOrder>>({ status: 'draft' });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [trips, setTrips] = useState<PurchaseTrip[]>([]);
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [localSizes, setLocalSizes] = useState<Record<string, Record<string, number>>>({});
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule | null>(null);
  const [saving, setSaving] = useState(false);

  // Load vendors + trips on mount; pre-fill if editing
  useEffect(() => {
    (async () => {
      const [vs, ts] = await Promise.all([getVendors(), getTrips()]);
      setVendors(vs);
      setTrips(ts.filter((t) => t.status === 'active' || t.status === 'planning' as string));

      if (params.tripId && !isEditing) {
        setPo((prev) => ({ ...prev, trip_id: params.tripId }));
      }

      if (isEditing && params.editId) {
        const existing = await getPOById(params.editId);
        if (existing) {
          setPo({
            vendor_id: existing.vendor_id,
            trip_id: existing.trip_id,
            status: existing.status,
          });
          setNotes(existing.notes ?? '');
          setDeliveryDate(existing.delivery_date ?? '');
        }
      }
    })();
  }, []);

  // Load/reload items from DB whenever screen comes into focus
  useFocusEffect(useCallback(() => {
    if (poId) reloadItems();
  }, [poId]));

  // Compute smart delivery when vendor is selected
  useEffect(() => {
    calculateDelivery(0, 1).then((s) => {
      setDeliverySchedule(s);
      if (!deliveryDate) setDeliveryDate(formatDate(s.storeShelfDate));
    });
  }, [po.vendor_id]);

  const reloadItems = async () => {
    if (!poId) return;
    const updated = await getPOById(poId);
    if (updated?.items) {
      const enriched = updated.items as EnrichedItem[];
      setItems(enriched);

      // Init localSizes from DB (garment-type-aware)
      const newLocalSizes: Record<string, Record<string, number>> = {};
      const newUnitPrices: Record<string, number> = {};
      enriched.forEach((i) => {
        newLocalSizes[i.id] = dbToSizes(i.garment_type ?? 'default', i);
        // Use purchase_price as fallback when unit_price is 0
        newUnitPrices[i.id] = i.unit_price > 0 ? i.unit_price : ((i.purchase_price ?? 0));
      });
      setLocalSizes((prev) => ({ ...newLocalSizes, ...prev }));
      setUnitPrices((prev) => {
        const merged: Record<string, number> = { ...newUnitPrices };
        // keep user-edited prices
        Object.keys(prev).forEach((k) => { if (prev[k] > 0) merged[k] = prev[k]; });
        return merged;
      });
    }
  };

  const ensurePO = async (): Promise<string> => {
    if (poId) return poId;
    if (!po.vendor_id) throw new Error('Select a vendor first');
    const id = await createPO({ ...po, notes, delivery_date: deliveryDate || undefined });
    setPoId(id);
    return id;
  };

  const handleSaveDraft = async () => {
    if (!po.vendor_id) { Alert.alert('Required', 'Please select a vendor'); return; }
    setSaving(true);
    try {
      const id = await ensurePO();
      await updatePO(id, { ...po, notes, delivery_date: deliveryDate || undefined, status: 'draft' });
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
      await updatePO(id, { ...po, notes, delivery_date: deliveryDate || undefined, status: 'sent' });
      if (po.trip_id) await updateTripSpent(po.trip_id);
      router.replace(`/po/${id}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  // Compute live totals from local sizes state
  const totalQty = items.reduce((sum, i) => {
    const sizes = localSizes[i.id] ?? {};
    return sum + Object.values(sizes).reduce((a, b) => a + b, 0);
  }, 0);
  const totalValue = items.reduce((sum, i) => {
    const sizes = localSizes[i.id] ?? {};
    const qty = Object.values(sizes).reduce((a, b) => a + b, 0);
    return sum + qty * (unitPrices[i.id] ?? 0);
  }, 0);
  const totalArticles = items.filter((i) => {
    const sizes = localSizes[i.id] ?? {};
    return Object.values(sizes).some((v) => v > 0);
  }).length;

  const selectedTrip = trips.find((t) => t.id === po.trip_id);
  const spentAfter = (selectedTrip?.spent ?? 0) + totalValue;
  const budgetPct = selectedTrip ? Math.round((spentAfter / (selectedTrip.budget || 1)) * 100) : 0;
  const overBudget = selectedTrip && spentAfter > selectedTrip.budget;

  // Build trip picker options showing budget
  const tripPickerOptions = [
    'No trip',
    ...trips.map((t) => `${t.name} (${formatINR(t.budget)})`),
    '＋ New Trip',
  ];
  const selectedTripDisplay = po.trip_id
    ? (trips.find((t) => t.id === po.trip_id) ? `${trips.find((t) => t.id === po.trip_id)!.name} (${formatINR(trips.find((t) => t.id === po.trip_id)!.budget)})` : 'No trip')
    : 'No trip';

  const vendorNames = vendors.map((v) => v.name);

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
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Purchase Order' : 'New Purchase Order'}</Text>
        </View>

        {/* PO Info */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>PO INFO</Text>
          <View style={styles.poNumberRow}>
            <Text style={styles.fieldLabel}>PO Number</Text>
            <Text style={styles.poNumberValue}>{poId ? '—' : 'Auto-generated on save'}</Text>
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
            options={tripPickerOptions}
            value={selectedTripDisplay}
            placeholder="No trip"
            onChange={(val) => {
              if (val === 'No trip') {
                setPo((prev) => ({ ...prev, trip_id: undefined }));
              } else if (val === '＋ New Trip') {
                router.push('/po/trip/new');
              } else {
                const t = trips.find((tt) => val.startsWith(tt.name));
                if (t) setPo((prev) => ({ ...prev, trip_id: t.id }));
              }
            }}
          />
          <Text style={styles.fieldLabel}>Requested Delivery Date (DD-Mon-YYYY)</Text>
          <TextInput
            style={styles.inlineInput}
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="e.g. 15-Apr-2026"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Notes</Text>
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

        {/* Smart Delivery Recommendation */}
        {deliverySchedule && (
          <View style={styles.deliverySection}>
            <DeliveryCard schedule={deliverySchedule} />
          </View>
        )}

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
              localSizes={localSizes[item.id] ?? dbToSizes(item.garment_type ?? 'default', item)}
              unitPrice={unitPrices[item.id] ?? 0}
              onUnitPriceChange={(val) => {
                setUnitPrices((prev) => ({ ...prev, [item.id]: val }));
                // Persist to DB in background
                const dbSizes = sizesToDB(item.garment_type ?? 'default', localSizes[item.id] ?? {});
                updatePOItem(item.id, { ...dbSizes, unit_price: val });
              }}
              onSizesChange={(sizes, _qty, _price) => {
                // Immediately update local state for live summary
                setLocalSizes((prev) => ({ ...prev, [item.id]: sizes }));
                // Persist to DB in background
                const dbSizes = sizesToDB(item.garment_type ?? 'default', sizes);
                updatePOItem(item.id, { ...dbSizes, unit_price: unitPrices[item.id] ?? 0 });
              }}
              onRemove={() => {
                removePOItem(item.id).then(reloadItems);
                setLocalSizes((prev) => {
                  const next = { ...prev };
                  delete next[item.id];
                  return next;
                });
                setItems((prev) => prev.filter((i) => i.id !== item.id));
              }}
            />
          ))}

          <TouchableOpacity
            style={styles.addArticleBtn}
            onPress={async () => {
              try {
                const id = await ensurePO();
                router.push(`/po/select-products?poId=${id}`);
              } catch {
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
            <Text style={styles.summaryValue}>{totalArticles}</Text>
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
    flex: 1,
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
  deliverySection: {
    marginHorizontal: 20,
    marginBottom: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.teal,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  inlineInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
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
  unitPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
    width: 120,
    textAlign: 'right',
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
  budgetBarFill: { height: 6, borderRadius: 3 },
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
