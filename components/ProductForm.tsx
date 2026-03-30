import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/theme';
import {
  createProduct,
  updateProduct,
  getVendors,
  getAttributeTemplate,
  setProductCustomAttr,
  getProductCustomAttrs,
  getProductPhotos,
  addProductPhoto as dbAddPhoto,
  deleteProductPhoto,
} from '../db/database';
import type { Product, Vendor, ProductPhoto } from '../db/types';
import {
  GARMENT_TYPES,
  COLORS,
  PATTERNS,
  FABRICS,
  WORK_TYPES,
  OCCASIONS,
  SEASONS,
} from '../db/types';
import GlassInput from './ui/GlassInput';
import GlassPicker from './ui/GlassPicker';
import PhotoViewer from './PhotoViewer';
import VoiceNoteBar from './VoiceNoteBar';
import { deleteAudioFile } from '../services/audio';

// ── Annotation templates ──────────────────────────────────────────────────────

const ASYNC_KEY = 'vastra_annotation_templates';
const DEFAULT_ANNOTATIONS = [
  'Shorten sleeve by __ inches',
  'Use heavier fabric',
  'Change button style',
  'Reduce neckline depth',
  'Add pocket',
  'Match color to sample',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomAttr {
  name: string;
  value: string;
}

export interface AIFields {
  garment_type?: string;
  primary_color?: string;
  secondary_color?: string;
  pattern?: string;
  fabric?: string;
  work_type?: string;
  occasion?: string;
  sleeve?: string;
  neck?: string;
}

interface ProductFormProps {
  initial?: Partial<Product>;
  productId?: string;
  aiConfidence?: number;
  aiFields?: AIFields;
}

// ── Photo type badge config ───────────────────────────────────────────────────

const PHOTO_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  main:   { label: 'MAIN',   color: colors.teal },
  back:   { label: 'BACK',   color: colors.blue },
  tag:    { label: 'TAG',    color: colors.amber },
  detail: { label: 'DETAIL', color: colors.purple },
  fabric: { label: 'FABRIC', color: colors.pink },
  grn:    { label: 'GRN',    color: colors.red },
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── AI badge ──────────────────────────────────────────────────────────────────

function AiBadge({ confidence }: { confidence: number }) {
  return (
    <View style={styles.aiBadgeInline}>
      <Text style={styles.aiBadgeText}>AI {confidence}%</Text>
    </View>
  );
}

// ── Label with optional AI badge ─────────────────────────────────────────────

function FieldLabel({ label, showAi, confidence }: { label: string; showAi?: boolean; confidence?: number }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {showAi && confidence != null && <AiBadge confidence={confidence} />}
    </View>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Margin badge ──────────────────────────────────────────────────────────────

function MarginBadge({ pp, sp }: { pp: string; sp: string }) {
  const ppNum = parseFloat(pp);
  const spNum = parseFloat(sp);
  if (!ppNum || !spNum || spNum <= 0) return null;
  const margin = ((spNum - ppNum) / spNum) * 100;
  return (
    <View style={styles.marginBadge}>
      <Text style={styles.marginText}>Margin: {margin.toFixed(1)}%</Text>
    </View>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function ProductForm({ initial, productId, aiConfidence, aiFields }: ProductFormProps) {
  const aiPct = aiConfidence != null ? Math.round(aiConfidence) : undefined;
  const router = useRouter();
  const isEdit = Boolean(productId);

  // Basic fields
  const [designName, setDesignName] = useState(initial?.design_name ?? '');
  const [barcode, setBarcode] = useState(initial?.barcode ?? '');
  const [garmentType, setGarmentType] = useState(initial?.garment_type ?? '');
  const [vendorId, setVendorId] = useState(initial?.vendor_id ?? '');

  // Pricing
  const [pp, setPp] = useState(initial?.purchase_price?.toString() ?? '');
  const [sp, setSp] = useState(initial?.selling_price?.toString() ?? '');
  const [mrp, setMrp] = useState(initial?.mrp?.toString() ?? '');

  // Attributes
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? '');
  const [secondaryColor, setSecondaryColor] = useState(initial?.secondary_color ?? '');
  const [pattern, setPattern] = useState(initial?.pattern ?? '');
  const [fabric, setFabric] = useState(initial?.fabric ?? '');
  const [workType, setWorkType] = useState(initial?.work_type ?? '');
  const [occasion, setOccasion] = useState(initial?.occasion ?? '');
  const [season, setSeason] = useState(initial?.season ?? '');
  const [sleeve, setSleeve] = useState(initial?.sleeve ?? '');
  const [neck, setNeck] = useState(initial?.neck ?? '');
  const [fit, setFit] = useState(initial?.fit ?? '');
  const [length, setLength] = useState(initial?.length ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // Garment-type specific + custom
  const [templateAttrs, setTemplateAttrs] = useState<string[]>([]);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [customAttrs, setCustomAttrs] = useState<CustomAttr[]>(
    initial?.custom_attrs ?? []
  );
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Photos
  const [photos, setPhotos] = useState<ProductPhoto[]>(initial?.photos ?? []);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Voice note
  const [voiceUri, setVoiceUri] = useState<string | undefined>(initial?.voice_note_uri ?? undefined);
  const [voiceDuration, setVoiceDuration] = useState<number | undefined>(undefined);

  // Annotations
  const [annotations, setAnnotations] = useState<string[]>(DEFAULT_ANNOTATIONS);
  const [usedAnnotations, setUsedAnnotations] = useState<Set<string>>(new Set());
  const [addingCustom, setAddingCustom] = useState(false);
  const [customAnnotationText, setCustomAnnotationText] = useState('');

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [saving, setSaving] = useState(false);

  // Load photos for existing product
  useEffect(() => {
    if (!productId) return;
    getProductPhotos(productId).then(setPhotos).catch(() => {});
  }, [productId]);

  const handlePhotoDelete = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const openPhotoViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  // Load vendors
  useEffect(() => {
    getVendors().then(setVendors).catch(() => {});
  }, []);

  // Load custom annotation templates
  useEffect(() => {
    AsyncStorage.getItem(ASYNC_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved: string[] = JSON.parse(raw);
        setAnnotations([...DEFAULT_ANNOTATIONS, ...saved.filter((s) => !DEFAULT_ANNOTATIONS.includes(s))]);
      } catch { /* ignore */ }
    }).catch(() => {});
  }, []);

  // Load template attrs when garment type changes
  useEffect(() => {
    if (!garmentType) { setTemplateAttrs([]); return; }
    getAttributeTemplate(garmentType).then(setTemplateAttrs).catch(() => {});
  }, [garmentType]);

  // Load existing template values for edit
  useEffect(() => {
    if (!productId) return;
    getProductCustomAttrs(productId).then((attrs) => {
      const map: Record<string, string> = {};
      for (const a of attrs) map[a.name] = a.value;
      setTemplateValues(map);
      // separate custom attrs not in template
    }).catch(() => {});
  }, [productId]);

  const vendorOptions = vendors.map((v) => v.name);
  const vendorNameToId = useCallback(
    (name: string) => vendors.find((v) => v.name === name)?.id ?? '',
    [vendors]
  );
  const vendorIdToName = useCallback(
    (id: string) => vendors.find((v) => v.id === id)?.name ?? '',
    [vendors]
  );

  const addCustomAttr = () => {
    if (!newAttrName.trim()) return;
    setCustomAttrs((prev) => [...prev, { name: newAttrName.trim(), value: newAttrValue.trim() }]);
    setNewAttrName('');
    setNewAttrValue('');
  };

  const handleAnnotationTap = (text: string) => {
    setUsedAnnotations((prev) => new Set([...prev, text]));
    setNotes((prev) => prev ? `${prev}\n${text}` : text);
  };

  const saveCustomAnnotation = async () => {
    const t = customAnnotationText.trim();
    if (!t) { setAddingCustom(false); return; }
    const updated = [...annotations, t];
    setAnnotations(updated);
    setAddingCustom(false);
    setCustomAnnotationText('');
    const custom = updated.filter((a) => !DEFAULT_ANNOTATIONS.includes(a));
    await AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(custom)).catch(() => {});
  };

  const handleVoiceRecorded = async (uri: string, duration: number) => {
    setVoiceUri(uri);
    setVoiceDuration(duration);
    if (productId) {
      await updateProduct(productId, { voice_note_uri: uri } as Partial<Product>).catch(() => {});
    }
  };

  const handleVoiceDeleted = async () => {
    if (voiceUri) {
      await deleteAudioFile(voiceUri).catch(() => {});
      if (productId) {
        await updateProduct(productId, { voice_note_uri: undefined } as Partial<Product>).catch(() => {});
      }
    }
    setVoiceUri(undefined);
    setVoiceDuration(undefined);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Partial<Product> = {
        design_name: designName || undefined,
        barcode: barcode || undefined,
        garment_type: garmentType || undefined,
        vendor_id: vendorId || undefined,
        purchase_price: pp ? parseFloat(pp) : undefined,
        selling_price: sp ? parseFloat(sp) : undefined,
        mrp: mrp ? parseFloat(mrp) : undefined,
        primary_color: primaryColor || undefined,
        secondary_color: secondaryColor || undefined,
        pattern: pattern || undefined,
        fabric: fabric || undefined,
        work_type: workType || undefined,
        occasion: occasion || undefined,
        season: season || undefined,
        sleeve: sleeve || undefined,
        neck: neck || undefined,
        fit: fit || undefined,
        length: length || undefined,
        notes: notes || undefined,
        status: 'enriched',
      };

      let id: string;
      if (isEdit && productId) {
        await updateProduct(productId, data);
        id = productId;
      } else {
        id = await createProduct(data);
      }

      // Save template + custom attrs
      for (const attr of templateAttrs) {
        const val = templateValues[attr];
        if (val) await setProductCustomAttr(id, attr, val);
      }
      for (const ca of customAttrs) {
        if (ca.name && ca.value) await setProductCustomAttr(id, ca.name, ca.value);
      }

      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to save product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Section 1: Photos ─── */}
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Photos</Text>

          {photos.length === 0 ? (
            /* No-photo placeholder */
            <View style={styles.noPhotoCard}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                  stroke="rgba(255,255,255,0.2)" strokeWidth={1.8} strokeLinejoin="round" />
                <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z"
                  stroke="rgba(255,255,255,0.2)" strokeWidth={1.8} />
              </Svg>
              <Text style={styles.noPhotoText}>No photos yet</Text>
              <TouchableOpacity
                style={styles.openCameraBtn}
                onPress={() => router.push(
                  productId
                    ? { pathname: '/(tabs)/scan', params: { productId } }
                    : '/(tabs)/scan'
                )}
              >
                <Text style={styles.openCameraBtnText}>Open Camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Photo strip */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStripContent}
            >
              {photos.map((photo, i) => {
                const cfg = PHOTO_TYPE_CONFIG[photo.photo_type] ?? { label: photo.photo_type.toUpperCase(), color: '#FFFFFF' };
                return (
                  <TouchableOpacity
                    key={photo.id}
                    style={[styles.photoThumb, photo.is_primary && styles.photoThumbPrimary]}
                    onPress={() => openPhotoViewer(i)}
                    onLongPress={() => {
                      Alert.alert('Photo Options', undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            await deleteProductPhoto(photo.id);
                            handlePhotoDelete(photo.id);
                          },
                        },
                      ]);
                    }}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.photoThumbImg} resizeMode="cover" />
                    <View style={[styles.photoTypeBadge, { backgroundColor: hexToRgba(cfg.color, 0.2) }]}>
                      <Text style={[styles.photoTypeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Add photo button */}
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={() => router.push(
                  productId
                    ? { pathname: '/(tabs)/scan', params: { productId } }
                    : '/(tabs)/scan'
                )}
              >
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke="rgba(255,255,255,0.35)" strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* ── Section 2: Basic Info ─── */}
        <Section title="Basic Info">
          <GlassInput
            label="Design name"
            value={designName}
            onChangeText={setDesignName}
            placeholder="e.g. Maroon Paisley Kurta"
          />
          <GlassInput
            label="Barcode"
            value={barcode}
            onChangeText={setBarcode}
            placeholder="Scan or type barcode"
          />
          <GlassPicker
            label={<FieldLabel label="Garment type" showAi={!!aiFields?.garment_type} confidence={aiPct} />}
            value={garmentType}
            options={GARMENT_TYPES}
            placeholder="Select garment type"
            onChange={setGarmentType}
          />
          <GlassPicker
            label="Vendor"
            value={vendorIdToName(vendorId)}
            options={vendorOptions}
            placeholder="Select vendor"
            onChange={(name) => setVendorId(vendorNameToId(name))}
          />
        </Section>

        {/* ── Section 3: Pricing ─── */}
        <Section title="Pricing">
          <GlassInput
            label="Purchase Price (PP) ₹"
            value={pp}
            onChangeText={setPp}
            placeholder="0"
            keyboardType="decimal-pad"
          />
          <GlassInput
            label="Selling Price (SP) ₹"
            value={sp}
            onChangeText={setSp}
            placeholder="0"
            keyboardType="decimal-pad"
          />
          <GlassInput
            label="MRP ₹"
            value={mrp}
            onChangeText={setMrp}
            placeholder="0"
            keyboardType="decimal-pad"
          />
          <MarginBadge pp={pp} sp={sp} />
        </Section>

        {/* ── Section 4: Attributes ─── */}
        <Section title="Attributes">
          <GlassPicker
            label={<FieldLabel label="Primary Color" showAi={!!aiFields?.primary_color} confidence={aiPct} />}
            value={primaryColor}
            options={COLORS}
            placeholder="Select color"
            onChange={setPrimaryColor}
          />
          <GlassPicker
            label="Secondary Color"
            value={secondaryColor}
            options={COLORS}
            placeholder="Select color (optional)"
            onChange={setSecondaryColor}
          />
          <GlassPicker
            label={<FieldLabel label="Pattern" showAi={!!aiFields?.pattern} confidence={aiPct} />}
            value={pattern}
            options={PATTERNS}
            placeholder="Select pattern"
            onChange={setPattern}
          />
          <GlassPicker
            label={<FieldLabel label="Fabric" showAi={!!aiFields?.fabric} confidence={aiPct} />}
            value={fabric}
            options={FABRICS}
            placeholder="Select fabric"
            onChange={setFabric}
          />
          <GlassPicker
            label={<FieldLabel label="Work Type" showAi={!!aiFields?.work_type} confidence={aiPct} />}
            value={workType}
            options={WORK_TYPES}
            placeholder="Select work type"
            onChange={setWorkType}
          />
          <GlassPicker
            label={<FieldLabel label="Occasion" showAi={!!aiFields?.occasion} confidence={aiPct} />}
            value={occasion}
            options={OCCASIONS}
            placeholder="Select occasion"
            onChange={setOccasion}
          />
          <GlassPicker
            label="Season"
            value={season}
            options={SEASONS}
            placeholder="Select season"
            onChange={setSeason}
          />
          <GlassInput label={<FieldLabel label="Sleeve" showAi={!!aiFields?.sleeve} confidence={aiPct} />} value={sleeve} onChangeText={setSleeve} placeholder="e.g. 3/4 sleeve" />
          <GlassInput label={<FieldLabel label="Neck" showAi={!!aiFields?.neck} confidence={aiPct} />} value={neck} onChangeText={setNeck} placeholder="e.g. Round" />
          <GlassInput label="Fit" value={fit} onChangeText={setFit} placeholder="e.g. Regular" />
          <GlassInput label="Length" value={length} onChangeText={setLength} placeholder="e.g. Knee length" />
        </Section>

        {/* ── Section 5: Garment-type specific ─── */}
        {templateAttrs.length > 0 && (
          <Section title={`${garmentType} Details`}>
            {templateAttrs.map((attr) => (
              <GlassInput
                key={attr}
                label={attr}
                value={templateValues[attr] ?? ''}
                onChangeText={(val) =>
                  setTemplateValues((prev) => ({ ...prev, [attr]: val }))
                }
                placeholder={`Enter ${attr.toLowerCase()}`}
              />
            ))}
          </Section>
        )}

        {/* ── Custom attributes ─── */}
        <Section title="Custom Attributes">
          {customAttrs.map((ca, i) => (
            <View key={i} style={styles.customAttrRow}>
              <Text style={styles.customAttrName}>{ca.name}</Text>
              <GlassInput
                value={ca.value}
                onChangeText={(val) =>
                  setCustomAttrs((prev) =>
                    prev.map((a, idx) => (idx === i ? { ...a, value: val } : a))
                  )
                }
                placeholder="Value"
                style={styles.customAttrInput}
              />
            </View>
          ))}
          <View style={styles.addAttrRow}>
            <GlassInput
              value={newAttrName}
              onChangeText={setNewAttrName}
              placeholder="Attribute name"
              style={styles.addAttrName}
            />
            <GlassInput
              value={newAttrValue}
              onChangeText={setNewAttrValue}
              placeholder="Value"
              style={styles.addAttrValue}
            />
            <TouchableOpacity style={styles.addAttrBtn} onPress={addCustomAttr}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 5v14M5 12h14"
                  stroke={colors.teal}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ── Section 6: Notes ─── */}
        <Section title="Notes">
          {/* Voice note */}
          <VoiceNoteBar
            voiceUri={voiceUri}
            duration={voiceDuration}
            onRecorded={handleVoiceRecorded}
            onDeleted={handleVoiceDeleted}
          />

          {/* Annotation chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.annotationChips}
            style={styles.annotationScroll}
          >
            {annotations.map((text) => (
              <TouchableOpacity
                key={text}
                style={[styles.annotationChip, usedAnnotations.has(text) && styles.annotationChipUsed]}
                onPress={() => handleAnnotationTap(text)}
                activeOpacity={0.7}
              >
                {usedAnnotations.has(text) && (
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={colors.amber} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
                <Text style={styles.annotationChipText}>{text}</Text>
              </TouchableOpacity>
            ))}
            {addingCustom ? (
              <View style={styles.customAnnotationInput}>
                <TextInput
                  value={customAnnotationText}
                  onChangeText={setCustomAnnotationText}
                  onSubmitEditing={saveCustomAnnotation}
                  onBlur={saveCustomAnnotation}
                  placeholder="Custom template…"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={styles.customAnnotationText}
                  autoFocus
                  returnKeyType="done"
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.annotationAddChip} onPress={() => setAddingCustom(true)}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke={colors.amber} strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Notes textarea */}
          <GlassInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about modifications, fabric changes..."
            multiline
            numberOfLines={4}
            style={styles.notesInput}
          />
        </Section>

        {/* ── AI confidence ─── */}
        {initial?.ai_confidence != null && (
          <Section title="AI Detection">
            <View style={styles.aiRow}>
              <View style={styles.aiBadge}>
                <View style={styles.aiDot} />
                <Text style={styles.aiLabel}>AI detected</Text>
              </View>
              <Text style={styles.aiPct}>
                {Math.round((initial.ai_confidence ?? 0) * 100)}% confidence
              </Text>
            </View>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${Math.round((initial.ai_confidence ?? 0) * 100)}%` },
                ]}
              />
            </View>
          </Section>
        )}

      </ScrollView>

      {/* ── Save button ─── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Product'}</Text>
        </TouchableOpacity>
      </View>

      <PhotoViewer
        photos={photos}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        onDelete={handlePhotoDelete}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },

  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
  },

  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_700Bold',
  },
  aiBadgeInline: {
    backgroundColor: 'rgba(93,202,165,0.1)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5DCAA5',
    fontFamily: 'Inter_700Bold',
  },

  marginBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(93,202,165,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  marginText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5DCAA5',
    fontFamily: 'Inter_700Bold',
  },

  customAttrRow: {
    marginBottom: 8,
  },
  customAttrName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  customAttrInput: {
    marginBottom: 0,
  },
  addAttrRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    marginTop: 4,
  },
  addAttrName: {
    flex: 1,
    marginBottom: 0,
  },
  addAttrValue: {
    flex: 1,
    marginBottom: 0,
  },
  addAttrBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(93,202,165,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },

  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  annotationScroll: {
    marginTop: 10,
    marginBottom: 10,
  },
  annotationChips: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  annotationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,159,39,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  annotationChipUsed: {
    opacity: 0.5,
  },
  annotationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.amber,
    fontFamily: 'Inter_700Bold',
  },
  annotationAddChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(239,159,39,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAnnotationInput: {
    backgroundColor: 'rgba(239,159,39,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 140,
  },
  customAnnotationText: {
    fontSize: 12,
    color: colors.amber,
    fontFamily: 'Inter_400Regular',
  },

  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#5DCAA5',
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5DCAA5',
    fontFamily: 'Inter_700Bold',
  },
  aiPct: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
  },
  confidenceBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: 6,
    backgroundColor: '#5DCAA5',
    borderRadius: 3,
  },

  // Photo strip
  photoSection: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
  },
  noPhotoCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  noPhotoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
  },
  openCameraBtn: {
    marginTop: 4,
    backgroundColor: 'rgba(93,202,165,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.25)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  openCameraBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5DCAA5',
    fontFamily: 'Inter_700Bold',
  },
  photoStripContent: {
    paddingRight: 4,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  photoThumbPrimary: {
    borderWidth: 2,
    borderColor: '#5DCAA5',
  },
  photoThumbImg: {
    width: '100%',
    height: '100%',
  },
  photoTypeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  photoTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },

  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  saveBtn: {
    backgroundColor: '#5DCAA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    fontFamily: 'Inter_800ExtraBold',
  },
});
