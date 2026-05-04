/**
 * app/(tabs)/index.tsx  —  Pace Calculator  v2.0
 *
 * FAANG-grade redesign: "Precision Athletic"
 * ─────────────────────────────────────────────
 * • Fully responsive across every iOS/Android screen (320px → 430px+)
 * • useWindowDimensions for live layout adaptation
 * • No broken layouts: flex-based, never fixed widths
 * • Haptic feedback on every interaction
 * • Accessible tap targets (min 44×44pt)
 * • Modal-based time/pace pickers (no inline DateTimePicker glitches)
 * • Keyboard-aware inputs with smooth dismiss
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Alert,
  useWindowDimensions,
  PixelRatio,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import {
  ArrowUpRight,
  Flame,
  RotateCcw,
  ChevronRight,
  TrendingUp,
  Clock,
  Zap,
  Target,
  ChevronUp,
  ChevronDown,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseTimeToSeconds,
  formatSecondsToHms,
  formatSecondsToMmSs,
  safeNumber,
} from "../../utils/runMath";
import RatingBottomSheet from "../../components/RatingBottomSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ─────────────────────────────────────────────────────────
   RESPONSIVE SCALE UTILITIES
───────────────────────────────────────────────────────── */
const BASE_WIDTH = 390; // iPhone 14 base
const { width: SCREEN_W } = Dimensions.get("window");

// Scales a size relative to screen width, clamped to avoid extremes
const rs = (size: number, factor = 0.5) => {
  const scale = SCREEN_W / BASE_WIDTH;
  return Math.round(size * (1 + (scale - 1) * factor));
};

const sp = (size: number) => {
  const scale = PixelRatio.getFontScale();
  return Math.round(rs(size) / Math.max(scale, 1));
};

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
const T = {
  // Surfaces
  bg:       "#FAFAF9",
  surface:  "#FFFFFF",
  elevated: "#FFFFFF",
  // Ink
  ink:      "#111110",
  ink70:    "#6B6B68",
  ink40:    "#AFAFAB",
  ink15:    "#E8E8E6",
  ink08:    "#F4F4F2",
  // Accent — one hot signal color
  live:     "#E8390E",  // Ember orange — athletic, precise
  liveSubt: "#FFF0EC",  // Tinted surface for live
  // Borders
  border:   "#E8E8E6",
  borderMd: "#D4D4D1",
  // Shape
  radius:   14,
  radiusSm: 8,
  radiusXs: 6,
};

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const pad2 = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");

const timeOfDayLabel = () => {
  const h = new Date().getHours();
  if (h < 5) return "Night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
};

const formatMarathon = (paceStr: string): string | null => {
  const ps = parseTimeToSeconds(paceStr);
  if (!ps || ps <= 0) return null;
  const total = ps * 42.195;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  return `${h}:${pad2(m)}:${pad2(s)}`;
};

const getRaceTime = (paceStr: string, dist: number): string => {
  const ps = parseTimeToSeconds(paceStr);
  if (!ps || ps <= 0) return "—";
  const secs = ps * dist;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
};

/* ─────────────────────────────────────────────────────────
   HAIRLINE
───────────────────────────────────────────────────────── */
const Hairline = ({ style }: { style?: object }) => (
  <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: T.border }, style]} />
);

/* ─────────────────────────────────────────────────────────
   STAGGERED APPEAR ANIMATION
───────────────────────────────────────────────────────── */
const Appear = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const op = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: op, transform: [{ translateY: y }] }}>
      {children}
    </Animated.View>
  );
};

