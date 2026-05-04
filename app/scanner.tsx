import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { fetchProduct, saveScan } from "./utils/api";

const { width, height } = Dimensions.get("window");

// ── Types ──────────────────────────────────────────────────
interface Alternative {
  barcode: string;
  name: string;
  brand: string;
  image_url?: string;
  base_score: number;
}

// Shape returned by your backend GET /api/product/:barcode
interface ProductData {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  image_url: string;
  nutrients: {
    sugar?: number;
    salt?: number;
    saturated_fat?: number;
    fiber?: number;
    calories?: number;
  };
  score: number;
  score_color: string;
  warnings: string[];
  alternatives: Alternative[];
}

type ScanState = "idle" | "loading" | "result" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

// ── Score helpers ──────────────────────────────────────────
function getScoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: "Great Choice", color: "#16a34a", bg: "#f0fdf4" };
  if (score >= 50) return { label: "Decent",       color: "#ca8a04", bg: "#fefce8" };
  if (score >= 25) return { label: "Not Ideal",    color: "#ea580c", bg: "#fff7ed" };
  return             { label: "Avoid",             color: "#dc2626", bg: "#fef2f2" };
}

// ── Sub-components ─────────────────────────────────────────
const NutrientRow = ({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number;
  unit: string;
}) => (
  <View style={styles.nutriRow}>
    <Text style={styles.nutriLabel}>{label}</Text>
    <Text style={styles.nutriValue}>
      {value !== undefined && value !== null ? `${value.toFixed(1)} ${unit}` : "—"}
    </Text>
  </View>
);

const AlternativeCard = ({
  item,
  onPress,
}: {
  item: Alternative;
  onPress: (barcode: string) => void;
}) => (
  <TouchableOpacity
    style={styles.altCard}
    onPress={() => onPress(item.barcode)}
    activeOpacity={0.75}
  >
    {item.image_url ? (
      <Image source={{ uri: item.image_url }} style={styles.altImage} resizeMode="contain" />
    ) : (
      <View style={[styles.altImage, styles.altImagePlaceholder]}>
        <Icon name="food-outline" size={22} color="#94a3b8" />
      </View>
    )}
    <View style={styles.altInfo}>
      <Text style={styles.altName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.altBrand}>{item.brand}</Text>
    </View>
    <View style={styles.altScoreBadge}>
      <Text style={styles.altScoreText}>{item.base_score}</Text>
      <Icon name="chevron-right" size={14} color="#10b981" />
    </View>
  </TouchableOpacity>
);

