import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { hexToRgba } from '../../components/ModuleCard';
import { createProduct } from '../../db/database';
import { addProductPhoto } from '../../db/database';
import { detectAttributes, type AIDetectionResult } from '../../services/ai';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FRAME_W = 220;
const FRAME_H = 280;
const CORNER_LEN = 20;
const CORNER_W = 3;

// ── Static data ───────────────────────────────────────────────────────────────

const MODES = ['Tag', 'Flat lay', 'Detail', 'Batch'] as const;
type Mode = typeof MODES[number];

const ATTR_PILLS = [
  { label: 'Kurta',      color: colors.teal },
  { label: 'Maroon',     color: colors.red },
  { label: 'Paisley',    color: colors.purple },
  { label: 'Cotton',     color: colors.pink },
  { label: '3/4 sleeve', color: colors.blue },
] as const;

// ── Icons ─────────────────────────────────────────────────────────────────────

function FlashIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke={color} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round"
      />
    </Svg>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"
        stroke={color} strokeWidth={1.8} strokeLinejoin="round"
      />
      <Path
        d="M19 10v2a7 7 0 01-14 0v-2M12 21v-4"
        stroke={color} strokeWidth={1.8} strokeLinecap="round"
      />
    </Svg>
  );
}

function GalleryIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2}
        stroke={color} strokeWidth={1.8} />
      <Path
        d="M3 16l5-5 4 4 3-3 5 4"
        stroke={color} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round"
      />
    </Svg>
  );
}

function BatchIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 10h16M4 14h10"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Rect x={14} y={12} width={7} height={7} rx={1}
        stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

// ── Corner bracket ────────────────────────────────────────────────────────────

type CornerPos = 'tl' | 'tr' | 'bl' | 'br';

