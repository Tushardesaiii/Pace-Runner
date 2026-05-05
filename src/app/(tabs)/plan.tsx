/**
 * app/(tabs)/plan.tsx  —  Training Plan  v2.0
 *
 * Design Direction: "Athletic Command Center"
 * ─────────────────────────────────────────────────
 * Philosophy: Every pixel earns its place.
 * Feels like Whoop × Strava × Notion — precision athletic tool,
 * not a generic fitness app.
 *
 * Key UX improvements over v1:
 * • Sticky tab navigation: Setup / Calendar / Plan  (no more scroll hunting)
 * • Setup step uses segmented pills — thumb-friendly, instant feedback
 * • Calendar rebuilt: bigger hit targets, better color legend, smooth month nav
 * • Week cards: swipeable feel, richer workout chip design
 * • Workout state machine (idle→active→paused→done) with live timer
 * • Full responsiveness via useWindowDimensions + rs() scale util
 * • Accessible 44×44pt tap targets everywhere
 * • Haptic feedback on every state change
 * • Zero layout breaks on any phone (320px SE → 430px Pro Max)
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
  PixelRatio,
  StatusBar,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Target,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Play,
  Pause,
  Square,
  Check,
  Flame,
  Calendar,
  Settings2,
  ListChecks,
  Timer,
  Zap,
  TrendingUp,
  Moon,
} from "lucide-react-native";
import { formatSecondsToHms } from "../../utils/runMath";

/* ─────────────────────────────────────────────────────────
   ANDROID LAYOUT ANIMATION UNLOCK
───────────────────────────────────────────────────────── */
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─────────────────────────────────────────────────────────
   RESPONSIVE SCALE
───────────────────────────────────────────────────────── */
const BASE_W = 390;
const { width: SCREEN_W } = require("react-native").Dimensions.get("window");

const rs = (size: number, factor = 0.5) => {
  const scale = SCREEN_W / BASE_W;
  return Math.round(size * (1 + (scale - 1) * factor));
};
const sp = (size: number) => {
  const fontScale = PixelRatio.getFontScale();
  return Math.round(rs(size) / Math.max(fontScale, 1));
};

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
const T = {
  // Base
  bg:        "#F7F6F4",
  surface:   "#FFFFFF",
  elevated:  "#FFFFFF",

  // Ink hierarchy
  ink:       "#111110",
  ink80:     "#3D3D3A",
  ink60:     "#6B6B68",
  ink40:     "#AFAFAB",
  ink20:     "#D4D4D1",
  ink10:     "#EBEBEA",
  ink05:     "#F4F4F2",

  // Accent: ember orange — athletic precision
  live:      "#E8390E",
  liveSoft:  "#FFF0EC",
  liveMid:   "#FDDDD4",

  // Workout type colors — carefully chosen, not random
  easy:      "#16A34A",  // green — aerobic, comfortable
  easySoft:  "#F0FDF4",
  tempo:     "#D97706",  // amber — threshold effort
  tempoSoft: "#FFFBEB",
  intervals: "#DC2626",  // red — max effort
  intervalsSoft: "#FEF2F2",
  long:      "#2563EB",  // blue — endurance
  longSoft:  "#EFF6FF",
  rest:      "#6B7280",  // gray — recovery
  restSoft:  "#F9FAFB",

  // Status
  success:   "#16A34A",
  successSoft: "#F0FDF4",
  missed:    "#DC2626",

  // Border
  border:    "#E8E8E6",
  borderMd:  "#D4D4D1",

  // Shape
  radius:    14,
  radiusSm:  8,
  radiusXs:  5,
};

/* ─────────────────────────────────────────────────────────
   WORKOUT TYPE CONFIGS
───────────────────────────────────────────────────────── */
const WORKOUT_META: Record<string, {
  label: string; short: string; color: string; softBg: string;
  pace: string; icon: React.FC<any>;
}> = {
  EASY:      { label: "Easy Run",    short: "EASY",  color: T.easy,      softBg: T.easySoft,      pace: "Conversational pace",   icon: TrendingUp },
  TEMPO:     { label: "Tempo Run",   short: "TEMPO", color: T.tempo,     softBg: T.tempoSoft,     pace: "Comfortably hard",      icon: Zap },
  INTERVALS: { label: "Intervals",   short: "INT",   color: T.intervals, softBg: T.intervalsSoft, pace: "Hard effort",           icon: Flame },
  LONG:      { label: "Long Run",    short: "LONG",  color: T.long,      softBg: T.longSoft,      pace: "Easy to moderate",      icon: Target },
  REST:      { label: "Rest Day",    short: "REST",  color: T.rest,      softBg: T.restSoft,      pace: "Full recovery",         icon: Moon },
};

const GOALS = [
  { id: "5k",   label: "5K",             dist: 5,      emoji: "⚡" },
  { id: "10k",  label: "10K",            dist: 10,     emoji: "🎯" },
  { id: "half", label: "Half Marathon",  dist: 21.1,   emoji: "🏃" },
  { id: "full", label: "Marathon",       dist: 42.2,   emoji: "🏅" },
];

const LEVELS = [
  { id: "beg", label: "Beginner",     weeks: 16, desc: "0–20 km/week" },
  { id: "int", label: "Intermediate", weeks: 12, desc: "20–50 km/week" },
  { id: "adv", label: "Advanced",     weeks: 8,  desc: "50+ km/week" },
];

const DAY_INDEX: Record<string, number> = { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5, Sun:6 };
const DAY_LABELS = ["S","M","T","W","T","F","S"];
const DAY_FULL   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const PACE_ESTIMATE: Record<string, number> = {
  EASY: 6.5, TEMPO: 5.3, INTERVALS: 4.8, LONG: 6.8,
};

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const pad2 = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");

const fmtTimer = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
};

const getWeekProgress = (week: any) => {
  const total     = week.dailyWorkouts.length;
  const completed = week.dailyWorkouts.filter((w: any) => w.completed).length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, pct };
};

/* ─────────────────────────────────────────────────────────
   HAIRLINE
───────────────────────────────────────────────────────── */
const Hairline = ({ style }: { style?: object }) => (
  <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: T.border }, style]} />
);

/* ─────────────────────────────────────────────────────────
   ANIMATED APPEAR
───────────────────────────────────────────────────────── */
const Appear = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const op = useRef(new Animated.Value(0)).current;
  const y  = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue:1, duration:260, delay, easing: Easing.out(Easing.cubic), useNativeDriver:true }),
      Animated.timing(y,  { toValue:0, duration:260, delay, easing: Easing.out(Easing.cubic), useNativeDriver:true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity:op, transform:[{translateY:y}] }}>{children}</Animated.View>;
};