/* ─────────────────────────────────────────────────────────
   PRESSABLE WITH SPRING SCALE
───────────────────────────────────────────────────────── */
const Spring = ({
  children,
  onPress,
  style,
  hitSlop = 8,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  hitSlop?: number;
  disabled?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 200,
      bounciness: 0,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 200,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [{ opacity: pressed && disabled ? 0.5 : 1 }]}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   DRUM-ROLL TIME PICKER MODAL
   Native feel, no DateTimePicker quirks
───────────────────────────────────────────────────────── */
interface TimePickerProps {
  visible: boolean;
  title: string;
  initialValue: string; // "HH:MM:SS" or "MM:SS"
  showSeconds?: boolean;
  maxHours?: number;    // For pace: 0 (no hours col)
  onConfirm: (val: string) => void;
  onDismiss: () => void;
}

const TimePicker = ({
  visible,
  title,
  initialValue,
  showSeconds = true,
  maxHours = 9,
  onConfirm,
  onDismiss,
}: TimePickerProps) => {
  const parts = initialValue.split(":");
  const hasPaceFormat = parts.length === 2; // MM:SS only

  const initH = hasPaceFormat ? 0 : parseInt(parts[0] || "0", 10);
  const initM = hasPaceFormat ? parseInt(parts[0] || "0", 10) : parseInt(parts[1] || "0", 10);
  const initS = hasPaceFormat ? parseInt(parts[1] || "0", 10) : parseInt(parts[2] || "0", 10);

  const [h, setH] = useState(Math.max(0, Math.min(initH, maxHours)));
  const [m, setM] = useState(Math.max(0, Math.min(initM, 59)));
  const [s, setS] = useState(Math.max(0, Math.min(initS, 59)));

  useEffect(() => {
    if (visible) {
      const p = initialValue.split(":");
      const isPace = p.length === 2;
      setH(isPace ? 0 : Math.max(0, Math.min(parseInt(p[0] || "0", 10), maxHours)));
      setM(isPace ? Math.max(0, Math.min(parseInt(p[0] || "0", 10), 59)) : Math.max(0, Math.min(parseInt(p[1] || "0", 10), 59)));
      setS(isPace ? Math.max(0, Math.min(parseInt(p[1] || "0", 10), 59)) : Math.max(0, Math.min(parseInt(p[2] || "0", 10), 59)));
    }
  }, [visible]);

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasPaceFormat || maxHours === 0) {
      onConfirm(`${pad2(m)}:${pad2(s)}`);
    } else {
      onConfirm(`${pad2(h)}:${pad2(m)}:${pad2(s)}`);
    }
  };

  const Stepper = ({
    label,
    value,
    onChange,
    max,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    max: number;
  }) => (
    <View style={pickerStyles.stepperCol}>
      <Text style={pickerStyles.stepperLabel}>{label}</Text>
      <View style={pickerStyles.stepperBox}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            onChange(value >= max ? 0 : value + 1);
          }}
          style={pickerStyles.stepperBtn}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        >
          <ChevronUp size={20} color={T.ink} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={pickerStyles.stepperValue}>{pad2(value)}</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            onChange(value <= 0 ? max : value - 1);
          }}
          style={pickerStyles.stepperBtn}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        >
          <ChevronDown size={20} color={T.ink} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const showHoursCol = maxHours > 0 && !hasPaceFormat;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={pickerStyles.overlay} onPress={onDismiss}>
        <Pressable style={pickerStyles.sheet} onPress={() => {}}>
          {/* Handle */}
          <View style={pickerStyles.handle} />

          <Text style={pickerStyles.sheetTitle}>{title}</Text>
          <Hairline style={{ marginBottom: 24 }} />

          <View style={pickerStyles.stepperRow}>
            {showHoursCol && (
              <>
                <Stepper label="HRS" value={h} onChange={setH} max={maxHours} />
                <Text style={pickerStyles.sep}>:</Text>
              </>
            )}
            <Stepper label="MIN" value={m} onChange={setM} max={59} />
            {showSeconds && (
              <>
                <Text style={pickerStyles.sep}>:</Text>
                <Stepper label="SEC" value={s} onChange={setS} max={59} />
              </>
            )}
          </View>

          <View style={pickerStyles.btnRow}>
            <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onDismiss}>
              <Text style={pickerStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pickerStyles.confirmBtn} onPress={handleConfirm}>
              <Text style={pickerStyles.confirmText}>Set</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.ink15,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: sp(17),
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  stepperCol: {
    alignItems: "center",
    minWidth: 72,
  },
  stepperLabel: {
    fontSize: sp(10),
    color: T.ink40,
    fontFamily: "Poppins-Medium",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  stepperBox: {
    alignItems: "center",
    backgroundColor: T.ink08,
    borderRadius: T.radius,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 68,
  },
  stepperBtn: {
    paddingVertical: 6,
  },
  stepperValue: {
    fontSize: sp(32),
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -1.5,
    lineHeight: sp(42),
    minWidth: 56,
    textAlign: "center",
  },
  sep: {
    fontSize: sp(28),
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: -1,
    marginTop: 20,
    marginHorizontal: 2,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: sp(15),
    fontFamily: "Poppins-Medium",
    color: T.ink70,
  },
  confirmBtn: {
    flex: 1,
    height: 50,
    borderRadius: T.radius,
    backgroundColor: T.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: sp(15),
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
  },
});

