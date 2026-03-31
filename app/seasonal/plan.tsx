import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import {
  getSeasonalPlan, getPlanItems, addPlanItem, updatePlanItem, deletePlanItem,
  updateSeasonalPlan, getVendors,
} from '../../db/database';
import type { SeasonalPlan, SeasonalPlanItem } from '../../db/types';
import type { Vendor } from '../../db/types';

// ── Seasonal defaults ─────────────────────────────────────────────────────────

const SEASONAL_DEFAULTS: Record<string, { colors: string; patterns: string; categories: string[] }> = {
  'Diwali Season': {
    colors: 'Red, Gold, Maroon, Mustard',
    patterns: 'Zari, Embroidery, Brocade, Printed',
    categories: ['Saree', 'Lehenga', 'Salwar Set', 'Kurta', 'Dupatta'],
  },
  'Navratri / Durga Puja': {
    colors: 'Chaniya (9 colors), Red, Yellow, Green',
    patterns: 'Mirror work, Bandhani, Gharchola',
    categories: ['Chaniya Choli', 'Salwar Set', 'Dupatta'],
  },
  'Wedding Season': {
    colors: 'Red, Gold, Pink, Royal Blue, Ivory',
    patterns: 'Heavy embroidery, Zari work, Stone work, Sequins',
    categories: ['Lehenga', 'Saree', 'Sherwani', 'Kurta', 'Indo-Western'],
  },
  'Ramadan / Eid': {
    colors: 'White, Ivory, Pastel Green, Sky Blue',
    patterns: 'Chikankari, Self-embossed, Lucknowi',
    categories: ['Kurta Set', 'Anarkali', 'Salwar Set', 'Dupatta'],
  },
  'Ugadi / Gudi Padwa': {
    colors: 'Green, Yellow, Orange, Pink',
    patterns: 'Printed, Kasuti, Ilkal, Ilkal Border',
    categories: ['Silk Saree', 'Salwar Set', 'Kurta'],
  },
  'Summer Collection': {
    colors: 'White, Pastels, Light Blue, Mint Green',
    patterns: 'Printed, Stripe, Checks, Dobby',
    categories: ['Cotton Kurta', 'T-Shirt', 'Shirt', 'Salwar Set'],
  },
  'Winter Collection': {
    colors: 'Maroon, Navy, Olive, Camel, Charcoal',
    patterns: 'Solid, Check, Woolen texture, Jacquard',
    categories: ['Sweater', 'Shawl', 'Blazer', 'Kurta'],
  },
  'Sankranti / Pongal': {
    colors: 'Yellow, Green, Orange',
    patterns: 'Temple border, Kanjivaram, Checks',
    categories: ['Silk Saree', 'Pavadai', 'Kurta'],
  },
  'Raksha Bandhan': {
    colors: 'Any festive color',
    patterns: 'Printed, Light embroidery',
    categories: ['Salwar Set', 'Lehenga', 'Kurta'],
  },
  'Ganesh Chaturthi': {
    colors: 'Yellow, Red, White, Green',
    patterns: 'Printed, Silk, Zari border',
    categories: ['Saree', 'Kurta Set', 'Salwar Set'],
  },
};

function getDefaults(name: string) {
  return SEASONAL_DEFAULTS[name] ?? { colors: '', patterns: '', categories: [] };
}