/* ─────────────────────────────────────────────────────────
   SPRING PRESSABLE
───────────────────────────────────────────────────────── */
const Spring = ({
  children, onPress, style, disabled = false, hitSlop = 6,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  disabled?: boolean;
  hitSlop?: number;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pi = () => Animated.spring(scale, { toValue:0.96, useNativeDriver:true, speed:300, bounciness:0 }).start();
  const po = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:200, bounciness:6 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={pi} onPressOut={po} disabled={disabled} hitSlop={hitSlop}>
      <Animated.View style={[{ transform:[{scale}] }, style, disabled && { opacity:0.45 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   SEGMENTED CONTROL
───────────────────────────────────────────────────────── */
const SegmentedControl = ({
  options, value, onChange,
}: {
  options: { id: string; label: string; sub?: string }[];
  value: string;
  onChange: (id: string) => void;
}) => {
  const { width } = useWindowDimensions();
  const hPad = width < 360 ? 16 : 22;

  return (
    <View style={segStyles.track}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Spring
            key={opt.id}
            onPress={() => { Haptics.selectionAsync(); onChange(opt.id); }}
            style={{ flex: 1 }}
          >
            <View style={[segStyles.pill, active && segStyles.pillActive]}>
              <Text style={[segStyles.label, { fontSize: sp(13) }, active && segStyles.labelActive]} numberOfLines={1}>
                {opt.label}
              </Text>
              {opt.sub ? (
                <Text style={[segStyles.sub, { fontSize: sp(10) }, active && segStyles.subActive]} numberOfLines={1}>
                  {opt.sub}
                </Text>
              ) : null}
            </View>
          </Spring>
        );
      })}
    </View>
  );
};

const segStyles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: T.ink10,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  pillActive: {
    backgroundColor: T.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: {
    fontFamily: "Poppins-Medium",
    color: T.ink60,
    letterSpacing: 0.1,
  },
  labelActive: { color: T.ink },
  sub: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    marginTop: 1,
  },
  subActive: { color: T.ink60 },
});

/* ─────────────────────────────────────────────────────────
   TAB BAR (top sticky tabs)
───────────────────────────────────────────────────────── */
const TABS = [
  { id: "setup",    icon: Settings2,   label: "Setup"    },
  { id: "calendar", icon: Calendar,    label: "Calendar" },
  { id: "plan",     icon: ListChecks,  label: "Plan"     },
];

const TabBar = ({
  active, onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) => (
  <View style={tabStyles.bar}>
    {TABS.map((t) => {
      const isActive = t.id === active;
      const Icon = t.icon;
      return (
        <Spring
          key={t.id}
          onPress={() => { Haptics.selectionAsync(); onChange(t.id); }}
          style={tabStyles.tab}
        >
          <View style={[tabStyles.tabInner, isActive && tabStyles.tabActive]}>
            <Icon
              size={15}
              color={isActive ? T.live : T.ink40}
              strokeWidth={isActive ? 2.2 : 1.8}
            />
            <Text style={[tabStyles.tabLabel, { fontSize: sp(11) }, isActive && tabStyles.tabLabelActive]}>
              {t.label}
            </Text>
          </View>
        </Spring>
      );
    })}
  </View>
);

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 0,
    gap: 4,
  },
  tab: { flex: 1 },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: T.live,
  },
  tabLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 0.2,
  },
  tabLabelActive: { color: T.live },
});

/* ─────────────────────────────────────────────────────────
   WORKOUT TYPE CHIP
───────────────────────────────────────────────────────── */
const WorkoutChip = ({ type }: { type: string }) => {
  const meta = WORKOUT_META[type] ?? WORKOUT_META.REST;
  return (
    <View style={[chipStyles.chip, { backgroundColor: meta.softBg }]}>
      <View style={[chipStyles.dot, { backgroundColor: meta.color }]} />
      <Text style={[chipStyles.label, { color: meta.color, fontSize: sp(10) }]}>
        {meta.short}
      </Text>
    </View>
  );
};

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  label: {
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.8,
  },
});

/* ─────────────────────────────────────────────────────────
   WORKOUT ACTION BUTTON
───────────────────────────────────────────────────────── */
const WkBtn = ({
  label, onPress, variant = "default",
}: {
  label: string;
  onPress: () => void;
  variant?: "default" | "primary" | "danger" | "amber" | "blue" | "done";
}) => {
  const bg: Record<string, string> = {
    default: T.ink10,
    primary: T.ink,
    danger:  "#DC2626",
    amber:   "#D97706",
    blue:    "#2563EB",
    done:    T.successSoft,
  };
  const fg: Record<string, string> = {
    default: T.ink60,
    primary: "#FFF",
    danger:  "#FFF",
    amber:   "#FFF",
    blue:    "#FFF",
    done:    T.success,
  };
  return (
    <Spring onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}>
      <View style={[wkBtnStyles.btn, { backgroundColor: bg[variant] }]}>
        <Text style={[wkBtnStyles.label, { color: fg[variant], fontSize: sp(12) }]}>
          {label}
        </Text>
      </View>
    </Spring>
  );
};

const wkBtnStyles = StyleSheet.create({
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    minHeight: 36,
  },
  label: {
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.1,
  },
});

/* ─────────────────────────────────────────────────────────
   LIVE TIMER DISPLAY
───────────────────────────────────────────────────────── */
const LiveTimer = ({ seconds }: { seconds: number }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    ).start();
    return () => pulse.stopAnimation();
  }, []);

  return (
    <View style={timerStyles.row}>
      <Animated.View style={[timerStyles.dot, { opacity: pulse }]} />
      <Text style={[timerStyles.time, { fontSize: sp(14) }]}>
        {fmtTimer(seconds)}
      </Text>
    </View>
  );
};

const timerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.liveSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.live,
  },
  time: {
    fontFamily: "Poppins-SemiBold",
    color: T.live,
    letterSpacing: -0.3,
  },
});

