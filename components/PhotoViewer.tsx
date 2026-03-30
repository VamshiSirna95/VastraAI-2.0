import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/theme';
import type { ProductPhoto } from '../db/types';
import { deleteProductPhoto } from '../db/database';

const { width: W, height: H } = Dimensions.get('window');

// ── Photo type badge config ───────────────────────────────────────────────────

const PHOTO_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  main:   { label: 'MAIN',   color: colors.teal },
  back:   { label: 'BACK',   color: colors.blue },
  tag:    { label: 'TAG',    color: colors.amber },
  detail: { label: 'DETAIL', color: colors.purple },
  fabric: { label: 'FABRIC', color: colors.pink },
  grn:    { label: 'GRN',    color: colors.red },
};

interface PhotoViewerProps {
  photos: ProductPhoto[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export default function PhotoViewer({
  photos,
  initialIndex = 0,
  visible,
  onClose,
  onDelete,
}: PhotoViewerProps) {
  const [current, setCurrent] = useState(initialIndex);

  const photo = photos[current];
  if (!photo) return null;

  const typeConfig = PHOTO_TYPE_CONFIG[photo.photo_type] ?? { label: photo.photo_type.toUpperCase(), color: '#FFFFFF' };

  const handleDelete = () => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProductPhoto(photo.id);
          onDelete?.(photo.id);
          if (current >= photos.length - 1 && current > 0) {
            setCurrent(current - 1);
          }
          if (photos.length <= 1) onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBtn} onPress={onClose}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12"
                stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          <View style={[styles.typeBadge, { backgroundColor: `${typeConfig.color}25`, borderColor: `${typeConfig.color}50` }]}>
            <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>

          <TouchableOpacity style={styles.topBtn} onPress={handleDelete}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                stroke={colors.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Photo — zoomable via ScrollView */}
        <ScrollView
          style={styles.imageScroll}
          contentContainerStyle={styles.imageScrollContent}
          maximumZoomScale={3}
          minimumZoomScale={1}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          centerContent
        >
          <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
        </ScrollView>

        {/* Dot indicators + swipe buttons */}
        {photos.length > 1 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
              onPress={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M15 18l-6-6 6-6" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            <View style={styles.dots}>
              {photos.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setCurrent(i)}>
                  <View style={[styles.dot, i === current && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.navBtn, current === photos.length - 1 && styles.navBtnDisabled]}
              onPress={() => setCurrent((c) => Math.min(photos.length - 1, c + 1))}
              disabled={current === photos.length - 1}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.5,
    fontFamily: 'Inter_700Bold',
  },
  imageScroll: { flex: 1 },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: W,
    height: H * 0.72,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 36,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: { backgroundColor: '#FFFFFF', width: 20 },
});