const PRIORITY_OPTS: SeasonalPlanItem['priority'][] = ['high', 'medium', 'low'];
const PRIORITY_COLOR: Record<string, string> = {
  high: colors.red,
  medium: colors.amber,
  low: colors.teal,
};

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item, vendors, onUpdate, onDelete,
}: {
  item: SeasonalPlanItem;
  vendors: Vendor[];
  onUpdate: (id: number, data: Partial<SeasonalPlanItem>) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState(item.category);
  const [targetQty, setTargetQty] = useState(String(item.target_qty ?? ''));
  const [targetValue, setTargetValue] = useState(String(item.target_value ?? ''));
  const [colorPref, setColorPref] = useState(item.color_preference ?? '');
  const [patternPref, setPatternPref] = useState(item.pattern_preference ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [priority, setPriority] = useState<SeasonalPlanItem['priority']>(item.priority);

  const vendorList: string[] = (() => {
    try { return JSON.parse(item.vendor_ids ?? '[]') as string[]; } catch { return []; }
  })();
  const [selectedVendors, setSelectedVendors] = useState<string[]>(vendorList);

  const handleSave = () => {
    onUpdate(item.id, {
      category,
      target_qty: targetQty ? parseInt(targetQty, 10) : undefined,
      target_value: targetValue ? parseFloat(targetValue) : undefined,
      color_preference: colorPref,
      pattern_preference: patternPref,
      vendor_ids: JSON.stringify(selectedVendors),
      notes,
      priority,
    });
    setExpanded(false);
  };

  const toggleVendor = (vid: string) => {
    setSelectedVendors((prev) =>
      prev.includes(vid) ? prev.filter((v) => v !== vid) : [...prev, vid]
    );
  };

  const priorityColor = PRIORITY_COLOR[priority];

  return (
    <View style={styles.itemCard}>
      <TouchableOpacity style={styles.itemHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
        <View style={styles.itemHeaderBody}>
          <Text style={styles.itemCategory}>{category || '—'}</Text>
          <View style={styles.itemMeta}>
            {item.target_qty ? <Text style={styles.itemMetaText}>{item.target_qty} pcs</Text> : null}
            {item.target_value ? <Text style={styles.itemMetaText}>₹{item.target_value.toLocaleString('en-IN')}</Text> : null}
            <View style={[styles.priorityChip, { backgroundColor: priorityColor + '22', borderColor: priorityColor + '44' }]}>
              <Text style={[styles.priorityChipText, { color: priorityColor }]}>{priority}</Text>
            </View>
          </View>
        </View>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d={expanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.itemExpanded}>
          <InputRow label="Category">
            <TextInput style={styles.fieldInput} value={category} onChangeText={setCategory} placeholderTextColor="rgba(255,255,255,0.2)" placeholder="e.g. Saree" />
          </InputRow>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Target Qty</Text>
              <TextInput style={styles.fieldInput} value={targetQty} onChangeText={(v) => setTargetQty(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor="rgba(255,255,255,0.2)" />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Target Value (₹)</Text>
              <TextInput style={styles.fieldInput} value={targetValue} onChangeText={(v) => setTargetValue(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor="rgba(255,255,255,0.2)" />
            </View>
          </View>

          <InputRow label="Color Suggestions">
            <TextInput style={styles.fieldInput} value={colorPref} onChangeText={setColorPref} placeholder="e.g. Red, Gold, Maroon" placeholderTextColor="rgba(255,255,255,0.2)" />
          </InputRow>

          <InputRow label="Pattern Suggestions">
            <TextInput style={styles.fieldInput} value={patternPref} onChangeText={setPatternPref} placeholder="e.g. Zari, Embroidery" placeholderTextColor="rgba(255,255,255,0.2)" />
          </InputRow>

          {/* Priority */}
          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITY_OPTS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.priorityBtn, priority === p && { backgroundColor: PRIORITY_COLOR[p] + '22', borderColor: PRIORITY_COLOR[p] + '55' }]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityBtnText, priority === p && { color: PRIORITY_COLOR[p] }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Vendors */}
          {vendors.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Preferred Vendors</Text>
              <View style={styles.vendorChips}>
                {vendors.map((v) => {
                  const sel = selectedVendors.includes(v.id);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.vendorChip, sel && styles.vendorChipSelected]}
                      onPress={() => toggleVendor(v.id)}
                    >
                      <Text style={[styles.vendorChipText, sel && styles.vendorChipTextSelected]}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <InputRow label="Notes">
            <TextInput style={[styles.fieldInput, { minHeight: 60, textAlignVertical: 'top', paddingTop: 8 }]} value={notes} onChangeText={setNotes} placeholder="Any notes…" placeholderTextColor="rgba(255,255,255,0.2)" multiline />
          </InputRow>

          <View style={styles.itemActions}>
            <TouchableOpacity style={styles.saveItemBtn} onPress={handleSave}>
              <Text style={styles.saveItemBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteItemBtn} onPress={() => onDelete(item.id)}>
              <Text style={styles.deleteItemBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Plan screen ───────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [plan, setPlan] = useState<SeasonalPlan | null>(null);
  const [items, setItems] = useState<SeasonalPlanItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit plan header
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, its, vs] = await Promise.all([
        getSeasonalPlan(parseInt(id, 10)),
        getPlanItems(parseInt(id, 10)),
        getVendors(),
      ]);
      setPlan(p);
      setItems(its);
      setVendors(vs);
      if (p?.target_budget) setBudgetInput(String(p.target_budget));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSaveBudget = async () => {
    if (!plan) return;
    const val = parseFloat(budgetInput) || 0;
    await updateSeasonalPlan(plan.id, { target_budget: val });
    setPlan((p) => p ? { ...p, target_budget: val } : p);
    setEditingBudget(false);
  };

  const handleAddCategory = async (category: string) => {
    if (!plan || !id) return;
    const defaults = getDefaults(plan.season_name);
    const itemId = await addPlanItem(parseInt(id, 10), {
      category,
      color_preference: defaults.colors,
      pattern_preference: defaults.patterns,
      priority: 'medium',
    });
    await load();
  };

  const handleAddCustom = async () => {
    await handleAddCategory('New Category');
  };

  const handleUpdateItem = async (itemId: number, data: Partial<SeasonalPlanItem>) => {
    await updatePlanItem(itemId, data);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...data } : i)));
  };

  const handleDeleteItem = (itemId: number) => {
    Alert.alert('Remove Category', 'Remove this category from the plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePlanItem(itemId);
          setItems((prev) => prev.filter((i) => i.id !== itemId));
        },
      },
    ]);
  };

  if (loading || !plan) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loader}><ActivityIndicator color={colors.teal} size="large" /></View>
      </SafeAreaView>
    );
  }

  const defaults = getDefaults(plan.season_name);
  const totalTargetQty = items.reduce((s, i) => s + (i.target_qty ?? 0), 0);
  const totalTargetValue = items.reduce((s, i) => s + (i.target_value ?? 0), 0);
  const remaining = (plan.target_budget ?? 0) - totalTargetValue;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.screenLabel}>SEASONAL PLAN</Text>
          <Text style={styles.screenTitle} numberOfLines={1}>{plan.season_name}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Date range */}
        <Text style={styles.dateRange}>
          {plan.start_date} → {plan.end_date}
        </Text>

        {/* Budget section */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetRow}>
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>Target Budget</Text>
              {editingBudget ? (
                <View style={styles.budgetEditRow}>
                  <TextInput
                    style={styles.budgetInput}
                    value={budgetInput}
                    onChangeText={(v) => setBudgetInput(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="numeric"
                    autoFocus
                  />
                  <TouchableOpacity onPress={handleSaveBudget}>
                    <Text style={styles.budgetSaveBtn}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setEditingBudget(true)}>
                  <Text style={styles.budgetValue}>
                    {plan.target_budget ? `₹${plan.target_budget.toLocaleString('en-IN')}` : 'Tap to set'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.budgetDivider} />
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>Planned</Text>
              <Text style={[styles.budgetValue, { color: colors.teal }]}>₹{totalTargetValue.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.budgetDivider} />
            <View style={styles.budgetCell}>
              <Text style={styles.budgetLabel}>Remaining</Text>
              <Text style={[styles.budgetValue, { color: remaining >= 0 ? colors.teal : colors.red }]}>
                {plan.target_budget ? `₹${Math.abs(remaining).toLocaleString('en-IN')}${remaining < 0 ? ' over' : ''}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Suggested categories from defaults */}
        {defaults.categories.length > 0 && items.length === 0 && (
          <View style={styles.suggSection}>
            <Text style={styles.fieldLabel}>SUGGESTED CATEGORIES</Text>
            <View style={styles.suggChips}>
              {defaults.categories.map((cat) => (
                <TouchableOpacity key={cat} style={styles.suggChip} onPress={() => handleAddCategory(cat)}>
                  <Text style={styles.suggChipText}>+ {cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Category items */}
        {items.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>CATEGORIES ({items.length})</Text>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                vendors={vendors}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </>
        )}

        {/* Add category */}
        <TouchableOpacity style={styles.addCategoryBtn} onPress={handleAddCustom}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <Text style={styles.addCategoryText}>Add Category</Text>
        </TouchableOpacity>

        {/* Summary */}
        {items.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionLabel}>SUMMARY</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Categories</Text>
              <Text style={styles.summaryValue}>{items.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Target Qty</Text>
              <Text style={styles.summaryValue}>{totalTargetQty} pcs</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Target Value</Text>
              <Text style={[styles.summaryValue, { color: colors.teal }]}>₹{totalTargetValue.toLocaleString('en-IN')}</Text>
            </View>
            {plan.target_budget ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>vs Budget</Text>
                <Text style={[styles.summaryValue, { color: remaining >= 0 ? colors.teal : colors.red }]}>
                  {remaining >= 0 ? `₹${remaining.toLocaleString('en-IN')} remaining` : `₹${Math.abs(remaining).toLocaleString('en-IN')} over`}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Generate POs placeholder */}
        <TouchableOpacity
          style={styles.genPOsBtn}
          onPress={() => Alert.alert('Coming Soon', 'Auto-generating draft POs from seasonal plans is coming in the next sprint.')}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={colors.purple} strokeWidth={1.8} strokeLinejoin="round" />
            <Path d="M14 2v6h6M12 18v-6M9 15h6" stroke={colors.purple} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
          <Text style={styles.genPOsBtnText}>Generate POs (Coming Soon)</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  screenLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold',
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16 },

  dateRange: {
    fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 10, marginTop: 6,
  },

  // Budget
  budgetCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 16, marginBottom: 20,
  },
  budgetRow: { flexDirection: 'row', alignItems: 'center' },
  budgetCell: { flex: 1, alignItems: 'center' },
  budgetDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.06)' },
  budgetLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  budgetValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  budgetEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetInput: {
    width: 80, fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold',
    borderBottomWidth: 1, borderBottomColor: colors.teal, paddingVertical: 2,
  },
  budgetSaveBtn: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // Suggested categories
  suggSection: { marginBottom: 16 },
  suggChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.teal + '15', borderRadius: 8, borderWidth: 1, borderColor: colors.teal + '33',
  },
  suggChipText: { fontSize: 13, fontWeight: '600', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // Item card
  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', marginBottom: 10,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  priorityBar: { width: 3, alignSelf: 'stretch' },
  itemHeaderBody: { flex: 1, padding: 12 },
  itemCategory: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  priorityChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  priorityChipText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  itemExpanded: { padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },

  inputRow: { marginBottom: 12 },
  fieldRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  fieldHalf: { flex: 1 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: '#FFFFFF', fontFamily: 'Inter_400Regular',
  },

  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  priorityBtnText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' },

  vendorChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  vendorChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  vendorChipSelected: { backgroundColor: colors.teal + '22', borderColor: colors.teal + '55' },
  vendorChipText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  vendorChipTextSelected: { color: colors.teal },

  itemActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveItemBtn: {
    flex: 1, backgroundColor: colors.teal + '22', borderWidth: 1, borderColor: colors.teal + '44',
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  saveItemBtnText: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
  deleteItemBtn: {
    paddingHorizontal: 16, backgroundColor: colors.red + '15', borderWidth: 1,
    borderColor: colors.red + '33', borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  deleteItemBtnText: { fontSize: 13, fontWeight: '700', color: colors.red, fontFamily: 'Inter_700Bold' },

  // Add category
  addCategoryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.teal + '33', borderRadius: 12,
    borderStyle: 'dashed', paddingVertical: 14, marginVertical: 8,
    backgroundColor: colors.teal + '08',
  },
  addCategoryText: { fontSize: 14, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // Summary
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },

  // Generate POs
  genPOsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.purple + '15', borderWidth: 1, borderColor: colors.purple + '33',
    borderRadius: 14, paddingVertical: 14, marginTop: 16,
  },
  genPOsBtnText: { fontSize: 14, fontWeight: '700', color: colors.purple, fontFamily: 'Inter_700Bold' },
});