/* ─────────────────────────────────────────────────────────
   DAILY WORKOUT ROW
───────────────────────────────────────────────────────── */
const DailyWorkoutRow = ({
  workout,
  workoutIndex,
  weekNum,
  nowMs,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  workout: any;
  workoutIndex: number;
  weekNum: number;
  nowMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) => {
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.REST;
  const Icon = meta.icon;

  const isRest = workout.type === "REST";
  const isActive = !!(workout.startedAt && !workout.isPaused && !workout.completed);
  const isPaused = !!(workout.isPaused && !workout.completed);
  const isDone = workout.completed;

  const getElapsed = (): number | null => {
    if (isDone) return null;
    const base = workout.elapsedBeforePauseSec ?? 0;
    if (isActive && workout.startedAt) {
      return base + Math.max(0, Math.round((nowMs - new Date(workout.startedAt).getTime()) / 1000));
    }
    if (isPaused) return base;
    return null;
  };

  const elapsed = getElapsed();

  return (
    <View style={[dwStyles.row, isDone && dwStyles.rowDone, (isActive || isPaused) && dwStyles.rowActive]}>
      {/* Left: day badge */}
      <View style={[dwStyles.dayBadge, { backgroundColor: meta.softBg }]}>
        <Text style={[dwStyles.dayText, { color: meta.color, fontSize: sp(11) }]}>
          {workout.day}
        </Text>
      </View>

      {/* Center: info */}
      <View style={dwStyles.info}>
        <View style={dwStyles.infoTop}>
          <Text style={[dwStyles.typeLabel, { color: meta.color, fontSize: sp(13) }]}>
            {meta.label}
          </Text>
          {isDone && (
            <View style={dwStyles.donePill}>
              <Check size={9} color={T.success} strokeWidth={3} />
              <Text style={[dwStyles.donePillText, { fontSize: sp(9) }]}>Done</Text>
            </View>
          )}
        </View>
        <Text style={[dwStyles.paceHint, { fontSize: sp(11) }]}>{meta.pace}</Text>

        {/* Actions */}
        {!isRest && !isDone && (
          <View style={dwStyles.actions}>
            {!isActive && !isPaused && (
              <WkBtn label="Start" onPress={onStart} variant="primary" />
            )}
            {isActive && (
              <>
                <WkBtn label="Pause" onPress={onPause} variant="amber" />
                <WkBtn label="Finish" onPress={onStop} variant="danger" />
              </>
            )}
            {isPaused && (
              <>
                <WkBtn label="Resume" onPress={onResume} variant="blue" />
                <WkBtn label="Finish" onPress={onStop} variant="danger" />
              </>
            )}
          </View>
        )}

        {/* Live timer */}
        {elapsed !== null && (
          <View style={{ marginTop: 8 }}>
            <LiveTimer seconds={elapsed} />
          </View>
        )}
      </View>

      {/* Right: distance */}
      {workout.distance > 0 && (
        <View style={dwStyles.distCol}>
          <Text style={[dwStyles.dist, { fontSize: sp(16) }]}>
            {workout.distance}
          </Text>
          <Text style={[dwStyles.distUnit, { fontSize: sp(10) }]}>km</Text>
        </View>
      )}
    </View>
  );
};

const dwStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: T.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  rowDone: {
    backgroundColor: T.successSoft,
    borderColor: "#BBF7D0",
  },
  rowActive: {
    borderColor: T.live,
    backgroundColor: T.liveSoft,
  },
  dayBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dayText: {
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.3,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  infoTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  typeLabel: {
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.2,
  },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: T.successSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  donePillText: {
    fontFamily: "Poppins-SemiBold",
    color: T.success,
    letterSpacing: 0.3,
  },
  paceHint: {
    fontFamily: "Poppins-Regular",
    color: T.ink60,
    marginBottom: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  distCol: {
    alignItems: "flex-end",
    flexShrink: 0,
    paddingTop: 2,
  },
  dist: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.5,
  },
  distUnit: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
  },
});

/* ─────────────────────────────────────────────────────────
   WEEK CARD
───────────────────────────────────────────────────────── */
const WeekCard = ({
  week,
  expanded,
  onToggle,
  nowMs,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  week: any;
  expanded: boolean;
  onToggle: () => void;
  nowMs: number;
  onStart: (wi: number) => void;
  onPause: (wi: number) => void;
  onResume: (wi: number) => void;
  onStop: (wi: number) => void;
}) => {
  const { width } = useWindowDimensions();
  const prog = getWeekProgress(week);
  const pct  = prog.pct;
  const hasActive = week.dailyWorkouts.some((w: any) => w.startedAt && !w.isPaused && !w.completed);

  return (
    <Appear delay={week.week * 20}>
      <View style={[wkStyles.card, hasActive && wkStyles.cardActive]}>
        {/* Header */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onToggle();
          }}
          style={wkStyles.header}
          hitSlop={{ top:8, bottom:8 }}
        >
          <View style={wkStyles.headerLeft}>
            <View style={wkStyles.weekNumBox}>
              <Text style={[wkStyles.weekNumLabel, { fontSize: sp(9) }]}>WK</Text>
              <Text style={[wkStyles.weekNum, { fontSize: sp(18) }]}>{week.week}</Text>
            </View>
            <View style={wkStyles.headerMeta}>
              <Text style={[wkStyles.metaMain, { fontSize: sp(14) }]}>
                {prog.completed}/{prog.total} workouts
              </Text>
              <View style={wkStyles.volRow}>
                <Text style={[wkStyles.vol, { fontSize: sp(12) }]}>{week.volume} km</Text>
                {pct === 100 && (
                  <View style={wkStyles.completePill}>
                    <Check size={8} color={T.success} strokeWidth={3} />
                    <Text style={[wkStyles.completePillText, { fontSize: sp(9) }]}>Complete</Text>
                  </View>
                )}
                {hasActive && (
                  <View style={wkStyles.activePill}>
                    <View style={wkStyles.activeDot} />
                    <Text style={[wkStyles.activePillText, { fontSize: sp(9) }]}>Active</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Progress bar + chevron */}
          <View style={wkStyles.headerRight}>
            <View style={wkStyles.progressBarContainer}>
              <View style={wkStyles.progressTrack}>
                <View
                  style={[
                    wkStyles.progressFill,
                    { width: `${pct}%`, backgroundColor: pct === 100 ? T.success : T.live },
                  ]}
                />
              </View>
              <Text style={[wkStyles.pctLabel, { fontSize: sp(10) }]}>{pct}%</Text>
            </View>
            <View style={wkStyles.chevron}>
              {expanded
                ? <ChevronUp  size={14} color={T.ink40} strokeWidth={2} />
                : <ChevronDown size={14} color={T.ink40} strokeWidth={2} />}
            </View>
          </View>
        </Pressable>

        {/* Workout type mini chips row (always visible) */}
        {!expanded && (
          <View style={wkStyles.chipsRow}>
            {week.dailyWorkouts.map((w: any, i: number) => (
              <WorkoutChip key={i} type={w.type} />
            ))}
          </View>
        )}

        {/* Expanded: daily workouts */}
        {expanded && (
          <View style={wkStyles.dailyList}>
            <Hairline style={{ marginBottom: 12 }} />
            {week.dailyWorkouts.map((workout: any, idx: number) => (
              <DailyWorkoutRow
                key={idx}
                workout={workout}
                workoutIndex={idx}
                weekNum={week.week}
                nowMs={nowMs}
                onStart={() => onStart(idx)}
                onPause={() => onPause(idx)}
                onResume={() => onResume(idx)}
                onStop={() => onStop(idx)}
              />
            ))}
          </View>
        )}
      </View>
    </Appear>
  );
};

