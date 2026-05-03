import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  Animated,
  Easing,
  Platform,
  Linking,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  AppShell,
  Input,
  Pill,
  COLORS,
  Button,
} from "../../components/DesignSystem";
import {
  Activity,
  ArrowRight,
  Zap,
  CalendarCheck,
  Flame,
  Route,
  Sparkles,
  Star,
  Trophy,
  Check,
  Lock,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseTimeToSeconds,
  formatSecondsToHms,
  formatSecondsToMmSs,
  safeNumber,
} from "../../utils/runMath";
import RatingBottomSheet from "../../components/RatingBottomSheet";

const DAY_INDEX = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export default function CalculatorScreen() {
  const [distance, setDistance] = useState("5");
  const [time, setTime] = useState("00:25:00");
  const [pace, setPace] = useState("05:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPacePicker, setShowPacePicker] = useState(false);
  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const premiumOpacity = useRef(new Animated.Value(0)).current;
  const premiumScale = useRef(new Animated.Value(0.92)).current;
  const [dashboard, setDashboard] = useState({
    weekOverview: "No active plan",
    streak: "0 days in a row",
    progress: "Week --/-- - 0% complete",
    nextWorkout: "No upcoming workout",
    achievement: "No runs logged yet",
  });

  const openPremium = () => {
    setShowPremium(true);
    Animated.parallel([
      Animated.timing(premiumOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(premiumScale, {
        toValue: 1,
        damping: 16,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closePremium = () => {
    Animated.parallel([
      Animated.timing(premiumOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(premiumScale, {
        toValue: 0.92,
        damping: 16,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setShowPremium(false));
  };

  useEffect(() => {
    const loadData = async () => {
      const saved = await AsyncStorage.getItem("knack_calculator");
      if (saved) {
        const { d, t, p } = JSON.parse(saved);
        setDistance(d);
        setTime(t);
        setPace(p);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    let active = true;
    let timer;

    const schedulePrompt = async () => {
      try {
        if (!active) {
          return;
        }

        timer = setTimeout(async () => {
          if (!active) {
            return;
          }

          setShowRatingSheet(true);
        }, 5000);
      } catch (error) {
        console.warn("Failed to schedule rate prompt:", error);
      }
    };

    schedulePrompt();

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
    }, []),
  );

  useEffect(() => {
    AsyncStorage.setItem(
      "knack_calculator",
      JSON.stringify({ d: distance, t: time, p: pace }),
    );
  }, [distance, time, pace]);

  const loadDashboard = async () => {
    try {
      const [rawPlan, rawRuns] = await Promise.all([
        AsyncStorage.getItem("trainingPlan"),
        AsyncStorage.getItem("runHistory"),
      ]);
      const runs = rawRuns ? JSON.parse(rawRuns) : [];
      const planData = rawPlan ? JSON.parse(rawPlan) : null;

      const streakDays = (() => {
        if (!runs.length) return 0;
        const dateSet = new Set(
          runs.map((r) => {
            const d = new Date(r.date);
            return Number.isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
          }).filter(Boolean),
        );
        let streak = 0;
        const cursor = new Date();
        while (true) {
          const key = cursor.toISOString().split("T")[0];
          if (!dateSet.has(key)) break;
          streak += 1;
          cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
      })();

      const bestPace = runs.length
        ? Math.min(...runs.map((r) => (Number.isFinite(r.pace) ? r.pace : Infinity)))
        : null;
      const bestPaceLabel =
        bestPace && Number.isFinite(bestPace)
          ? `Personal best pace: ${formatSecondsToMmSs(bestPace * 60)}/km`
          : "No runs logged yet";

      if (!planData?.plan?.length || !planData?.startDate) {
        setDashboard({
          weekOverview: "No active plan",
          streak: `${streakDays} days in a row`,
          progress: "Week --/-- - 0% complete",
          nextWorkout: "No upcoming workout",
          achievement: bestPaceLabel,
        });
        return;
      }

      const plan = planData.plan;
      const startDate = new Date(planData.startDate);
      const today = new Date();
      const daysSinceStart = Math.max(
        0,
        Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const currentWeekNumber = Math.min(plan.length, Math.floor(daysSinceStart / 7) + 1);
      const currentWeek = plan.find((w) => w.week === currentWeekNumber) ?? plan[0];

      const weekCompleted = currentWeek.dailyWorkouts.filter((w) => w.completed).length;
      const weekTotal = currentWeek.dailyWorkouts.length;

      const allWorkouts = plan.flatMap((w) => w.dailyWorkouts);
      const totalCompleted = allWorkouts.filter((w) => w.completed).length;
      const totalPercent = allWorkouts.length
        ? Math.round((totalCompleted / allWorkouts.length) * 100)
        : 0;

      const getScheduledDate = (weekNum, dayLabel) => {
        const d = new Date(planData.startDate);
        d.setDate(d.getDate() + (weekNum - 1) * 7 + (DAY_INDEX[dayLabel] ?? 0));
        return d;
      };

      let nextWorkoutLabel = "No upcoming workout";
      let nearest = null;
      plan.forEach((week) => {
        week.dailyWorkouts.forEach((workout) => {
          if (workout.type === "REST" || workout.completed) return;
          const scheduled = getScheduledDate(week.week, workout.day);
          if (scheduled < new Date(today.toDateString())) return;
          if (!nearest || scheduled < nearest.date) {
            nearest = { date: scheduled, workout };
          }
        });
      });
      if (nearest) {
        const diffDays = Math.floor(
          (new Date(nearest.date.toDateString()).getTime() -
            new Date(today.toDateString()).getTime()) /
          (1000 * 60 * 60 * 24),
        );
        const when = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : "Upcoming";
        nextWorkoutLabel = `${when}: ${nearest.workout.type === "LONG" ? "Long Run" : nearest.workout.type} - ${nearest.workout.distance}km`;
      }

      setDashboard({
        weekOverview: `This Week: ${weekCompleted}/${weekTotal} workouts complete`,
        streak: `${streakDays} days in a row 🔥`,
        progress: `Week ${currentWeekNumber}/${plan.length} - ${totalPercent}% complete`,
        nextWorkout: nextWorkoutLabel,
        achievement: bestPaceLabel,
      });
    } catch (error) {
      setDashboard((prev) => ({ ...prev, weekOverview: "Dashboard unavailable" }));
    }
  };

  const calculatePace = (d, t) => {
    const distanceNum = safeNumber(d);
    const totalSeconds = parseTimeToSeconds(t);
    if (!distanceNum || distanceNum <= 0 || !totalSeconds || totalSeconds <= 0) {
      return;
    }
    const paceSeconds = totalSeconds / distanceNum;
    setPace(formatSecondsToMmSs(paceSeconds));
  };

  const calculateTime = (d, p) => {
    const distanceNum = safeNumber(d);
    const paceSeconds = parseTimeToSeconds(p);
    if (!distanceNum || distanceNum <= 0 || !paceSeconds || paceSeconds <= 0) {
      return;
    }
    const totalSeconds = paceSeconds * distanceNum;
    setTime(formatSecondsToHms(totalSeconds));
  };

  const calculateDistance = (t, p) => {
    const totalSeconds = parseTimeToSeconds(t);
    const paceSeconds = parseTimeToSeconds(p);
    if (!totalSeconds || totalSeconds <= 0 || !paceSeconds || paceSeconds <= 0) {
      return;
    }
    setDistance((totalSeconds / paceSeconds).toFixed(2));
  };

  const handleSetGoalRace = async () => {
    const totalSeconds = parseTimeToSeconds(pace);
    if (!totalSeconds || totalSeconds <= 0) {
      Alert.alert("Invalid pace", "Please select a valid pace first.");
      return;
    }

    const marathonSeconds = Math.round(totalSeconds * 42.195);
    const goalTime = formatSecondsToHms(marathonSeconds);

    try {
      const existing = await AsyncStorage.getItem("knack_race");
      const parsed = existing ? JSON.parse(existing) : {};
      const payload = {
        date: parsed.date || "2026-10-18",
        time: goalTime,
      };
      await AsyncStorage.setItem("knack_race", JSON.stringify(payload));
      Alert.alert("Race goal updated", `Goal time set to ${goalTime} in Race tab.`);
      router.push("/(tabs)/race");
    } catch (error) {
      Alert.alert("Error", "Could not save goal race time.");
    }
  };

  const parsedTimeValue = (() => {
    const secs = parseTimeToSeconds(time);
    const d = new Date();
    if (!secs || secs < 0) return d;
    d.setHours(Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60, 0);
    return d;
  })();

  const parsedPaceValue = (() => {
    const secs = parseTimeToSeconds(pace);
    const d = new Date();
    if (!secs || secs < 0) return d;
    d.setHours(Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60, 0);
    return d;
  })();

  return (
    <>
    <AppShell title="Calculator" subtitle="Pace Tools">
      <View style={{ marginBottom: 24 }}>
        <Pill
          label="Targeting Excellence"
          icon={Activity}
          color={COLORS.statusLow}
          bgColor={COLORS.statusLowBg}
        />
      </View>
      <View style={styles.dashboardCard}>
        <Text style={styles.dashboardTitle}>Progress Dashboard</Text>
        <View style={[styles.dashboardRow, styles.rowNeutral]}>
          <CalendarCheck size={14} color={COLORS.primary} />
          <Text style={styles.dashboardItem}>{dashboard.weekOverview}</Text>
        </View>
        <View style={[styles.dashboardRow, styles.rowHot]}>
          <Flame size={14} color="#B45309" />
          <Text style={styles.dashboardItem}>{dashboard.streak}</Text>
        </View>
        <View style={[styles.dashboardRow, styles.rowSuccess]}>
          <Route size={14} color={COLORS.statusLow} />
          <Text style={styles.dashboardItem}>{dashboard.progress}</Text>
        </View>
        <View style={[styles.dashboardRow, styles.rowInfo]}>
          <CalendarCheck size={14} color="#0EA5E9" />
          <Text style={styles.dashboardItem}>{dashboard.nextWorkout}</Text>
        </View>
        <View style={[styles.dashboardRow, styles.rowAchievement]}>
          <Trophy size={14} color={COLORS.statusMedium} />
          <Text style={styles.dashboardItem}>{dashboard.achievement}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Input
          label="Distance (km)"
          value={distance}
          onChangeText={(v) => {
            setDistance(v);
            calculatePace(v, time);
          }}
          keyboardType="numeric"
          placeholder="e.g. 42.19"
        />

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Time (HH:MM:SS)</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={[styles.pickerButtonText, !time && styles.placeholderText]}>
              {time || "Select time (HH:MM:SS)"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Pace (MM:SS /km)</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowPacePicker(true)}
          >
            <Text style={[styles.pickerButtonText, !pace && styles.placeholderText]}>
              {pace || "Select pace (MM:SS /km)"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showTimePicker && (
        <DateTimePicker
          value={parsedTimeValue}
          mode="time"
          is24Hour
          display="default"
          onChange={(_, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) {
              const h = `${selectedTime.getHours()}`.padStart(2, "0");
              const m = `${selectedTime.getMinutes()}`.padStart(2, "0");
              const nextTime = `${h}:${m}:00`;
              setTime(nextTime);
              calculatePace(distance, nextTime);
            }
          }}
        />
      )}

      {showPacePicker && (
        <DateTimePicker
          value={parsedPaceValue}
          mode="time"
          is24Hour
          display="default"
          onChange={(_, selectedTime) => {
            setShowPacePicker(false);
            if (selectedTime) {
              const totalSeconds =
                selectedTime.getHours() * 3600 + selectedTime.getMinutes() * 60;
              const nextPace = formatSecondsToMmSs(totalSeconds);
              setPace(nextPace);
              calculateTime(distance, nextPace);
            }
          }}
        />
      )}

      <View style={styles.resultContainer}>
        <Text style={styles.resultLabel}>Estimated Finish for Marathon</Text>
        <Text style={styles.resultValue}>
          {(() => {
            const psTotal = parseTimeToSeconds(pace);
            if (!psTotal || psTotal <= 0) return "--";
            const marathonSeconds = psTotal * 42.195;
            const h = Math.floor(marathonSeconds / 3600);
            const m = Math.floor((marathonSeconds % 3600) / 60);
            const s = Math.round(marathonSeconds % 60);
            return `${h}h ${m}m ${s}s`;
          })()}
        </Text>
      </View>

      <View style={{ gap: 12, marginTop: 20 }}>
        <Button title="Set as Race Goal" onPress={handleSetGoalRace} />
        <Pressable style={styles.premiumButton} onPress={openPremium}>
          <LinearGradient
            colors={["#FF6A2C", "#FF8A4C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumGradient}
          >
            <Lock size={16} color="#FFFFFF" />
            <Text style={styles.premiumButtonText}>Unlock Premium</Text>
            <Zap size={16} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
        <Button
          title="Clear All"
          type="secondary"
          onPress={() => {
            setDistance("");
            setTime("");
            setPace("");
          }}
        />
      </View>
    </AppShell>

    <RatingBottomSheet
      isVisible={showRatingSheet}
      onClose={() => setShowRatingSheet(false)}
    />
    
    <Modal
      visible={showPremium}
      transparent
      animationType="none"
      onRequestClose={closePremium}
    >
      <View style={styles.premiumOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closePremium} />
        <Animated.View
          style={[
            styles.premiumCard,
            {
              opacity: premiumOpacity,
              transform: [{ scale: premiumScale }],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,106,44,0.40)", "rgba(15,23,42,0.98)", "#020617"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.premiumGlowTop} />
          
          <View style={styles.premiumHeader}>
            <Text style={styles.premiumBadge}>MARATHON PLANNER PRO</Text>
            <Text style={styles.premiumTitle}>Level Up Your Training</Text>
            <Text style={styles.premiumSubtitle}>Get advanced analytics, AI coaching, and unlimited plans</Text>
          </View>
          
          <View style={styles.premiumBenefitsList}>
            {[
              { icon: Zap, text: "AI-Powered Training Plans" },
              { icon: Activity, text: "Real-Time Performance Analytics" },
              { icon: Trophy, text: "Unlimited Race Goals" },
              { icon: Check, text: "Advanced Injury Prevention" },
              { icon: Star, text: "Priority Support" },
            ].map((benefit, idx) => (
              <View key={idx} style={styles.premiumBenefitItem}>
                <View style={styles.premiumBenefitIcon}>
                  <benefit.icon size={16} color="#FF6A2C" />
                </View>
                <Text style={styles.premiumBenefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.premiumPlansContainer}>
            <View style={[styles.premiumPlan, styles.planBasic]}>
              <Text style={styles.planPrice}>$0</Text>
              <Text style={styles.planName}>Free</Text>
              <Text style={styles.planDesc}>Basic features</Text>
            </View>
            <View style={[styles.premiumPlan, styles.planPro]}>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>BEST</Text>
              </View>
              <Text style={styles.planPrice}>$4.99</Text>
              <Text style={styles.planName}>Pro</Text>
              <Text style={styles.planDesc}>All premium features</Text>
            </View>
          </View>
          
          <View style={styles.premiumActions}>
            <Pressable style={styles.premiumCTA} onPress={closePremium}>
              <LinearGradient
                colors={["#FF6A2C", "#FF8A4C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumCTAGradient}
              >
                <Text style={styles.premiumCTAText}>Get Premium</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.premiumSecondary} onPress={closePremium}>
              <Text style={styles.premiumSecondaryText}>Maybe Later</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 2,
  },
  dashboardCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: COLORS.workspaceBg,
    gap: 6,
    marginBottom: 14,
  },
  dashboardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 2,
  },
  dashboardItem: {
    fontSize: 13,
    color: COLORS.foreground,
    flex: 1,
  },
  dashboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowNeutral: {
    backgroundColor: "#F8FAFC",
  },
  rowHot: {
    backgroundColor: "#FFFBEB",
  },
  rowSuccess: {
    backgroundColor: "#ECFDF5",
  },
  rowInfo: {
    backgroundColor: "#EFF6FF",
  },
  rowAchievement: {
    backgroundColor: "#FEF3C7",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.mutedForeground,
    marginBottom: 6,
  },
  pickerButton: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: COLORS.workspaceBg,
  },
  pickerButtonText: {
    fontSize: 16,
    color: COLORS.foreground,
  },
  placeholderText: {
    color: COLORS.mutedForeground,
  },
  resultContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.canvasBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.24,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: "400",
    color: COLORS.foreground,
  },
  rateOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.76)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  rateCard: {
    borderRadius: 32,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0F172A",
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 20 },
    elevation: 20,
  },
  rateGlow: {
    position: "absolute",
    top: -72,
    right: -72,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,106,44,0.24)",
  },
  rateTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  rateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    alignSelf: "center",
  },
  rateBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: 0.6,
  },
  rateMeta: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  starHeroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  starHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  starHeroPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.11)",
    alignItems: "center",
    justifyContent: "center",
  },
  rateTitle: {
    fontSize: 29,
    lineHeight: 33,
    color: "#FFFFFF",
    fontWeight: "600",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  rateBody: {
    marginTop: 11,
    fontSize: 15,
    lineHeight: 23,
    color: "#CBD5E1",
    textAlign: "center",
  },
  rateStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  rateStat: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  rateStatValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rateStatLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
  rateActions: {
    gap: 12,
    marginTop: 20,
  },
  ratePrimaryAction: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  ratePrimaryActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  rateSecondaryAction: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rateSecondaryActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  premiumButton: {
    borderRadius: 14,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#FF6A2C",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  premiumGradient: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  premiumButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  premiumOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.80)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  premiumCard: {
    borderRadius: 40,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#0F172A",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 30 },
    elevation: 30,
    maxHeight: "85%",
  },
  premiumGlowTop: {
    position: "absolute",
    top: -100,
    left: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,106,44,0.30)",
    opacity: 0.5,
  },
  premiumHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  premiumBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FF6A2C",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  premiumTitle: {
    fontSize: 32,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 38,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  premiumSubtitle: {
    fontSize: 15,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 22,
  },
  premiumBenefitsList: {
    gap: 12,
    marginBottom: 24,
  },
  premiumBenefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  premiumBenefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,106,44,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumBenefitText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
    flex: 1,
  },
  premiumPlansContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  premiumPlan: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  planBasic: {
    borderColor: "rgba(255,255,255,0.06)",
  },
  planPro: {
    borderColor: "rgba(255,106,44,0.40)",
    backgroundColor: "rgba(255,106,44,0.08)",
  },
  planBadge: {
    position: "absolute",
    top: -10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#FF6A2C",
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 4,
  },
  planName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
  },
  planDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  premiumActions: {
    gap: 12,
  },
  premiumCTA: {
    borderRadius: 18,
    overflow: "hidden",
    elevation: 8,
  },
  premiumCTAGradient: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  premiumCTAText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  premiumSecondary: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  premiumSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#CBD5E1",
  },
});
