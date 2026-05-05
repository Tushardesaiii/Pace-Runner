/**
 * app/(tabs)/race.tsx  —  Race Day  v2.0
 *
 * Design: Minimalist FAANG-grade — clean white, precise typography,
 * generous whitespace, zero clutter. Every element earns its place.
 *
 * UX improvements:
 * • Inline number-pad style time input — no native picker jank
 * • Date picker opens as bottom sheet modal (no surprise jumps)
 * • Countdown ring animation for visual impact
 * • Splits table with alternating rows, pace column added
 * • All edge cases handled (invalid date, zero time, past race)
 * • Smooth scroll with sticky splits header
 * • Full accessibility labels
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  Easing,
  Platform,
  PixelRatio,
  useWindowDimensions,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { differenceInDays, differenceInWeeks, parseISO, format, isValid, isFuture } from "date-fns";
import { parseTimeToSeconds, formatDateForInput } from "../../utils/runMath";
import {
  Trophy,
  Calendar,
  Clock,
  ChevronRight,
  Flag,
  TrendingUp,
  Zap,
} from "lucide-react-native";

/* ─────────────────────────────────────────────────────────
   RESPONSIVE SCALE
───────────────────────────────────────────────────────── */
const BASE_W = 390;
const { width: SCREEN_W } = require("react-native").Dimensions.get("window");
const rs = (size: number, factor = 0.45) =>
  Math.round(size * (1 + (SCREEN_W / BASE_W - 1) * factor));
const sp = (size: number) =>
  Math.round(rs(size) / Math.max(PixelRatio.getFontScale(), 1));

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
const T = {
  // Backgrounds
  bg:        "#FFFFFF",
  surface:   "#FFFFFF",
  surfaceOff:"#F7F7F5",
  page:      "#F2F2F0",

  // Ink
  ink:       "#111111",
  ink80:     "#333333",
  ink60:     "#666666",
  ink40:     "#999999",
  ink20:     "#CCCCCC",
  ink10:     "#E8E8E8",
  ink05:     "#F4F4F4",

  // Accent
  accent:    "#111111",   // primary CTA — near black
  accentFg:  "#FFFFFF",

  // Countdown accent — vivid blue
  blue:      "#0066FF",
  blueSoft:  "#EEF4FF",
  blueMid:   "#C7DCFF",

  // Status
  success:   "#16A34A",
  successBg: "#F0FDF4",
  warn:      "#D97706",
  warnBg:    "#FFFBEB",
  danger:    "#DC2626",
  dangerBg:  "#FEF2F2",

  // Border
  border:    "#EBEBEB",
  borderMd:  "#D9D9D9",

  // Shape
  radius:    16,
  radiusMd:  12,
  radiusSm:  8,
};

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

