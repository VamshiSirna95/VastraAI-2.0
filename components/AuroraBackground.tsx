import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Static aurora background — very subtle ambient depth on pure black.
 * Absolutely positioned behind all content (zIndex: -1).
 * Screen backgrounds should be transparent or rgba(0,0,0,x) to let aurora show through.
 */
export default function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Base black */}
      <View style={styles.base} />

      {/* Teal aurora — top-right */}
      <LinearGradient
        colors={['transparent', 'rgba(93,202,165,0.04)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Violet aurora — bottom-left */}
      <LinearGradient
        colors={['transparent', 'rgba(155,114,242,0.03)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Amber aurora — centre, extremely subtle */}
      <LinearGradient
        colors={['transparent', 'rgba(239,159,39,0.015)', 'transparent']}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 0.7, y: 0.7 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
});
