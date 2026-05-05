/**
 * app/(tabs)/plan.tsx  —  Training Plan  v3.0
 *
 * UX Overhaul:
 * • Pure white (#FFFFFF) background throughout
 * • Larger touch targets (min 48px height) on all interactive elements
 * • Tabs are always visible and accessible — no scroll hunting
 * • Generous spacing — nothing crammed or overlapping
 * • Segmented controls use full-height tappable pills
 * • Calendar cells are larger and easier to hit
 * • Week cards clearly separated with shadow depth
 * • Workout rows have breathing room between elements
 * • Buttons are wide, high-contrast, clearly labelled
 * • Live timer visible without scrolling
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
  Check,
  Flame,
  Calendar,
  Settings2,
  ListChecks,
  Zap,
  TrendingUp,
  Moon,
  Play,
  Pause,
  Square,
} from "lucide-react-native";
import { formatSecondsToHms } from "../../utils/runMath";

/* ─────────────────────────────────────────────────────────
   ANDROID LAYOUT ANIMATION
───────────────────────────────────────────────────────── */
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
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
   DESIGN TOKENS — white-first palette
───────────────────────────────────────────────────────── */
const T = {
  // Base — pure white
  bg:         "#FFFFFF",
  surface:    "#FFFFFF",
  surfaceOff: "#F8F8F8",
  page:       "#F2F2F2",

  // Ink hierarchy
  ink:        "#0F0F0F",
  ink80:      "#2C2C2C",
  ink60:      "#5A5A5A",
  ink40:      "#999999",
  ink20:      "#CCCCCC",
  ink10:      "#E8E8E8",
  ink05:      "#F4F4F4",

  // Accent — vivid ember
  live:       "#E8390E",
  liveSoft:   "#FFF3F0",
  liveMid:    "#FFD5C8",

  // Workout type colors
  easy:       "#16A34A",
  easySoft:   "#F0FDF4",
  tempo:      "#D97706",
  tempoSoft:  "#FFFBEB",
  intervals:  "#DC2626",
  intSoft:    "#FEF2F2",
  long:       "#2563EB",
  longSoft:   "#EFF6FF",
  rest:       "#71717A",
  restSoft:   "#FAFAFA",

  // Status
  success:     "#16A34A",
  successSoft: "#F0FDF4",
  successBorder:"#86EFAC",
  missed:      "#DC2626",

  // Border
  border:     "#EBEBEB",
  borderMd:   "#D9D9D9",

  // Shape
  radius:     16,
  radiusMd:   12,
  radiusSm:   8,
  radiusXs:   6,
};

/* ─────────────────────────────────────────────────────────
   WORKOUT CONFIGS
───────────────────────────────────────────────────────── */
const WORKOUT_META: Record<string, {
  label: string; short: string; color: string; softBg: string;
  pace: string; icon: React.FC<any>;
}> = {
  EASY:      { label: "Easy Run",   short: "EASY",  color: T.easy,      softBg: T.easySoft,  pace: "Conversational pace",  icon: TrendingUp },
  TEMPO:     { label: "Tempo Run",  short: "TEMPO", color: T.tempo,     softBg: T.tempoSoft, pace: "Comfortably hard",     icon: Zap },
  INTERVALS: { label: "Intervals",  short: "INT",   color: T.intervals, softBg: T.intSoft,   pace: "Hard effort",          icon: Flame },
  LONG:      { label: "Long Run",   short: "LONG",  color: T.long,      softBg: T.longSoft,  pace: "Easy to moderate",    icon: Target },
  REST:      { label: "Rest Day",   short: "REST",  color: T.rest,      softBg: T.restSoft,  pace: "Full recovery",        icon: Moon },
};

const GOALS = [
  { id: "5k",   label: "5K",            dist: 5 },
  { id: "10k",  label: "10K",           dist: 10 },
  { id: "half", label: "Half",          dist: 21.1 },
  { id: "full", label: "Marathon",      dist: 42.2 },
];

const LEVELS = [
  { id: "beg", label: "Beginner",     weeks: 16, desc: "0–20 km/wk" },
  { id: "int", label: "Intermediate", weeks: 12, desc: "20–50 km/wk" },
  { id: "adv", label: "Advanced",     weeks: 8,  desc: "50+ km/wk" },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
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
  const total = week.dailyWorkouts.length;
  const completed = week.dailyWorkouts.filter((w: any) => w.completed).length;
  return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
};

/* ─────────────────────────────────────────────────────────
   HAIRLINE
───────────────────────────────────────────────────────── */
const Hairline = ({ style }: { style?: object }) => (
  <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: T.border }, style]} />
);

/* ─────────────────────────────────────────────────────────
   FADE-IN WRAPPER
───────────────────────────────────────────────────────── */
const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 240, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 240, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>
      {children}
    </Animated.View>
  );
};

/* ─────────────────────────────────────────────────────────
   PRESS SCALE
───────────────────────────────────────────────────────── */
const PressScale = ({
  children, onPress, style, disabled = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  disabled?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 300, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 200, bounciness: 5 }).start()}
      disabled={disabled}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style, disabled && { opacity: 0.4 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   TAB BAR
───────────────────────────────────────────────────────── */
const TABS = [
  { id: "setup",    icon: Settings2,  label: "Setup" },
  { id: "calendar", icon: Calendar,   label: "Calendar" },
  { id: "plan",     icon: ListChecks, label: "Plan" },
];

const TabBar = ({ active, onChange }: { active: string; onChange: (id: string) => void }) => (
  <View style={tabS.bar}>
    {TABS.map((t) => {
      const on = t.id === active;
      const Icon = t.icon;
      return (
        <Pressable
          key={t.id}
          onPress={() => { Haptics.selectionAsync(); onChange(t.id); }}
          style={tabS.tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: on }}
        >
          <View style={[tabS.inner, on && tabS.innerActive]}>
            <Icon size={18} color={on ? T.live : T.ink40} strokeWidth={on ? 2 : 1.8} />
            <Text style={[tabS.label, { fontSize: sp(12) }, on && tabS.labelActive]}>
              {t.label}
            </Text>
          </View>
        </Pressable>
      );
    })}
  </View>
);

