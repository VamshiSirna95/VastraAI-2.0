import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import { SIZE_TEMPLATES } from '../db/types';

interface SizeQtyMatrixProps {
  garmentType: string;
  sizes: Record<string, number>;
  unitPrice: number;
  onChange: (sizes: Record<string, number>, totalQty: number, totalPrice: number) => void;
}

function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN');
}

export default function SizeQtyMatrix({ garmentType, sizes, unitPrice, onChange }: SizeQtyMatrixProps) {
  const sizeLabels = SIZE_TEMPLATES[garmentType] ?? SIZE_TEMPLATES['default'];
  const isFreeSize = sizeLabels.length === 1 && sizeLabels[0] === 'Free';

  const [qtys, setQtys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    sizeLabels.forEach((s) => { init[s] = String(sizes[s] ?? 0); });
    return init;
  });

  useEffect(() => {
    const updated: Record<string, string> = {};
    sizeLabels.forEach((s) => { updated[s] = String(sizes[s] ?? 0); });
    setQtys(updated);
  }, [garmentType]);

  const recalc = (newQtys: Record<string, string>) => {
    const numericSizes: Record<string, number> = {};
    sizeLabels.forEach((s) => { numericSizes[s] = parseInt(newQtys[s] || '0', 10) || 0; });
    const totalQty = Object.values(numericSizes).reduce((a, b) => a + b, 0);
    const totalPrice = totalQty * unitPrice;
    onChange(numericSizes, totalQty, totalPrice);
  };

  const handleChange = (size: string, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    const newQtys = { ...qtys, [size]: cleaned };
    setQtys(newQtys);
    recalc(newQtys);
  };

  const totalQty = sizeLabels.reduce((sum, s) => sum + (parseInt(qtys[s] || '0', 10) || 0), 0);
  const totalPrice = totalQty * unitPrice;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>SIZE-QTY MATRIX</Text>

      {isFreeSize ? (
        <View style={styles.freeSizeRow}>
          <Text style={styles.freeSizeLabel}>Qty</Text>
          <TextInput
            style={styles.freeSizeInput}
            value={qtys['Free'] ?? '0'}
            onChangeText={(v) => handleChange('Free', v)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
        </View>
      ) : (
        <View style={styles.sizeRow}>
          {sizeLabels.map((size) => (
            <View key={size} style={styles.sizeCol}>
              <Text style={styles.sizeLabel}>{size}</Text>
              <TextInput
                style={styles.sizeInput}
                value={qtys[size] ?? '0'}
                onChangeText={(v) => handleChange(size, v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.2)"
                maxLength={3}
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.totalsRow}>
        <Text style={styles.unitPriceText}>@ {formatINR(unitPrice)}/pc</Text>
        <Text style={styles.totalsText}>
          Total: <Text style={styles.qtyText}>{totalQty} pcs</Text>
          {' = '}
          <Text style={styles.valueText}>{formatINR(totalPrice)}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },

  sizeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sizeCol: {
    alignItems: 'center',
    minWidth: 48,
  },
  sizeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  sizeInput: {
    width: 48,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    padding: 0,
  },

  freeSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  freeSizeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_500Medium',
  },
  freeSizeInput: {
    width: 80,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    padding: 0,
  },

  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(93,202,165,0.08)',
  },
  unitPriceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
  },
  totalsText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
  },
  qtyText: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  valueText: {
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
});