/* ─────────────────────────────────────────────────────────
   INPUT TILE  — redesigned for clarity + responsiveness
───────────────────────────────────────────────────────── */
interface InputTileProps {
  label: string;
  value: string;
  unit: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  editable?: boolean;
  onChangeText?: (v: string) => void;
  variant?: "default" | "accent" | "muted";
}

const InputTile = ({
  label,
  value,
  unit,
  icon,
  onPress,
  editable = false,
  onChangeText,
  variant = "default",
}: InputTileProps) => {
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isAccent = variant === "accent";
  const isMuted = variant === "muted";

  const bgColor = isAccent ? T.ink : T.surface;
  const labelColor = isAccent ? "rgba(255,255,255,0.5)" : T.ink40;
  const valueColor = isAccent ? "#FFFFFF" : T.ink;
  const unitColor = isAccent ? "rgba(255,255,255,0.35)" : T.ink40;
  const borderColor = focused && !isAccent ? T.ink40 : isAccent ? T.ink : T.border;

  // Value font size adapts to content length
  const valueFontSize = useMemo(() => {
    const len = (value || "").length;
    if (len > 7) return sp(16);
    if (len > 5) return sp(18);
    return sp(21);
  }, [value]);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        if (editable) inputRef.current?.focus();
        else onPress?.();
      }}
      style={{ flex: 1 }}
    >
      <View
        style={[
          styles.tile,
          { backgroundColor: bgColor, borderColor },
          focused && !isAccent && styles.tileFocused,
        ]}
      >
        <View style={styles.tileLabelRow}>
          {icon && <View style={{ marginRight: 4 }}>{icon}</View>}
          <Text style={[styles.tileLabel, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
        </View>

        {editable ? (
          <TextInput
            ref={inputRef}
            style={[
              styles.tileValue,
              { color: valueColor, fontSize: valueFontSize },
            ]}
            value={value}
            onChangeText={onChangeText}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectionColor={T.live}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="0"
            placeholderTextColor={isAccent ? "rgba(255,255,255,0.2)" : T.ink15}
          />
        ) : (
          <Text
            style={[styles.tileValue, { color: valueColor, fontSize: valueFontSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {value || "—"}
          </Text>
        )}

        <Text style={[styles.tileUnit, { color: unitColor }]} numberOfLines={1}>
          {unit}
        </Text>
      </View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   CIRCULAR PROGRESS (pure RN, no SVG dep)
───────────────────────────────────────────────────────── */
const RingProgress = ({ percent = 0, size = 64 }: { percent: number; size?: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const r = size / 2;
  const strokeW = 3;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Track */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: strokeW,
          borderColor: T.ink15,
        }}
      />
      {/* Fill — right half */}
      <View style={{ position: "absolute", width: size, height: size, borderRadius: r, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: 0, top: 0, width: r, height: size, overflow: "hidden" }}>
          <Animated.View
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: size,
              height: size,
              borderRadius: r,
              borderWidth: strokeW,
              borderColor: T.live,
              transform: [
                {
                  rotate: anim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0deg", "360deg"],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          />
        </View>
        {/* Left half — fills > 50% */}
        <View style={{ position: "absolute", left: 0, top: 0, width: r, height: size, overflow: "hidden" }}>
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: size,
              height: size,
              borderRadius: r,
              borderWidth: strokeW,
              borderColor: percent >= 50 ? T.live : "transparent",
              transform: [
                {
                  rotate: anim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0deg", "360deg"],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          />
        </View>
      </View>
      <Text style={{ fontSize: sp(12), fontFamily: "Poppins-SemiBold", color: T.ink, letterSpacing: -0.3 }}>
        {percent}%
      </Text>
    </View>
  );
};

/* ─────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────── */
export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 360;
  const isLargeScreen = width >= 414;

  const [distance, setDistance] = useState("10");
  const [time, setTime] = useState("00:50:00");
  const [pace, setPace] = useState("05:00");

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPacePicker, setShowPacePicker] = useState(false);
  const [showRatingSheet, setShowRatingSheet] = useState(false);

  const [dash, setDash] = useState({
    streak: 0,
    weekDone: 0,
    weekTotal: 0,
    totalPct: 0,
    nextWorkout: "No plan yet",
    bestPace: "",
    hasPlan: false,
    planLabel: "",
  });

  /* ── Persist ── */
  useEffect(() => {
    AsyncStorage.getItem("knack_calculator").then((saved) => {
      if (saved) {
        const { d, t, p } = JSON.parse(saved);
        if (d) setDistance(d);
        if (t) setTime(t);
        if (p) setPace(p);
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      "knack_calculator",
      JSON.stringify({ d: distance, t: time, p: pace })
    );
  }, [distance, time, pace]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setShowRatingSheet(true);
    }, 8000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  useFocusEffect(useCallback(() => { loadDashboard(); }, []));

  const DAY_INDEX: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };

  const loadDashboard = async () => {
    try {
      const [rawPlan, rawRuns] = await Promise.all([
        AsyncStorage.getItem("trainingPlan"),
        AsyncStorage.getItem("runHistory"),
      ]);
      const runs = rawRuns ? JSON.parse(rawRuns) : [];
      const planData = rawPlan ? JSON.parse(rawPlan) : null;

      const dateSet = new Set(
        runs
          .map((r: any) => {
            const d = new Date(r.date);
            return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
          })
          .filter(Boolean)
      );
      let streak = 0;
      const cursor = new Date();
      while (dateSet.has(cursor.toISOString().split("T")[0])) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }

      const bestPaceRaw = runs.length
        ? Math.min(...runs.map((r: any) => (isFinite(r.pace) ? r.pace : Infinity)))
        : null;
      const bestPace =
        bestPaceRaw && isFinite(bestPaceRaw)
          ? `${formatSecondsToMmSs(bestPaceRaw * 60)}/km`
          : "";

      if (!planData?.plan?.length || !planData?.startDate) {
        setDash({
          streak,
          weekDone: 0,
          weekTotal: 0,
          totalPct: 0,
          nextWorkout: "No plan yet",
          bestPace,
          planLabel: "",
          hasPlan: false,
        });
        return;
      }

      const plan = planData.plan;
      const startDate = new Date(planData.startDate);
      const daysSince = Math.max(
        0,
        Math.floor((Date.now() - startDate.getTime()) / 86400000)
      );
      const curWeekNum = Math.min(plan.length, Math.floor(daysSince / 7) + 1);
      const curWeek = plan.find((w: any) => w.week === curWeekNum) ?? plan[0];

      const weekDone = curWeek.dailyWorkouts.filter((w: any) => w.completed).length;
      const weekTotal = curWeek.dailyWorkouts.length;
      const all = plan.flatMap((w: any) => w.dailyWorkouts);
      const totalDone = all.filter((w: any) => w.completed).length;
      const totalPct = all.length ? Math.round((totalDone / all.length) * 100) : 0;

      const getDate = (wNum: number, day: string) => {
        const d = new Date(planData.startDate);
        d.setDate(d.getDate() + (wNum - 1) * 7 + (DAY_INDEX[day] ?? 0));
        return d;
      };

      let nearest: any = null;
      const today = new Date();
      plan.forEach((w: any) =>
        w.dailyWorkouts.forEach((wo: any) => {
          if (wo.type === "REST" || wo.completed) return;
          const sched = getDate(w.week, wo.day);
          if (sched < new Date(today.toDateString())) return;
          if (!nearest || sched < nearest.date) nearest = { date: sched, workout: wo };
        })
      );

      let nextWorkout = "All done ✓";
      if (nearest) {
        const diff = Math.floor(
          (new Date(nearest.date.toDateString()).getTime() -
            new Date(today.toDateString()).getTime()) /
            86400000
        );
        const when = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `In ${diff}d`;
        nextWorkout = `${when} · ${
          nearest.workout.type === "LONG" ? "Long Run" : nearest.workout.type
        } ${nearest.workout.distance}km`;
      }

      setDash({
        streak,
        weekDone,
        weekTotal,
        totalPct,
        nextWorkout,
        bestPace,
        planLabel: `Week ${curWeekNum} of ${plan.length}`,
        hasPlan: true,
      });
    } catch {
      /* keep defaults */
    }
  };

  /* ── Calc helpers ── */
  const calcPace = (d: string, t: string) => {
    const dist = safeNumber(d);
    const secs = parseTimeToSeconds(t);
    if (!dist || dist <= 0 || !secs || secs <= 0) return;
    setPace(formatSecondsToMmSs(secs / dist));
  };

  const calcTime = (d: string, p: string) => {
    const dist = safeNumber(d);
    const ps = parseTimeToSeconds(p);
    if (!dist || dist <= 0 || !ps || ps <= 0) return;
    setTime(formatSecondsToHms(ps * dist));
  };

  const handleSetGoal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ps = parseTimeToSeconds(pace);
    if (!ps || ps <= 0) {
      Alert.alert("Invalid pace", "Enter a valid pace first.");
      return;
    }
    const goalTime = formatSecondsToHms(Math.round(ps * 42.195));
    try {
      const ex = await AsyncStorage.getItem("knack_race");
      const parsed = ex ? JSON.parse(ex) : {};
      await AsyncStorage.setItem(
        "knack_race",
        JSON.stringify({ date: parsed.date || "2026-10-18", time: goalTime })
      );
      Alert.alert("Goal saved", `Marathon target: ${goalTime}`, [
        { text: "View race", onPress: () => router.push("/(tabs)/race") },
        { text: "Done", style: "cancel" },
      ]);
    } catch {
      Alert.alert("Error", "Could not save goal.");
    }
  };

  const marathonDisplay = formatMarathon(pace);

  const raceDistances = [
    { label: "5K", km: 5, emoji: "⚡" },
    { label: "10K", km: 10, emoji: "🎯" },
    { label: "Half", km: 21.0975, emoji: "🏃" },
    { label: "Marathon", km: 42.195, emoji: "🏅" },
  ];

  // Responsive layout: hero section adapts to screen width
  const heroSize = isSmallScreen ? 56 : isLargeScreen ? 72 : 64;
  const hPad = isSmallScreen ? 18 : isLargeScreen ? 28 : 22;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      <View style={[styles.root, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scroll,
              {
                paddingHorizontal: hPad,
                paddingBottom: insets.bottom + 110,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >

            {/* ═══════════════════════
                HEADER
            ═══════════════════════ */}
            <Appear delay={0}>
              <View style={styles.header}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.eyebrow, { fontSize: sp(10) }]}>
                    {timeOfDayLabel()} · {new Date().toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                  </Text>
                  <Text style={[styles.title, { fontSize: sp(22) }]} numberOfLines={1} adjustsFontSizeToFit>
                    Pace Calculator
                  </Text>
                </View>

                {dash.streak > 0 && (
                  <View style={styles.streakBadge}>
                    <Flame size={12} color={T.live} strokeWidth={2.5} />
                    <Text style={[styles.streakNum, { fontSize: sp(13) }]}>
                      {dash.streak}
                    </Text>
                  </View>
                )}
              </View>
            </Appear>

            <Hairline />

            {/* ═══════════════════════
                HERO — Marathon estimate
            ═══════════════════════ */}
            <Appear delay={50}>
              <View style={[styles.hero, { paddingVertical: isSmallScreen ? 20 : 24 }]}>
                {/* Left: ring progress */}
                <View style={{ alignItems: "center" }}>
                  <RingProgress percent={dash.totalPct} size={heroSize} />
                  <Text style={[styles.ringLabel, { fontSize: sp(9), marginTop: 6 }]}>
                    {dash.hasPlan ? "Plan" : "Progress"}
                  </Text>
                </View>

                {/* Vertical divider */}
                <View style={styles.heroDivider} />

                {/* Center: marathon */}
                <View style={{ flex: 1 }}>
                  <View style={styles.heroChip}>
                    <Target size={10} color={T.live} strokeWidth={2} />
                    <Text style={[styles.heroChipText, { fontSize: sp(9) }]}>MARATHON</Text>
                  </View>
                  <Text
                    style={[styles.heroTime, { fontSize: sp(34) }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {marathonDisplay ?? "—:——:——"}
                  </Text>
                  <Text style={[styles.heroPace, { fontSize: sp(12) }]}>
                    @ {pace || "—:——"} /km
                  </Text>
                </View>

                {/* Right: best pace */}
                {dash.bestPace ? (
                  <View style={styles.heroRight}>
                    <Text style={[styles.heroRightLabel, { fontSize: sp(9) }]}>BEST</Text>
                    <Text style={[styles.heroRightValue, { fontSize: sp(12) }]} numberOfLines={1}>
                      {dash.bestPace.replace("/km", "")}
                    </Text>
                    <Text style={[styles.heroRightUnit, { fontSize: sp(9) }]}>/km</Text>
                  </View>
                ) : null}
              </View>
            </Appear>

            <Hairline />

            {/* ═══════════════════════
                INPUT TILES
            ═══════════════════════ */}
            <Appear delay={100}>
              <View style={[styles.section, { paddingTop: isSmallScreen ? 18 : 22 }]}>
                <Text style={[styles.sectionLabel, { fontSize: sp(9) }]}>INPUTS</Text>

                <View style={[styles.tileRow, { gap: isSmallScreen ? 6 : 8 }]}>
                  <InputTile
                    label="Distance"
                    value={distance}
                    unit="km"
                    icon={<Zap size={9} color={T.ink40} strokeWidth={2} />}
                    editable
                    onChangeText={(v) => {
                      setDistance(v);
                      calcPace(v, time);
                    }}
                  />
                  <InputTile
                    label="Time"
                    value={time.replace(/^00:/, "")}  // trim leading 00: if hours = 0
                    unit="h:m:s"
                    icon={<Clock size={9} color={T.ink40} strokeWidth={2} />}
                    onPress={() => setShowTimePicker(true)}
                  />
                  <InputTile
                    label="Pace"
                    value={pace}
                    unit="/km"
                    icon={<TrendingUp size={9} color="rgba(255,255,255,0.5)" strokeWidth={2} />}
                    variant="accent"
                    onPress={() => setShowPacePicker(true)}
                  />
                </View>

                {/* Helper hint */}
                <Text style={[styles.inputHint, { fontSize: sp(11) }]}>
                  Tap Time or Pace to adjust · Distance auto-recalculates pace
                </Text>
              </View>
            </Appear>

            <Hairline />

            {/* ═══════════════════════
                RACE PROJECTIONS
            ═══════════════════════ */}
            <Appear delay={150}>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { fontSize: sp(9) }]}>RACE PROJECTIONS</Text>

                <View style={styles.raceGrid}>
                  {raceDistances.map((r, i) => {
                    const isMarathon = r.label === "Marathon";
                    const t = getRaceTime(pace, r.km);
                    return (
                      <View
                        key={r.label}
                        style={[
                          styles.raceCard,
                          isMarathon && styles.raceCardMarathon,
                        ]}
                      >
                        <View style={styles.raceCardTop}>
                          <Text style={[styles.raceCardLabel, { fontSize: sp(10) }, isMarathon && { color: T.live }]}>
                            {r.label.toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.raceCardTime,
                            { fontSize: sp(isSmallScreen ? 17 : 19) },
                            isMarathon && styles.raceCardTimeMarathon,
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                        >
                          {t}
                        </Text>
                        <Text style={[styles.raceCardKm, { fontSize: sp(10) }]}>
                          {r.km < 10 ? r.km : r.km < 25 ? r.km.toFixed(1) : r.km.toFixed(1)}km
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Appear>

            <Hairline />

            {/* ═══════════════════════
                TRAINING PLAN
            ═══════════════════════ */}
            <Appear delay={200}>
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { fontSize: sp(9) }]}>TRAINING PLAN</Text>
                  {dash.hasPlan && (
                    <Text style={[styles.sectionMeta, { fontSize: sp(11) }]}>
                      {dash.planLabel}
                    </Text>
                  )}
                </View>

                {dash.hasPlan ? (
                  <View style={{ gap: 14 }}>
                    {/* Next workout card */}
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push("/(tabs)/plan");
                      }}
                      style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.72 }]}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <View style={styles.nextCardLeft}>
                        <Text style={[styles.nextLabel, { fontSize: sp(9) }]}>NEXT UP</Text>
                        <Text style={[styles.nextValue, { fontSize: sp(14) }]} numberOfLines={2}>
                          {dash.nextWorkout}
                        </Text>
                      </View>
                      <View style={styles.nextArrow}>
                        <ChevronRight size={14} color={T.ink40} strokeWidth={1.8} />
                      </View>
                    </Pressable>

                    {/* Progress bars */}
                    <View style={{ gap: 14 }}>
                      <View>
                        <View style={styles.barLabelRow}>
                          <Text style={[styles.barLabel, { fontSize: sp(12) }]}>This week</Text>
                          <Text style={[styles.barCount, { fontSize: sp(12) }]}>
                            {dash.weekDone}/{dash.weekTotal}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${dash.weekTotal ? Math.round((dash.weekDone / dash.weekTotal) * 100) : 0}%` },
                            ]}
                          />
                        </View>
                      </View>

                      <View>
                        <View style={styles.barLabelRow}>
                          <Text style={[styles.barLabel, { fontSize: sp(12) }]}>Overall</Text>
                          <Text style={[styles.barCount, { fontSize: sp(12) }]}>{dash.totalPct}%</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[styles.barFill, styles.barFillLive, { width: `${dash.totalPct}%` }]}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push("/(tabs)/plan");
                    }}
                    style={({ pressed }) => [styles.noPlanRow, pressed && { opacity: 0.7 }]}
                  >
                    <View style={styles.noPlanIcon}>
                      <TrendingUp size={16} color={T.ink70} strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.noPlanText, { fontSize: sp(14) }]}>
                      Create a training plan
                    </Text>
                    <ChevronRight size={14} color={T.ink40} strokeWidth={1.8} />
                  </Pressable>
                )}
              </View>
            </Appear>

            <Hairline />

            {/* ═══════════════════════
                ACTIONS
            ═══════════════════════ */}
            <Appear delay={250}>
              <View style={[styles.section, { gap: 10 }]}>
                {/* Primary CTA */}
                <Spring onPress={handleSetGoal}>
                  <View style={[styles.btnPrimary, { height: isSmallScreen ? 48 : 52 }]}>
                    <Text style={[styles.btnPrimaryText, { fontSize: sp(15) }]}>
                      Set as Race Goal
                    </Text>
                    <ArrowUpRight size={16} color="#FFF" strokeWidth={2.5} />
                  </View>
                </Spring>

                {/* Clear */}
                <Spring
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDistance("");
                    setTime("00:00:00");
                    setPace("00:00");
                  }}
                >
                  <View style={[styles.btnSecondary, { height: isSmallScreen ? 42 : 46 }]}>
                    <RotateCcw size={13} color={T.ink70} strokeWidth={2} />
                    <Text style={[styles.btnSecondaryText, { fontSize: sp(14) }]}>Clear</Text>
                  </View>
                </Spring>
              </View>
            </Appear>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ── PICKERS ── */}
      <TimePicker
        visible={showTimePicker}
        title="Set Time"
        initialValue={time}
        showSeconds
        maxHours={9}
        onConfirm={(val) => {
          setShowTimePicker(false);
          setTime(val);
          calcPace(distance, val);
        }}
        onDismiss={() => setShowTimePicker(false)}
      />

      <TimePicker
        visible={showPacePicker}
        title="Set Pace"
        initialValue={pace}
        showSeconds
        maxHours={0}
        onConfirm={(val) => {
          setShowPacePicker(false);
          setPace(val);
          calcTime(distance, val);
        }}
        onDismiss={() => setShowPacePicker(false)}
      />

      <RatingBottomSheet
        isVisible={showRatingSheet}
        onClose={() => setShowRatingSheet(false)}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    // paddingHorizontal set dynamically above
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 18,
  },
  eyebrow: {
    color: T.ink40,
    fontFamily: "Poppins-Regular",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  title: {
    color: T.ink,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.8,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    backgroundColor: T.liveSubt,
  },
  streakNum: {
    color: T.live,
    fontFamily: "Poppins-SemiBold",
  },

  /* ── Hero ── */
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    height: 52,
    backgroundColor: T.border,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  heroChipText: {
    color: T.live,
    fontFamily: "Poppins-Medium",
    letterSpacing: 1.8,
  },
  heroTime: {
    color: T.ink,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -2,
    lineHeight: undefined,
    includeFontPadding: false,
  },
  heroPace: {
    color: T.ink40,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },
  ringLabel: {
    color: T.ink40,
    fontFamily: "Poppins-Regular",
    letterSpacing: 0.5,
  },
  heroRight: {
    alignItems: "flex-end",
    paddingLeft: 4,
  },
  heroRightLabel: {
    color: T.ink40,
    fontFamily: "Poppins-Medium",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  heroRightValue: {
    color: T.ink,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.5,
  },
  heroRightUnit: {
    color: T.ink40,
    fontFamily: "Poppins-Regular",
  },

  /* ── Section ── */
  section: {
    paddingTop: 22,
    paddingBottom: 22,
  },
  sectionLabel: {
    color: T.ink40,
    fontFamily: "Poppins-Medium",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 14,
  },
  sectionMeta: {
    color: T.ink40,
    fontFamily: "Poppins-Regular",
  },

  /* ── Input tiles ── */
  tileRow: {
    flexDirection: "row",
  },
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 11,
    minHeight: 90,
    justifyContent: "space-between",
    backgroundColor: T.surface,
  },
  tileFocused: {
    borderColor: T.ink40,
  },
  tileLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  tileLabel: {
    fontFamily: "Poppins-Medium",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    // fontSize set via prop
  },
  tileValue: {
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.5,
    flex: 1,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  tileUnit: {
    fontFamily: "Poppins-Regular",
    marginTop: 2,
    // fontSize set via prop
  },
  inputHint: {
    color: T.ink40,
    fontFamily: "Poppins-Regular",
    marginTop: 10,
    textAlign: "center",
  },

  /* ── Race grid ── */
  raceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  raceCard: {
    width: "47.5%",          // Two-column grid, flex-safe
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
    minHeight: 82,
  },
  raceCardMarathon: {
    borderColor: T.live,
    backgroundColor: T.liveSubt,
  },
  raceCardTop: {
    marginBottom: 4,
  },
  raceCardLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 1.2,
  },
  raceCardTime: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.8,
    marginBottom: 2,
  },
  raceCardTimeMarathon: {
    color: T.live,
  },
  raceCardKm: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
  },

  /* ── Training plan ── */
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: T.surface,
    gap: 10,
  },
  nextCardLeft: {
    flex: 1,
  },
  nextArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.ink08,
    alignItems: "center",
    justifyContent: "center",
  },
  nextLabel: {
    color: T.ink40,
    fontFamily: "Poppins-Medium",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  nextValue: {
    color: T.ink,
    fontFamily: "Poppins-Medium",
    lineHeight: 20,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  barLabel: {
    color: T.ink70,
    fontFamily: "Poppins-Regular",
  },
  barCount: {
    color: T.ink,
    fontFamily: "Poppins-Medium",
  },
  barTrack: {
    height: 3,
    backgroundColor: T.ink15,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: T.ink,
    borderRadius: 2,
  },
  barFillLive: {
    backgroundColor: T.live,
  },
  noPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: T.surface,
  },
  noPlanIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.ink08,
    alignItems: "center",
    justifyContent: "center",
  },
  noPlanText: {
    flex: 1,
    color: T.ink70,
    fontFamily: "Poppins-Regular",
  },

  /* ── Actions ── */
  btnPrimary: {
    backgroundColor: T.ink,
    borderRadius: T.radius,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.1,
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  btnSecondaryText: {
    color: T.ink70,
    fontFamily: "Poppins-Medium",
  },
});