const tabS = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  tab: { flex: 1 },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  innerActive: { borderBottomColor: T.live },
  label: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 0.1,
  },
  labelActive: { color: T.live },
});

/* ─────────────────────────────────────────────────────────
   SEGMENTED CONTROL
───────────────────────────────────────────────────────── */
const SegControl = ({
  options, value, onChange,
}: {
  options: { id: string; label: string; sub?: string }[];
  value: string;
  onChange: (id: string) => void;
}) => (
  <View style={segS.track}>
    {options.map((o) => {
      const on = o.id === value;
      return (
        <Pressable
          key={o.id}
          onPress={() => { Haptics.selectionAsync(); onChange(o.id); }}
          style={[segS.pill, on && segS.pillOn]}
        >
          <Text style={[segS.label, { fontSize: sp(13) }, on && segS.labelOn]} numberOfLines={1}>
            {o.label}
          </Text>
          {o.sub ? (
            <Text style={[segS.sub, { fontSize: sp(10) }, on && segS.subOn]} numberOfLines={1}>
              {o.sub}
            </Text>
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const segS = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: T.ink05,
    borderRadius: T.radiusMd,
    padding: 4,
    gap: 4,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: T.radiusSm,
    minHeight: 48,
    justifyContent: "center",
  },
  pillOn: {
    backgroundColor: T.surface,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: {
    fontFamily: "Poppins-Medium",
    color: T.ink60,
  },
  labelOn: { color: T.ink },
  sub: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    marginTop: 2,
  },
  subOn: { color: T.ink60 },
});

/* ─────────────────────────────────────────────────────────
   WORKOUT TYPE CHIP
───────────────────────────────────────────────────────── */
const WorkoutChip = ({ type }: { type: string }) => {
  const m = WORKOUT_META[type] ?? WORKOUT_META.REST;
  return (
    <View style={[chipS.chip, { backgroundColor: m.softBg }]}>
      <View style={[chipS.dot, { backgroundColor: m.color }]} />
      <Text style={[chipS.label, { color: m.color, fontSize: sp(10) }]}>{m.short}</Text>
    </View>
  );
};

const chipS = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: { fontFamily: "Poppins-SemiBold", letterSpacing: 0.6 },
});

/* ─────────────────────────────────────────────────────────
   LIVE TIMER
───────────────────────────────────────────────────────── */
const LiveTimer = ({ seconds }: { seconds: number }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <View style={timerS.row}>
      <Animated.View style={[timerS.dot, { opacity: pulse }]} />
      <Text style={[timerS.time, { fontSize: sp(13) }]}>{fmtTimer(seconds)}</Text>
    </View>
  );
};

const timerS = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: T.liveSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.live },
  time: { fontFamily: "Poppins-SemiBold", color: T.live, letterSpacing: -0.3 },
});

/* ─────────────────────────────────────────────────────────
   ACTION BUTTON
───────────────────────────────────────────────────────── */
type BtnVariant = "primary" | "amber" | "blue" | "danger" | "ghost";
const ActionBtn = ({
  label, onPress, variant = "primary", icon,
}: {
  label: string; onPress: () => void; variant?: BtnVariant; icon?: React.ReactNode;
}) => {
  const bg: Record<BtnVariant, string> = {
    primary: T.ink,
    amber:   "#D97706",
    blue:    "#2563EB",
    danger:  "#DC2626",
    ghost:   T.ink05,
  };
  const fg: Record<BtnVariant, string> = {
    primary: "#FFFFFF",
    amber:   "#FFFFFF",
    blue:    "#FFFFFF",
    danger:  "#FFFFFF",
    ghost:   T.ink60,
  };
  return (
    <PressScale onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}>
      <View style={[abS.btn, { backgroundColor: bg[variant] }]}>
        {icon}
        <Text style={[abS.label, { color: fg[variant], fontSize: sp(13) }]}>{label}</Text>
      </View>
    </PressScale>
  );
};

const abS = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: T.radiusSm,
    minWidth: 80,
    minHeight: 44,
  },
  label: { fontFamily: "Poppins-SemiBold" },
});