// ── Main Screen ────────────────────────────────────────────
export default function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanState, setScanState]         = useState<ScanState>("idle");
  const [product, setProduct]             = useState<ProductData | null>(null);
  const [errorMsg, setErrorMsg]           = useState("");
  const [lastBarcode, setLastBarcode]     = useState("");
  const [saveState, setSaveState]         = useState<SaveState>("idle");

  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const router    = useRouter();

  // Camera permission
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // Scanner line pulse
  useEffect(() => {
    if (scanState === "idle") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [scanState]);

  // ── Sheet helpers ────────────────────────────────────────
  const showSheet = () => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const hideSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,      duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setProduct(null);
      setScanState("idle");
      setLastBarcode("");
      setSaveState("idle");
      callback?.();
    });
  };

  // ── Load product from YOUR backend ──────────────────────
  // This gives us score, warnings, AND alternatives in one call.
  const loadProduct = async (barcode: string) => {
    setScanState("loading");
    setErrorMsg("");
    setSaveState("idle");
    try {
      const p = await fetchProduct(barcode); // GET /api/product/:barcode
      setProduct(p);
      setScanState("result");
      showSheet();
    } catch (err: any) {
      setErrorMsg(err.message || "Could not fetch product data");
      setScanState("error");
    }
  };

  // ── Barcode scanned ──────────────────────────────────────
  const handleBarcodeScanned = ({ data }: { type: string; data: string }) => {
    if (data === lastBarcode || scanState === "loading") return;
    setLastBarcode(data);
    loadProduct(data);
  };

  // ── Save to history ──────────────────────────────────────
  const handleSave = async () => {
    if (!product || saveState === "saving" || saveState === "saved") return;

    setSaveState("saving");
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();

    try {
      await saveScan(product.barcode, product.score);
      setSaveState("saved");
    } catch (err: any) {
      setSaveState("error");
      Alert.alert("Save Failed", err.message || "Could not save. Please try again.");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  // ── Tap an alternative ───────────────────────────────────
  const handleLoadAlternative = (barcode: string) => {
    hideSheet(() => loadProduct(barcode));
  };

  // ── Permission screens ───────────────────────────────────
  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.permissionText}>Requesting camera permission…</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Icon name="camera-off" size={48} color="#94a3b8" />
        <Text style={styles.permissionText}>Camera access denied</Text>
        <Text style={styles.permissionSub}>Enable camera permissions in Settings.</Text>
      </View>
    );
  }

  const isIdle     = scanState === "idle";
  const scoreInfo  = product ? getScoreLabel(product.score) : null;
  const showAlts   = (product?.score ?? 100) < 50 && (product?.alternatives?.length ?? 0) > 0;

  const saveCfg = {
    idle:   { icon: "content-save-outline" as const, text: "Save to History",    color: "#10b981", bg: "#f0fdf4", border: "#10b981" },
    saving: { icon: "loading"              as const, text: "Saving…",            color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
    saved:  { icon: "check-circle-outline" as const, text: "Saved!",             color: "#16a34a", bg: "#dcfce7", border: "#16a34a" },
    error:  { icon: "alert-circle-outline" as const, text: "Failed — Tap Retry", color: "#dc2626", bg: "#fef2f2", border: "#dc2626" },
  }[saveState];

  return (
    <View style={styles.root}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={isIdle ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13","ean8","upc_a","upc_e","code128","code39","qr","pdf417","itf14","codabar"],
        }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan Product</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Viewfinder */}
        <View style={styles.viewfinderWrapper}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {isIdle && <Animated.View style={[styles.scanLine, { opacity: pulseAnim }]} />}

            {scanState === "loading" && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Fetching product…</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom hint */}
        <View style={styles.bottomHint}>
          {scanState === "error" ? (
            <View style={styles.errorCard}>
              <Icon name="alert-circle-outline" size={20} color="#ef4444" />
              <Text style={styles.errorMsg}>{errorMsg}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => { setScanState("idle"); setLastBarcode(""); }}
              >
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.hintCard}>
              <Icon name="barcode-scan" size={20} color="#10b981" />
              <Text style={styles.hintText}>
                {scanState === "loading" ? "Looking up product…" : "Point camera at any barcode"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Result Bottom Sheet ── */}
      {scanState === "result" && product && (
        <>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => hideSheet()}
              activeOpacity={1}
            />
          </Animated.View>

          {/* Sheet */}
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>

              {/* ── Score banner ── */}
              {scoreInfo && (
                <View style={[styles.scoreBanner, { backgroundColor: scoreInfo.bg, borderColor: scoreInfo.color + "33" }]}>
                  <View style={styles.scoreBannerLeft}>
                    <Text style={[styles.scoreBannerLabel, { color: scoreInfo.color }]}>
                      {scoreInfo.label}
                    </Text>
                    {product.warnings.length > 0 && (
                      <View style={styles.warningsList}>
                        {product.warnings.map((w, i) => (
                          <View key={i} style={styles.warningRow}>
                            <Icon name="alert" size={12} color={scoreInfo.color} />
                            <Text style={[styles.warningText, { color: scoreInfo.color }]}>{w}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={[styles.scoreCircle, { borderColor: scoreInfo.color }]}>
                    <Text style={[styles.scoreNumber, { color: scoreInfo.color }]}>{product.score}</Text>
                    <Text style={[styles.scoreMax,    { color: scoreInfo.color + "99" }]}>/100</Text>
                  </View>
                </View>
              )}

              {/* ── Product header ── */}
              <View style={styles.productHeader}>
                {product.image_url ? (
                  <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Icon name="image-off-outline" size={32} color="#cbd5e1" />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.productBrand}>{product.brand}</Text>
                  <Text style={styles.productCategory}>{product.category}</Text>
                </View>
              </View>

              {/* Barcode chip */}
              <View style={styles.barcodeChip}>
                <Icon name="barcode" size={14} color="#64748b" />
                <Text style={styles.barcodeText}>{product.barcode}</Text>
              </View>

              {/* ── Nutrition ── */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>Nutrition per 100g</Text>
                <NutrientRow label="Calories"       value={product.nutrients.calories}      unit="kcal" />
                <NutrientRow label="Sugar"          value={product.nutrients.sugar}          unit="g" />
                <NutrientRow label="Salt"           value={product.nutrients.salt}           unit="g" />
                <NutrientRow label="Saturated fat"  value={product.nutrients.saturated_fat}  unit="g" />
                <NutrientRow label="Fibre"          value={product.nutrients.fiber}          unit="g" />
              </View>

              {/* ── Healthier alternatives (score < 50 only) ── */}
              {showAlts && (
                <View style={styles.altSection}>
                  <View style={styles.altHeader}>
                    <Icon name="leaf" size={16} color="#10b981" />
                    <Text style={styles.altTitle}>Healthier Alternatives</Text>
                  </View>
                  <Text style={styles.altSubtitle}>
                    Same category, better score — tap to inspect:
                  </Text>
                  {product.alternatives.map((alt) => (
                    <AlternativeCard
                      key={alt.barcode}
                      item={alt}
                      onPress={handleLoadAlternative}
                    />
                  ))}
                </View>
              )}

              {/* ── Action row ── */}
              <View style={styles.actionRow}>
                {/* Save button */}
                <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleAnim }] }]}>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: saveCfg.bg, borderColor: saveCfg.border }]}
                    onPress={handleSave}
                    activeOpacity={0.85}
                    disabled={saveState === "saving" || saveState === "saved"}
                  >
                    {saveState === "saving" ? (
                      <ActivityIndicator size="small" color="#64748b" />
                    ) : (
                      <Icon name={saveCfg.icon} size={18} color={saveCfg.color} />
                    )}
                    <Text style={[styles.saveBtnText, { color: saveCfg.color }]}>
                      {saveCfg.text}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* Scan again */}
                <TouchableOpacity
                  style={styles.scanAgainBtn}
                  onPress={() => hideSheet()}
                  activeOpacity={0.85}
                >
                  <Icon name="barcode-scan" size={20} color="#475569" />
                </TouchableOpacity>
              </View>

            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const VIEWFINDER_SIZE  = width * 0.72;