const wkStyles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardActive: {
    borderColor: T.live,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  weekNumBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: T.ink05,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  weekNumLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  weekNum: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.8,
    lineHeight: 22,
  },
  headerMeta: { flex: 1 },
  metaMain: {
    fontFamily: "Poppins-Medium",
    color: T.ink,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  volRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  vol: {
    fontFamily: "Poppins-Regular",
    color: T.ink60,
  },
  completePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: T.successSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  completePillText: {
    fontFamily: "Poppins-SemiBold",
    color: T.success,
    letterSpacing: 0.2,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: T.liveSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.live,
  },
  activePillText: {
    fontFamily: "Poppins-SemiBold",
    color: T.live,
    letterSpacing: 0.2,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 6,
    flexShrink: 0,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressTrack: {
    width: 52,
    height: 3,
    backgroundColor: T.ink10,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  pctLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink60,
    minWidth: 28,
    textAlign: "right",
  },
  chevron: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  dailyList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
  },
});

/* ─────────────────────────────────────────────────────────
   CALENDAR SECTION
───────────────────────────────────────────────────────── */
const CalendarSection = ({
  plan,
  planStartDate,
  runHistory,
  onLogDate,
}: {
  plan: any[] | null;
  planStartDate: string;
  runHistory: any[];
  onLogDate: (dateStr: string, mapped: any) => void;
}) => {
  const { width } = useWindowDimensions();
  const hPad = width < 360 ? 16 : 22;

  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date().toISOString().split("T")[0]);

  const activitySet = useMemo(() =>
    new Set((runHistory || []).map((r: any) => new Date(r.date).toISOString().split("T")[0])),
    [runHistory]
  );

  const streak = useMemo(() => {
    let s = 0;
    const cursor = new Date();
    while (activitySet.has(cursor.toISOString().split("T")[0])) {
      s++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return s;
  }, [activitySet]);

  const getWorkoutForDate = useCallback((dateStr: string) => {
    if (!plan?.length || !planStartDate) return null;
    const start  = new Date(planStartDate);
    const target = new Date(dateStr);
    const diff   = Math.floor(
      (new Date(target.toDateString()).getTime() - new Date(start.toDateString()).getTime()) / 86400000
    );
    if (diff < 0) return null;
    const wi = Math.floor(diff / 7);
    if (wi >= plan.length) return null;
    const di = diff % 7;
    const week = plan[wi];
    const workout = week.dailyWorkouts[di];
    if (!workout) return null;
    return {
      week: week.week,
      dayLabel: Object.keys(DAY_INDEX).find((k) => DAY_INDEX[k] === di) || "Mon",
      workout,
      workoutIndex: di,
    };
  }, [plan, planStartDate]);

  const days = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const count = new Date(y, m + 1, 0).getDate();
    const offset = first.getDay();
    const result: any[] = [];
    for (let i = 0; i < offset; i++) result.push({ empty: true, key: `e${i}` });
    const todayStr = new Date().toISOString().split("T")[0];
    for (let d = 1; d <= count; d++) {
      const dateStr = new Date(y, m, d).toISOString().split("T")[0];
      const mapped = getWorkoutForDate(dateStr);
      const hasAct = activitySet.has(dateStr);
      const isPast = dateStr < todayStr;
      let marker = "none";
      if (mapped?.workout && mapped.workout.type !== "REST") {
        if (mapped.workout.completed || hasAct) marker = "completed";
        else if (isPast) marker = "missed";
        else marker = "planned";
      }
      result.push({
        key: dateStr, d, dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selected,
        marker,
      });
    }
    return result;
  }, [month, selected, getWorkoutForDate, activitySet]);

  const CELL_W = Math.floor((width - hPad * 2 - 32) / 7); // 32 = card padding

  const selectedMapped = getWorkoutForDate(selected);

  return (
    <Appear delay={0}>
      {/* Stats strip */}
      <View style={calStyles.statsRow}>
        <View style={calStyles.statBox}>
          <View style={calStyles.statIcon}>
            <Flame size={14} color={T.live} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={[calStyles.statVal, { fontSize: sp(18) }]}>{streak}</Text>
            <Text style={[calStyles.statLabel, { fontSize: sp(10) }]}>Day streak</Text>
          </View>
        </View>
        <Hairline style={{ width: StyleSheet.hairlineWidth, height: 36, backgroundColor: T.border }} />
        <View style={calStyles.statBox}>
          <View style={[calStyles.statIcon, { backgroundColor: T.longSoft }]}>
            <Target size={14} color={T.long} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={[calStyles.statVal, { fontSize: sp(18) }]}>{runHistory.length}</Text>
            <Text style={[calStyles.statLabel, { fontSize: sp(10) }]}>Runs logged</Text>
          </View>
        </View>
        <Hairline style={{ width: StyleSheet.hairlineWidth, height: 36, backgroundColor: T.border }} />
        <View style={calStyles.statBox}>
          <View style={[calStyles.statIcon, { backgroundColor: T.easySoft }]}>
            <TrendingUp size={14} color={T.easy} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={[calStyles.statVal, { fontSize: sp(18) }]}>
              {Math.round(runHistory.reduce((s: number, r: any) => s + (r.distance || 0), 0))}
            </Text>
            <Text style={[calStyles.statLabel, { fontSize: sp(10) }]}>km total</Text>
          </View>
        </View>
      </View>

      {/* Calendar card */}
      <View style={calStyles.card}>
        {/* Month navigation */}
        <View style={calStyles.monthNav}>
          <Spring
            onPress={() => {
              Haptics.selectionAsync();
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
            }}
            style={calStyles.navBtn}
          >
            <View style={calStyles.navBtnInner}>
              <ChevronLeft size={16} color={T.ink60} strokeWidth={2} />
            </View>
          </Spring>
          <Text style={[calStyles.monthLabel, { fontSize: sp(14) }]}>
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
          <Spring
            onPress={() => {
              Haptics.selectionAsync();
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
            }}
            style={calStyles.navBtn}
          >
            <View style={calStyles.navBtnInner}>
              <ChevronRight size={16} color={T.ink60} strokeWidth={2} />
            </View>
          </Spring>
        </View>

        {/* Weekday headers */}
        <View style={calStyles.weekdaysRow}>
          {DAY_LABELS.map((d, i) => (
            <View key={i} style={[calStyles.weekdayCell, { width: CELL_W }]}>
              <Text style={[calStyles.weekdayText, { fontSize: sp(11) }]}>{d}</Text>
            </View>
          ))}
        </View>

        <Hairline style={{ marginBottom: 8 }} />

        {/* Days grid */}
        <View style={calStyles.daysGrid}>
          {days.map((item) =>
            item.empty ? (
              <View key={item.key} style={{ width: CELL_W, height: CELL_W }} />
            ) : (
              <Pressable
                key={item.key}
                onPress={() => { Haptics.selectionAsync(); setSelected(item.dateStr); }}
                style={[
                  calStyles.dayCell,
                  { width: CELL_W, height: CELL_W + 6 },
                  item.isToday && calStyles.dayCellToday,
                  item.isSelected && calStyles.dayCellSelected,
                ]}
              >
                <Text style={[
                  calStyles.dayNum,
                  { fontSize: sp(12) },
                  item.isToday && calStyles.dayNumToday,
                  item.isSelected && calStyles.dayNumSelected,
                ]}>
                  {item.d}
                </Text>
                {item.marker !== "none" && (
                  <View style={[
                    calStyles.marker,
                    item.marker === "completed" && calStyles.markerDone,
                    item.marker === "planned"   && calStyles.markerPlanned,
                    item.marker === "missed"    && calStyles.markerMissed,
                  ]} />
                )}
              </Pressable>
            )
          )}
        </View>

        {/* Legend */}
        <Hairline style={{ marginTop: 8, marginBottom: 10 }} />
        <View style={calStyles.legend}>
          {[
            { color: T.success, label: "Done" },
            { color: T.long,    label: "Planned", circle: true },
            { color: T.missed,  label: "Missed", hollow: true },
          ].map((l) => (
            <View key={l.label} style={calStyles.legendItem}>
              <View style={[
                calStyles.legendDot,
                { backgroundColor: l.hollow ? "transparent" : l.color },
                l.hollow && { borderWidth: 1.5, borderColor: l.color },
              ]} />
              <Text style={[calStyles.legendLabel, { fontSize: sp(10) }]}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Selected day detail */}
      <View style={calStyles.detailCard}>
        <Text style={[calStyles.detailDate, { fontSize: sp(12) }]}>
          {new Date(selected + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "short", day: "numeric",
          })}
        </Text>
        {selectedMapped ? (
          <>
            <View style={calStyles.detailWorkout}>
              <WorkoutChip type={selectedMapped.workout.type} />
              {selectedMapped.workout.distance > 0 && (
                <Text style={[calStyles.detailDist, { fontSize: sp(14) }]}>
                  {selectedMapped.workout.distance} km
                </Text>
              )}
              {selectedMapped.workout.completed && (
                <View style={calStyles.donePill}>
                  <Check size={9} color={T.success} strokeWidth={3} />
                  <Text style={[calStyles.donePillText, { fontSize: sp(10) }]}>Completed</Text>
                </View>
              )}
            </View>
            {selectedMapped.workout.type !== "REST" && !selectedMapped.workout.completed && (
              <Spring
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onLogDate(selected, selectedMapped);
                }}
              >
                <View style={calStyles.logBtn}>
                  <Check size={14} color="#FFF" strokeWidth={2.5} />
                  <Text style={[calStyles.logBtnText, { fontSize: sp(13) }]}>Log run for this date</Text>
                </View>
              </Spring>
            )}
          </>
        ) : (
          <Text style={[calStyles.noWorkout, { fontSize: sp(13) }]}>No workout scheduled</Text>
        )}
      </View>
    </Appear>
  );
};