/* ─────────────────────────────────────────────────────────
   DAILY WORKOUT ROW
───────────────────────────────────────────────────────── */
const DailyWorkoutRow = ({
  workout, workoutIndex, weekNum, nowMs, onStart, onPause, onResume, onStop,
}: {
  workout: any; workoutIndex: number; weekNum: number; nowMs: number;
  onStart: () => void; onPause: () => void; onResume: () => void; onStop: () => void;
}) => {
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.REST;
  const isRest    = workout.type === "REST";
  const isActive  = !!(workout.startedAt && !workout.isPaused && !workout.completed);
  const isPaused  = !!(workout.isPaused && !workout.completed);
  const isDone    = workout.completed;

  const elapsed: number | null = (() => {
    if (isDone) return null;
    const base = workout.elapsedBeforePauseSec ?? 0;
    if (isActive && workout.startedAt)
      return base + Math.max(0, Math.round((nowMs - new Date(workout.startedAt).getTime()) / 1000));
    if (isPaused) return base;
    return null;
  })();

  return (
    <View style={[
      dwS.row,
      isDone && dwS.rowDone,
      isActive && dwS.rowActive,
      isPaused && dwS.rowPaused,
    ]}>
      {/* Day label */}
      <View style={[dwS.dayBadge, { backgroundColor: meta.softBg }]}>
        <Text style={[dwS.dayText, { color: meta.color, fontSize: sp(11) }]}>
          {workout.day}
        </Text>
      </View>

      {/* Info */}
      <View style={dwS.info}>
        <View style={dwS.topRow}>
          <Text style={[dwS.typeLabel, { color: meta.color, fontSize: sp(14) }]}>
            {meta.label}
          </Text>
          {isDone && (
            <View style={dwS.donePill}>
              <Check size={10} color={T.success} strokeWidth={2.5} />
              <Text style={[dwS.donePillText, { fontSize: sp(10) }]}>Done</Text>
            </View>
          )}
        </View>

        <Text style={[dwS.pace, { fontSize: sp(12) }]}>{meta.pace}</Text>

        {!isRest && !isDone && (
          <View style={dwS.actions}>
            {!isActive && !isPaused && (
              <ActionBtn
                label="Start"
                onPress={onStart}
                variant="primary"
                icon={<Play size={13} color="#FFF" fill="#FFF" />}
              />
            )}
            {isActive && (
              <>
                <ActionBtn label="Pause"  onPress={onPause}  variant="amber" icon={<Pause size={13} color="#FFF" />} />
                <ActionBtn label="Finish" onPress={onStop}   variant="danger" icon={<Square size={13} color="#FFF" fill="#FFF" />} />
              </>
            )}
            {isPaused && (
              <>
                <ActionBtn label="Resume" onPress={onResume} variant="blue" icon={<Play size={13} color="#FFF" fill="#FFF" />} />
                <ActionBtn label="Finish" onPress={onStop}   variant="danger" icon={<Square size={13} color="#FFF" fill="#FFF" />} />
              </>
            )}
          </View>
        )}

        {elapsed !== null && <LiveTimer seconds={elapsed} />}
      </View>

      {/* Distance */}
      {workout.distance > 0 && (
        <View style={dwS.distCol}>
          <Text style={[dwS.dist, { fontSize: sp(18) }]}>{workout.distance}</Text>
          <Text style={[dwS.distUnit, { fontSize: sp(10) }]}>km</Text>
        </View>
      )}
    </View>
  );
};

const dwS = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    backgroundColor: T.surface,
    borderRadius: T.radiusMd,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 8,
  },
  rowDone:   { backgroundColor: T.successSoft, borderColor: T.successBorder },
  rowActive: { borderColor: T.live, backgroundColor: T.liveSoft },
  rowPaused: { borderColor: "#D97706", backgroundColor: "#FFFBEB" },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: T.radiusSm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dayText: { fontFamily: "Poppins-SemiBold", letterSpacing: 0.3 },
  info: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 },
  typeLabel: { fontFamily: "Poppins-SemiBold", letterSpacing: -0.2 },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: T.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  donePillText: { fontFamily: "Poppins-SemiBold", color: T.success },
  pace: { fontFamily: "Poppins-Regular", color: T.ink60, marginBottom: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  distCol: { alignItems: "flex-end", flexShrink: 0, paddingTop: 4 },
  dist: { fontFamily: "Poppins-SemiBold", color: T.ink, letterSpacing: -0.8 },
  distUnit: { fontFamily: "Poppins-Regular", color: T.ink40, marginTop: 1 },
});

/* ─────────────────────────────────────────────────────────
   WEEK CARD
───────────────────────────────────────────────────────── */
const WeekCard = ({
  week, expanded, onToggle, nowMs, onStart, onPause, onResume, onStop,
}: {
  week: any; expanded: boolean; onToggle: () => void; nowMs: number;
  onStart: (wi: number) => void; onPause: (wi: number) => void;
  onResume: (wi: number) => void; onStop: (wi: number) => void;
}) => {
  const prog      = getWeekProgress(week);
  const hasActive = week.dailyWorkouts.some((w: any) => w.startedAt && !w.isPaused && !w.completed);

  return (
    <View style={[wkS.card, hasActive && wkS.cardLive]}>
      {/* Header — full-width pressable */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggle();
        }}
        style={wkS.header}
        android_ripple={{ color: T.ink10 }}
      >
        {/* Week number block */}
        <View style={wkS.wkBox}>
          <Text style={[wkS.wkLbl, { fontSize: sp(9) }]}>WK</Text>
          <Text style={[wkS.wkNum, { fontSize: sp(20) }]}>{week.week}</Text>
        </View>

        {/* Meta */}
        <View style={wkS.meta}>
          <Text style={[wkS.metaTitle, { fontSize: sp(14) }]}>
            {prog.completed}/{prog.total} workouts
          </Text>
          <View style={wkS.subRow}>
            <Text style={[wkS.vol, { fontSize: sp(12) }]}>{week.volume} km</Text>
            {prog.pct === 100 && (
              <View style={wkS.completePill}>
                <Check size={9} color={T.success} strokeWidth={3} />
                <Text style={[wkS.completePillTxt, { fontSize: sp(10) }]}>Complete</Text>
              </View>
            )}
            {hasActive && (
              <View style={wkS.livePill}>
                <View style={wkS.liveDot} />
                <Text style={[wkS.livePillTxt, { fontSize: sp(10) }]}>Active</Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress + chevron */}
        <View style={wkS.right}>
          <View style={wkS.progRow}>
            <View style={wkS.progTrack}>
              <View
                style={[
                  wkS.progFill,
                  { width: `${prog.pct}%`, backgroundColor: prog.pct === 100 ? T.success : T.live },
                ]}
              />
            </View>
            <Text style={[wkS.progPct, { fontSize: sp(11) }]}>{prog.pct}%</Text>
          </View>
          <View style={wkS.chevron}>
            {expanded
              ? <ChevronUp   size={16} color={T.ink40} strokeWidth={2} />
              : <ChevronDown size={16} color={T.ink40} strokeWidth={2} />}
          </View>
        </View>
      </Pressable>

      {/* Collapsed: chips row */}
      {!expanded && (
        <View style={wkS.chipsRow}>
          {week.dailyWorkouts.map((w: any, i: number) => (
            <WorkoutChip key={i} type={w.type} />
          ))}
        </View>
      )}

      {/* Expanded: daily workouts */}
      {expanded && (
        <View style={wkS.dailyWrap}>
          <Hairline style={{ marginBottom: 14 }} />
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
  );
};

const wkS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardLive: { borderColor: T.live },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    minHeight: 76,
  },
  wkBox: {
    width: 52,
    height: 52,
    borderRadius: T.radiusMd,
    backgroundColor: T.ink05,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  wkLbl: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 1.5,
    lineHeight: 14,
  },
  wkNum: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -1,
    lineHeight: 24,
  },
  meta: { flex: 1 },
  metaTitle: { fontFamily: "Poppins-Medium", color: T.ink, marginBottom: 4 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  vol: { fontFamily: "Poppins-Regular", color: T.ink60 },
  completePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.successSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  completePillTxt: { fontFamily: "Poppins-SemiBold", color: T.success },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.liveSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.live },
  livePillTxt: { fontFamily: "Poppins-SemiBold", color: T.live },
  right: { alignItems: "flex-end", gap: 8, flexShrink: 0 },
  progRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  progTrack: { width: 56, height: 4, backgroundColor: T.ink10, borderRadius: 2, overflow: "hidden" },
  progFill: { height: "100%", borderRadius: 2 },
  progPct: { fontFamily: "Poppins-Medium", color: T.ink60, minWidth: 30, textAlign: "right" },
  chevron: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  dailyWrap: { paddingHorizontal: 14, paddingBottom: 14 },
});

