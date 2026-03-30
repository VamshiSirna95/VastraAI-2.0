import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { colors } from '../constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PatternType = 'wave' | 'grid' | 'hexdots' | 'blobs' | 'zigzag' | 'rings';

export interface MetricData {
  value: string;
  label: string;
  color: string;
}

export interface ModuleCardProps {
  name: string;
  accent: string;
  title: string;
  metrics: MetricData[];
  patternType: PatternType;
  width: number;
}

// ── Module-level constants ────────────────────────────────────────────────────

const PATTERN_H = 100;

// ── Animation Clock (single RAF shared across all cards) ─────────────────────

type FrameListener = (t: number) => void;
const _listeners = new Set<FrameListener>();
let _t = 0;
let _rafId: number | null = null;

function _tick() {
  _t += 0.02;
  _listeners.forEach(fn => fn(_t));
  _rafId = requestAnimationFrame(_tick);
}

function subscribeFrame(fn: FrameListener): () => void {
  if (_listeners.size === 0) {
    _rafId = requestAnimationFrame(_tick);
  }
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
    if (_listeners.size === 0 && _rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  };
}

function useFrameTime(): number {
  const [t, setT] = useState(_t);
  useEffect(() => subscribeFrame((newT) => setT(newT)), []);
  return t;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function polylinePoints(w: number, amp: number, freq: number, phase: number, cy: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 4) {
    const y = cy + amp * Math.sin(freq * x + phase);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

// ── Pattern: Wave (Enrichment — teal) ────────────────────────────────────────

function WavePattern({ width, t }: { width: number; t: number }) {
  return (
    <Svg width={width} height={PATTERN_H}>
      <Polyline
        points={polylinePoints(width, 10, 0.08, t, PATTERN_H * 0.45)}
        fill="none" stroke={colors.teal} strokeWidth={1.5} opacity={0.55}
      />
      <Polyline
        points={polylinePoints(width, 14, 0.06, t + 1.0, PATTERN_H * 0.55)}
        fill="none" stroke={colors.blue} strokeWidth={1.5} opacity={0.35}
      />
      <Polyline
        points={polylinePoints(width, 8, 0.10, t + 2.0, PATTERN_H * 0.35)}
        fill="none" stroke="#1D9E75" strokeWidth={1.5} opacity={0.30}
      />
    </Svg>
  );
}

// ── Pattern: Grid (Purchase — amber) ─────────────────────────────────────────

const GRID_SPACING = 12;

function GridPattern({ width, t, accent }: { width: number; t: number; accent: string }) {
  const lineOpacity = 0.2 + 0.12 * Math.sin(t * 1.5);

  const vLines = useMemo(() => {
    const xs: number[] = [];
    for (let x = 0; x <= width; x += GRID_SPACING) xs.push(x);
    return xs;
  }, [width]);

  const hLines = useMemo(() => {
    const ys: number[] = [];
    for (let y = 0; y <= PATTERN_H; y += GRID_SPACING) ys.push(y);
    return ys;
  }, []);

  const dotBases = useMemo(() => [
    { bx: width * 0.28, by: PATTERN_H * 0.5, orbitR: 13, orbitRy: 7, speed: 0.8, phase: 0 },
    { bx: width * 0.65, by: PATTERN_H * 0.5, orbitR: 10, orbitRy: 6, speed: 0.6, phase: 2.1 },
    { bx: width * 0.5, by: PATTERN_H * 0.38, orbitR: 17, orbitRy: 8, speed: 0.4, phase: 1.0 },
    { bx: width * 0.2, by: PATTERN_H * 0.62, orbitR: 9, orbitRy: 5, speed: 1.0, phase: 3.5 },
  ], [width]);

  return (
    <Svg width={width} height={PATTERN_H}>
      {vLines.map((x, i) => (
        <Line key={`v${i}`} x1={x} y1={0} x2={x} y2={PATTERN_H}
          stroke={accent} strokeWidth={0.5} opacity={lineOpacity} />
      ))}
      {hLines.map((y, i) => (
        <Line key={`h${i}`} x1={0} y1={y} x2={width} y2={y}
          stroke={accent} strokeWidth={0.5} opacity={lineOpacity} />
      ))}
      {dotBases.map((d, i) => (
        <Circle
          key={`d${i}`}
          cx={d.bx + d.orbitR * Math.cos(t * d.speed + d.phase)}
          cy={d.by + d.orbitRy * Math.sin(t * d.speed + d.phase)}
          r={3} fill={accent} opacity={0.75}
        />
      ))}
    </Svg>
  );
}

// ── Pattern: HexDots (Warehouse — blue) ──────────────────────────────────────

const HEX_SPACING = 22;
const HEX_V_SPACING = HEX_SPACING * 0.866;

function HexDotsPattern({ width, t, accent }: { width: number; t: number; accent: string }) {
  const dots = useMemo(() => {
    const result: Array<{ x: number; y: number; idx: number }> = [];
    let idx = 0;
    for (let row = 0; row * HEX_V_SPACING <= PATTERN_H + HEX_SPACING; row++) {
      const offset = row % 2 === 0 ? 0 : HEX_SPACING * 0.5;
      for (let col = 0; col * HEX_SPACING - HEX_SPACING * 0.5 + offset <= width + HEX_SPACING; col++) {
        const x = col * HEX_SPACING - HEX_SPACING * 0.5 + offset;
        const y = row * HEX_V_SPACING;
        if (x >= -4 && x <= width + 4 && y >= -4 && y <= PATTERN_H + 4) {
          result.push({ x, y, idx: idx++ });
        } else {
          idx++;
        }
      }
    }
    return result.filter(d => d.x >= -4 && d.x <= width + 4 && d.y >= -4 && d.y <= PATTERN_H + 4);
  }, [width]);

  return (
    <Svg width={width} height={PATTERN_H}>
      {dots.map((d) => {
        const r = Math.max(0.5, 2 + 1.2 * Math.sin(t + d.idx * 0.31));
        const op = 0.22 + 0.2 * Math.sin(t * 0.8 + d.idx * 0.4);
        return <Circle key={d.idx} cx={d.x} cy={d.y} r={r} fill={accent} opacity={op} />;
      })}
    </Svg>
  );
}

// ── Pattern: Blobs (Intelligence — pink/purpleLight) ─────────────────────────

function BlobsPattern({ width, t }: { width: number; t: number }) {
  const blobDefs = useMemo(() => [
    { bx: width * 0.2, by: PATTERN_H * 0.45, orx: 24, ory: 14, speed: 0.7, phase: 0, color: colors.pink, r: 14, alpha: 0.30 },
    { bx: width * 0.65, by: PATTERN_H * 0.55, orx: 20, ory: 16, speed: 0.5, phase: 1.1, color: colors.purpleLight, r: 18, alpha: 0.25 },
    { bx: width * 0.4, by: PATTERN_H * 0.28, orx: 14, ory: 10, speed: 0.9, phase: 2.2, color: colors.pink, r: 12, alpha: 0.20 },
    { bx: width * 0.75, by: PATTERN_H * 0.35, orx: 21, ory: 11, speed: 0.6, phase: 3.3, color: colors.purpleLight, r: 16, alpha: 0.28 },
    { bx: width * 0.3, by: PATTERN_H * 0.72, orx: 17, ory: 10, speed: 0.8, phase: 4.4, color: colors.pink, r: 10, alpha: 0.22 },
  ], [width]);

  return (
    <Svg width={width} height={PATTERN_H}>
      {blobDefs.map((b, i) => {
        const cx = b.bx + b.orx * Math.cos(t * b.speed + b.phase);
        const cy = b.by + b.ory * Math.sin(t * b.speed + b.phase);
        const r = Math.max(4, b.r + 2 * Math.sin(t * 1.2 + b.phase));
        return <Circle key={i} cx={cx} cy={cy} r={r} fill={b.color} opacity={b.alpha} />;
      })}
    </Svg>
  );
}

// ── Pattern: Zigzag (Analytics — purpleLight) ─────────────────────────────────

const CHEV_W = 18;
const CHEV_H = 10;
const ZIGZAG_ROWS = [16, 50, 82] as const;

function ZigzagPattern({ width, t, accent }: { width: number; t: number; accent: string }) {
  const allChevrons = useMemo(() => {
    const result: Array<{ cx: number; y0: number; y1: number; ri: number; ci: number }> = [];
    ZIGZAG_ROWS.forEach((rowY, ri) => {
      let ci = 0;
      for (let cx = CHEV_W / 2; cx <= width + CHEV_W; cx += CHEV_W) {
        result.push({ cx, y0: rowY, y1: rowY + CHEV_H, ri, ci: ci++ });
      }
    });
    return result;
  }, [width]);

  return (
    <Svg width={width} height={PATTERN_H}>
      {allChevrons.map((c) => {
        const shift = 6 * Math.sin(t * 0.9 + c.ri * 1.2);
        const lw = 3 + 3 * Math.sin(t * 0.7 + c.ri * 0.8);
        const op = 0.12 + 0.15 * Math.sin(t * 0.6 + c.ri);
        const x0 = (c.cx - CHEV_W / 2 + shift).toFixed(1);
        const x1 = (c.cx + shift).toFixed(1);
        const x2 = (c.cx + CHEV_W / 2 + shift).toFixed(1);
        return (
          <Path
            key={`${c.ri}-${c.ci}`}
            d={`M${x0},${c.y1} L${x1},${c.y0} L${x2},${c.y1}`}
            fill="none" stroke={accent}
            strokeWidth={lw} strokeLinejoin="round" strokeLinecap="round"
            opacity={op}
          />
        );
      })}
    </Svg>
  );
}

// ── Pattern: Rings (Vendors — red) ───────────────────────────────────────────

const RING_BASE_RADII = [10, 22, 34, 46, 58] as const;

function RingsPattern({ width, t, accent }: { width: number; t: number; accent: string }) {
  const cx = width * 0.55;
  const cy = 44;
  return (
    <Svg width={width} height={PATTERN_H}>
      {RING_BASE_RADII.map((baseR, i) => {
        const r = Math.max(1, baseR + 3 * Math.sin(t + i * 0.5));
        const op = 0.10 + 0.12 * Math.sin(t * 0.8 + i * 0.9);
        return (
          <Circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={accent} strokeWidth={1} opacity={op} />
        );
      })}
    </Svg>
  );
}

// ── Pattern Canvas dispatcher ─────────────────────────────────────────────────

function PatternCanvas({ patternType, width, accent, t }: {
  patternType: PatternType;
  width: number;
  accent: string;
  t: number;
}) {
  switch (patternType) {
    case 'wave':    return <WavePattern width={width} t={t} />;
    case 'grid':    return <GridPattern width={width} t={t} accent={accent} />;
    case 'hexdots': return <HexDotsPattern width={width} t={t} accent={accent} />;
    case 'blobs':   return <BlobsPattern width={width} t={t} />;
    case 'zigzag':  return <ZigzagPattern width={width} t={t} accent={accent} />;
    case 'rings':   return <RingsPattern width={width} t={t} accent={accent} />;
    default:        return null;
  }
}

// ── ModuleCard ────────────────────────────────────────────────────────────────

export default function ModuleCard({
  name, accent, title, metrics, patternType, width,
}: ModuleCardProps) {
  const t = useFrameTime();

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.patternContainer}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hexToRgba(accent, 0.08) }]} />
        <PatternCanvas patternType={patternType} width={width} accent={accent} t={t} />
      </View>
      <View style={styles.bottom}>
        <View style={[styles.eyebrowTag, { backgroundColor: hexToRgba(accent, 0.12) }]}>
          <Text style={[styles.eyebrowText, { color: accent }]}>{name}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.metricsRow}>
          {metrics.map((m, i) => (
            <View key={i}>
              <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  patternContainer: {
    height: PATTERN_H,
    overflow: 'hidden',
  },
  bottom: {
    backgroundColor: 'rgba(14,14,14,0.95)',
    padding: 14,
  },
  eyebrowTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 6,
    marginBottom: 0,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});
