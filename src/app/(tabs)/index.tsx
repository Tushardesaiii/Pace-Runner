/**
 * app/(tabs)/index.tsx  —  Pace Calculator
 *
 * Design Direction: "Swiss Editorial Minimal"
 * Pure white · Geometric precision · One dominant number
 * Feels like: Linear × Loom × Strava Pro
 *
 * Expo modules:
 *   - expo-haptics
 *   - expo-blur
 *   - react-native-safe-area-context
 *   - @react-native-community/datetimepicker
 *   - expo-linear-gradient
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Pressable,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
  TextInput,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  ArrowUpRight,
  Flame,
  RotateCcw,
  ChevronRight,
  TrendingUp,
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

const { width: W } = Dimensions.get("window");

/* ─────────────────────────────────────────────────────────
   TOKENS — Swiss Editorial Minimal
   One accent. Everything else is type hierarchy.
───────────────────────────────────────────────────────── */
const T = {
  bg:        "#FFFFFF",
  surface:   "#F8F8F7",
  ink:       "#0A0A0A",
  ink60:     "#999999",
  ink30:     "#DDDDDD",
  ink10:     "#F2F2F2",
  accent:    "#0A0A0A",
  live:      "#FF3B00",   // single hot accent — pace ring + marathon time only
  border:    "#EBEBEB",
  radius:    12,
  radiusSm:  8,
};

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");

const timeOfDayLabel = () => {
  const h = new Date().getHours();
  if (h < 5)  return "Late night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
};

const formatMarathon = (paceStr: string) => {
  const ps = parseTimeToSeconds(paceStr);
  if (!ps || ps <= 0) return null;
  const total = ps * 42.195;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  return `${h}:${pad2(m)}:${pad2(s)}`;
};

/* ─────────────────────────────────────────────────────────
   HAIRLINE  — 0.5 px separator
───────────────────────────────────────────────────────── */
const Hairline = ({ style }: { style?: object }) => (
  <View
    style={[
      {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.border,
      },
      style,
    ]}
  />
);