/* ─────────────────────────────────────────────────────────
   CALENDAR SECTION
───────────────────────────────────────────────────────── */
const CalendarSection = ({
  plan, planStartDate, runHistory, onLogDate,
}: {
  plan: any[] | null; planStartDate: string;
  runHistory: any[]; onLogDate: (dateStr: string, mapped: any) => void;
}) => {
  const { width } = useWindowDimensions();
  const [month, setMonth]       = useState(new Date());
  const [selected, setSelected] = useState(new Date().toISOString().split("T")[0]);

  const activitySet = useMemo(
    () => new Set((runHistory || []).map((r: any) => new Date(r.date).toISOString().split("T")[0])),
    [runHistory]
  );

  const streak = useMemo(() => {
    let s = 0;
    const cur = new Date();
    while (activitySet.has(cur.toISOString().split("T")[0])) {
      s++;
      cur.setDate(cur.getDate() - 1);
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
    const di   = diff % 7;
    const week = plan[wi];
    const workout = week.dailyWorkouts[di];
    if (!workout) return null;
    return { week: week.week, dayLabel: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][di], workout, workoutIndex: di };
  }, [plan, planStartDate]);

  const days = useMemo(() => {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1);
    const count = new Date(y, m + 1, 0).getDate();
    const offset = first.getDay();
    const todayStr = new Date().toISOString().split("T")[0];
    const result: any[] = [];
    for (let i = 0; i < offset; i++) result.push({ empty: true, key: `e${i}` });
    for (let d = 1; d <= count; d++) {
      const ds = new Date(y, m, d).toISOString().split("T")[0];
      const mapped = getWorkoutForDate(ds);
      const hasAct = activitySet.has(ds);
      const isPast = ds < todayStr;
      let marker = "none";
      if (mapped?.workout && mapped.workout.type !== "REST") {
        if (mapped.workout.completed || hasAct) marker = "completed";
        else if (isPast) marker = "missed";
        else marker = "planned";
      }
      result.push({ key: ds, d, dateStr: ds, isToday: ds === todayStr, isSelected: ds === selected, marker });
    }
    return result;
  }, [month, selected, getWorkoutForDate, activitySet]);

  const cellW = Math.floor((width - 40 - 32) / 7); // 40 hPad + 32 card padding
  const selMapped = getWorkoutForDate(selected);

  return (
    <FadeIn>
      {/* Stats strip */}
      <View style={calS.statsCard}>
        {[
          { icon: <Flame size={16} color={T.live} strokeWidth={2} />, bg: T.liveSoft, val: streak,              lbl: "Day streak" },
          { icon: <Target size={16} color={T.long} strokeWidth={2} />, bg: T.longSoft, val: runHistory.length,  lbl: "Runs logged" },
          { icon: <TrendingUp size={16} color={T.easy} strokeWidth={2} />, bg: T.easySoft,
            val: Math.round(runHistory.reduce((s: number, r: any) => s + (r.distance || 0), 0)), lbl: "km total" },
        ].map((s, i) => (
          <View key={i} style={calS.statItem}>
            <View style={[calS.statIcon, { backgroundColor: s.bg }]}>{s.icon}</View>
            <View>
              <Text style={[calS.statVal, { fontSize: sp(20) }]}>{s.val}</Text>
              <Text style={[calS.statLbl, { fontSize: sp(11) }]}>{s.lbl}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Calendar */}
      <View style={calS.card}>
        {/* Month nav */}
        <View style={calS.monthNav}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }}
            style={calS.navBtn}
            hitSlop={12}
          >
            <ChevronLeft size={18} color={T.ink60} strokeWidth={2} />
          </Pressable>
          <Text style={[calS.monthTxt, { fontSize: sp(15) }]}>
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); }}
            style={calS.navBtn}
            hitSlop={12}
          >
            <ChevronRight size={18} color={T.ink60} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View style={calS.weekdays}>
          {DAY_LABELS.map((d, i) => (
            <View key={i} style={[calS.wdCell, { width: cellW }]}>
              <Text style={[calS.wdTxt, { fontSize: sp(11) }]}>{d}</Text>
            </View>
          ))}
        </View>

        <Hairline style={{ marginBottom: 6 }} />

        {/* Days */}
        <View style={calS.daysGrid}>
          {days.map((item) =>
            item.empty ? (
              <View key={item.key} style={{ width: cellW, height: cellW + 8 }} />
            ) : (
              <Pressable
                key={item.key}
                onPress={() => { Haptics.selectionAsync(); setSelected(item.dateStr); }}
                style={[
                  calS.dayCell,
                  { width: cellW, height: cellW + 10 },
                  item.isToday && calS.dayCellToday,
                  item.isSelected && calS.dayCellSel,
                ]}
              >
                <Text style={[
                  calS.dayNum, { fontSize: sp(13) },
                  item.isToday && calS.dayNumToday,
                  item.isSelected && calS.dayNumSel,
                ]}>
                  {item.d}
                </Text>
                {item.marker !== "none" && (
                  <View style={[
                    calS.marker,
                    item.marker === "completed" && calS.markerDone,
                    item.marker === "planned"   && calS.markerPlanned,
                    item.marker === "missed"    && calS.markerMissed,
                  ]} />
                )}
              </Pressable>
            )
          )}
        </View>

        {/* Legend */}
        <Hairline style={{ marginTop: 10, marginBottom: 12 }} />
        <View style={calS.legend}>
          {[
            { color: T.success, label: "Done",    hollow: false },
            { color: T.long,    label: "Planned",  hollow: false },
            { color: T.missed,  label: "Missed",   hollow: true  },
          ].map((l) => (
            <View key={l.label} style={calS.legendItem}>
              <View style={[
                calS.legendDot,
                { backgroundColor: l.hollow ? "transparent" : l.color },
                l.hollow && { borderWidth: 2, borderColor: l.color },
              ]} />
              <Text style={[calS.legendLbl, { fontSize: sp(11) }]}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Day detail */}
      <View style={calS.detailCard}>
        <Text style={[calS.detailDate, { fontSize: sp(13) }]}>
          {new Date(selected + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "short", day: "numeric",
          })}
        </Text>
        {selMapped ? (
          <>
            <View style={calS.detailWorkout}>
              <WorkoutChip type={selMapped.workout.type} />
              {selMapped.workout.distance > 0 && (
                <Text style={[calS.detailDist, { fontSize: sp(15) }]}>
                  {selMapped.workout.distance} km
                </Text>
              )}
              {selMapped.workout.completed && (
                <View style={calS.donePill}>
                  <Check size={10} color={T.success} strokeWidth={2.5} />
                  <Text style={[calS.donePillTxt, { fontSize: sp(11) }]}>Completed</Text>
                </View>
              )}
            </View>
            {selMapped.workout.type !== "REST" && !selMapped.workout.completed && (
              <PressScale onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLogDate(selected, selMapped); }}>
                <View style={calS.logBtn}>
                  <Check size={15} color="#FFF" strokeWidth={2.5} />
                  <Text style={[calS.logBtnTxt, { fontSize: sp(14) }]}>Log run for this date</Text>
                </View>
              </PressScale>
            )}
          </>
        ) : (
          <Text style={[calS.noWorkout, { fontSize: sp(13) }]}>No workout scheduled</Text>
        )}
      </View>
    </FadeIn>
  );
};

