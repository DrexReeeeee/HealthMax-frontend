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
import {
  fetchProduct,
  saveScan,
  isPHAlternative,
  buildProductFromAlternative,
  type ProductData,
  type Alternative,
} from "./utils/api";

const { width, height } = Dimensions.get("window");

type ScanState = "idle" | "loading" | "result" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

function getScoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: "Great Choice", color: "#16a34a", bg: "#f0fdf4" };
  if (score >= 60) return { label: "Decent",       color: "#ca8a04", bg: "#fefce8" };
  if (score >= 45) return { label: "Not Ideal",    color: "#ea580c", bg: "#fff7ed" };
  return             { label: "Avoid",             color: "#dc2626", bg: "#fef2f2" };
}

function gradeColor(grade: string): string {
  return { A: "#16a34a", B: "#65a30d", C: "#ca8a04", D: "#ea580c", E: "#dc2626" }[grade] ?? "#64748b";
}

function getMultiplierColor(multiplier: number): { color: string; bg: string; border: string } {
  if (multiplier >= 5) return { color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" };
  if (multiplier >= 3) return { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" };
  if (multiplier >= 2) return { color: "#ea580c", bg: "#fff7ed", border: "#fdba74" };
  return                      { color: "#ca8a04", bg: "#fefce8", border: "#fde047" };
}

const NutrientRow = ({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number | null;
  unit: string;
}) => (
  <View style={styles.nutriRow}>
    <Text style={styles.nutriLabel}>{label}</Text>
    <Text style={styles.nutriValue}>
      {value !== undefined && value !== null && !isNaN(value)
        ? `${value.toFixed(1)} ${unit}`
        : "—"}
    </Text>
  </View>
);

const AlternativeCard = ({
  item,
  onPress,
  showWhereToBuy = false,
}: {
  item: Alternative;
  onPress: (barcode: string) => void;
  showWhereToBuy?: boolean;
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
      {item.description ? (
        <Text style={styles.altDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : item.reason ? (
        <Text style={styles.altReason} numberOfLines={2}>{item.reason}</Text>
      ) : null}
      {showWhereToBuy && item.where_to_buy ? (
        <View style={styles.whereToBuyRow}>
          <Icon name="map-marker-outline" size={11} color="#0369a1" />
          <Text style={styles.whereToBuyText} numberOfLines={1}>{item.where_to_buy}</Text>
        </View>
      ) : null}
    </View>
    <View style={styles.altScoreBadge}>
      <Text style={styles.altScoreText}>{item.score}</Text>
      <Icon name="chevron-right" size={14} color="#10b981" />
    </View>
  </TouchableOpacity>
);

export default function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanState, setScanState]         = useState<ScanState>("idle");
  const [product, setProduct]             = useState<ProductData | null>(null);
  const [originalProduct, setOriginalProduct] = useState<ProductData | null>(null);
  const [errorMsg, setErrorMsg]           = useState("");
  const [lastBarcode, setLastBarcode]     = useState("");
  const [saveState, setSaveState]         = useState<SaveState>("idle");
  const [lastScanTime, setLastScanTime]   = useState<number>(0);
  const [consecutiveScans, setConsecutiveScans] = useState(0);
  const [isPHView, setIsPHView] = useState(false);

  const currentAltsRef = useRef<Alternative[]>([]);

  const [streakBonus, setStreakBonus] = useState<{
    multiplier: number;
    points_earned: number;
    current_streak: number;
    consecutive_scans?: number;
  } | null>(null);
  const bonusAnim  = useRef(new Animated.Value(0)).current;
  const bonusScale = useRef(new Animated.Value(0.8)).current;
  const streakAnim = useRef(new Animated.Value(1)).current;

  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const router    = useRouter();

  const triggerStreakAnimation = () => {
    Animated.sequence([
      Animated.timing(streakAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(streakAnim, { toValue: 1,   duration: 150, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

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

  const showBonusToast = (multiplier: number, points_earned: number, current_streak: number, consecutive_scans?: number) => {
    setStreakBonus({ multiplier, points_earned, current_streak, consecutive_scans });
    bonusAnim.setValue(0);
    bonusScale.setValue(0.8);
    if (multiplier >= 3) triggerStreakAnimation();
    Animated.parallel([
      Animated.spring(bonusAnim,  { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.spring(bonusScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
    ]).start();
    setTimeout(() => {
      Animated.timing(bonusAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setStreakBonus(null);
      });
    }, 4000);
  };

  const checkConsecutiveScan = () => {
    const now = Date.now();
    const timeSinceLastScan = now - lastScanTime;
    if (timeSinceLastScan < 30000 && lastScanTime !== 0) {
      const newCount = consecutiveScans + 1;
      setConsecutiveScans(newCount);
      if (newCount >= 2) triggerStreakAnimation();
    } else {
      setConsecutiveScans(1);
    }
    setLastScanTime(now);
    return consecutiveScans + 1;
  };

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
      setOriginalProduct(null);
      setScanState("idle");
      setLastBarcode("");
      setSaveState("idle");
      setStreakBonus(null);
      setIsPHView(false);
      currentAltsRef.current = [];
      callback?.();
    });
  };

  const loadProduct = async (barcode: string) => {
    setScanState("loading");
    setErrorMsg("");
    setSaveState("idle");
    setStreakBonus(null);
    setIsPHView(false);
    checkConsecutiveScan();
    try {
      const p = await fetchProduct(barcode);
      setProduct(p);
      setOriginalProduct(p);
      currentAltsRef.current = p.alternatives ?? [];
      setScanState("result");
      showSheet();
    } catch (err: any) {
      setErrorMsg(err.message || "Could not fetch product data");
      setScanState("error");
    }
  };

  const loadPHAlternative = (alt: Alternative) => {
    setScanState("loading");
    setErrorMsg("");
    setSaveState("idle");
    setStreakBonus(null);
    setIsPHView(true);

    setTimeout(() => {
      try {
        const p = buildProductFromAlternative(alt);
        setProduct(p);
        // CRITICAL FIX: Don't clear originalProduct when loading PH alternative
        // Keep originalProduct unchanged (the original scanned product)
        currentAltsRef.current = [];
        setScanState("result");
        showSheet();
      } catch (err: any) {
        setErrorMsg(err.message || "Could not load alternative details");
        setScanState("error");
        setIsPHView(false);
      }
    }, 300);
  };

  const handleBarcodeScanned = ({ data }: { type: string; data: string }) => {
    if (data === lastBarcode || scanState === "loading") return;
    setLastBarcode(data);
    loadProduct(data);
  };

  const handleLoadAlternative = (barcode: string) => {
    const alt = currentAltsRef.current.find(a => a.barcode === barcode);

    if (alt && isPHAlternative(alt)) {
      // Don't hide the sheet and lose originalProduct
      // Instead, directly load the PH alternative while keeping the sheet visible
      loadPHAlternativeDirect(alt);
    } else {
      hideSheet(() => loadProduct(barcode));
    }
  };

  // New function to load PH alternative without hiding the sheet
  const loadPHAlternativeDirect = (alt: Alternative) => {
    setScanState("loading");
    setErrorMsg("");
    setSaveState("idle");
    setStreakBonus(null);
    setIsPHView(true);

    setTimeout(() => {
      try {
        const p = buildProductFromAlternative(alt);
        setProduct(p);
        currentAltsRef.current = [];
        setScanState("result");
        // Don't call showSheet() again since sheet is already visible
      } catch (err: any) {
        setErrorMsg(err.message || "Could not load alternative details");
        setScanState("error");
        setIsPHView(false);
      }
    }, 300);
  };

  const handleSave = async () => {
    if (!product || saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    const baseScale = 1 + (consecutiveScans * 0.05);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: baseScale > 1.3 ? 1.3 : baseScale, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    try {
      const result = await saveScan(
        product.barcode,
        product.evaluation.score,
        product,
        product.alternatives,
        product.description,
        product.warnings,
        product.tips,
      );
      setSaveState("saved");
      const gam = result?.gamification as any;
      let finalMultiplier = gam?.multiplier || 1;
      let finalPoints     = gam?.points_earned || 0;
      if (consecutiveScans > 1) {
        const sessionMultiplier = Math.min(consecutiveScans * 0.2, 2.0);
        finalMultiplier = finalMultiplier * (1 + sessionMultiplier);
        finalPoints     = Math.floor(finalPoints * (1 + sessionMultiplier));
      }
      if (finalMultiplier > 1 && finalPoints > 0) {
        showBonusToast(finalMultiplier, finalPoints, gam?.current_streak || 1, consecutiveScans);
        if (finalMultiplier >= 3) triggerStreakAnimation();
      }
    } catch (err: any) {
      setSaveState("error");
      Alert.alert("Save Failed", err.message || "Could not save. Please try again.");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  const handleBackToOriginal = () => {
    if (originalProduct) {
      setProduct(originalProduct);
      setIsPHView(false);
      setSaveState("idle");
      // Also restore alternatives reference if needed
      currentAltsRef.current = originalProduct.alternatives ?? [];
    } else {
      Alert.alert("Error", "No original product to return to");
    }
  };

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

  const isIdle    = scanState === "idle";
  const score     = product?.evaluation?.score ?? 0;
  const scoreInfo = product ? getScoreLabel(score) : null;

  const showAltsSection = score < 95 && !isPHView;
  const globalAlts = product?.alternatives?.filter(a => !isPHAlternative(a)) ?? [];
  const phAlts     = product?.alternatives?.filter(a =>  isPHAlternative(a)) ?? [];
  const hasAlts    = globalAlts.length > 0;
  const hasPHAlts  = phAlts.length > 0;

  const saveCfg = {
    idle:   { icon: "content-save-outline" as const, text: "Save to History",    color: "#10b981", bg: "#f0fdf4", border: "#10b981" },
    saving: { icon: "loading"              as const, text: "Saving…",            color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
    saved:  { icon: "check-circle-outline" as const, text: "Saved!",             color: "#16a34a", bg: "#dcfce7", border: "#16a34a" },
    error:  { icon: "alert-circle-outline" as const, text: "Failed — Tap Retry", color: "#dc2626", bg: "#fef2f2", border: "#dc2626" },
  }[saveState];

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={isIdle ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13","ean8","upc_a","upc_e","code128","code39","qr","pdf417","itf14","codabar"],
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan Product</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.viewfinderWrapper}>
          <Animated.View style={[styles.viewfinder, { transform: [{ scale: streakAnim }] }]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {isIdle && <Animated.View style={[styles.scanLine, { opacity: pulseAnim }]} />}
            {scanState === "loading" && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>
                  {isPHView ? "Loading alternative…" : "Fetching product…"}
                </Text>
              </View>
            )}
            {consecutiveScans > 1 && isIdle && (
              <Animated.View style={[styles.consecutiveBadge, { transform: [{ scale: streakAnim }] }]}>
                <Icon name="fire" size={14} color="#ff6b6b" />
                <Text style={styles.consecutiveText}>x{consecutiveScans}</Text>
              </Animated.View>
            )}
          </Animated.View>
        </View>

        <View style={styles.bottomHint}>
          {scanState === "error" ? (
            <View style={styles.errorCard}>
              <Icon name="alert-circle-outline" size={20} color="#ef4444" />
              <Text style={styles.errorMsg}>{errorMsg}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => { setScanState("idle"); setLastBarcode(""); setIsPHView(false); }}
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
              {consecutiveScans > 1 && (
                <View style={styles.streakHint}>
                  <Icon name="fire" size={12} color="#ff6b6b" />
                  <Text style={styles.streakHintText}>{consecutiveScans}x scan streak!</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {scanState === "result" && product && (
        <>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => hideSheet()} activeOpacity={1} />
          </Animated.View>

          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>

              {/* ── Score banner ── */}
              {scoreInfo && (
                <View style={[styles.scoreBanner, { backgroundColor: scoreInfo.bg, borderColor: scoreInfo.color + "33" }]}>
                  <View style={styles.scoreBannerLeft}>
                    <View style={styles.scoreLabelRow}>
                      <Text style={[styles.scoreBannerLabel, { color: scoreInfo.color }]}>
                        {scoreInfo.label}
                      </Text>
                      <View style={[styles.gradePill, { backgroundColor: gradeColor(product.evaluation.grade) }]}>
                        <Text style={styles.gradePillText}>{product.evaluation.grade}</Text>
                      </View>
                      {product.nutriscore && (
                        <View style={[styles.gradePill, { backgroundColor: "#64748b" }]}>
                          <Text style={styles.gradePillText}>NS {product.nutriscore}</Text>
                        </View>
                      )}
                      {isPHView && (
                        <View style={[styles.gradePill, { backgroundColor: "#1d4ed8" }]}>
                          <Text style={styles.gradePillText}>🇵🇭 PH Est.</Text>
                        </View>
                      )}
                    </View>
                    {product.warnings.length > 0 && (
                      <View style={styles.warningsList}>
                        {product.warnings.map((w, i) => (
                          <View key={i} style={styles.warningRow}>
                            <Text style={[styles.warningText, { color: scoreInfo.color }]}>{w}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {(product.description || (isPHView && product.description)) ? (
                      <View style={styles.descriptionCard}>
                        <Icon name="information-outline" size={16} color="#1d4ed8" />
                        <Text style={styles.descriptionCardText}>{product.description}</Text>
                      </View>
                    ) : product.description ? (
                      <Text style={styles.descriptionText}>{product.description}</Text>
                    ) : null}
                    {product.tips?.length > 0 && (
                      <View style={styles.tipsList}>
                        {product.tips.map((t, i) => (
                          <Text key={i} style={styles.tipText}>{t}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={[styles.scoreCircle, { borderColor: scoreInfo.color }]}>
                    <Text style={[styles.scoreNumber, { color: scoreInfo.color }]}>{score}</Text>
                    <Text style={[styles.scoreMax, { color: scoreInfo.color + "99" }]}>/100</Text>
                  </View>
                </View>
              )}

              {/* ── Product header ── */}
              <View style={styles.productHeader}>
                {product.image_url ? (
                  <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Icon
                      name={isPHView ? "flag" : "image-off-outline"}
                      size={32}
                      color={isPHView ? "#3b82f6" : "#cbd5e1"}
                    />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.productBrand}>{product.brand}</Text>
                  <Text style={styles.productCategory}>
                    {isPHView ? "🇵🇭 Philippine Alternative" : product.category}
                  </Text>
                </View>
              </View>

              {!isPHView && (
                <View style={styles.barcodeChip}>
                  <Icon name="barcode" size={14} color="#64748b" />
                  <Text style={styles.barcodeText}>{product.barcode}</Text>
                </View>
              )}

              {/* ── Nutrition section ── */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>
                  Nutrition per 100g
                  {isPHView ? " (estimated)" : ""}
                </Text>
                <NutrientRow label="Calories"      value={product.nutrients.energy_kcal}    unit="kcal" />
                <NutrientRow label="Sugar"         value={product.nutrients.sugar_g}         unit="g" />
                <NutrientRow label="Sodium"        value={product.nutrients.sodium_mg != null
                                                          ? product.nutrients.sodium_mg / 1000
                                                          : null}                            unit="g" />
                <NutrientRow label="Saturated fat" value={product.nutrients.saturated_fat_g} unit="g" />
                <NutrientRow label="Fibre"         value={product.nutrients.fiber_g}         unit="g" />
                <NutrientRow label="Protein"       value={product.nutrients.protein_g}       unit="g" />
                {product.nutrients.nova_group && (
                  <View style={styles.nutriRow}>
                    <Text style={styles.nutriLabel}>NOVA group</Text>
                    <Text style={[
                      styles.nutriValue,
                      { color: product.nutrients.nova_group === 4 ? "#dc2626"
                              : product.nutrients.nova_group === 3 ? "#ea580c"
                              : "#16a34a" }
                    ]}>
                      {product.nutrients.nova_group} / 4
                    </Text>
                  </View>
                )}
                {product.nutrients.additives_count > 0 && (
                  <View style={styles.nutriRow}>
                    <Text style={styles.nutriLabel}>Additives</Text>
                    <Text style={[styles.nutriValue, { color: product.nutrients.additives_count > 5 ? "#dc2626" : "#ea580c" }]}>
                      {product.nutrients.additives_count}
                    </Text>
                  </View>
                )}
                {isPHView && (
                  <View style={styles.estimatedBanner}>
                    <Icon name="information-outline" size={13} color="#1d4ed8" />
                    <Text style={styles.estimatedNote}>
                      Nutrition values are estimated. Score is approximate.
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Healthier alternatives ── */}
              {showAltsSection && (
                <>
                  <View style={styles.altSection}>
                    <View style={styles.altHeader}>
                      <Icon name="leaf" size={16} color="#10b981" />
                      <Text style={styles.altTitle}>Healthier Alternatives</Text>
                    </View>
                    {hasAlts ? (
                      <>
                        <Text style={styles.altSubtitle}>
                          Same category, better score — tap to inspect:
                        </Text>
                        {globalAlts.map((alt) => (
                          <AlternativeCard key={alt.barcode} item={alt} onPress={handleLoadAlternative} />
                        ))}
                      </>
                    ) : (
                      <View style={styles.noAltsContainer}>
                        <Icon name="magnify-close" size={32} color="#86efac" />
                        <Text style={styles.noAltsTitle}>No alternatives found</Text>
                        <Text style={styles.noAltsSubtitle}>
                          We couldn't find a healthier option in this category right now.
                        </Text>
                      </View>
                    )}
                  </View>

                  {hasPHAlts && (
                    <View style={styles.phAltSection}>
                      <View style={styles.altHeader}>
                        <Text style={styles.phFlag}>🇵🇭</Text>
                        <Text style={styles.phAltTitle}>Available in the Philippines</Text>
                      </View>
                      <Text style={styles.altSubtitle}>
                        Locally available healthier options — tap to inspect:
                      </Text>
                      {phAlts.map((alt) => (
                        <AlternativeCard
                          key={alt.barcode}
                          item={alt}
                          onPress={handleLoadAlternative}
                          showWhereToBuy
                        />
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* ── Streak bonus toast ── */}
              {streakBonus && (() => {
                const mc = getMultiplierColor(streakBonus.multiplier);
                return (
                  <Animated.View
                    style={[
                      styles.bonusToast,
                      { backgroundColor: mc.bg, borderColor: mc.border },
                      {
                        opacity: bonusAnim,
                        transform: [
                          { scale: bonusScale },
                          { translateY: bonusAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.bonusLeft}>
                      <Animated.Text style={[styles.bonusEmoji, { transform: [{ scale: streakAnim }] }]}>
                        {streakBonus.multiplier >= 5 ? "💎" : streakBonus.multiplier >= 3 ? "🔥🔥" : "🔥"}
                      </Animated.Text>
                      <View style={styles.bonusTextGroup}>
                        <Text style={[styles.bonusTitle, { color: mc.color }]}>
                          {streakBonus.multiplier}x Streak Bonus!
                        </Text>
                        <Text style={[styles.bonusSub, { color: mc.color + "bb" }]}>
                          {streakBonus.current_streak}-day streak
                          {streakBonus.consecutive_scans && streakBonus.consecutive_scans > 1
                            ? ` · ${streakBonus.consecutive_scans}x scan streak!`
                            : ' · keep it up!'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.bonusPointsBadge, { backgroundColor: mc.color }]}>
                      <Text style={styles.bonusPointsText}>+{streakBonus.points_earned}</Text>
                      <Text style={styles.bonusPointsLabel}>pts</Text>
                    </View>
                  </Animated.View>
                );
              })()}

              {/* ── Action row ── */}
              <View style={styles.actionRow}>
                {!isPHView ? (
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
                ) : (
                  <>
                    {/* Save History button for PH alternative */}
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
                    
                    {/* Back button to return to original scanned product */}
                    <TouchableOpacity
                      style={styles.backToOriginalBtn}
                      onPress={handleBackToOriginal}
                      activeOpacity={0.85}
                    >
                      <Icon name="arrow-left" size={18} color="#1d4ed8" />
                      <Text style={styles.backToOriginalText}>Back to Original</Text>
                    </TouchableOpacity>
                  </>
                )}

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
  hintText:   { color: "#fff", fontSize: 14, fontWeight: "500", flex: 1 },
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

  scoreBanner:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderRadius: 16, padding: 16, marginTop: 12, marginBottom: 4, borderWidth: 1 },
  scoreBannerLeft:  { flex: 1, gap: 6 },
  scoreLabelRow:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  scoreBannerLabel: { fontSize: 16, fontWeight: "800" },
  gradePill:        { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 8 },
  gradePillText:    { fontSize: 11, fontWeight: "800", color: "#fff" },
  warningsList:     { gap: 4 },
  warningRow:       { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  warningText:      { fontSize: 12, fontWeight: "500", flex: 1 },
  
  descriptionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  descriptionCardText: {
    fontSize: 13,
    color: "#1e293b",
    lineHeight: 19,
    fontWeight: "500",
    flex: 1,
  },
  descriptionText:  { fontSize: 13, color: '#374151', lineHeight: 19, fontWeight: '400', marginTop: 2 },
  tipsList:         { gap: 4, marginTop: 4 },
  tipText:          { fontSize: 12, color: "#0369a1", fontWeight: "500" },
  scoreCircle:      { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  scoreNumber:      { fontSize: 22, fontWeight: "900", lineHeight: 24 },
  scoreMax:         { fontSize: 10, fontWeight: "600" },

  productHeader:           { flexDirection: "row", gap: 14, paddingVertical: 16, alignItems: "flex-start" },
  productImage:            { width: 80, height: 80, borderRadius: 12, backgroundColor: "#f1f5f9" },
  productImagePlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  productInfo:     { flex: 1, gap: 4, paddingTop: 4 },
  productName:     { fontSize: 17, fontWeight: "800", color: "#1e293b", lineHeight: 22 },
  productBrand:    { fontSize: 13, color: "#64748b", fontWeight: "600" },
  productCategory: { fontSize: 12, color: "#94a3b8", fontWeight: "500", textTransform: "capitalize" },

  barcodeChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f1f5f9", borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, alignSelf: "flex-start", marginBottom: 16 },
  barcodeText: { fontSize: 12, color: "#64748b", fontWeight: "500", letterSpacing: 0.5 },

  sectionBox:   { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#1e293b", marginBottom: 12, letterSpacing: -0.2 },
  nutriRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  nutriLabel:   { fontSize: 13, color: "#475569", fontWeight: "500" },
  nutriValue:   { fontSize: 13, color: "#1e293b", fontWeight: "700" },

  estimatedBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", borderRadius: 8, padding: 8, marginTop: 10 },
  estimatedNote:   { fontSize: 11, color: "#1d4ed8", fontWeight: "500", flex: 1 },

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
  altReason:     { fontSize: 11, color: "#16a34a", fontWeight: "500", marginTop: 3, lineHeight: 15 },
  altDescription: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "500",
    marginTop: 3,
    lineHeight: 15,
  },
  altScoreBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#dcfce7", borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  altScoreText:  { fontSize: 13, fontWeight: "800", color: "#16a34a" },

  noAltsContainer: { alignItems: "center", paddingVertical: 20, gap: 8 },
  noAltsTitle:     { fontSize: 14, fontWeight: "700", color: "#166534" },
  noAltsSubtitle:  { fontSize: 12, color: "#16a34a", textAlign: "center", lineHeight: 18, fontWeight: "400" },

  phAltSection: { backgroundColor: "#eff6ff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#bfdbfe" },
  phAltTitle:   { fontSize: 14, fontWeight: "800", color: "#1d4ed8" },
  phFlag:       { fontSize: 16 },

  whereToBuyRow:  { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  whereToBuyText: { fontSize: 11, color: "#0369a1", fontWeight: "500", flex: 1 },

  bonusToast: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1.5 },
  bonusLeft:        { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  bonusEmoji:       { fontSize: 28 },
  bonusTextGroup:   { flex: 1, gap: 2 },
  bonusTitle:       { fontSize: 15, fontWeight: "800" },
  bonusSub:         { fontSize: 12, fontWeight: "500" },
  bonusPointsBadge: { borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, alignItems: "center", minWidth: 52 },
  bonusPointsText:  { fontSize: 18, fontWeight: "900", color: "#fff" },
  bonusPointsLabel: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.8)" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderRadius: 20, paddingVertical: 14 },
  saveBtnText: { fontSize: 15, fontWeight: "700" },
  scanAgainBtn: { width: 52, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#e2e8f0", borderRadius: 20, backgroundColor: "#f8fafc" },

  consecutiveBadge: { position: "absolute", bottom: -30, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 },
  consecutiveText:  { fontSize: 12, fontWeight: "700", color: "#ff6b6b" },
  streakHint:     { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  streakHintText: { fontSize: 11, color: "#ff6b6b", fontWeight: "600" },
  
  backToOriginalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 2,
    borderColor: "#bfdbfe",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backToOriginalText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d4ed8",
  },
});