const CORNER_SIZE      = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  permissionContainer: { flex: 1, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  permissionText: { fontSize: 18, fontWeight: "700", color: "#1e293b", textAlign: "center" },
  permissionSub:  { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },

  topBar:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },

  viewfinderWrapper: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewfinder: { width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE, position: "relative", alignItems: "center", justifyContent: "center" },

  corner:   { position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE },
  cornerTL: { top: 0,    left: 0,  borderTopWidth: CORNER_THICKNESS,    borderLeftWidth: CORNER_THICKNESS,  borderColor: "#10b981", borderTopLeftRadius: 4 },
  cornerTR: { top: 0,    right: 0, borderTopWidth: CORNER_THICKNESS,    borderRightWidth: CORNER_THICKNESS, borderColor: "#10b981", borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,  borderColor: "#10b981", borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderColor: "#10b981", borderBottomRightRadius: 4 },

  scanLine: { position: "absolute", width: "85%", height: 2, backgroundColor: "#10b981", borderRadius: 1 },

  loadingOverlay: { position: "absolute", alignItems: "center", gap: 12, backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: 20, paddingHorizontal: 28, borderRadius: 16 },
  loadingText:    { color: "#fff", fontSize: 14, fontWeight: "600" },

  bottomHint: { paddingHorizontal: 24, paddingBottom: 48 },
  hintCard:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20 },
  hintText:   { color: "#fff", fontSize: 14, fontWeight: "500" },
  errorCard:  { backgroundColor: "#fef2f2", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, alignItems: "center", gap: 8 },
  errorMsg:   { color: "#dc2626", fontSize: 13, fontWeight: "500", textAlign: "center" },
  retryBtn:   { backgroundColor: "#ef4444", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 24, marginTop: 4 },
  retryText:  { color: "#fff", fontSize: 13, fontWeight: "700" },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },

  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: height * 0.88,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  sheetHandle:  { width: 40, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Score banner
  scoreBanner:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, padding: 16, marginTop: 12, marginBottom: 4, borderWidth: 1 },
  scoreBannerLeft:  { flex: 1, gap: 6 },
  scoreBannerLabel: { fontSize: 16, fontWeight: "800" },
  warningsList:     { gap: 4 },
  warningRow:       { flexDirection: "row", alignItems: "center", gap: 5 },
  warningText:      { fontSize: 12, fontWeight: "500" },
  scoreCircle:      { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  scoreNumber:      { fontSize: 22, fontWeight: "900", lineHeight: 24 },
  scoreMax:         { fontSize: 10, fontWeight: "600" },

  // Product header
  productHeader:           { flexDirection: "row", gap: 14, paddingVertical: 16, alignItems: "flex-start" },
  productImage:            { width: 80, height: 80, borderRadius: 12, backgroundColor: "#f1f5f9" },
  productImagePlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  productInfo:     { flex: 1, gap: 4, paddingTop: 4 },
  productName:     { fontSize: 17, fontWeight: "800", color: "#1e293b", lineHeight: 22 },
  productBrand:    { fontSize: 13, color: "#64748b", fontWeight: "600" },
  productCategory: { fontSize: 12, color: "#94a3b8", fontWeight: "500", textTransform: "capitalize" },

  barcodeChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f1f5f9", borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, alignSelf: "flex-start", marginBottom: 16 },
  barcodeText: { fontSize: 12, color: "#64748b", fontWeight: "500", letterSpacing: 0.5 },

  // Nutrition
  sectionBox:   { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#1e293b", marginBottom: 12, letterSpacing: -0.2 },
  nutriRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  nutriLabel:   { fontSize: 13, color: "#475569", fontWeight: "500" },
  nutriValue:   { fontSize: 13, color: "#1e293b", fontWeight: "700" },

  // Alternatives
  altSection:  { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0" },
  altHeader:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  altTitle:    { fontSize: 14, fontWeight: "800", color: "#166534" },
  altSubtitle: { fontSize: 12, color: "#16a34a", marginBottom: 12, fontWeight: "500" },
  altCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 12, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: "#dcfce7",
  },
  altImage:            { width: 50, height: 50, borderRadius: 8, backgroundColor: "#f1f5f9" },
  altImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  altInfo:       { flex: 1 },
  altName:       { fontSize: 13, fontWeight: "700", color: "#1e293b", lineHeight: 18 },
  altBrand:      { fontSize: 11, color: "#64748b", fontWeight: "500", marginTop: 2 },
  altScoreBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#dcfce7", borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  altScoreText:  { fontSize: 13, fontWeight: "800", color: "#16a34a" },

  // Actions
  actionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 2, borderRadius: 20, paddingVertical: 14,
  },
  saveBtnText: { fontSize: 15, fontWeight: "700" },
  scanAgainBtn: {
    width: 52, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#e2e8f0", borderRadius: 20, backgroundColor: "#f8fafc",
  },
});