const calS = StyleSheet.create({
  statsCard: {
    flexDirection: "row",
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statVal: { fontFamily: "Poppins-SemiBold", color: T.ink, letterSpacing: -0.8, lineHeight: 26 },
  statLbl: { fontFamily: "Poppins-Regular", color: T.ink40 },
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navBtn: {
    width: 40, height: 40, borderRadius: T.radiusSm,
    backgroundColor: T.ink05, alignItems: "center", justifyContent: "center",
  },
  monthTxt: { fontFamily: "Poppins-SemiBold", color: T.ink, letterSpacing: -0.3 },
  weekdays: { flexDirection: "row", marginBottom: 8 },
  wdCell: { alignItems: "center" },
  wdTxt: { fontFamily: "Poppins-Medium", color: T.ink40 },
  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    alignItems: "center", justifyContent: "center",
    borderRadius: 10, marginVertical: 1, gap: 3,
  },
  dayCellToday: { backgroundColor: T.ink05 },
  dayCellSel:   { backgroundColor: T.liveSoft },
  dayNum: { fontFamily: "Poppins-Regular", color: T.ink80 },
  dayNumToday: { fontFamily: "Poppins-SemiBold", color: T.ink },
  dayNumSel:   { fontFamily: "Poppins-SemiBold", color: T.live },
  marker: { width: 5, height: 5, borderRadius: 3 },
  markerDone:    { backgroundColor: T.success },
  markerPlanned: { backgroundColor: T.long },
  markerMissed:  { backgroundColor: "transparent", borderWidth: 2, borderColor: T.missed, borderRadius: 3 },
  legend: { flexDirection: "row", gap: 18, paddingHorizontal: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLbl: { fontFamily: "Poppins-Regular", color: T.ink60 },
  detailCard: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  detailDate: { fontFamily: "Poppins-SemiBold", color: T.ink },
  detailWorkout: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  detailDist: { fontFamily: "Poppins-SemiBold", color: T.ink, letterSpacing: -0.4 },
  donePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.successSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  donePillTxt: { fontFamily: "Poppins-SemiBold", color: T.success },
  noWorkout: { fontFamily: "Poppins-Regular", color: T.ink40 },
  logBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.ink, borderRadius: T.radiusMd,
    paddingVertical: 14, paddingHorizontal: 18,
    minHeight: 52,
  },
  logBtnTxt: { fontFamily: "Poppins-SemiBold", color: "#FFF", letterSpacing: 0.1 },
});

