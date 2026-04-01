import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { hexToRgba } from '../../components/ModuleCard';
import { createProduct, addProductPhoto, getProductByBarcode } from '../../db/database';
import { detectAttributes, type AIDetectionResult } from '../../services/ai';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FRAME_W = 220;
const FRAME_H = 280;
const CORNER_LEN = 20;
const CORNER_W = 3;

// ── Mode config ───────────────────────────────────────────────────────────────

type Mode = 'Tag' | 'Flat lay' | 'Detail' | 'Batch';
type PhotoType = 'tag' | 'main' | 'detail' | 'back';
type FlashMode = 'off' | 'on' | 'auto';
type Facing = 'back' | 'front';

const MODE_PHOTO_TYPE: Record<Mode, PhotoType> = {
  'Flat lay': 'main',
  'Tag': 'tag',
  'Detail': 'detail',
  'Batch': 'main',
};

const MODE_HINT: Record<Mode, string> = {
  'Flat lay': 'Front photo — lay garment flat',
  'Tag': 'Price tag — auto-reads MRP & barcode',
  'Detail': 'Close-up — embroidery, print, or work',
  'Batch': 'Tap to capture, garment auto-saved',
};

const MODES: Mode[] = ['Flat lay', 'Tag', 'Detail', 'Batch'];

// ── Static data ───────────────────────────────────────────────────────────────

const ATTR_PILLS = [
  { label: 'Kurta',      color: colors.teal },
  { label: 'Maroon',     color: colors.red },
  { label: 'Paisley',    color: colors.purple },
  { label: 'Cotton',     color: colors.pink },
  { label: '3/4 sleeve', color: colors.blue },
] as const;

// ── Icons ─────────────────────────────────────────────────────────────────────

function FlashOffIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" opacity={0.4} />
      <Line x1="3" y1="3" x2="21" y2="21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function FlashOnIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function FlashAutoIcon({ color }: { color: string }) {
  return (
    <View style={{ position: 'relative', width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
          stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      <Text style={{ position: 'absolute', right: 0, bottom: 0, fontSize: 8, fontWeight: '800', color, fontFamily: 'Inter_800ExtraBold' }}>A</Text>
    </View>
  );
}

function FlipIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M20 7h-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M14 17H5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M17 4l3 3-3 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 14l-3 3 3 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"
        stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M19 10v2a7 7 0 01-14 0v-2M12 21v-4"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function GalleryIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={color} strokeWidth={1.8} />
      <Path d="M3 16l5-5 4 4 3-3 5 4" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ── Corner bracket ────────────────────────────────────────────────────────────

type CornerPos = 'tl' | 'tr' | 'bl' | 'br';

function CornerBracket({ pos, color }: { pos: CornerPos; color: string }) {
  const isTop  = pos === 'tl' || pos === 'tr';
  const isLeft = pos === 'tl' || pos === 'bl';
  const offset = -(CORNER_W / 2);
  return (
    <View style={{
      position: 'absolute',
      width: CORNER_LEN, height: CORNER_LEN,
      top:    isTop  ? offset : undefined,
      bottom: !isTop ? offset : undefined,
      left:   isLeft  ? offset : undefined,
      right:  !isLeft ? offset : undefined,
      borderTopWidth:    isTop  ? CORNER_W : 0,
      borderBottomWidth: !isTop ? CORNER_W : 0,
      borderLeftWidth:   isLeft  ? CORNER_W : 0,
      borderRightWidth:  !isLeft ? CORNER_W : 0,
      borderColor: color,
    }} />
  );
}

// ── Detection float ───────────────────────────────────────────────────────────

function DetectionFloat({ pulseAnim }: { pulseAnim: Animated.Value }) {
  return (
    <View style={styles.detectionFloat}>
      <View style={styles.detectionHeader}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        <Text style={styles.detectionLabel}>AI detected</Text>
      </View>
      <View style={styles.pillsRow}>
        {ATTR_PILLS.map((p) => (
          <View key={p.label} style={[styles.attrPill, { backgroundColor: hexToRgba(p.color, 0.18) }]}>
            <Text style={styles.attrPillText}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Analyzing overlay ─────────────────────────────────────────────────────────

function AnalyzingOverlay({ pulseAnim, detectedAttrs }: { pulseAnim: Animated.Value; detectedAttrs: string[] }) {
  return (
    <View style={styles.analyzingOverlay}>
      <View style={styles.analyzingCard}>
        <View style={styles.analyzingHeader}>
          <Animated.View style={[styles.analyzingDot, { opacity: pulseAnim }]} />
          <Text style={styles.analyzingTitle}>🔍 Detecting attributes…</Text>
        </View>
        {detectedAttrs.length > 0 && (
          <View style={styles.detectedPillsRow}>
            {detectedAttrs.map((attr, i) => (
              <View key={i} style={[styles.detectedPill, { backgroundColor: hexToRgba(colors.teal, 0.15) }]}>
                <Text style={styles.detectedPillText}>{attr}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Photo review overlay ──────────────────────────────────────────────────────

function PhotoReview({
  photoUri,
  photoTypeLabel,
  isBatch,
  onRetake,
  onUse,
}: {
  photoUri: string;
  photoTypeLabel: string;
  isBatch: boolean;
  onRetake: () => void;
  onUse: () => void;
}) {
  return (
    <View style={styles.reviewOverlay}>
      <Image source={{ uri: photoUri }} style={styles.reviewImage} resizeMode="contain" />
      <SafeAreaView style={styles.reviewBar} edges={['bottom']}>
        <TouchableOpacity style={styles.reviewRetakeBtn} onPress={onRetake}>
          <Text style={styles.reviewRetakeText}>Retake</Text>
        </TouchableOpacity>
        <View style={styles.reviewCenter}>
          <Text style={styles.reviewTypeLabel}>{photoTypeLabel.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.reviewUseBtn} onPress={onUse}>
          <Text style={styles.reviewUseText}>{isBatch ? 'Use & Next' : 'Use Photo'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ── Batch toast ───────────────────────────────────────────────────────────────

function BatchToast({ count, visible }: { count: number; visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.batchToast}>
      <Text style={styles.batchToastText}>Saved! #{count}</Text>
    </View>
  );
}

// ── Permission denied view ────────────────────────────────────────────────────

function PermissionView({ onRequest }: { onRequest: () => void }) {
  return (
    <View style={styles.permContainer}>
      <Text style={styles.permTitle}>Camera access needed</Text>
      <Text style={styles.permSub}>Allow camera access to scan garments</Text>
      <TouchableOpacity style={styles.permBtn} onPress={onRequest}>
        <Text style={styles.permBtnText}>Enable Camera</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main scan screen ──────────────────────────────────────────────────────────

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string }>();
  const existingProductId = params.productId;

  const [permission, requestPermission] = useCameraPermissions();
  const [activeMode, setActiveMode] = useState<Mode>('Flat lay');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<Facing>('back');
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedAttrs, setDetectedAttrs] = useState<string[]>([]);
  const [reviewPhoto, setReviewPhoto] = useState<string | null>(null);

  // Batch mode state
  const [batchProducts, setBatchProducts] = useState<string[]>([]);
  const isBatchMode = activeMode === 'Batch';
  const [batchToastVisible, setBatchToastVisible] = useState(false);

  // Barcode scan state
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [barcodeChecking, setBarcodeChecking] = useState(false);
  const barcodeCooldownRef = useRef(false);

  const cameraRef = useRef<CameraViewType>(null);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const analyzePulse = useRef(new Animated.Value(0.3)).current;

  // Viewfinder pulse loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Analyzing overlay pulse
  useEffect(() => {
    if (!analyzing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(analyzePulse, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(analyzePulse, { toValue: 0.2, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [analyzing, analyzePulse]);

  const hasCamera = permission?.granted ?? false;

  const cycleFlash = () => {
    setFlashMode((f) => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off');
  };

  const flipCamera = () => {
    setFacing((f) => f === 'back' ? 'front' : 'back');
  };

  // Called when user taps shutter
  const handleShutter = async () => {
    if (analyzing) return;

    if (!hasCamera || !cameraRef.current) {
      if (existingProductId) {
        router.back();
      } else {
        router.push('/product/new');
      }
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('No photo captured');

      if (isBatchMode) {
        // In batch mode: show 1-second review then auto-accept
        setReviewPhoto(photo.uri);
      } else {
        // Normal: show review screen
        setReviewPhoto(photo.uri);
      }
    } catch {
      // silent — stay on camera
    }
  };

  // Called when user taps "Use Photo" / "Use & Next"
  const handleUsePhoto = async () => {
    if (!reviewPhoto) return;
    const uri = reviewPhoto;
    setReviewPhoto(null);

    if (isBatchMode) {
      // Batch: create product, save photo, run AI in background, show toast
      await processBatchCapture(uri);
    } else {
      // Normal: create/add photo, run AI, navigate
      await processNormalCapture(uri);
    }
  };

  const handleRetake = () => {
    setReviewPhoto(null);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (barcodeCooldownRef.current || scannedBarcode || reviewPhoto || analyzing) return;
    barcodeCooldownRef.current = true;
    setScannedBarcode(data);
    setBarcodeChecking(true);
    try {
      const product = await getProductByBarcode(data);
      if (product) {
        setScannedBarcode(null);
        barcodeCooldownRef.current = false;
        router.push(`/product/${product.id}` as `/product/${string}`);
        return;
      }
    } finally {
      setBarcodeChecking(false);
    }
    // No product found — keep overlay open for user to create new
    setTimeout(() => { barcodeCooldownRef.current = false; }, 3000);
  };

  const dismissBarcode = () => {
    setScannedBarcode(null);
    barcodeCooldownRef.current = false;
  };

  const createNewFromBarcode = () => {
    const code = scannedBarcode;
    setScannedBarcode(null);
    barcodeCooldownRef.current = false;
    router.push({ pathname: '/product/new', params: { barcode: code ?? '' } });
  };

  const ensureDir = async () => {
    const dir = `${FileSystem.documentDirectory}products/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    return dir;
  };

  const processNormalCapture = async (photoUri: string) => {
    setAnalyzing(true);
    setDetectedAttrs([]);
    try {
      const dir = await ensureDir();
      const photoType = MODE_PHOTO_TYPE[activeMode];

      let productId: string;
      if (existingProductId) {
        // Adding photo to existing product
        productId = existingProductId;
        const destUri = `${dir}${productId}_${photoType}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: photoUri, to: destUri });
        await addProductPhoto(productId, destUri, photoType, false);
        setAnalyzing(false);
        router.back();
        return;
      }

      // New product flow
      productId = await createProduct({ status: 'draft' });
      const destUri = `${dir}${productId}_${photoType}.jpg`;
      await FileSystem.copyAsync({ from: photoUri, to: destUri });
      await addProductPhoto(productId, destUri, photoType, true);

      // Tag mode → tag entry screen
      if (activeMode === 'Tag') {
        setAnalyzing(false);
        router.push({
          pathname: '/product/tag-entry',
          params: { productId, photoUri: destUri },
        });
        return;
      }

      const result: AIDetectionResult = await detectAttributes(destUri);

      const attrs: string[] = [];
      if (result.garment_type) attrs.push(result.garment_type);
      if (result.primary_color) attrs.push(result.primary_color);
      if (result.pattern) attrs.push(result.pattern);
      if (result.fabric) attrs.push(result.fabric);
      setDetectedAttrs(attrs);

      await new Promise((res) => setTimeout(res, 800));
      setAnalyzing(false);

      router.push({
        pathname: `/product/${productId}` as `/product/${string}`,
        params: {
          ai_garment_type: result.garment_type ?? '',
          ai_primary_color: result.primary_color ?? '',
          ai_secondary_color: result.secondary_color ?? '',
          ai_pattern: result.pattern ?? '',
          ai_fabric: result.fabric ?? '',
          ai_work_type: result.work_type ?? '',
          ai_occasion: result.occasion ?? '',
          ai_sleeve: result.sleeve ?? '',
          ai_neck: result.neck ?? '',
          ai_confidence: String(result.confidence),
          ai_source: result.source,
        },
      });
    } catch {
      setAnalyzing(false);
      router.push('/product/new');
    }
  };

  const processBatchCapture = async (photoUri: string) => {
    try {
      const dir = await ensureDir();
      const productId = await createProduct({ status: 'draft' });
      const destUri = `${dir}${productId}_main.jpg`;
      await FileSystem.copyAsync({ from: photoUri, to: destUri });
      await addProductPhoto(productId, destUri, 'main', true);

      // Fire-and-forget AI detection
      detectAttributes(destUri).catch(() => {});

      setBatchProducts((prev) => [...prev, productId]);

      // Show toast
      setBatchToastVisible(true);
      setTimeout(() => setBatchToastVisible(false), 1200);
    } catch {
      // silent
    }
  };

  const handleBatchDone = () => {
    router.push('/(tabs)/orders');
  };

  const frameColor = isBatchMode ? colors.amber : colors.teal;
  const shutterBorderColor = isBatchMode ? colors.amber : '#FFFFFF';

  const FlashIcon = flashMode === 'off'
    ? FlashOffIcon
    : flashMode === 'on'
    ? FlashOnIcon
    : FlashAutoIcon;

  const photoTypeLabel = MODE_PHOTO_TYPE[activeMode].replace('_', ' ');

  return (
    <View style={styles.root}>
      {hasCamera ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flashMode}
          onBarcodeScanned={activeMode === 'Tag' ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={activeMode === 'Tag' ? {
            barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'],
          } : undefined}
        />
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#12121e' }]} />
          <View style={[StyleSheet.absoluteFill, styles.gradientBottom]} />
        </>
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>

        {/* ── Mode pills ───────── */}
        <View style={styles.modePillsWrapper}>
          <View style={styles.modePillsRow}>
            {MODES.map((mode) => {
              const active = mode === activeMode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setActiveMode(mode)}
                  style={[styles.modePill, active && styles.modePillActive]}
                >
                  <Text style={[styles.modePillText, active && styles.modePillTextActive]}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.modeHint}>{MODE_HINT[activeMode]}</Text>
        </View>

        {/* ── Detection area ───── */}
        <View style={styles.detectionArea}>

          {/* Batch counter badge */}
          {isBatchMode && batchProducts.length > 0 && (
            <View style={styles.batchCountBadge}>
              <View style={styles.batchCountDot} />
              <Text style={styles.batchCountText}>{batchProducts.length} captured</Text>
            </View>
          )}

          <View style={styles.frameRow}>
            <View style={[styles.detectionFrame, { borderColor: hexToRgba(frameColor, 0.45) }]}>
              <CornerBracket pos="tl" color={frameColor} />
              <CornerBracket pos="tr" color={frameColor} />
              <CornerBracket pos="bl" color={frameColor} />
              <CornerBracket pos="br" color={frameColor} />
              <View style={styles.detectionFloatWrapper}>
                <DetectionFloat pulseAnim={pulseAnim} />
              </View>
            </View>

            {/* Side buttons */}
            <View style={styles.sideButtons}>
              {/* Flash */}
              <View style={styles.sideBtnGroup}>
                <TouchableOpacity style={styles.sideBtn} onPress={cycleFlash}>
                  <FlashIcon color={flashMode === 'off' ? 'rgba(255,255,255,0.4)' : '#FFFFFF'} />
                </TouchableOpacity>
                <Text style={styles.sideBtnLabel}>
                  {flashMode === 'off' ? 'Off' : flashMode === 'on' ? 'On' : 'Auto'}
                </Text>
              </View>

              {/* Flip */}
              <View style={styles.sideBtnGroup}>
                <TouchableOpacity style={styles.sideBtn} onPress={flipCamera}>
                  <FlipIcon color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              {/* Mic (placeholder) */}
              <View style={styles.sideBtnGroup}>
                <TouchableOpacity style={styles.sideBtn}>
                  <MicIcon color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.stabilityHint}>
            <Text style={styles.stabilityText}>
              {isBatchMode
                ? 'Tap to capture, garment auto-saved'
                : hasCamera
                ? 'Hold steady — garment detected'
                : 'Camera access needed'}
            </Text>
          </View>
        </View>

        {/* ── Bottom bar ────────── */}
        <View style={styles.bottomBar}>
          {isBatchMode ? (
            <TouchableOpacity style={styles.batchDoneBtn} onPress={handleBatchDone}>
              <Text style={styles.batchDoneText}>
                Done {batchProducts.length > 0 ? `(${batchProducts.length})` : ''}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.bottomSideBtn}>
              <GalleryIcon color="rgba(255,255,255,0.4)" />
              <Text style={styles.bottomBtnLabel}>Gallery</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.shutterOuter, { borderColor: shutterBorderColor }, analyzing && styles.shutterDisabled]}
            onPress={handleShutter}
            disabled={analyzing}
          >
            <View style={[styles.shutterInner, isBatchMode && { backgroundColor: colors.amber }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomSideBtn}
            onPress={!hasCamera ? requestPermission : undefined}
          >
            <Text style={styles.bottomBtnLabel}>{existingProductId ? 'Cancel' : 'Batch'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Photo review overlay */}
      {reviewPhoto && (
        <PhotoReview
          photoUri={reviewPhoto}
          photoTypeLabel={photoTypeLabel}
          isBatch={isBatchMode}
          onRetake={handleRetake}
          onUse={handleUsePhoto}
        />
      )}

      {/* Analyzing overlay */}
      {analyzing && <AnalyzingOverlay pulseAnim={analyzePulse} detectedAttrs={detectedAttrs} />}

      {/* Batch toast */}
      <BatchToast count={batchProducts.length} visible={batchToastVisible} />

      {/* Barcode overlay */}
      {scannedBarcode && (
        <View style={styles.barcodeOverlay}>
          <View style={styles.barcodeCard}>
            <Text style={styles.barcodeBadge}>BARCODE DETECTED</Text>
            <Text style={styles.barcodeValue} numberOfLines={1}>{scannedBarcode}</Text>
            {barcodeChecking ? (
              <Text style={styles.barcodeChecking}>Looking up product…</Text>
            ) : (
              <View style={styles.barcodeActions}>
                <TouchableOpacity style={styles.barcodeCreateBtn} onPress={createNewFromBarcode}>
                  <Text style={styles.barcodeCreateBtnText}>New Product with This Barcode</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.barcodeDismissBtn} onPress={dismissBarcode}>
                  <Text style={styles.barcodeDismissBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Permission overlay */}
      {permission && !permission.granted && (
        <View style={styles.permOverlay}>
          <PermissionView onRequest={requestPermission} />
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080810' },
  gradientBottom: { top: '50%', backgroundColor: '#080810' },
  overlay: { flex: 1 },

  // Mode pills
  modePillsWrapper: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
    gap: 6,
  },
  modePillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  modePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modePillActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  modePillText: {
    fontSize: 12, fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_500Medium',
  },
  modePillTextActive: { color: '#FFFFFF' },
  modeHint: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },

  // Detection area
  detectionArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  frameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detectionFrame: {
    width: FRAME_W, height: FRAME_H,
    borderWidth: 2, borderRadius: 14,
  },
  detectionFloatWrapper: { position: 'absolute', bottom: 10, left: 10, right: 10 },

  // Side buttons
  sideButtons: { gap: 8 },
  sideBtnGroup: { alignItems: 'center', gap: 2 },
  sideBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  sideBtnLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },

  // AI Detection float
  detectionFloat: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1, borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, gap: 6,
  },
  detectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.teal },
  detectionLabel: { fontSize: 12, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  attrPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  attrPillText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter_500Medium' },

  // Stability hint
  stabilityHint: {
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
    paddingVertical: 6, paddingHorizontal: 16,
  },
  stabilityText: { fontSize: 12, color: colors.teal, fontFamily: 'Inter_500Medium' },

  // Batch counter
  batchCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1, borderColor: `${colors.amber}40`,
    borderRadius: 12, paddingVertical: 5, paddingHorizontal: 12,
  },
  batchCountDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  batchCountText: { fontSize: 12, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

  // Bottom bar
  bottomBar: {
    height: 120, backgroundColor: 'rgba(0,0,0,0.95)',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 40,
  },
  bottomSideBtn: { alignItems: 'center', gap: 4 },
  bottomBtnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  batchDoneBtn: {
    backgroundColor: `${colors.amber}20`,
    borderWidth: 1, borderColor: `${colors.amber}50`,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
  },
  batchDoneText: { fontSize: 14, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

  // Shutter
  shutterOuter: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },

  // Photo review
  reviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  reviewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  reviewBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, gap: 12,
  },
  reviewRetakeBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(226,75,74,0.15)',
    borderWidth: 1, borderColor: 'rgba(226,75,74,0.3)',
    borderRadius: 12,
  },
  reviewRetakeText: { fontSize: 14, fontWeight: '700', color: colors.red, fontFamily: 'Inter_700Bold' },
  reviewCenter: { alignItems: 'center' },
  reviewTypeLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold',
  },
  reviewUseBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(93,202,165,0.15)',
    borderWidth: 1, borderColor: 'rgba(93,202,165,0.35)',
    borderRadius: 12,
  },
  reviewUseText: { fontSize: 14, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // Analyzing overlay
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  analyzingCard: {
    backgroundColor: 'rgba(8,8,16,0.95)',
    borderWidth: 1, borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 16, padding: 24, minWidth: 220, alignItems: 'center', gap: 14,
  },
  analyzingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyzingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
  analyzingTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  detectedPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  detectedPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  detectedPillText: { fontSize: 12, fontWeight: '600', color: colors.teal, fontFamily: 'Inter_500Medium' },

  // Batch toast
  batchToast: {
    position: 'absolute', bottom: 140, alignSelf: 'center',
    backgroundColor: colors.teal, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  batchToastText: { fontSize: 13, fontWeight: '700', color: '#000000', fontFamily: 'Inter_700Bold' },

  // Permission overlay
  permOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,16,0.92)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  permContainer: { alignItems: 'center', gap: 12 },
  permTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  permSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  permBtn: {
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 24,
    backgroundColor: hexToRgba(colors.teal, 0.15),
    borderWidth: 1, borderColor: hexToRgba(colors.teal, 0.35), borderRadius: 10,
  },
  permBtnText: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // Barcode overlay
  barcodeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  barcodeCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  barcodeBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  barcodeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },
  barcodeChecking: {
    fontSize: 13,
    color: colors.amber,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
  barcodeActions: { gap: 8 },
  barcodeCreateBtn: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  barcodeCreateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },
  barcodeDismissBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  barcodeDismissBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_700Bold',
  },
});