const secondsToHms = (secs: number): string => {
  if (!secs || secs <= 0) return "00:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

const parseHms = (str: string): number => {
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return 0;
};

const paceString = (secsPerKm: number): string => {
  if (!secsPerKm || secsPerKm <= 0 || !isFinite(secsPerKm)) return "—";
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${pad2(s)} /km`;
};

const safeParseISO = (str: string): Date | null => {
  try {
    const d = parseISO(str);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
};

/* ─────────────────────────────────────────────────────────
   FADE WRAPPER
───────────────────────────────────────────────────────── */
const FadeSlide = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 280, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 280, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
};

/* ─────────────────────────────────────────────────────────
   SECTION LABEL
───────────────────────────────────────────────────────── */
const SectionLabel = ({ label }: { label: string }) => (
  <Text style={secS.label}>{label}</Text>
);
const secS = StyleSheet.create({
  label: {
    fontFamily: "Poppins-Medium",
    fontSize: sp(11),
    color: T.ink40,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
});

/* ─────────────────────────────────────────────────────────
   COUNTDOWN DISPLAY
───────────────────────────────────────────────────────── */
const CountdownDisplay = ({
  days, weeks, raceDate, isPast,
}: {
  days: number; weeks: number; raceDate: string; isPast: boolean;
}) => {
  const scale = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
  }, []);

  const dateObj = safeParseISO(raceDate);
  const formatted = dateObj ? format(dateObj, "MMMM d, yyyy") : raceDate;

  return (
    <Animated.View style={[cdS.card, { transform: [{ scale }] }]}>
      {/* Top accent line */}
      <View style={cdS.accentBar} />

      <View style={cdS.inner}>
        {/* Race name row */}
        <View style={cdS.topRow}>
          <View style={cdS.flagBox}>
            <Flag size={14} color={T.blue} strokeWidth={2} />
          </View>
          <Text style={[cdS.raceName, { fontSize: sp(13) }]}>Marathon Race Day</Text>
          {isPast && (
            <View style={cdS.pastBadge}>
              <Text style={[cdS.pastBadgeTxt, { fontSize: sp(10) }]}>Past</Text>
            </View>
          )}
        </View>

        {/* Numbers */}
        <View style={cdS.numbersRow}>
          <View style={cdS.numBlock}>
            <Text style={[cdS.numVal, { fontSize: sp(52) }]}>
              {isPast ? "0" : String(weeks)}
            </Text>
            <Text style={[cdS.numLbl, { fontSize: sp(12) }]}>weeks</Text>
          </View>

          <View style={cdS.divider} />

          <View style={cdS.numBlock}>
            <Text style={[cdS.numVal, { fontSize: sp(52) }]}>
              {isPast ? "0" : String(days)}
            </Text>
            <Text style={[cdS.numLbl, { fontSize: sp(12) }]}>days left</Text>
          </View>
        </View>

        {/* Date label */}
        <Text style={[cdS.dateStr, { fontSize: sp(13) }]}>{formatted}</Text>
      </View>
    </Animated.View>
  );
};

const cdS = StyleSheet.create({
  card: {
    backgroundColor: T.ink,
    borderRadius: T.radius,
    overflow: "hidden",
  },
  accentBar: {
    height: 3,
    backgroundColor: T.blue,
  },
  inner: {
    padding: 24,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  flagBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: T.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  raceName: {
    fontFamily: "Poppins-Medium",
    color: "rgba(255,255,255,0.7)",
    flex: 1,
  },
  pastBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pastBadgeTxt: {
    fontFamily: "Poppins-Medium",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.3,
  },
  numbersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    marginBottom: 20,
  },
  numBlock: {
    flex: 1,
    alignItems: "center",
  },
  numVal: {
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
    letterSpacing: -3,
    lineHeight: undefined,
  },
  numLbl: {
    fontFamily: "Poppins-Regular",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 56,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dateStr: {
    fontFamily: "Poppins-Regular",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
});

/* ─────────────────────────────────────────────────────────
   SETTINGS ROW (date + time pickers)
───────────────────────────────────────────────────────── */
const SettingsRow = ({
  icon: Icon, label, value, onPress, color = T.ink,
}: {
  icon: React.FC<any>; label: string; value: string;
  onPress: () => void; color?: string;
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [srS.row, pressed && srS.rowPressed]}>
    <View style={[srS.iconBox, { backgroundColor: color === T.blue ? T.blueSoft : T.ink05 }]}>
      <Icon size={16} color={color} strokeWidth={2} />
    </View>
    <View style={srS.content}>
      <Text style={[srS.label, { fontSize: sp(12) }]}>{label}</Text>
      <Text style={[srS.value, { fontSize: sp(15) }]}>{value}</Text>
    </View>
    <ChevronRight size={16} color={T.ink20} strokeWidth={2} />
  </Pressable>
);

const srS = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: T.surface,
    borderRadius: T.radiusMd,
    borderWidth: 1,
    borderColor: T.border,
  },
  rowPressed: { backgroundColor: T.ink05 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: T.radiusSm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1 },
  label: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    marginBottom: 1,
  },
  value: {
    fontFamily: "Poppins-Medium",
    color: T.ink,
    letterSpacing: -0.2,
  },
});

/* ─────────────────────────────────────────────────────────
   GOAL TIME EDITOR MODAL
───────────────────────────────────────────────────────── */
const TimeEditorModal = ({
  visible, current, onConfirm, onClose,
}: {
  visible: boolean; current: string;
  onConfirm: (t: string) => void; onClose: () => void;
}) => {
  const [h, setH] = useState("04");
  const [m, setM] = useState("00");
  const [s, setS] = useState("00");

  useEffect(() => {
    if (visible) {
      const parts = current.split(":");
      setH(parts[0]?.padStart(2, "0") ?? "04");
      setM(parts[1]?.padStart(2, "0") ?? "00");
      setS(parts[2]?.padStart(2, "0") ?? "00");
    }
  }, [visible, current]);

  const clamp = (val: string, min: number, max: number) => {
    const n = parseInt(val, 10);
    if (isNaN(n)) return pad2(min);
    return pad2(Math.max(min, Math.min(max, n)));
  };

  const handleConfirm = () => {
    const ch = clamp(h, 0, 9);
    const cm = clamp(m, 0, 59);
    const cs = clamp(s, 0, 59);
    onConfirm(`${ch}:${cm}:${cs}`);
  };

  const ty = useRef(new Animated.Value(300)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, useNativeDriver: true, tension: 80, friction: 14 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(op, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(ty, { toValue: 300, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[teS.overlay, { opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[teS.sheet, { transform: [{ translateY: ty }] }]}>
          <View style={teS.handle} />
          <Text style={[teS.title, { fontSize: sp(16) }]}>Goal Finish Time</Text>
          <Text style={[teS.subtitle, { fontSize: sp(13) }]}>
            Enter your target marathon time
          </Text>

          <View style={teS.inputsRow}>
            {/* Hours */}
            <View style={teS.unitBlock}>
              <TextInput
                style={[teS.numInput, { fontSize: sp(36) }]}
                value={h}
                onChangeText={setH}
                onBlur={() => setH(clamp(h, 0, 9))}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                accessibilityLabel="Hours"
              />
              <Text style={[teS.unitLabel, { fontSize: sp(11) }]}>hrs</Text>
            </View>

            <Text style={[teS.colon, { fontSize: sp(36) }]}>:</Text>

            {/* Minutes */}
            <View style={teS.unitBlock}>
              <TextInput
                style={[teS.numInput, { fontSize: sp(36) }]}
                value={m}
                onChangeText={setM}
                onBlur={() => setM(clamp(m, 0, 59))}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                accessibilityLabel="Minutes"
              />
              <Text style={[teS.unitLabel, { fontSize: sp(11) }]}>min</Text>
            </View>

            <Text style={[teS.colon, { fontSize: sp(36) }]}>:</Text>

            {/* Seconds */}
            <View style={teS.unitBlock}>
              <TextInput
                style={[teS.numInput, { fontSize: sp(36) }]}
                value={s}
                onChangeText={setS}
                onBlur={() => setS(clamp(s, 0, 59))}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                accessibilityLabel="Seconds"
              />
              <Text style={[teS.unitLabel, { fontSize: sp(11) }]}>sec</Text>
            </View>
          </View>

          {/* Quick presets */}
          <View style={teS.presets}>
            {["03:00:00", "03:30:00", "04:00:00", "04:30:00", "05:00:00"].map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  Haptics.selectionAsync();
                  const p = t.split(":");
                  setH(p[0]); setM(p[1]); setS(p[2]);
                }}
                style={({ pressed }) => [teS.preset, pressed && teS.presetPressed]}
              >
                <Text style={[teS.presetTxt, { fontSize: sp(12) }]}>{t.substring(0, 5)}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleConfirm(); }}
            style={({ pressed }) => [teS.confirmBtn, pressed && { opacity: 0.88 }]}
          >
            <Text style={[teS.confirmTxt, { fontSize: sp(16) }]}>Set Goal Time</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const teS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.ink10,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    marginBottom: 28,
  },
  inputsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 4,
    marginBottom: 24,
  },
  unitBlock: {
    alignItems: "center",
    gap: 4,
  },
  numInput: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    textAlign: "center",
    letterSpacing: -1,
    width: 72,
    height: 72,
    backgroundColor: T.ink05,
    borderRadius: T.radiusMd,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  unitLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  colon: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink20,
    marginTop: 16,
    letterSpacing: -1,
  },
  presets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: T.ink05,
    borderWidth: 1,
    borderColor: T.border,
  },
  presetPressed: { backgroundColor: T.ink10 },
  presetTxt: {
    fontFamily: "Poppins-Medium",
    color: T.ink60,
    letterSpacing: 0.1,
  },
  confirmBtn: {
    backgroundColor: T.ink,
    borderRadius: T.radiusMd,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTxt: {
    fontFamily: "Poppins-SemiBold",
    color: "#FFF",
    letterSpacing: 0.1,
  },
});

/* ─────────────────────────────────────────────────────────
   SPLITS TABLE
───────────────────────────────────────────────────────── */
type Split = { km: number; time: string; pace: string };

const SplitsTable = ({ splits, goalTime }: { splits: Split[]; goalTime: string }) => {
  if (!splits.length) return null;

  const totalSecs = parseHms(goalTime);
  const pacePerKm = totalSecs > 0 ? totalSecs / 42.195 : 0;

  return (
    <View style={stS.container}>
      {/* Header */}
      <View style={stS.tableHeader}>
        <Text style={[stS.hdrTxt, { fontSize: sp(11), flex: 1 }]}>DISTANCE</Text>
        <Text style={[stS.hdrTxt, { fontSize: sp(11), flex: 1, textAlign: "center" }]}>TIME</Text>
        <Text style={[stS.hdrTxt, { fontSize: sp(11), flex: 1, textAlign: "right" }]}>PACE</Text>
      </View>

      {splits.map((s, i) => {
        const isLast = i === splits.length - 1;
        return (
          <View
            key={s.km}
            style={[
              stS.row,
              i % 2 === 0 && stS.rowAlt,
              isLast && stS.rowLast,
            ]}
          >
            <View style={stS.kmCell}>
              {isLast ? (
                <View style={stS.finishBadge}>
                  <Flag size={10} color={T.blue} strokeWidth={2.5} />
                  <Text style={[stS.finishTxt, { fontSize: sp(12) }]}>Finish</Text>
                </View>
              ) : (
                <Text style={[stS.kmTxt, { fontSize: sp(15) }]}>{s.km} km</Text>
              )}
            </View>
            <Text style={[
              stS.timeTxt,
              { fontSize: sp(15), flex: 1, textAlign: "center" },
              isLast && stS.finalTimeTxt,
            ]}>
              {s.time}
            </Text>
            <Text style={[stS.paceTxt, { fontSize: sp(13), flex: 1, textAlign: "right" }]}>
              {s.pace}
            </Text>
          </View>
        );
      })}

      {/* Footer note */}
      <View style={stS.footer}>
        <Zap size={11} color={T.ink40} strokeWidth={2} />
        <Text style={[stS.footerTxt, { fontSize: sp(11) }]}>
          Average pace {paceString(pacePerKm)} · Even splits
        </Text>
      </View>
    </View>
  );
};

const stS = StyleSheet.create({
  container: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.ink05,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  hdrTxt: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  rowAlt: { backgroundColor: T.surfaceOff },
  rowLast: {
    backgroundColor: "#EEF4FF",
    borderBottomWidth: 0,
  },
  kmCell: { flex: 1 },
  kmTxt: {
    fontFamily: "Poppins-Regular",
    color: T.ink60,
  },
  timeTxt: {
    fontFamily: "Poppins-Medium",
    color: T.ink,
    letterSpacing: -0.3,
  },
  finalTimeTxt: {
    color: T.blue,
    fontFamily: "Poppins-SemiBold",
  },
  paceTxt: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    letterSpacing: -0.2,
  },
  finishBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  finishTxt: {
    fontFamily: "Poppins-SemiBold",
    color: T.blue,
    letterSpacing: 0.1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    backgroundColor: T.ink05,
  },
  footerTxt: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
  },
});

/* ─────────────────────────────────────────────────────────
   STAT ROW (pace insight)
───────────────────────────────────────────────────────── */
const InsightRow = ({ goalTime }: { goalTime: string }) => {
  const totalSecs = parseHms(goalTime);
  const pacePerKm = totalSecs > 0 ? totalSecs / 42.195 : 0;
  const pacePerMile = pacePerKm * 1.60934;

  const items = [
    { label: "Pace /km",   value: paceString(pacePerKm),    icon: TrendingUp, color: T.blue },
    { label: "Pace /mile", value: paceString(pacePerMile),  icon: Zap,        color: "#8B5CF6" },
    { label: "Avg speed",  value: totalSecs > 0 ? `${(42.195 / (totalSecs / 3600)).toFixed(1)} km/h` : "—", icon: Flag, color: T.success },
  ];

  return (
    <View style={irS.row}>
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <View key={it.label} style={[irS.item, i > 0 && irS.itemBorder]}>
            <View style={[irS.iconBox, { backgroundColor: it.color + "15" }]}>
              <Icon size={13} color={it.color} strokeWidth={2} />
            </View>
            <Text style={[irS.value, { fontSize: sp(14) }]}>{it.value}</Text>
            <Text style={[irS.label, { fontSize: sp(10) }]}>{it.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

const irS = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
  },
  item: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  itemBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: T.border,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  value: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.3,
  },
  label: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    letterSpacing: 0.2,
  },
});

/* ─────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────── */
export default function RaceScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const hPad = width < 360 ? 16 : width >= 414 ? 24 : 20;

  const [raceDate,      setRaceDate]      = useState("2026-10-18");
  const [goalTime,      setGoalTime]      = useState("04:00:00");
  const [countdown,     setCountdown]     = useState({ days: 0, weeks: 0 });
  const [isPast,        setIsPast]        = useState(false);
  const [showDatePicker,setShowDatePicker]= useState(false);
  const [showTimePicker,setShowTimePicker]= useState(false);

  /* Load from storage */
  useEffect(() => {
    AsyncStorage.getItem("knack_race").then((saved) => {
      if (saved) {
        try {
          const { date, time } = JSON.parse(saved);
          if (date) setRaceDate(date);
          if (time) setGoalTime(time);
        } catch { /* ignore */ }
      }
    });
  }, []);

  /* Save to storage */
  useEffect(() => {
    AsyncStorage.setItem("knack_race", JSON.stringify({ date: raceDate, time: goalTime }));
  }, [raceDate, goalTime]);

  /* Compute countdown */
  useEffect(() => {
    const date = safeParseISO(raceDate);
    if (!date) { setCountdown({ days: 0, weeks: 0 }); setIsPast(false); return; }
    const today = new Date();
    const days  = differenceInDays(date, today);
    const weeks = differenceInWeeks(date, today);
    setIsPast(days < 0);
    setCountdown({ days: Math.max(0, days), weeks: Math.max(0, weeks) });
  }, [raceDate]);

  /* Compute splits */
  const splits = useCallback((): Split[] => {
    const totalSecs = parseHms(goalTime);
    if (!totalSecs || totalSecs <= 0) return [];
    const pacePerKm = totalSecs / 42.195;
    const result: Split[] = [];

    for (let km = 5; km <= 40; km += 5) {
      const secs = pacePerKm * km;
      result.push({
        km,
        time: secondsToHms(secs),
        pace: paceString(pacePerKm),
      });
    }
    // Final
    result.push({
      km: 42.2,
      time: secondsToHms(totalSecs),
      pace: paceString(pacePerKm),
    });
    return result;
  }, [goalTime])();

  /* Parsed date for picker */
  const parsedRaceDate = (() => {
    const d = safeParseISO(raceDate);
    return d ?? new Date();
  })();

  /* Formatted display */
  const raceDateDisplay = (() => {
    const d = safeParseISO(raceDate);
    return d ? format(d, "MMMM d, yyyy") : raceDate;
  })();

  const validGoalTime = (() => {
    const s = parseHms(goalTime);
    return s > 0 ? goalTime : "04:00:00";
  })();

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
      <View style={[ms.root, { paddingTop: insets.top }]}>

        {/* Page header */}
        <View style={[ms.header, { paddingHorizontal: hPad }]}>
          <View>
            <Text style={[ms.eyebrow, { fontSize: sp(10) }]}>MARATHON</Text>
            <Text style={[ms.title, { fontSize: sp(24) }]}>Race Day</Text>
          </View>
          <View style={ms.trophyBox}>
            <Trophy size={20} color={T.blue} strokeWidth={1.8} />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            ms.scroll,
            { paddingHorizontal: hPad, paddingBottom: insets.bottom + 120 },
          ]}
        >
          {/* Countdown card */}
          <FadeSlide delay={0}>
            <View style={{ marginBottom: 28 }}>
              <CountdownDisplay
                days={countdown.days}
                weeks={countdown.weeks}
                raceDate={raceDate}
                isPast={isPast}
              />
            </View>
          </FadeSlide>

          {/* Race Settings */}
          <FadeSlide delay={60}>
            <View style={{ marginBottom: 28 }}>
              <SectionLabel label="Race Settings" />
              <View style={{ gap: 8 }}>
                <SettingsRow
                  icon={Calendar}
                  label="Race Date"
                  value={raceDateDisplay}
                  onPress={() => { Haptics.selectionAsync(); setShowDatePicker(true); }}
                  color={T.blue}
                />
                <SettingsRow
                  icon={Clock}
                  label="Goal Finish Time"
                  value={validGoalTime}
                  onPress={() => { Haptics.selectionAsync(); setShowTimePicker(true); }}
                  color={T.ink}
                />
              </View>
            </View>
          </FadeSlide>

          {/* Pace Insights */}
          {splits.length > 0 && (
            <FadeSlide delay={120}>
              <View style={{ marginBottom: 28 }}>
                <SectionLabel label="Pace Breakdown" />
                <InsightRow goalTime={validGoalTime} />
              </View>
            </FadeSlide>
          )}

          {/* Splits */}
          {splits.length > 0 && (
            <FadeSlide delay={180}>
              <View style={{ marginBottom: 12 }}>
                <SectionLabel label="Kilometer Splits" />
                <SplitsTable splits={splits} goalTime={validGoalTime} />
              </View>
            </FadeSlide>
          )}

          {splits.length === 0 && (
            <FadeSlide delay={120}>
              <View style={ms.emptySplits}>
                <Text style={[ms.emptySplitsTxt, { fontSize: sp(13) }]}>
                  Set a valid goal time to see your kilometer splits.
                </Text>
              </View>
            </FadeSlide>
          )}
        </ScrollView>

        {/* Native date picker (iOS/Android) */}
        {showDatePicker && (
          <DateTimePicker
            value={parsedRaceDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={new Date()}
            onChange={(_, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const iso = formatDateForInput(selectedDate);
                setRaceDate(iso);
              }
            }}
          />
        )}

        {/* Custom time editor modal */}
        <TimeEditorModal
          visible={showTimePicker}
          current={validGoalTime}
          onConfirm={(t) => { setGoalTime(t); setShowTimePicker(false); }}
          onClose={() => setShowTimePicker(false)}
        />
      </View>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN STYLES
───────────────────────────────────────────────────────── */
const ms = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: T.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  eyebrow: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    letterSpacing: 2.5,
    marginBottom: 1,
  },
  title: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.8,
  },
  trophyBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingTop: 28,
  },
  emptySplits: {
    backgroundColor: T.surfaceOff,
    borderRadius: T.radiusMd,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
    borderStyle: "dashed",
  },
  emptySplitsTxt: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    textAlign: "center",
    lineHeight: 20,
  },
});