/* ─────────────────────────────────────────────────────────
   SETUP SECTION
───────────────────────────────────────────────────────── */
const SetupSection = ({
  goal, level, onSetGoal, onSetLevel, onGenerate, hasPlan,
}: {
  goal: string; level: string;
  onSetGoal: (g: string) => void; onSetLevel: (l: string) => void;
  onGenerate: () => void; hasPlan: boolean;
}) => {
  const curGoal  = GOALS.find((g) => g.id === goal);
  const curLevel = LEVELS.find((l) => l.id === level);

  return (
    <FadeIn>
      <View style={setupS.block}>
        <Text style={[setupS.sectionLabel, { fontSize: sp(11) }]}>GOAL RACE</Text>
        <SegControl
          options={GOALS.map((g) => ({ id: g.id, label: g.label }))}
          value={goal}
          onChange={onSetGoal}
        />
      </View>

      <View style={[setupS.block, { marginTop: 22 }]}>
        <Text style={[setupS.sectionLabel, { fontSize: sp(11) }]}>EXPERIENCE LEVEL</Text>
        <SegControl
          options={LEVELS.map((l) => ({ id: l.id, label: l.label, sub: l.desc }))}
          value={level}
          onChange={onSetLevel}
        />
      </View>

      {/* Summary */}
      <View style={[setupS.summaryCard, { marginTop: 24 }]}>
        <View style={setupS.summaryRow}>
          {[
            { label: "GOAL",     value: curGoal?.label  ?? "—" },
            { label: "LEVEL",    value: curLevel?.label ?? "—" },
            { label: "DURATION", value: `${curLevel?.weeks ?? "—"} wks` },
          ].map((item, i) => (
            <View key={item.label} style={[setupS.summaryItem, i > 0 && setupS.summaryBorderLeft]}>
              <Text style={[setupS.summaryLabel, { fontSize: sp(10) }]}>{item.label}</Text>
              <Text style={[setupS.summaryValue, { fontSize: sp(15) }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Generate */}
      <PressScale
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onGenerate(); }}
        style={{ marginTop: 24 }}
      >
        <View style={setupS.genBtn}>
          <Zap size={18} color="#FFF" strokeWidth={2.2} />
          <Text style={[setupS.genTxt, { fontSize: sp(16) }]}>
            {hasPlan ? "Regenerate Plan" : "Generate Training Plan"}
          </Text>
        </View>
      </PressScale>

      {hasPlan && (
        <Text style={[setupS.note, { fontSize: sp(12) }]}>
          Regenerating will reset all current progress.{"\n"}Switch to the Plan tab to view your plan.
        </Text>
      )}
    </FadeIn>
  );
};

const setupS = StyleSheet.create({
  block: {},
  sectionLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  summaryRow: { flexDirection: "row" },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  summaryBorderLeft: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: T.border,
  },
  summaryLabel: {
    fontFamily: "Poppins-Medium",
    color: T.ink40,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  summaryValue: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  genBtn: {
    backgroundColor: T.ink,
    borderRadius: T.radius,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  genTxt: {
    fontFamily: "Poppins-SemiBold",
    color: "#FFF",
    letterSpacing: 0.1,
  },
  note: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 20,
  },
});

/* ─────────────────────────────────────────────────────────
   PLAN SECTION
───────────────────────────────────────────────────────── */
const PlanSection = ({
  plan, goal, level, planStartDate, nowMs, onStart, onPause, onResume, onStop,
}: {
  plan: any[]; goal: string; level: string; planStartDate: string; nowMs: number;
  onStart: (wk: number, wi: number) => void; onPause: (wk: number, wi: number) => void;
  onResume: (wk: number, wi: number) => void; onStop: (wk: number, wi: number) => void;
}) => {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [showAll,      setShowAll]      = useState(false);

  const curGoal  = GOALS.find((g) => g.id === goal);
  const curLevel = LEVELS.find((l) => l.id === level);

  const allWorkouts = useMemo(() => plan.flatMap((w) => w.dailyWorkouts), [plan]);
  const totalDone   = useMemo(() => allWorkouts.filter((w: any) => w.completed).length, [allWorkouts]);
  const totalWork   = allWorkouts.length;
  const overallPct  = totalWork > 0 ? Math.round((totalDone / totalWork) * 100) : 0;

  const displayPlan = showAll ? plan : plan.slice(0, 4);

  return (
    <FadeIn>
      {/* Plan header */}
      <View style={planS.header}>
        <View style={planS.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[planS.planTitle, { fontSize: sp(16) }]}>
              {curGoal?.label} · {curLevel?.label}
            </Text>
            <Text style={[planS.planMeta, { fontSize: sp(12) }]}>
              {plan.length} weeks · Started{" "}
              {new Date(planStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={planS.circle}>
            <Text style={[planS.circleTxt, { fontSize: sp(14) }]}>{overallPct}%</Text>
          </View>
        </View>
        <View style={planS.overallBar}>
          <View style={[planS.overallFill, { width: `${overallPct}%` }]} />
        </View>
        <Text style={[planS.overallNote, { fontSize: sp(12) }]}>
          {totalDone} of {totalWork} workouts complete
        </Text>
      </View>

      {/* Week cards */}
      {displayPlan.map((w) => (
        <WeekCard
          key={w.week}
          week={w}
          expanded={expandedWeek === w.week}
          onToggle={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedWeek(expandedWeek === w.week ? null : w.week);
          }}
          nowMs={nowMs}
          onStart={(wi) => onStart(w.week, wi)}
          onPause={(wi) => onPause(w.week, wi)}
          onResume={(wi) => onResume(w.week, wi)}
          onStop={(wi) => onStop(w.week, wi)}
        />
      ))}

      {plan.length > 4 && (
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setShowAll(!showAll); }}
          style={planS.showMore}
        >
          <Text style={[planS.showMoreTxt, { fontSize: sp(14) }]}>
            {showAll ? "Show less" : `View all ${plan.length} weeks`}
          </Text>
          {showAll
            ? <ChevronUp   size={15} color={T.ink60} strokeWidth={2} />
            : <ChevronDown size={15} color={T.ink60} strokeWidth={2} />}
        </Pressable>
      )}
    </FadeIn>
  );
};

const planS = StyleSheet.create({
  header: {
    backgroundColor: T.surface,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 },
  planTitle: { fontFamily: "Poppins-SemiBold", color: T.ink, letterSpacing: -0.4, marginBottom: 3 },
  planMeta: { fontFamily: "Poppins-Regular", color: T.ink60 },
  circle: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2.5, borderColor: T.live,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  circleTxt: { fontFamily: "Poppins-SemiBold", color: T.live, letterSpacing: -0.5 },
  overallBar: { height: 4, backgroundColor: T.ink10, borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  overallFill: { height: "100%", backgroundColor: T.live, borderRadius: 2 },
  overallNote: { fontFamily: "Poppins-Regular", color: T.ink60 },
  showMore: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 18,
  },
  showMoreTxt: { fontFamily: "Poppins-Medium", color: T.ink60 },
});

/* ─────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────── */
const EmptyPlan = ({ onGoSetup }: { onGoSetup: () => void }) => (
  <FadeIn>
    <View style={emptyS.wrap}>
      <View style={emptyS.iconBox}>
        <ListChecks size={32} color={T.ink40} strokeWidth={1.5} />
      </View>
      <Text style={[emptyS.title, { fontSize: sp(18) }]}>No plan yet</Text>
      <Text style={[emptyS.sub, { fontSize: sp(14) }]}>
        Set your goal and generate a personalized training plan to get started.
      </Text>
      <PressScale onPress={onGoSetup} style={{ marginTop: 8 }}>
        <View style={emptyS.cta}>
          <Text style={[emptyS.ctaTxt, { fontSize: sp(15) }]}>Go to Setup</Text>
          <ChevronRight size={16} color="#FFF" strokeWidth={2.5} />
        </View>
      </PressScale>
    </View>
  </FadeIn>
);

const emptyS = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24, gap: 14 },
  iconBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: T.ink05, alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  title: { fontFamily: "Poppins-SemiBold", color: T.ink },
  sub: {
    fontFamily: "Poppins-Regular", color: T.ink60,
    textAlign: "center", lineHeight: 22,
  },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.ink, borderRadius: T.radiusMd,
    paddingVertical: 14, paddingHorizontal: 28, minHeight: 52,
  },
  ctaTxt: { fontFamily: "Poppins-SemiBold", color: "#FFF" },
});

