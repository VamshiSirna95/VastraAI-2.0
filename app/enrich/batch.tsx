import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/theme';
import { createProduct, addProductPhoto } from '../../db/database';
import { detectAttributes } from '../../services/ai';
import { compressImage } from '../../services/imageManager';
import { logError } from '../../services/errorLogger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 48) / 3;

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemStatus = 'pending' | 'processing' | 'done' | 'failed';

interface BatchItem {
  uri: string;
  status: ItemStatus;
  productId?: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ItemStatus, string> = {
  pending: 'rgba(255,255,255,0.4)',
  processing: colors.amber,
  done: colors.teal,
  failed: colors.red ?? '#FF4444',
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: '–',
  processing: '...',
  done: '✓',
  failed: '✗',
};

function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLOR[status] + '33', borderColor: STATUS_COLOR[status] }]}>
      <Text style={[styles.badgeText, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

// ── Thumbnail item ────────────────────────────────────────────────────────────

function ThumbItem({ item }: { item: BatchItem }) {
  return (
    <View style={styles.thumbWrap}>
      <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="cover" />
      <StatusBadge status={item.status} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BatchEnrichScreen() {
  const router = useRouter();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [done, setDone] = useState(false);

  const handlePickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as const,
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 0.8,
      orderedSelection: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newItems: BatchItem[] = result.assets.map((a) => ({
        uri: a.uri,
        status: 'pending',
      }));
      setItems(newItems);
      setDone(false);
      setSucceeded(0);
      setFailed(0);
    }
  }, []);

  const updateItem = useCallback((index: number, patch: Partial<BatchItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const handleStart = useCallback(async () => {
    if (items.length === 0 || processing) return;
    setProcessing(true);
    setDone(false);

    const batchId = `batch-${Date.now()}`;
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < items.length; i++) {
      setCurrentIdx(i);
      updateItem(i, { status: 'processing' });

      try {
        const compressed = await compressImage(items[i].uri);
        const uri = compressed ?? items[i].uri;

        const detection = await detectAttributes(uri);

        const productId = await createProduct({
          garment_type: detection.garment_type,
          primary_color: detection.primary_color,
          secondary_color: detection.secondary_color,
          pattern: detection.pattern,
          fabric: detection.fabric,
          work_type: detection.work_type,
          occasion: detection.occasion,
          sleeve: detection.sleeve,
          neck: detection.neck,
          ai_confidence: detection.confidence,
          ai_status: detection.status === 'success' ? 'success' : 'failed',
          ai_batch_id: batchId,
          status: 'draft',
        });

        await addProductPhoto(productId, uri, 'main', true);

        updateItem(i, { status: detection.status === 'success' ? 'done' : 'failed', productId });

        if (detection.status === 'success') {
          ok++;
          setSucceeded(ok);
        } else {
          fail++;
          setFailed(fail);
        }
      } catch (e) {
        logError('BatchEnrich.processItem', e);
        updateItem(i, { status: 'failed' });
        fail++;
        setFailed(fail);
      }
    }

    setProcessing(false);
    setDone(true);
  }, [items, processing, updateItem]);

  const handleReview = useCallback(() => {
    router.push('/(tabs)/orders');
  }, [router]);

  const canStart = items.length > 0 && !processing && !done;
  const canReselect = !processing;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Batch Enrich</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Body */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🖼️</Text>
          <Text style={styles.emptyTitle}>Select up to 50 photos</Text>
          <Text style={styles.emptySubtitle}>
            AI will detect garment attributes for each photo and create draft products automatically.
          </Text>
          <TouchableOpacity style={styles.pickBtn} onPress={handlePickImages}>
            <Text style={styles.pickBtnText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, index) => String(index)}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <ThumbItem item={item} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>{items.length} photo{items.length !== 1 ? 's' : ''} selected</Text>
              {canReselect && (
                <TouchableOpacity onPress={handlePickImages}>
                  <Text style={styles.reselectText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      )}

      {/* Progress bar when processing */}
      {processing && (
        <View style={styles.progressWrap}>
          <Text style={styles.progressText}>
            Processing {currentIdx + 1} of {items.length}…
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((currentIdx + 1) / items.length) * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Completion summary */}
      {done && (
        <View style={styles.summaryWrap}>
          <Text style={styles.summaryText}>
            <Text style={{ color: colors.teal }}>{succeeded} succeeded</Text>
            {'  '}
            <Text style={{ color: colors.red ?? '#FF4444' }}>{failed} failed</Text>
          </Text>
          <TouchableOpacity style={styles.reviewBtn} onPress={handleReview}>
            <Text style={styles.reviewBtnText}>Review Products</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Start button */}
      {canStart && (
        <View style={styles.startWrap}>
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Text style={styles.startBtnText}>Start Processing ({items.length})</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: colors.teal, fontFamily: 'Inter_500Medium' },
  title: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  pickBtn: {
    marginTop: 8,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 32,
  },
  pickBtnText: { fontSize: 15, fontWeight: '700', color: '#000000', fontFamily: 'Inter_700Bold' },

  // Grid
  grid: { padding: 12, gap: 4 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  listHeaderText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  reselectText: { fontSize: 13, color: colors.teal, fontFamily: 'Inter_500Medium' },

  // Thumbnail
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  thumb: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  // Progress
  progressWrap: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  progressText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 2 },

  // Summary
  summaryWrap: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    gap: 12,
  },
  summaryText: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  reviewBtn: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 28,
  },
  reviewBtnText: { fontSize: 14, fontWeight: '700', color: '#000000', fontFamily: 'Inter_700Bold' },

  // Start button
  startWrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  startBtn: {
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#000000', fontFamily: 'Inter_700Bold' },
});