const calStyles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "space-around",
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: T.liveSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.8,
    lineHeight: undefined,
  },
  statLabel: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthLabel: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.3,
  },
  navBtn: {},
  navBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: T.ink05,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdaysRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayCell: {
    alignItems: "center",
  },
  weekdayText: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 0.3,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginVertical: 1,
    gap: 2,
  },
  dayCellToday: {
    backgroundColor: T.ink05,
  },
  dayCellSelected: {
    backgroundColor: T.liveSoft,
  },
  dayNum: {
    fontFamily: "Poppins-Regular",
    color: T.ink80,
  },
  dayNumToday: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
  },
  dayNumSelected: {
    color: T.live,
    fontFamily: "Poppins-SemiBold",
  },
  marker: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  markerDone: { backgroundColor: T.success },
  markerPlanned: { backgroundColor: T.long },
  markerMissed: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: T.missed },
  legend: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 2,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: "Poppins-Regular",
    color: T.ink60,
  },
  detailCard: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    padding: 14,
    gap: 10,
  },
  detailDate: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.2,
  },
  detailWorkout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  detailDist: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.3,
  },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: T.successSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  donePillText: {
    fontFamily: "Poppins-SemiBold",
    color: T.success,
  },
  noWorkout: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
  },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: T.ink,
    borderRadius: T.radiusSm,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  logBtnText: {
    fontFamily: "Poppins-SemiBold",
    color: "#FFF",
    letterSpacing: 0.1,
  },
});