/* ─────────────────────────────────────────────────────────
   ANIMATED ENTRY — staggered fade+lift
───────────────────────────────────────────────────────── */
const Appear = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const op = useRef(new Animated.Value(0)).current;
  const y  = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, {
        toValue: 1,
        duration: 380,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 380,
        delay,
        easing: Easing.out(Easing.quad),
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
   SPRING PRESS — scale down on tap
───────────────────────────────────────────────────────── */
const Spring = ({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   PACE ARC  — thin SVG-like arc using border-radius trick
   Clean, geometric, one color
───────────────────────────────────────────────────────── */
const ARC_SIZE  = 80;
const ARC_TRACK = 3;

const PaceArc = ({ percent = 0 }: { percent: number }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const r = ARC_SIZE / 2;

  return (
    <View style={{ width: ARC_SIZE, height: ARC_SIZE, alignItems: "center", justifyContent: "center" }}>
      {/* Track ring */}
      <View
        style={{
          position: "absolute",
          width: ARC_SIZE,
          height: ARC_SIZE,
          borderRadius: r,
          borderWidth: ARC_TRACK,
          borderColor: T.ink10,
        }}
      />
      {/* Progress — right half */}
      <View
        style={{
          position: "absolute",
          width: ARC_SIZE,
          height: ARC_SIZE,
          borderRadius: r,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: r,
            height: ARC_SIZE,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: ARC_SIZE,
              height: ARC_SIZE,
              borderRadius: r,
              borderWidth: ARC_TRACK,
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
        {/* Left half — shows > 50% */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: r,
            height: ARC_SIZE,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: ARC_SIZE,
              height: ARC_SIZE,
              borderRadius: r,
              borderWidth: ARC_TRACK,
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

      {/* Label inside ring */}
      <Text style={{ fontSize: 13, fontFamily: "Poppins-SemiBold", color: T.ink, letterSpacing: -0.3 }}>
        {percent}%
      </Text>
    </View>
  );
};

/* ─────────────────────────────────────────────────────────
   INPUT CELL  — large tappable field
───────────────────────────────────────────────────────── */
const InputCell = ({
  label,
  value,
  unit,
  onPress,
  editable = false,
  onChangeText,
  accent = false,
}: {
  label: string;
  value: string;
  unit: string;
  onPress?: () => void;
  editable?: boolean;
  onChangeText?: (v: string) => void;
  accent?: boolean;
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <Spring onPress={!editable ? () => { Haptics.selectionAsync(); onPress?.(); } : undefined} style={{ flex: 1 }}>
      <View
        style={[
          styles.inputCell,
          accent && styles.inputCellAccent,
          focused && styles.inputCellFocused,
        ]}
      >
        <Text style={[styles.inputLabel, accent && styles.inputLabelAccent]}>
          {label}
        </Text>
        {editable ? (
          <TextInput
            style={[styles.inputValue, accent && styles.inputValueAccent]}
            value={value}
            onChangeText={onChangeText}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectionColor={T.live}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="0"
            placeholderTextColor={T.ink30}
          />
        ) : (
          <Text style={[styles.inputValue, accent && styles.inputValueAccent]}>
            {value || "—"}
          </Text>
        )}
        <Text style={[styles.inputUnit, accent && styles.inputUnitAccent]}>
          {unit}
        </Text>
      </View>
    </Spring>
  );
};

/* ─────────────────────────────────────────────────────────
   RACE ROW
───────────────────────────────────────────────────────── */
const RaceRow = ({
  label,
  time,
  isMarathon,
}: {
  label: string;
  time: string;
  isMarathon: boolean;
}) => (
  <View style={styles.raceRow}>
    <Text style={[styles.raceLabel, isMarathon && styles.raceLabelBold]}>
      {label}
    </Text>
    <Text style={[styles.raceTime, isMarathon && styles.raceTimeAccent]}>
      {time}
    </Text>
  </View>
);

/* ─────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────── */
export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();

  const [distance, setDistance] = useState("10");
  const [time, setTime]         = useState("00:50:00");
  const [pace, setPace]         = useState("05:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPacePicker, setShowPacePicker] = useState(false);
  const [showRatingSheet, setShowRatingSheet] = useState(false);

  const [dash, setDash] = useState({
    streak:    0,
    weekDone:  0,
    weekTotal: 0,
    totalPct:  0,
    nextWorkout: "No plan yet",
    bestPace:  "",
    hasPlan:   false,
    planLabel: "",
  });

  /* Persist */
  useEffect(() => {
    AsyncStorage.getItem("knack_calculator").then(saved => {
      if (saved) {
        const { d, t, p } = JSON.parse(saved);
        if (d) setDistance(d);
        if (t) setTime(t);
        if (p) setPace(p);
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("knack_calculator", JSON.stringify({ d: distance, t: time, p: pace }));
  }, [distance, time, pace]);

  /* Rating prompt */
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { if (active) setShowRatingSheet(true); }, 8000);
    return () => { active = false; clearTimeout(timer); };
  }, []);

  /* Dashboard load */
  useFocusEffect(useCallback(() => { loadDashboard(); }, []));

  const DAY_INDEX: Record<string, number> = { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5, Sun:6 };

  const loadDashboard = async () => {
    try {
      const [rawPlan, rawRuns] = await Promise.all([
        AsyncStorage.getItem("trainingPlan"),
        AsyncStorage.getItem("runHistory"),
      ]);
      const runs     = rawRuns  ? JSON.parse(rawRuns)  : [];
      const planData = rawPlan  ? JSON.parse(rawPlan)  : null;

      const dateSet = new Set(
        runs.map((r: any) => {
          const d = new Date(r.date);
          return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
        }).filter(Boolean)
      );
      let streak = 0;
      const cursor = new Date();
      while (dateSet.has(cursor.toISOString().split("T")[0])) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }

      const bestPaceRaw = runs.length
        ? Math.min(...runs.map((r: any) => isFinite(r.pace) ? r.pace : Infinity))
        : null;
      const bestPace = bestPaceRaw && isFinite(bestPaceRaw)
        ? `${formatSecondsToMmSs(bestPaceRaw * 60)}/km`
        : "";

      if (!planData?.plan?.length || !planData?.startDate) {
        setDash({ streak, weekDone: 0, weekTotal: 0, totalPct: 0,
          nextWorkout: "No plan yet", bestPace, planLabel: "", hasPlan: false });
        return;
      }

      const plan      = planData.plan;
      const startDate = new Date(planData.startDate);
      const daysSince = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 86400000));
      const curWeekNum= Math.min(plan.length, Math.floor(daysSince / 7) + 1);
      const curWeek   = plan.find((w: any) => w.week === curWeekNum) ?? plan[0];

      const weekDone  = curWeek.dailyWorkouts.filter((w: any) => w.completed).length;
      const weekTotal = curWeek.dailyWorkouts.length;
      const all       = plan.flatMap((w: any) => w.dailyWorkouts);
      const totalDone = all.filter((w: any) => w.completed).length;
      const totalPct  = all.length ? Math.round((totalDone / all.length) * 100) : 0;

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
          (new Date(nearest.date.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000
        );
        const when = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `In ${diff}d`;
        nextWorkout = `${when} · ${nearest.workout.type === "LONG" ? "Long Run" : nearest.workout.type} ${nearest.workout.distance}km`;
      }

      setDash({ streak, weekDone, weekTotal, totalPct,
        nextWorkout, bestPace, planLabel: `Week ${curWeekNum} of ${plan.length}`, hasPlan: true });
    } catch { /* keep defaults */ }
  };

  /* Calculations */
  const calcPace = (d: string, t: string) => {
    const dist = safeNumber(d), secs = parseTimeToSeconds(t);
    if (!dist || dist <= 0 || !secs || secs <= 0) return;
    setPace(formatSecondsToMmSs(secs / dist));
  };

  const calcTime = (d: string, p: string) => {
    const dist = safeNumber(d), ps = parseTimeToSeconds(p);
    if (!dist || dist <= 0 || !ps || ps <= 0) return;
    setTime(formatSecondsToHms(ps * dist));
  };

  const toDate = (str: string) => {
    const secs = parseTimeToSeconds(str);
    const d = new Date();
    if (!secs || secs < 0) return d;
    d.setHours(Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60, 0);
    return d;
  };

  const handleSetGoal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ps = parseTimeToSeconds(pace);
    if (!ps || ps <= 0) { Alert.alert("Invalid pace", "Enter a valid pace first."); return; }
    const goalTime = formatSecondsToHms(Math.round(ps * 42.195));
    try {
      const ex = await AsyncStorage.getItem("knack_race");
      const parsed = ex ? JSON.parse(ex) : {};
      await AsyncStorage.setItem("knack_race", JSON.stringify({ date: parsed.date || "2026-10-18", time: goalTime }));
      Alert.alert("Goal saved", `Marathon target: ${goalTime}`, [
        { text: "View race", onPress: () => router.push("/(tabs)/race") },
        { text: "Done", style: "cancel" },
      ]);
    } catch { Alert.alert("Error", "Could not save goal."); }
  };

  const marathonDisplay = formatMarathon(pace);

  /* Race times */
  const raceDistances = [
    { label: "5K",       dist: 5       },
    { label: "10K",      dist: 10      },
    { label: "Half",     dist: 21.0975 },
    { label: "Marathon", dist: 42.195  },
  ];

  const getRaceTime = (dist: number) => {
    const ps = parseTimeToSeconds(pace);
    const secs = ps && ps > 0 ? ps * dist : null;
    if (!secs) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.round(secs % 60);
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >

          {/* ═══════════════════════════════════
              HEADER
          ═══════════════════════════════════ */}
          <Appear delay={0}>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>{timeOfDayLabel()}</Text>
                <Text style={styles.title}>Pace Calculator</Text>
              </View>

              {dash.streak > 0 && (
                <View style={styles.streakBadge}>
                  <Flame size={12} color={T.live} strokeWidth={2.5} />
                  <Text style={styles.streakNum}>{dash.streak}</Text>
                </View>
              )}
            </View>
          </Appear>

          <Hairline style={{ marginBottom: 28 }} />

          {/* ═══════════════════════════════════
              MARATHON HERO NUMBER
              The single thing you remember
          ═══════════════════════════════════ */}
          <Appear delay={60}>
            <View style={styles.heroBlock}>
              {/* Left: arc + plan % */}
              <PaceArc percent={dash.totalPct} />

              {/* Right: marathon estimate */}
              <View style={styles.heroRight}>
                <Text style={styles.heroLabel}>MARATHON</Text>
                <Text style={styles.heroTime}>
                  {marathonDisplay ?? "—:——:——"}
                </Text>
                <Text style={styles.heroPace}>{pace} /km</Text>
              </View>
            </View>
          </Appear>

          <Hairline style={{ marginVertical: 24 }} />

          {/* ═══════════════════════════════════
              INPUTS — Distance · Time · Pace
          ═══════════════════════════════════ */}
          <Appear delay={120}>
            <Text style={styles.sectionLabel}>INPUTS</Text>
            <View style={styles.inputRow}>
              <InputCell
                label="Distance"
                value={distance}
                unit="km"
                editable
                onChangeText={v => { setDistance(v); calcPace(v, time); }}
              />
              <InputCell
                label="Time"
                value={time}
                unit="h:m:s"
                onPress={() => setShowTimePicker(true)}
              />
              <InputCell
                label="Pace"
                value={pace}
                unit="/km"
                accent
                onPress={() => setShowPacePicker(true)}
              />
            </View>
          </Appear>

          <Hairline style={{ marginVertical: 24 }} />

          {/* ═══════════════════════════════════
              RACE PROJECTIONS
          ═══════════════════════════════════ */}
          <Appear delay={180}>
            <Text style={styles.sectionLabel}>RACE PROJECTIONS</Text>
            <View style={styles.raceCard}>
              {raceDistances.map((r, i) => (
                <React.Fragment key={r.label}>
                  <RaceRow
                    label={r.label}
                    time={getRaceTime(r.dist)}
                    isMarathon={r.label === "Marathon"}
                  />
                  {i < raceDistances.length - 1 && <Hairline />}
                </React.Fragment>
              ))}
            </View>
          </Appear>

          <Hairline style={{ marginVertical: 24 }} />

          {/* ═══════════════════════════════════
              TRAINING PLAN STRIP  (plan-aware)
          ═══════════════════════════════════ */}
          <Appear delay={240}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>TRAINING PLAN</Text>
              {dash.hasPlan && (
                <Text style={styles.sectionMeta}>{dash.planLabel}</Text>
              )}
            </View>

            {dash.hasPlan ? (
              <>
                {/* Next workout */}
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/plan"); }}
                  style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.75 }]}
                >
                  <View>
                    <Text style={styles.nextLabel}>NEXT UP</Text>
                    <Text style={styles.nextValue}>{dash.nextWorkout}</Text>
                  </View>
                  <ChevronRight size={16} color={T.ink60} strokeWidth={1.5} />
                </Pressable>

                {/* Progress bars */}
                <View style={{ marginTop: 20 }}>
                  {/* Week */}
                  <View style={styles.barRow}>
                    <Text style={styles.barLabel}>This week</Text>
                    <Text style={styles.barCount}>
                      {dash.weekDone}/{dash.weekTotal}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${dash.weekTotal
                            ? Math.round((dash.weekDone / dash.weekTotal) * 100)
                            : 0}%`,
                        },
                      ]}
                    />
                  </View>

                  {/* Overall */}
                  <View style={[styles.barRow, { marginTop: 16 }]}>
                    <Text style={styles.barLabel}>Overall</Text>
                    <Text style={styles.barCount}>{dash.totalPct}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        styles.barFillLive,
                        { width: `${dash.totalPct}%` },
                      ]}
                    />
                  </View>
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/plan"); }}
                style={({ pressed }) => [styles.noPlanRow, pressed && { opacity: 0.7 }]}
              >
                <TrendingUp size={16} color={T.ink60} strokeWidth={1.5} />
                <Text style={styles.noPlanText}>Create a training plan</Text>
                <ChevronRight size={14} color={T.ink60} strokeWidth={1.5} />
              </Pressable>
            )}
          </Appear>

          <Hairline style={{ marginVertical: 28 }} />

          {/* ═══════════════════════════════════
              ACTIONS
          ═══════════════════════════════════ */}
          <Appear delay={300}>
            <View style={styles.actions}>
              {/* Primary */}
              <Spring
                onPress={handleSetGoal}
                style={styles.btnPrimary}
              >
                <Text style={styles.btnPrimaryText}>Set as Race Goal</Text>
                <ArrowUpRight size={16} color="#FFF" strokeWidth={2.5} />
              </Spring>

              {/* Secondary */}
              <Spring
                onPress={() => {
                  Haptics.selectionAsync();
                  setDistance("");
                  setTime("");
                  setPace("");
                }}
                style={styles.btnSecondary}
              >
                <RotateCcw size={14} color={T.ink60} strokeWidth={2} />
                <Text style={styles.btnSecondaryText}>Clear</Text>
              </Spring>
            </View>
          </Appear>

          {/* Best pace footnote */}
          {dash.bestPace ? (
            <Appear delay={340}>
              <Text style={styles.footnote}>Personal best pace · {dash.bestPace}</Text>
            </Appear>
          ) : null}

        </ScrollView>
      </View>

      {/* Pickers */}
      {showTimePicker && (
        <DateTimePicker
          value={toDate(time)}
          mode="time"
          is24Hour
          display="spinner"
          onChange={(_, sel) => {
            setShowTimePicker(false);
            if (sel) {
              const h = pad2(sel.getHours());
              const m = pad2(sel.getMinutes());
              const next = `${h}:${m}:00`;
              setTime(next);
              calcPace(distance, next);
            }
          }}
        />
      )}

      {showPacePicker && (
        <DateTimePicker
          value={toDate(pace)}
          mode="time"
          is24Hour
          display="spinner"
          onChange={(_, sel) => {
            setShowPacePicker(false);
            if (sel) {
              const secs = sel.getHours() * 3600 + sel.getMinutes() * 60;
              const next = formatSecondsToMmSs(secs);
              setPace(next);
              calcTime(distance, next);
            }
          }}
        />
      )}

      <RatingBottomSheet
        isVisible={showRatingSheet}
        onClose={() => setShowRatingSheet(false)}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   STYLES — Precision spacing, one type scale
───────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bg },
  scroll: { paddingHorizontal: 24 },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 20,
    paddingBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    color: T.ink60,
    fontFamily: "Poppins-Regular",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  title: {
    fontSize: 24,
    color: T.ink,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.8,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  streakNum: {
    fontSize: 13,
    color: T.live,
    fontFamily: "Poppins-SemiBold",
  },

  /* Hero */
  heroBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  heroRight: { flex: 1 },
  heroLabel: {
    fontSize: 10,
    color: T.ink60,
    fontFamily: "Poppins-Medium",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTime: {
    fontSize: 38,
    color: T.live,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -2,
    lineHeight: 44,
  },
  heroPace: {
    fontSize: 13,
    color: T.ink60,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
  },

  /* Section labels */
  sectionLabel: {
    fontSize: 10,
    color: T.ink60,
    fontFamily: "Poppins-Medium",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 14,
  },
  sectionMeta: {
    fontSize: 11,
    color: T.ink60,
    fontFamily: "Poppins-Regular",
  },

  /* Input cells */
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  inputCell: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: T.surface,
    minHeight: 88,
    justifyContent: "space-between",
  },
  inputCellAccent: {
    backgroundColor: T.ink,
    borderColor: T.ink,
  },
  inputCellFocused: {
    borderColor: T.ink60,
  },
  inputLabel: {
    fontSize: 10,
    color: T.ink60,
    fontFamily: "Poppins-Medium",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  inputLabelAccent: { color: "rgba(255,255,255,0.45)" },
  inputValue: {
    fontSize: 19,
    color: T.ink,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.5,
    marginVertical: 4,
    height: 28,
  },
  inputValueAccent: { color: "#FFFFFF" },
  inputUnit: {
    fontSize: 10,
    color: T.ink30,
    fontFamily: "Poppins-Regular",
  },
  inputUnitAccent: { color: "rgba(255,255,255,0.3)" },

  /* Race projections */
  raceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    overflow: "hidden",
    backgroundColor: T.surface,
  },
  raceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  raceLabel: {
    fontSize: 14,
    color: T.ink60,
    fontFamily: "Poppins-Regular",
  },
  raceLabelBold: {
    color: T.ink,
    fontFamily: "Poppins-Medium",
  },
  raceTime: {
    fontSize: 15,
    color: T.ink,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.4,
  },
  raceTimeAccent: {
    color: T.live,
    fontSize: 16,
  },

  /* Next workout */
  nextCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: T.surface,
  },
  nextLabel: {
    fontSize: 9,
    color: T.ink60,
    fontFamily: "Poppins-Medium",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  nextValue: {
    fontSize: 14,
    color: T.ink,
    fontFamily: "Poppins-Medium",
  },

  /* Progress bars */
  barRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 12,
    color: T.ink60,
    fontFamily: "Poppins-Regular",
  },
  barCount: {
    fontSize: 12,
    color: T.ink,
    fontFamily: "Poppins-Medium",
  },
  barTrack: {
    height: 2,
    backgroundColor: T.ink10,
    borderRadius: 1,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: T.ink,
    borderRadius: 1,
  },
  barFillLive: {
    backgroundColor: T.live,
  },

  /* No plan */
  noPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noPlanText: {
    flex: 1,
    fontSize: 14,
    color: T.ink60,
    fontFamily: "Poppins-Regular",
  },

  /* Actions */
  actions: { gap: 10 },
  btnPrimary: {
    backgroundColor: T.ink,
    borderRadius: T.radius,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPrimaryText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.1,
  },
  btnSecondary: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  btnSecondaryText: {
    fontSize: 14,
    color: T.ink60,
    fontFamily: "Poppins-Medium",
  },

  /* Footnote */
  footnote: {
    textAlign: "center",
    fontSize: 11,
    color: T.ink30,
    fontFamily: "Poppins-Regular",
    marginTop: 20,
    letterSpacing: 0.3,
  },
});