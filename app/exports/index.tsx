import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import GlassInput from '../../components/ui/GlassInput';
import {
  exportProductCatalog,
  exportPurchaseOrders,
  exportGRNReport,
  exportVendorReport,
  exportStockReport,
  exportCustomerDemands,
  exportFullBackup,
} from '../../services/excelExport';

type ExportId =
  | 'products' | 'pos' | 'grns' | 'vendors' | 'stock' | 'demands' | 'backup';

interface ExportCard {
  id: ExportId;
  title: string;
  description: string;
  color: string;
  hasDateRange: boolean;
  iconPath: string;
}

const EXPORTS: ExportCard[] = [
  {
    id: 'products', title: 'Product Catalog', color: colors.teal, hasDateRange: false,
    description: 'All products with attributes, photos, pricing and stock levels.',
    iconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    id: 'pos', title: 'Purchase Orders', color: colors.amber, hasDateRange: true,
    description: 'PO history with vendor, status, quantities and values.',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 'grns', title: 'GRN Report', color: colors.blue, hasDateRange: true,
    description: 'Goods receipt data with acceptance rates by vendor.',
    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    id: 'vendors', title: 'Vendor Report', color: colors.purple, hasDateRange: false,
    description: 'Vendor directory with rankings, scores and order history.',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    id: 'stock', title: 'Stock Report', color: colors.blue, hasDateRange: false,
    description: 'Current inventory across all stores with size-wise breakdown.',
    iconPath: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  },
  {
    id: 'demands', title: 'Customer Demands', color: colors.purple, hasDateRange: false,
    description: 'All customer requests with status, price range and store.',
    iconPath: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  },
  {
    id: 'backup', title: 'Full Data Backup', color: colors.red, hasDateRange: false,
    description: 'Everything — Products, POs, GRNs, Vendors, Stock, Demands in one workbook.',
    iconPath: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
  },
];

export default function ExportCenterScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<ExportId | null>(null);
  const [dateFrom, setDateFrom] = useState<Record<string, string>>({});
  const [dateTo, setDateTo] = useState<Record<string, string>>({});

  const handleExport = async (card: ExportCard) => {
    if (loading) return;
    setLoading(card.id);
    try {
      switch (card.id) {
        case 'products': await exportProductCatalog(); break;
        case 'pos': await exportPurchaseOrders(dateFrom['pos'] || undefined, dateTo['pos'] || undefined); break;
        case 'grns': await exportGRNReport(dateFrom['grns'] || undefined, dateTo['grns'] || undefined); break;
        case 'vendors': await exportVendorReport(); break;
        case 'stock': await exportStockReport(); break;
        case 'demands': await exportCustomerDemands(); break;
        case 'backup': await exportFullBackup(); break;
      }
    } catch (e: unknown) {
      Alert.alert('Export Failed', e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.title}>Export Center</Text>
            <Text style={styles.subtitle}>Download reports as Excel files</Text>
          </View>
        </View>

        {EXPORTS.map((card) => (
          <View key={card.id} style={styles.card}>
            {/* Card header row */}
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: card.color + '18' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d={card.iconPath} stroke={card.color} strokeWidth={1.8}
                    strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatText}>XLSX</Text>
                </View>
              </View>
            </View>

            <Text style={styles.cardDesc}>{card.description}</Text>

            {/* Date range pickers */}
            {card.hasDateRange && (
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <GlassInput
                    label="From (YYYY-MM-DD)"
                    value={dateFrom[card.id] ?? ''}
                    onChangeText={(v) => setDateFrom((prev) => ({ ...prev, [card.id]: v }))}
                    placeholder="2024-01-01"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.dateField}>
                  <GlassInput
                    label="To (YYYY-MM-DD)"
                    value={dateTo[card.id] ?? ''}
                    onChangeText={(v) => setDateTo((prev) => ({ ...prev, [card.id]: v }))}
                    placeholder="2024-12-31"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            {/* Export button */}
            <TouchableOpacity
              style={[styles.exportBtn, { borderColor: card.color + '40', backgroundColor: card.color + '12' }]}
              onPress={() => handleExport(card)}
              disabled={loading === card.id}
            >
              {loading === card.id ? (
                <ActivityIndicator color={card.color} size="small" />
              ) : (
                <Text style={[styles.exportBtnText, { color: card.color }]}>Export →</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 10, marginBottom: 20,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerBody: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 2 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitleBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  formatBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  formatText: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  cardDesc: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular', lineHeight: 18, marginBottom: 14,
  },

  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dateField: { flex: 1 },

  exportBtn: {
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  exportBtnText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