/* ─────────────────────────────────────────────────────────
   SETUP SECTION
───────────────────────────────────────────────────────── */
const SetupSection = ({
  goal, level, onSetGoal, onSetLevel, onGenerate, hasPlan,
}: {
  goal: string; level: string;
  onSetGoal: (g: string) => void;
  onSetLevel: (l: string) => void;
  onGenerate: () => void;
  hasPlan: boolean;
}) => {
  const curLevel = LEVELS.find((l) => l.id === level);
  const curGoal  = GOALS.find((g) => g.id === goal);

  return (
    <Appear delay={0}>
      {/* Goal */}
      <View style={setupStyles.block}>
        <Text style={[setupStyles.blockLabel, { fontSize: sp(10) }]}>GOAL RACE</Text>
        <SegmentedControl
          options={GOALS.map((g) => ({ id: g.id, label: g.label }))}
          value={goal}
          onChange={onSetGoal}
        />
      </View>

      {/* Level */}
      <View style={[setupStyles.block, { marginTop: 18 }]}>
        <Text style={[setupStyles.blockLabel, { fontSize: sp(10) }]}>EXPERIENCE LEVEL</Text>
        <SegmentedControl
          options={LEVELS.map((l) => ({ id: l.id, label: l.label, sub: l.desc }))}
          value={level}
          onChange={onSetLevel}
        />
      </View>

      {/* Summary card */}
      <View style={setupStyles.summaryCard}>
        <View style={setupStyles.summaryRow}>
          <View style={setupStyles.summaryItem}>
            <Text style={[setupStyles.summaryLabel, { fontSize: sp(10) }]}>PLAN GOAL</Text>
            <Text style={[setupStyles.summaryValue, { fontSize: sp(15) }]}>
              {curGoal?.label ?? "—"}
            </Text>
          </View>
          <View style={[setupStyles.summaryDivider]} />
          <View style={setupStyles.summaryItem}>
            <Text style={[setupStyles.summaryLabel, { fontSize: sp(10) }]}>LEVEL</Text>
            <Text style={[setupStyles.summaryValue, { fontSize: sp(15) }]}>
              {curLevel?.label ?? "—"}
            </Text>
          </View>
          <View style={[setupStyles.summaryDivider]} />
          <View style={setupStyles.summaryItem}>
            <Text style={[setupStyles.summaryLabel, { fontSize: sp(10) }]}>DURATION</Text>
            <Text style={[setupStyles.summaryValue, { fontSize: sp(15) }]}>
              {curLevel?.weeks ?? "—"} wks
            </Text>
          </View>
        </View>
      </View>

      {/* Generate CTA */}
      <Spring onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onGenerate(); }}>
        <View style={setupStyles.generateBtn}>
          <Zap size={16} color="#FFF" strokeWidth={2.5} />
          <Text style={[setupStyles.generateText, { fontSize: sp(15) }]}>
            {hasPlan ? "Regenerate Plan" : "Generate Training Plan"}
          </Text>
        </View>
      </Spring>

      {hasPlan && (
        <Text style={[setupStyles.regenerateNote, { fontSize: sp(11) }]}>
          Regenerating will reset all progress. Switch to Plan tab to view your current plan.
        </Text>
      )}
    </Appear>
  );
};

const setupStyles = StyleSheet.create({
  block: {},
  blockLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 2,
    marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    marginTop: 18,
    marginBottom: 18,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
  },
  summaryLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  generateBtn: {
    backgroundColor: T.ink,
    borderRadius: T.radius,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateText: {
    fontFamily: "Poppins-SemiBold",
    color: "#FFF",
    letterSpacing: 0.1,
  },
  regenerateNote: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 18,
  },
});

/* ─────────────────────────────────────────────────────────
   PLAN LIST SECTION
───────────────────────────────────────────────────────── */
const PlanSection = ({
  plan,
  goal,
  level,
  planStartDate,
  nowMs,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  plan: any[];
  goal: string;
  level: string;
  planStartDate: string;
  nowMs: number;
  onStart: (wk: number, wi: number) => void;
  onPause: (wk: number, wi: number) => void;
  onResume: (wk: number, wi: number) => void;
  onStop: (wk: number, wi: number) => void;
}) => {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const curGoal  = GOALS.find((g) => g.id === goal);
  const curLevel = LEVELS.find((l) => l.id === level);

  const totalDone = useMemo(() =>
    plan.flatMap((w) => w.dailyWorkouts).filter((w: any) => w.completed).length,
    [plan]
  );
  const totalWork = useMemo(() =>
    plan.flatMap((w) => w.dailyWorkouts).length,
    [plan]
  );
  const overallPct = totalWork > 0 ? Math.round((totalDone / totalWork) * 100) : 0;

  const displayPlan = showAll ? plan : plan.slice(0, 4);

  return (
    <Appear delay={0}>
      {/* Plan header card */}
      <View style={planStyles.headerCard}>
        <View style={planStyles.headerCardTop}>
          <View>
            <Text style={[planStyles.planTitle, { fontSize: sp(16) }]}>
              {curGoal?.label} · {curLevel?.label}
            </Text>
            <Text style={[planStyles.planMeta, { fontSize: sp(12) }]}>
              {plan.length} weeks · Started {new Date(planStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={planStyles.overallCircle}>
            <Text style={[planStyles.overallPct, { fontSize: sp(14) }]}>{overallPct}%</Text>
          </View>
        </View>
        <View style={planStyles.overallBar}>
          <View style={[planStyles.overallFill, { width: `${overallPct}%` }]} />
        </View>
        <Text style={[planStyles.overallNote, { fontSize: sp(11) }]}>
          {totalDone}/{totalWork} workouts complete
        </Text>
      </View>

      {/* Weeks */}
      {displayPlan.map((w) => (
        <WeekCard
          key={w.week}
          week={w}
          expanded={expandedWeek === w.week}
          onToggle={() => setExpandedWeek(expandedWeek === w.week ? null : w.week)}
          nowMs={nowMs}
          onStart={(wi) => onStart(w.week, wi)}
          onPause={(wi) => onPause(w.week, wi)}
          onResume={(wi) => onResume(w.week, wi)}
          onStop={(wi) => onStop(w.week, wi)}
        />
      ))}

      {plan.length > 4 && (
        <Spring onPress={() => { Haptics.selectionAsync(); setShowAll(!showAll); }}>
          <View style={planStyles.showMoreBtn}>
            <Text style={[planStyles.showMoreText, { fontSize: sp(13) }]}>
              {showAll ? "Show less" : `View all ${plan.length} weeks`}
            </Text>
            {showAll
              ? <ChevronUp   size={14} color={T.ink60} strokeWidth={2} />
              : <ChevronDown size={14} color={T.ink60} strokeWidth={2} />}
          </View>
        </Spring>
      )}
    </Appear>
  );
};

const planStyles = StyleSheet.create({
  headerCard: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  headerCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planTitle: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  planMeta: {
    fontFamily: "Poppins-Regular",
    color: T.ink60,
  },
  overallCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: T.live,
    alignItems: "center",
    justifyContent: "center",
  },
  overallPct: {
    fontFamily: "Poppins-SemiBold",
    color: T.live,
    letterSpacing: -0.5,
  },
  overallBar: {
    height: 3,
    backgroundColor: T.ink10,
    borderRadius: 2,
    overflow: "hidden",
  },
  overallFill: {
    height: "100%",
    backgroundColor: T.live,
    borderRadius: 2,
  },
  overallNote: {
    fontFamily: "Poppins-Regular",
    color: T.ink60,
  },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  showMoreText: {
    fontFamily: "Poppins-Medium",
    color: T.ink60,
  },
});

/* ─────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────── */
const EmptyPlan = ({ onGoSetup }: { onGoSetup: () => void }) => (
  <Appear delay={0}>
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconBox}>
        <ListChecks size={28} color={T.ink40} strokeWidth={1.5} />
      </View>
      <Text style={[emptyStyles.title, { fontSize: sp(16) }]}>No plan yet</Text>
      <Text style={[emptyStyles.sub, { fontSize: sp(13) }]}>
        Set your goal and generate a personalized training plan to get started.
      </Text>
      <Spring onPress={onGoSetup}>
        <View style={emptyStyles.cta}>
          <Text style={[emptyStyles.ctaText, { fontSize: sp(14) }]}>Go to Setup</Text>
          <ChevronRight size={14} color="#FFF" strokeWidth={2.5} />
        </View>
      </Spring>
    </View>
  </Appear>
);

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: T.ink05,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: "Poppins-Regular",
    color: T.ink60,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.ink,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  ctaText: {
    fontFamily: "Poppins-SemiBold",
    color: "#FFF",
  },
});

