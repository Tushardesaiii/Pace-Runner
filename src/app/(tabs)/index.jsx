import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  AppShell,
  Input,
  Pill,
  COLORS,
  Button,
} from "../../components/DesignSystem";
import { Activity, CalendarCheck, Flame, Trophy, Route } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseTimeToSeconds,
  formatSecondsToHms,
  formatSecondsToMmSs,
  safeNumber,
} from "../../utils/runMath";

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
  const [dashboard, setDashboard] = useState({
    weekOverview: "No active plan",
    streak: "0 days in a row",
    progress: "Week --/-- - 0% complete",
    nextWorkout: "No upcoming workout",
    achievement: "No runs logged yet",
  });

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
    fontWeight: "700",
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
});