function CornerBracket({ pos }: { pos: CornerPos }) {
  const isTop  = pos === 'tl' || pos === 'tr';
  const isLeft = pos === 'tl' || pos === 'bl';
  const offset = -(CORNER_W / 2);
  return (
    <View
      style={{
        position: 'absolute',
        width: CORNER_LEN,
        height: CORNER_LEN,
        top:    isTop  ? offset : undefined,
        bottom: !isTop ? offset : undefined,
        left:   isLeft  ? offset : undefined,
        right:  !isLeft ? offset : undefined,
        borderTopWidth:    isTop  ? CORNER_W : 0,
        borderBottomWidth: !isTop ? CORNER_W : 0,
        borderLeftWidth:   isLeft  ? CORNER_W : 0,
        borderRightWidth:  !isLeft ? CORNER_W : 0,
        borderColor: colors.teal,
      }}
    />
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
          <View
            key={p.label}
            style={[styles.attrPill, { backgroundColor: hexToRgba(p.color, 0.18) }]}
          >
            <Text style={styles.attrPillText}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Analyzing overlay ─────────────────────────────────────────────────────────

function AnalyzingOverlay({
  pulseAnim,
  detectedAttrs,
}: {
  pulseAnim: Animated.Value;
  detectedAttrs: string[];
}) {
  return (
    <View style={styles.analyzingOverlay}>
      <View style={styles.analyzingCard}>
        <View style={styles.analyzingHeader}>
          <Animated.View style={[styles.analyzingDot, { opacity: pulseAnim }]} />
          <Text style={styles.analyzingTitle}>Analyzing garment…</Text>
        </View>
        {detectedAttrs.length > 0 && (
          <View style={styles.detectedPillsRow}>
            {detectedAttrs.map((attr, i) => (
              <View
                key={i}
                style={[styles.detectedPill, { backgroundColor: hexToRgba(colors.teal, 0.15) }]}
              >
                <Text style={styles.detectedPillText}>{attr}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
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
  const [permission, requestPermission] = useCameraPermissions();
  const [activeMode, setActiveMode] = useState<Mode>('Tag');
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedAttrs, setDetectedAttrs] = useState<string[]>([]);

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

  const handleShutter = async () => {
    if (analyzing) return;

    // No camera: navigate directly to new product form
    if (!hasCamera || !cameraRef.current) {
      router.push('/product/new');
      return;
    }

    try {
      setAnalyzing(true);
      setDetectedAttrs([]);

      // 1. Take picture
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('No photo');

      // 2. Ensure products directory exists
      const dir = `${FileSystem.documentDirectory}products/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      // 3. Create draft product
      const productId = await createProduct({ status: 'draft' });

      // 4. Save photo to app directory
      const destUri = `${dir}${productId}_main.jpg`;
      await FileSystem.copyAsync({ from: photo.uri, to: destUri });

      // 5. Attach photo to product
      await addProductPhoto(productId, destUri, 'main', true);

      // 6. Run AI detection cascade
      const result: AIDetectionResult = await detectAttributes(destUri);

      // Show detected attributes as pills
      const attrs: string[] = [];
      if (result.garment_type) attrs.push(result.garment_type);
      if (result.primary_color) attrs.push(result.primary_color);
      if (result.pattern) attrs.push(result.pattern);
      if (result.fabric) attrs.push(result.fabric);
      setDetectedAttrs(attrs);

      // Brief pause so user can see detected attrs
      await new Promise((res) => setTimeout(res, 800));

      setAnalyzing(false);

      // 7. Navigate to product form with AI results as params
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
      // Fall back to manual new product
      router.push('/product/new');
    }
  };

  return (
    <View style={styles.root}>
      {/* Background: camera or dark gradient fallback */}
      {hasCamera ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
        />
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#12121e' }]} />
          <View style={[StyleSheet.absoluteFill, styles.gradientBottom]} />
        </>
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>

        {/* ── Mode pills ─────────────────────────────────────────────── */}
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

        {/* ── Detection area ─────────────────────────────────────────── */}
        <View style={styles.detectionArea}>
          <View style={styles.frameRow}>
            <View style={styles.detectionFrame}>
              <CornerBracket pos="tl" />
              <CornerBracket pos="tr" />
              <CornerBracket pos="bl" />
              <CornerBracket pos="br" />
              <View style={styles.detectionFloatWrapper}>
                <DetectionFloat pulseAnim={pulseAnim} />
              </View>
            </View>
            <View style={styles.sideButtons}>
              <TouchableOpacity style={styles.sideBtn}>
                <FlashIcon color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sideBtn}>
                <MicIcon color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.stabilityHint}>
            <Text style={styles.stabilityText}>
              {hasCamera ? 'Hold steady — garment detected' : 'Camera access needed'}
            </Text>
          </View>
        </View>

        {/* ── Bottom control bar ─────────────────────────────────────── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomSideBtn}>
            <GalleryIcon color="rgba(255,255,255,0.4)" />
            <Text style={styles.bottomBtnLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shutterOuter, analyzing && styles.shutterDisabled]}
            onPress={handleShutter}
            disabled={analyzing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomSideBtn}
            onPress={!hasCamera ? requestPermission : undefined}
          >
            <BatchIcon color="rgba(255,255,255,0.4)" />
            <Text style={styles.bottomBtnLabel}>Batch</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Analyzing overlay */}
      {analyzing && (
        <AnalyzingOverlay pulseAnim={analyzePulse} detectedAttrs={detectedAttrs} />
      )}

      {/* Camera permission overlay */}
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
  root: {
    flex: 1,
    backgroundColor: '#080810',
  },
  gradientBottom: {
    top: '50%',
    backgroundColor: '#080810',
  },
  overlay: {
    flex: 1,
  },

  // Mode pills
  modePillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  modePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modePillActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_500Medium',
  },
  modePillTextActive: {
    color: '#FFFFFF',
  },

  // Detection area
  detectionArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  frameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detectionFrame: {
    width: FRAME_W,
    height: FRAME_H,
    borderWidth: 2,
    borderColor: 'rgba(93,202,165,0.45)',
    borderRadius: 14,
  },
  detectionFloatWrapper: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },

  // Side buttons
  sideButtons: { gap: 10 },
  sideBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // AI Detection float
  detectionFloat: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
    width: 240,
  },
  detectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  detectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  attrPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  attrPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
  },

  // Stability hint
  stabilityHint: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  stabilityText: {
    fontSize: 12,
    color: colors.teal,
    fontFamily: 'Inter_500Medium',
  },

  // Bottom bar
  bottomBar: {
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  bottomSideBtn: {
    alignItems: 'center',
    gap: 4,
  },
  bottomBtnLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },

  // Shutter
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },

  // Analyzing overlay
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingCard: {
    backgroundColor: 'rgba(8,8,16,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 16,
    padding: 24,
    minWidth: 220,
    alignItems: 'center',
    gap: 14,
  },
  analyzingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  analyzingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.teal,
  },
  analyzingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  detectedPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  detectedPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  detectedPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.teal,
    fontFamily: 'Inter_500Medium',
  },

  // Permission overlay
  permOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,16,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permContainer: {
    alignItems: 'center',
    gap: 12,
  },
  permTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  permSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  permBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: hexToRgba(colors.teal, 0.15),
    borderWidth: 1,
    borderColor: hexToRgba(colors.teal, 0.35),
    borderRadius: 10,
  },
  permBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
});