/* ─────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────── */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const hPad = width < 360 ? 16 : width >= 414 ? 24 : 20;

  const [activeTab,     setActiveTab]     = useState<"setup" | "calendar" | "plan">("setup");
  const [goal,          setGoal]          = useState("full");
  const [level,         setLevel]         = useState("beg");
  const [plan,          setPlan]          = useState<any[] | null>(null);
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [runHistory,    setRunHistory]    = useState<any[]>([]);
  const [nowMs,         setNowMs]         = useState(Date.now());

  /* Tick when there's an active workout */
  useEffect(() => {
    const hasActive = plan?.some((w) =>
      w.dailyWorkouts?.some((dw: any) => dw.startedAt && !dw.isPaused && !dw.completed)
    );
    if (!hasActive) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [plan]);

  /* Load from storage */
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

  /* Generate plan */
  const buildWeek = (wn: number, totalWeeks: number): any => {
    const prog = wn / totalWeeks;
    const taper = prog >= 0.8;
    let base = goal === "full" ? 8 : goal === "half" ? 5 : 3;
    if (level === "adv") base *= 1.3;
    if (level === "int") base *= 1.15;
    const longDist = Math.round(base * (1 + prog * 1.5) * (taper ? 0.6 : 1));
    const dw = [
      { day: "Mon", type: "EASY",                             distance: Math.round(base * 0.7) },
      { day: "Tue", type: wn % 2 === 0 ? "INTERVALS":"TEMPO",distance: Math.round(base * 0.8) },
      { day: "Wed", type: "REST",                             distance: 0 },
      { day: "Thu", type: "EASY",                             distance: Math.round(base * 0.9) },
      { day: "Fri", type: "REST",                             distance: 0 },
      { day: "Sat", type: "EASY",                             distance: Math.round(base * 0.6) },
      { day: "Sun", type: "LONG",                             distance: longDist },
    ].map((w) => ({ ...w, completed: false, startedAt: null, isPaused: false, elapsedBeforePauseSec: 0 }));
    return { week: wn, volume: dw.reduce((s, d) => s + d.distance, 0), dailyWorkouts: dw };
  };

  const doGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const weeks = level === "beg" ? 16 : level === "int" ? 12 : 8;
    const sd = new Date().toISOString().split("T")[0];
    const p = Array.from({ length: weeks }, (_, i) => buildWeek(i + 1, weeks));
    setPlan(p);
    setPlanStartDate(sd);
    savePlan(p, goal, level, sd);
    setActiveTab("plan");
  };

  const handleGenerate = () => {
    if (plan) {
      Alert.alert(
        "Regenerate Plan?",
        "This will reset all workout progress. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Regenerate", style: "destructive", onPress: doGenerate },
        ]
      );
    } else {
      doGenerate();
    }
  };

  /* Workout state helpers */
  const updateWorkout = (wkNum: number, wi: number, patch: object) => {
    const next = plan!.map((w) =>
      w.week !== wkNum ? w : {
        ...w,
        dailyWorkouts: w.dailyWorkouts.map((dw: any, idx: number) =>
          idx !== wi ? dw : { ...dw, ...patch }
        ),
      }
    );
    setPlan(next);
    savePlan(next, goal, level, planStartDate);
    return next;
  };

  const hasOtherActive = (wkNum: number, wi: number) =>
    plan?.some((w) =>
      w.dailyWorkouts?.some((dw: any, idx: number) =>
        !dw.completed && (dw.startedAt || dw.isPaused) && !(w.week === wkNum && idx === wi)
      )
    );

  const handleStart = (wkNum: number, wi: number) => {
    const tw = plan?.find((w) => w.week === wkNum)?.dailyWorkouts?.[wi];
    if (!tw || tw.type === "REST" || tw.completed) return;
    if (hasOtherActive(wkNum, wi)) {
      Alert.alert("Workout Active", "Finish your current workout before starting a new one."); return;
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
    if (hasOtherActive(wkNum, wi)) {
      Alert.alert("Workout Active", "Finish your current workout first."); return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateWorkout(wkNum, wi, { startedAt: new Date().toISOString(), isPaused: false });
  };

  const handleStop = async (wkNum: number, wi: number) => {
    const tw = plan?.find((w) => w.week === wkNum)?.dailyWorkouts?.[wi];
    if ((!tw?.startedAt && !tw?.isPaused) || tw?.type === "REST") return;
    const base = tw.elapsedBeforePauseSec ?? 0;
    const cur  = tw.startedAt && !tw.isPaused
      ? Math.max(0, Math.round((Date.now() - new Date(tw.startedAt).getTime()) / 1000))
      : 0;
    const dur = Math.max(1, base + cur);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateWorkout(wkNum, wi, {
      completed: true, startedAt: null, isPaused: false,
      elapsedBeforePauseSec: 0, actualDurationSec: dur,
    });
    if (tw.distance <= 0) return;
    const entry = {
      id: `${Date.now()}-${wkNum}-${wi}`,
      date: new Date().toISOString().split("T")[0],
      distance: tw.distance,
      time: formatSecondsToHms(dur),
      pace: dur / 60 / tw.distance,
      notes: `Training Plan · Week ${wkNum} ${tw.day} · ${WORKOUT_META[tw.type]?.label}`,
    };
    const existing = await AsyncStorage.getItem("runHistory");
    const hist = existing ? JSON.parse(existing) : [];
    const updated = [entry, ...hist];
    await AsyncStorage.setItem("runHistory", JSON.stringify(updated));
    setRunHistory(updated);
  };

  const handleLogDate = async (dateStr: string, mapped: any) => {
    const tw = mapped.workout;
    if (tw.completed) { Alert.alert("Already Logged", "This workout is already marked complete."); return; }
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
    const next = plan!.map((w) =>
      w.week !== mapped.week ? w : {
        ...w,
        dailyWorkouts: w.dailyWorkouts.map((dw: any, idx: number) =>
          idx !== mapped.workoutIndex ? dw : { ...dw, completed: true, startedAt: null, isPaused: false, elapsedBeforePauseSec: 0 }
        ),
      }
    );
    const existing = await AsyncStorage.getItem("runHistory");
    const hist = existing ? JSON.parse(existing) : [];
    const updated = [entry, ...hist];
    await AsyncStorage.setItem("runHistory", JSON.stringify(updated));
    await savePlan(next, goal, level, planStartDate);
    setPlan(next);
    setRunHistory(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Run Logged ✓", "Workout marked complete and added to your history.");
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
      <View style={[mainS.root, { paddingTop: insets.top }]}>

        {/* Page header */}
        <View style={[mainS.pageHeader, { paddingHorizontal: hPad }]}>
          <View>
            <Text style={[mainS.eyebrow, { fontSize: sp(10) }]}>YOUR</Text>
            <Text style={[mainS.pageTitle, { fontSize: sp(24) }]}>Training Plan</Text>
          </View>
          {plan && (
            <View style={mainS.planPill}>
              <ListChecks size={12} color={T.live} strokeWidth={2.2} />
              <Text style={[mainS.planPillTxt, { fontSize: sp(12) }]}>
                {plan.length}wk plan
              </Text>
            </View>
          )}
        </View>

        {/* Tabs — sticky */}
        <TabBar active={activeTab} onChange={(id) => setActiveTab(id as any)} />

        {/* Scrollable content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            mainS.scroll,
            { paddingHorizontal: hPad, paddingBottom: insets.bottom + 120 },
          ]}
        >
          {activeTab === "setup" && (
            <View style={{ paddingTop: 24 }}>
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
            <View style={{ paddingTop: 24 }}>
              <CalendarSection
                plan={plan}
                planStartDate={planStartDate}
                runHistory={runHistory}
                onLogDate={handleLogDate}
              />
            </View>
          )}

          {activeTab === "plan" && (
            <View style={{ paddingTop: 24 }}>
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
const mainS = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: T.surface,
  },
  eyebrow: {
    fontFamily: "Poppins-Regular",
    color: T.ink40,
    letterSpacing: 2.5,
    marginBottom: 1,
  },
  pageTitle: {
    fontFamily: "Poppins-SemiBold",
    color: T.ink,
    letterSpacing: -1,
  },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.liveSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.liveMid,
  },
  planPillTxt: {
    fontFamily: "Poppins-SemiBold",
    color: T.live,
    letterSpacing: 0.2,
  },
  scroll: {
    flexGrow: 1,
  },
});