/* ─────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────── */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isSmall = width < 360;
  const hPad    = isSmall ? 16 : width >= 414 ? 24 : 20;

  const [activeTab, setActiveTab] = useState<"setup" | "calendar" | "plan">("setup");
  const [goal,  setGoal]  = useState("full");
  const [level, setLevel] = useState("beg");
  const [plan,  setPlan]  = useState<any[] | null>(null);
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [runHistory, setRunHistory] = useState<any[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());

  /* ── Live timer tick ── */
  useEffect(() => {
    const hasActive = plan?.some((w) =>
      w.dailyWorkouts?.some((dw: any) => dw.startedAt && !dw.isPaused && !dw.completed)
    );
    if (!hasActive) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [plan]);

  /* ── Load from storage ── */
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [rawPlan, rawHistory] = await Promise.all([
        AsyncStorage.getItem("trainingPlan"),
        AsyncStorage.getItem("runHistory"),
      ]);
      if (rawPlan) {
        const p = JSON.parse(rawPlan);
        setPlan(p.plan);
        setGoal(p.goal ?? "full");
        setLevel(p.level ?? "beg");
        if (p.startDate) setPlanStartDate(p.startDate);
        setActiveTab("plan");
      }
      if (rawHistory) setRunHistory(JSON.parse(rawHistory));
    } catch { /* ignore */ }
  };

  const savePlan = async (newPlan: any[], g: string, l: string, sd: string) => {
    await AsyncStorage.setItem("trainingPlan", JSON.stringify({ plan: newPlan, goal: g, level: l, startDate: sd }));
  };

  /* ── Generate plan ── */
  const generateDailyWorkouts = (week: number, totalWeeks: number, goalId: string, lvl: string) => {
    const prog = week / totalWeeks;
    const taper = prog >= 0.8;
    let base = goalId === "full" ? 8 : goalId === "half" ? 5 : 3;
    if (lvl === "adv") base *= 1.3;
    if (lvl === "int") base *= 1.15;
    const longDist = Math.round(base * (1 + prog * 1.5) * (taper ? 0.6 : 1));
    return [
      { day:"Mon", type:"EASY",                     distance: Math.round(base * 0.7) },
      { day:"Tue", type: week % 2 === 0 ? "INTERVALS" : "TEMPO", distance: Math.round(base * 0.8) },
      { day:"Wed", type:"REST",                     distance: 0 },
      { day:"Thu", type:"EASY",                     distance: Math.round(base * 0.9) },
      { day:"Fri", type:"REST",                     distance: 0 },
      { day:"Sat", type:"EASY",                     distance: Math.round(base * 0.6) },
      { day:"Sun", type:"LONG",                     distance: longDist },
    ];
  };

  const handleGenerate = () => {
    if (plan) {
      Alert.alert(
        "Regenerate Plan?",
        "This will reset all progress. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Regenerate", style: "destructive", onPress: doGenerate },
        ]
      );
    } else {
      doGenerate();
    }
  };

  const doGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const weeks = level === "beg" ? 16 : level === "int" ? 12 : 8;
    const sd = new Date().toISOString().split("T")[0];
    const p = Array.from({ length: weeks }, (_, i) => {
      const wn = i + 1;
      const dw = generateDailyWorkouts(wn, weeks, goal, level).map((w) => ({
        ...w,
        completed: false,
        startedAt: null,
        isPaused: false,
        elapsedBeforePauseSec: 0,
      }));
      return { week: wn, volume: dw.reduce((s, d) => s + d.distance, 0), dailyWorkouts: dw };
    });
    setPlan(p);
    setPlanStartDate(sd);
    savePlan(p, goal, level, sd);
    setActiveTab("plan");
  };

  /* ── Workout actions ── */
  const hasAnotherActive = (wkNum: number, wi: number) =>
    plan?.some((w) =>
      w.dailyWorkouts?.some((dw: any, idx: number) =>
        !dw.completed && (dw.startedAt || dw.isPaused) && !(w.week === wkNum && idx === wi)
      )
    );

  const updateWorkout = (wkNum: number, wi: number, patch: object) => {
    const next = plan!.map((w) => w.week !== wkNum ? w : {
      ...w,
      dailyWorkouts: w.dailyWorkouts.map((dw: any, idx: number) =>
        idx !== wi ? dw : { ...dw, ...patch }
      ),
    });
    setPlan(next);
    savePlan(next, goal, level, planStartDate);
    return next;
  };

  const handleStart = (wkNum: number, wi: number) => {
    const tw = plan?.find((w) => w.week === wkNum)?.dailyWorkouts?.[wi];
    if (!tw || tw.type === "REST" || tw.completed) return;
    if (hasAnotherActive(wkNum, wi)) {
      Alert.alert("Workout active", "Finish the current workout first."); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateWorkout(wkNum, wi, { startedAt: new Date().toISOString(), isPaused: false });
  };

  const handlePause = (wkNum: number, wi: number) => {
    const tw = plan?.find((w) => w.week === wkNum)?.dailyWorkouts?.[wi];
    if (!tw?.startedAt || tw.completed || tw.isPaused) return;
    const elapsed = Math.max(0, Math.round((Date.now() - new Date(tw.startedAt).getTime()) / 1000));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateWorkout(wkNum, wi, {
      startedAt: null, isPaused: true,
      elapsedBeforePauseSec: (tw.elapsedBeforePauseSec ?? 0) + elapsed,
    });
  };

  const handleResume = (wkNum: number, wi: number) => {
    const tw = plan?.find((w) => w.week === wkNum)?.dailyWorkouts?.[wi];
    if (!tw || tw.completed || !tw.isPaused) return;
    if (hasAnotherActive(wkNum, wi)) {
      Alert.alert("Workout active", "Finish the current workout first."); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateWorkout(wkNum, wi, { startedAt: new Date().toISOString(), isPaused: false });
  };

  const handleStop = async (wkNum: number, wi: number) => {
    const tw = plan?.find((w) => w.week === wkNum)?.dailyWorkouts?.[wi];
    if ((!tw?.startedAt && !tw?.isPaused) || tw.type === "REST") return;

    const base = tw.elapsedBeforePauseSec ?? 0;
    const cur  = tw.startedAt && !tw.isPaused
      ? Math.max(0, Math.round((Date.now() - new Date(tw.startedAt).getTime()) / 1000))
      : 0;
    const dur = Math.max(1, base + cur);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = updateWorkout(wkNum, wi, {
      completed: true, startedAt: null, isPaused: false,
      elapsedBeforePauseSec: 0, actualDurationSec: dur,
    });

    if (tw.distance <= 0) return;
    const pace = dur / 60 / tw.distance;
    const entry = {
      id: `${Date.now()}-${wkNum}-${wi}`,
      date: new Date().toISOString().split("T")[0],
      distance: tw.distance,
      time: formatSecondsToHms(dur),
      pace,
      notes: `Training Plan · Week ${wkNum} ${tw.day} · ${WORKOUT_META[tw.type]?.label}`,
    };
    const existing = await AsyncStorage.getItem("runHistory");
    const hist = existing ? JSON.parse(existing) : [];
    const updated = [entry, ...hist];
    await AsyncStorage.setItem("runHistory", JSON.stringify(updated));
    setRunHistory(updated);
  };

  /* ── Log from calendar ── */
  const handleLogDate = async (dateStr: string, mapped: any) => {
    const tw = mapped.workout;
    if (tw.completed) { Alert.alert("Already logged", "This workout is already complete."); return; }
    const pace = PACE_ESTIMATE[tw.type] ?? 6;
    const dur  = Math.round(tw.distance * pace * 60);
    const entry = {
      id: `${Date.now()}-cal`,
      date: dateStr,
      distance: tw.distance,
      time: formatSecondsToHms(dur),
      pace,
      notes: `Calendar log · Week ${mapped.week} ${mapped.dayLabel} · ${WORKOUT_META[tw.type]?.label}`,
    };
    const next = plan!.map((w) => w.week !== mapped.week ? w : {
      ...w,
      dailyWorkouts: w.dailyWorkouts.map((dw: any, idx: number) =>
        idx !== mapped.workoutIndex ? dw : { ...dw, completed: true, startedAt: null, isPaused: false, elapsedBeforePauseSec: 0 }
      ),
    });
    const existing = await AsyncStorage.getItem("runHistory");
    const hist = existing ? JSON.parse(existing) : [];
    const updated = [entry, ...hist];
    await AsyncStorage.setItem("runHistory", JSON.stringify(updated));
    await savePlan(next, goal, level, planStartDate);
    setPlan(next);
    setRunHistory(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Logged ✓", "Run added and workout marked complete.");
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
      <View style={[mainStyles.root, { paddingTop: insets.top }]}>

        {/* ── Page header ── */}
        <View style={[mainStyles.pageHeader, { paddingHorizontal: hPad }]}>
          <View>
            <Text style={[mainStyles.pageEyebrow, { fontSize: sp(10) }]}>YOUR</Text>
            <Text style={[mainStyles.pageTitle, { fontSize: sp(22) }]}>Training Plan</Text>
          </View>
          {plan && (
            <View style={mainStyles.planPill}>
              <ListChecks size={11} color={T.live} strokeWidth={2.2} />
              <Text style={[mainStyles.planPillText, { fontSize: sp(11) }]}>
                {plan.length}wk plan
              </Text>
            </View>
          )}
        </View>

        {/* ── Sticky tab bar ── */}
        <TabBar
          active={activeTab}
          onChange={(id) => setActiveTab(id as any)}
        />

        {/* ── Content ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            mainStyles.scroll,
            { paddingHorizontal: hPad, paddingBottom: insets.bottom + 110 },
          ]}
        >
          {activeTab === "setup" && (
            <View style={{ paddingTop: 22 }}>
              <SetupSection
                goal={goal}
                level={level}
                onSetGoal={setGoal}
                onSetLevel={setLevel}
                onGenerate={handleGenerate}
                hasPlan={!!plan}
              />
            </View>
          )}

          {activeTab === "calendar" && (
            <View style={{ paddingTop: 22 }}>
              <CalendarSection
                plan={plan}
                planStartDate={planStartDate}
                runHistory={runHistory}
                onLogDate={handleLogDate}
              />
            </View>
          )}

          {activeTab === "plan" && (
            <View style={{ paddingTop: 22 }}>
              {plan ? (
                <PlanSection
                  plan={plan}
                  goal={goal}
                  level={level}
                  planStartDate={planStartDate}
                  nowMs={nowMs}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                />
              ) : (
                <EmptyPlan onGoSetup={() => setActiveTab("setup")} />
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN STYLES
───────────────────────────────────────────────────────── */
const mainStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: T.bg,
  },
  pageEyebrow: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    letterSpacing: 2,
    marginBottom: 1,
  },
  pageTitle: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -0.8,
  },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.liveSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.liveMid,
  },
  planPillText: {
    fontFamily: "Poppins-SemiBold",
    color: T.live,
    letterSpacing: 0.2,
  },
  scroll: {
    // horizontal padding set inline
  },
});