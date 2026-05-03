import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppShell, COLORS, Pill, Button } from "../../components/DesignSystem";
import { Target, ChevronRight, ChevronDown } from "lucide-react-native";
import { formatSecondsToHms } from "../../utils/runMath";

const GOALS = [
  { id: "5k", label: "5K", dist: 5 },
  { id: "10k", label: "10K", dist: 10 },
  { id: "half", label: "Half Marathon", dist: 21.1 },
  { id: "full", label: "Full Marathon", dist: 42.2 },
];

const LEVELS = [
  { id: "beg", label: "Beginner" },
  { id: "int", label: "Intermediate" },
  { id: "adv", label: "Advanced" },
];

const WORKOUT_TYPES = {
  EASY: {
    label: "Easy Run",
    color: COLORS.statusLow,
    pace: "Conversational pace",
  },
  TEMPO: {
    label: "Tempo Run",
    color: COLORS.statusMedium,
    pace: "Comfortably hard",
  },
  INTERVALS: {
    label: "Intervals",
    color: COLORS.statusHigh,
    pace: "Hard effort",
  },
  LONG: { label: "Long Run", color: COLORS.primary, pace: "Easy to moderate" },
  REST: { label: "Rest Day", color: COLORS.mutedForeground, pace: "Recovery" },
};

const DAY_INDEX = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ESTIMATED_PACE_MIN_PER_KM = {
  EASY: 6.5,
  TEMPO: 5.3,
  INTERVALS: 4.8,
  LONG: 6.8,
};

const getWeekProgress = (week) => {
  const total = week.dailyWorkouts.length;
  const completed = week.dailyWorkouts.filter((w) => w.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
};

export default function PlanScreen() {
  const [goal, setGoal] = useState("full");
  const [level, setLevel] = useState("beg");
  const [plan, setPlan] = useState(null);
  const [planStartDate, setPlanStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [showFullPlan, setShowFullPlan] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [runHistory, setRunHistory] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadPlan();
  }, []);

  useEffect(() => {
    const hasRunningWorkout = plan?.some((w) =>
      w.dailyWorkouts?.some((dw) => dw.startedAt && !dw.completed && !dw.isPaused),
    );
    if (!hasRunningWorkout) return;

    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [plan]);

  const loadPlan = async () => {
    try {
      const [saved, savedHistory] = await Promise.all([
        AsyncStorage.getItem("trainingPlan"),
        AsyncStorage.getItem("runHistory"),
      ]);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPlan(parsed.plan);
        setGoal(parsed.goal);
        setLevel(parsed.level);
        if (parsed.startDate) {
          setPlanStartDate(parsed.startDate);
        }
      }
      if (savedHistory) {
        setRunHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error("Failed to load plan:", error);
    }
  };

  const savePlan = async (newPlan, newGoal, newLevel, startDate) => {
    try {
      await AsyncStorage.setItem(
        "trainingPlan",
        JSON.stringify({
          plan: newPlan,
          goal: newGoal,
          level: newLevel,
          startDate,
        }),
      );
    } catch (error) {
      console.error("Failed to save plan:", error);
    }
  };

  const generateDailyWorkouts = (
    week,
    totalWeeks,
    goalId,
    experienceLevel,
  ) => {
    const weekProgress = week / totalWeeks;
    const isTaperWeek = weekProgress >= 0.8;

    let baseDistance = goalId === "full" ? 8 : goalId === "half" ? 5 : 3;
    if (experienceLevel === "adv") baseDistance *= 1.3;
    if (experienceLevel === "int") baseDistance *= 1.15;

    const longRunDistance = Math.round(
      baseDistance * (1 + weekProgress * 1.5) * (isTaperWeek ? 0.6 : 1),
    );

    return [
      { day: "Mon", type: "EASY", distance: Math.round(baseDistance * 0.7) },
      {
        day: "Tue",
        type: week % 2 === 0 ? "INTERVALS" : "TEMPO",
        distance: Math.round(baseDistance * 0.8),
      },
      { day: "Wed", type: "REST", distance: 0 },
      { day: "Thu", type: "EASY", distance: Math.round(baseDistance * 0.9) },
      { day: "Fri", type: "REST", distance: 0 },
      { day: "Sat", type: "EASY", distance: Math.round(baseDistance * 0.6) },
      { day: "Sun", type: "LONG", distance: longRunDistance },
    ];
  };

  const generatePlan = () => {
    const weeks = level === "beg" ? 16 : level === "int" ? 12 : 8;
    const startDate = new Date().toISOString().split("T")[0];

    const p = Array.from({ length: weeks }, (_, i) => {
      const weekNum = i + 1;
      const dailyWorkouts = generateDailyWorkouts(weekNum, weeks, goal, level);
      const totalVolume = dailyWorkouts.reduce((sum, d) => sum + d.distance, 0);

      return {
        week: weekNum,
        volume: totalVolume,
        dailyWorkouts: dailyWorkouts.map((workout) => ({
          ...workout,
          completed: false,
          startedAt: null,
          isPaused: false,
          elapsedBeforePauseSec: 0,
        })),
      };
    });

    setPlan(p);
    setPlanStartDate(startDate);
    savePlan(p, goal, level, startDate);
  };

  const toggleWeekExpansion = (weekNum) => {
    setExpandedWeek(expandedWeek === weekNum ? null : weekNum);
  };

  const getScheduledDate = (weekNum, dayLabel) => {
    const base = new Date(planStartDate);
    const dayOffset = DAY_INDEX[dayLabel] ?? 0;
    const daysFromStart = (weekNum - 1) * 7 + dayOffset;
    base.setDate(base.getDate() + daysFromStart);
    return base.toISOString().split("T")[0];
  };

  const hasAnotherActiveWorkout = (weekNum, workoutIndex) => {
    return plan?.some((w) =>
      w.dailyWorkouts?.some(
        (dw, idx) =>
          !dw.completed &&
          (dw.startedAt || dw.isPaused) &&
          !(w.week === weekNum && idx === workoutIndex),
      ),
    );
  };

  const startWorkout = async (weekNum, workoutIndex) => {
    const targetWeek = plan?.find((w) => w.week === weekNum);
    const targetWorkout = targetWeek?.dailyWorkouts?.[workoutIndex];
    if (!targetWorkout || targetWorkout.type === "REST") return;
    if (targetWorkout.completed) return;

    if (hasAnotherActiveWorkout(weekNum, workoutIndex)) {
      Alert.alert(
        "Workout already running",
        "Please finish the active workout before starting another.",
      );
      return;
    }

    const updatedPlan = plan.map((w) => {
      if (w.week !== weekNum) return w;
      return {
        ...w,
        dailyWorkouts: w.dailyWorkouts.map((dw, idx) =>
          idx === workoutIndex
            ? {
              ...dw,
              startedAt: new Date().toISOString(),
              isPaused: false,
              elapsedBeforePauseSec: dw.elapsedBeforePauseSec ?? 0,
            }
            : dw,
        ),
      };
    });

    setPlan(updatedPlan);
    await savePlan(updatedPlan, goal, level, planStartDate);
  };

  const pauseWorkout = async (weekNum, workoutIndex) => {
    const targetWeek = plan?.find((w) => w.week === weekNum);
    const targetWorkout = targetWeek?.dailyWorkouts?.[workoutIndex];
    if (!targetWorkout?.startedAt || targetWorkout.completed || targetWorkout.isPaused) return;

    const startedMs = new Date(targetWorkout.startedAt).getTime();
    const elapsedThisRun = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
    const elapsedBeforePauseSec = targetWorkout.elapsedBeforePauseSec ?? 0;

    const updatedPlan = plan.map((w) => {
      if (w.week !== weekNum) return w;
      return {
        ...w,
        dailyWorkouts: w.dailyWorkouts.map((dw, idx) =>
          idx === workoutIndex
            ? {
              ...dw,
              startedAt: null,
              isPaused: true,
              elapsedBeforePauseSec: elapsedBeforePauseSec + elapsedThisRun,
            }
            : dw,
        ),
      };
    });

    setPlan(updatedPlan);
    await savePlan(updatedPlan, goal, level, planStartDate);
  };

  const resumeWorkout = async (weekNum, workoutIndex) => {
    const targetWeek = plan?.find((w) => w.week === weekNum);
    const targetWorkout = targetWeek?.dailyWorkouts?.[workoutIndex];
    if (!targetWorkout || targetWorkout.completed || !targetWorkout.isPaused) return;
    if (hasAnotherActiveWorkout(weekNum, workoutIndex)) {
      Alert.alert(
        "Workout already running",
        "Please finish the active workout before resuming another.",
      );
      return;
    }

    const updatedPlan = plan.map((w) => {
      if (w.week !== weekNum) return w;
      return {
        ...w,
        dailyWorkouts: w.dailyWorkouts.map((dw, idx) =>
          idx === workoutIndex
            ? {
              ...dw,
              startedAt: new Date().toISOString(),
              isPaused: false,
            }
            : dw,
        ),
      };
    });

    setPlan(updatedPlan);
    await savePlan(updatedPlan, goal, level, planStartDate);
  };

  const stopWorkout = async (weekNum, workoutIndex) => {
    const targetWeek = plan?.find((w) => w.week === weekNum);
    const targetWorkout = targetWeek?.dailyWorkouts?.[workoutIndex];
    if (
      (!targetWorkout?.startedAt && !targetWorkout?.isPaused) ||
      targetWorkout.type === "REST"
    ) {
      return;
    }

    const elapsedBeforePauseSec = targetWorkout.elapsedBeforePauseSec ?? 0;
    const currentRunSec =
      targetWorkout.startedAt && !targetWorkout.isPaused
        ? Math.max(0, Math.round((Date.now() - new Date(targetWorkout.startedAt).getTime()) / 1000))
        : 0;
    const durationSeconds = Math.max(1, elapsedBeforePauseSec + currentRunSec);

    const updatedPlan = plan.map((w) => {
      if (w.week !== weekNum) return w;
      return {
        ...w,
        dailyWorkouts: w.dailyWorkouts.map((dw, idx) =>
          idx === workoutIndex
            ? {
              ...dw,
              completed: true,
              startedAt: null,
              isPaused: false,
              elapsedBeforePauseSec: 0,
              actualDurationSec: durationSeconds,
            }
            : dw,
        ),
      };
    });

    setPlan(updatedPlan);
    await savePlan(updatedPlan, goal, level, planStartDate);

    if (targetWorkout.distance <= 0) return;
    const paceMinPerKm = durationSeconds / 60 / targetWorkout.distance;
    const runEntry = {
      id: `${Date.now()}-${weekNum}-${workoutIndex}`,
      date: new Date().toISOString().split("T")[0],
      distance: targetWorkout.distance,
      time: formatSecondsToHms(durationSeconds),
      pace: paceMinPerKm,
      notes: `Auto-logged from Training Plan: Week ${weekNum} ${targetWorkout.day} (${WORKOUT_TYPES[targetWorkout.type].label}); scheduled ${getScheduledDate(weekNum, targetWorkout.day)}`,
    };

    try {
      const existing = await AsyncStorage.getItem("runHistory");
      const parsed = existing ? JSON.parse(existing) : [];
      const updatedHistory = [runEntry, ...parsed];
      await AsyncStorage.setItem("runHistory", JSON.stringify(updatedHistory));
      setRunHistory(updatedHistory);
    } catch (error) {
      console.error("Failed to append completed workout to history:", error);
    }
  };

  const getRunningSeconds = (workout) => {
    if (!workout || workout.completed) return null;
    const elapsedBeforePauseSec = workout.elapsedBeforePauseSec ?? 0;
    if (workout.startedAt && !workout.isPaused) {
      const startedMs = new Date(workout.startedAt).getTime();
      return Math.max(0, elapsedBeforePauseSec + Math.round((nowMs - startedMs) / 1000));
    }
    if (workout.isPaused) return elapsedBeforePauseSec;
    return null;
  };

  const getWorkoutForDate = (dateStr) => {
    if (!plan?.length || !planStartDate) return null;
    const start = new Date(planStartDate);
    const target = new Date(dateStr);
    const diffDays = Math.floor(
      (new Date(target.toDateString()).getTime() - new Date(start.toDateString()).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (diffDays < 0) return null;
    const weekIndex = Math.floor(diffDays / 7);
    if (weekIndex >= plan.length) return null;

    const dayIndex = diffDays % 7;
    const week = plan[weekIndex];
    const workout = week.dailyWorkouts[dayIndex];
    if (!workout) return null;

    return {
      week: week.week,
      dayLabel: Object.keys(DAY_INDEX).find((k) => DAY_INDEX[k] === dayIndex) || "Mon",
      workout,
      workoutIndex: dayIndex,
    };
  };

  const getActivityDateSet = () =>
    new Set((runHistory || []).map((r) => new Date(r.date).toISOString().split("T")[0]));

  const getStreakDays = () => {
    const dateSet = getActivityDateSet();
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = cursor.toISOString().split("T")[0];
      if (!dateSet.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };

  const buildCalendarDays = () => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const startOffset = firstDay.getDay();
    const days = [];

    for (let i = 0; i < startOffset; i += 1) {
      days.push({ key: `empty-${i}`, empty: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = new Date(y, m, d);
      const dateStr = date.toISOString().split("T")[0];
      const mapped = getWorkoutForDate(dateStr);
      const hasActivity = getActivityDateSet().has(dateStr);
      const isToday = dateStr === new Date().toISOString().split("T")[0];
      const isSelected = dateStr === selectedDate;

      let marker = "none";
      if (mapped && mapped.workout && mapped.workout.type !== "REST") {
        const isMissed =
          new Date(dateStr) < new Date(new Date().toDateString()) &&
          !mapped.workout.completed;
        if (mapped.workout.completed || hasActivity) marker = "completed";
        else if (isMissed) marker = "missed";
        else marker = "planned";
      }
      days.push({ key: dateStr, day: d, dateStr, isToday, isSelected, marker });
    }
    return days;
  };

  const logSelectedDateRun = async () => {
    const mapped = getWorkoutForDate(selectedDate);
    if (!mapped || mapped.workout.type === "REST") {
      Alert.alert("No workout", "No planned workout on this date.");
      return;
    }
    if (mapped.workout.completed) {
      Alert.alert("Already complete", "This workout is already marked complete.");
      return;
    }

    const pace = ESTIMATED_PACE_MIN_PER_KM[mapped.workout.type] ?? 6;
    const durationSeconds = Math.round(mapped.workout.distance * pace * 60);
    const runEntry = {
      id: `${Date.now()}-${mapped.week}-${mapped.workoutIndex}`,
      date: selectedDate,
      distance: mapped.workout.distance,
      time: formatSecondsToHms(durationSeconds),
      pace,
      notes: `Calendar log: Week ${mapped.week} ${mapped.dayLabel} (${WORKOUT_TYPES[mapped.workout.type].label})`,
    };

    const updatedPlan = plan.map((w) => {
      if (w.week !== mapped.week) return w;
      return {
        ...w,
        dailyWorkouts: w.dailyWorkouts.map((dw, idx) =>
          idx === mapped.workoutIndex
            ? { ...dw, completed: true, startedAt: null, isPaused: false, elapsedBeforePauseSec: 0 }
            : dw,
        ),
      };
    });

    try {
      const existing = await AsyncStorage.getItem("runHistory");
      const parsed = existing ? JSON.parse(existing) : [];
      const updatedHistory = [runEntry, ...parsed];
      await AsyncStorage.setItem("runHistory", JSON.stringify(updatedHistory));
      await savePlan(updatedPlan, goal, level, planStartDate);
      setPlan(updatedPlan);
      setRunHistory(updatedHistory);
      Alert.alert("Logged", "Run added and workout marked complete.");
    } catch (error) {
      Alert.alert("Error", "Could not log run for this date.");
    }
  };

  return (
    <AppShell title="Training" subtitle="Plan Generator">
      <View style={{ marginBottom: 24 }}>
        <Pill
          label="Consistency is Key"
          icon={Target}
          color={COLORS.statusMedium}
          bgColor={COLORS.statusMediumBg}
        />
      </View>

      <Text style={styles.sectionTitle}>Goal Distance</Text>
      <View style={styles.optionGrid}>
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.id}
            onPress={() => setGoal(g.id)}
            style={[styles.option, goal === g.id && styles.optionActive]}
          >
            <Text
              style={[
                styles.optionText,
                goal === g.id && styles.optionTextActive,
              ]}
            >
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Experience Level</Text>
      <View style={styles.optionGrid}>
        {LEVELS.map((l) => (
          <TouchableOpacity
            key={l.id}
            onPress={() => setLevel(l.id)}
            style={[styles.option, level === l.id && styles.optionActive]}
          >
            <Text
              style={[
                styles.optionText,
                level === l.id && styles.optionTextActive,
              ]}
            >
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title="Generate Weekly Plan" onPress={generatePlan} />
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarTitle}>Training Calendar</Text>
          <Text style={styles.streakLabel}>Streak: {getStreakDays()} days 🔥</Text>
        </View>
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() =>
              setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
          >
            <Text style={styles.monthNavBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
          <TouchableOpacity
            onPress={() =>
              setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
          >
            <Text style={styles.monthNavBtn}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weekdaysRow}>
          {DAY_LABELS.map((d) => (
            <Text key={d} style={styles.weekdayText}>
              {d.slice(0, 1)}
            </Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {buildCalendarDays().map((item) =>
            item.empty ? (
              <View key={item.key} style={styles.dayCell} />
            ) : (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.dayCell,
                  item.isSelected && styles.daySelected,
                  item.isToday && styles.dayToday,
                ]}
                onPress={() => setSelectedDate(item.dateStr)}
              >
                <Text style={styles.dayNumber}>{item.day}</Text>
                {item.marker !== "none" && (
                  <View
                    style={[
                      styles.markerBase,
                      item.marker === "completed" && styles.markerCompleted,
                      item.marker === "planned" && styles.markerPlanned,
                      item.marker === "missed" && styles.markerMissed,
                    ]}
                  />
                )}
              </TouchableOpacity>
            ),
          )}
        </View>
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedDateLabel}>
            {new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Text>
          {(() => {
            const mapped = getWorkoutForDate(selectedDate);
            if (!mapped) return <Text style={styles.selectedWorkout}>No scheduled workout</Text>;
            return (
              <>
                <Text style={styles.selectedWorkout}>
                  {WORKOUT_TYPES[mapped.workout.type].label} • {mapped.workout.distance} km
                </Text>
                {mapped.workout.type !== "REST" && !mapped.workout.completed && (
                  <Button title="Log Run for This Date" onPress={logSelectedDateRun} />
                )}
              </>
            );
          })()}
        </View>
      </View>

      {plan && (
        <View style={{ marginTop: 32 }}>
          <Text style={styles.sectionTitle}>
            Your {plan.length} Week Roadmap
          </Text>
          {(showFullPlan ? plan : plan.slice(0, 4)).map((w) => (
            <View key={w.week}>
              <TouchableOpacity
                style={styles.planItem}
                onPress={() => toggleWeekExpansion(w.week)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.weekNumber}>Week {w.week}</Text>
                  <Text style={styles.sessionType}>
                    {getWeekProgress(w).completed}/{getWeekProgress(w).total} workouts complete
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                  <Text style={styles.volume}>{w.volume} km</Text>
                  <Text style={styles.volumeLabel}>Total Volume</Text>
                  <Text style={styles.progressPercent}>
                    {getWeekProgress(w).percent}% complete
                  </Text>
                </View>
                {expandedWeek === w.week ? (
                  <ChevronDown size={20} color={COLORS.mutedForeground} />
                ) : (
                  <ChevronRight size={20} color={COLORS.mutedForeground} />
                )}
              </TouchableOpacity>

              {expandedWeek === w.week && (
                <View style={styles.dailyWorkoutsContainer}>
                  {w.dailyWorkouts.map((workout, idx) => (
                    <View key={idx} style={styles.dailyWorkout}>
                      <View style={styles.dailyWorkoutTop}>
                        <View style={styles.dayBadge}>
                          <Text style={styles.dayText}>{workout.day}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.workoutType,
                              { color: WORKOUT_TYPES[workout.type].color },
                            ]}
                          >
                            {WORKOUT_TYPES[workout.type].label}
                          </Text>
                          <Text style={styles.workoutPace}>
                            {WORKOUT_TYPES[workout.type].pace}
                          </Text>
                        </View>
                        {workout.distance > 0 && (
                          <Text style={styles.workoutDistance}>
                            {workout.distance} km
                          </Text>
                        )}
                        {workout.completed && (
                          <View style={styles.completedBadge}>
                            <Text style={styles.completedBadgeText}>Completed</Text>
                          </View>
                        )}
                      </View>
                      {workout.type !== "REST" && (
                        <View style={styles.workoutActionsRow}>
                          {!workout.completed && !workout.startedAt && !workout.isPaused && (
                            <TouchableOpacity
                              style={styles.completeButton}
                              onPress={() => startWorkout(w.week, idx)}
                            >
                              <Text style={styles.completeButtonText}>Start Run</Text>
                            </TouchableOpacity>
                          )}
                          {!workout.completed && workout.startedAt && !workout.isPaused && (
                            <>
                              <TouchableOpacity
                                style={[styles.completeButton, styles.pauseButton]}
                                onPress={() => pauseWorkout(w.week, idx)}
                              >
                                <Text
                                  style={[styles.completeButtonText, styles.completeButtonTextRunning]}
                                >
                                  Pause
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.completeButton, styles.completeButtonRunning]}
                                onPress={() => stopWorkout(w.week, idx)}
                              >
                                <Text
                                  style={[styles.completeButtonText, styles.completeButtonTextRunning]}
                                >
                                  Stop & Complete
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                          {!workout.completed && workout.isPaused && (
                            <>
                              <TouchableOpacity
                                style={[styles.completeButton, styles.resumeButton]}
                                onPress={() => resumeWorkout(w.week, idx)}
                              >
                                <Text
                                  style={[styles.completeButtonText, styles.completeButtonTextRunning]}
                                >
                                  Resume
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.completeButton, styles.completeButtonRunning]}
                                onPress={() => stopWorkout(w.week, idx)}
                              >
                                <Text
                                  style={[styles.completeButtonText, styles.completeButtonTextRunning]}
                                >
                                  Stop & Complete
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                          {workout.completed && (
                            <View style={[styles.completeButton, styles.completeButtonDone]}>
                              <Text
                                style={[styles.completeButtonText, styles.completeButtonTextDone]}
                              >
                                Done
                              </Text>
                            </View>
                          )}
                          {getRunningSeconds(workout) !== null && (
                            <Text style={styles.timerText}>
                              {formatSecondsToHms(getRunningSeconds(workout))}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          {plan.length > 4 && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowFullPlan(!showFullPlan)}
            >
              <Text style={styles.moreButtonText}>
                {showFullPlan ? "Show Less" : "View Full Plan"}
              </Text>
              {showFullPlan ? (
                <ChevronDown size={16} color={COLORS.mutedForeground} />
              ) : (
                <ChevronRight size={16} color={COLORS.mutedForeground} />
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.foreground,
    marginBottom: 12,
    marginTop: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.workspaceBg,
  },
  optionActive: {
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.primaryMuted,
  },
  optionText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  optionTextActive: {
    color: COLORS.primary,
    fontWeight: "500",
  },
  planItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  weekNumber: {
    fontSize: 16,
    fontWeight: "400",
    color: COLORS.foreground,
  },
  sessionType: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  volume: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.primary,
  },
  volumeLabel: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
  },
  progressPercent: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.statusLow,
    fontWeight: "600",
  },
  dailyWorkoutsContainer: {
    backgroundColor: COLORS.canvasBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 8,
  },
  dailyWorkout: {
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.workspaceBg,
  },
  dailyWorkoutTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  workoutActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.workspaceBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.foreground,
  },
  workoutType: {
    fontSize: 14,
    fontWeight: "500",
  },
  workoutPace: {
    fontSize: 11,
    color: COLORS.mutedForeground,
    marginTop: 2,
  },
  workoutDistance: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.foreground,
  },
  completedBadge: {
    backgroundColor: COLORS.statusLowBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedBadgeText: {
    fontSize: 11,
    color: COLORS.statusLow,
    fontWeight: "600",
  },
  moreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 4,
  },
  moreButtonText: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  calendarCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: COLORS.workspaceBg,
    gap: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  streakLabel: {
    fontSize: 12,
    color: COLORS.mutedForeground,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.foreground,
  },
  monthNavBtn: {
    fontSize: 22,
    color: COLORS.primary,
    paddingHorizontal: 8,
  },
  weekdaysRow: {
    flexDirection: "row",
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: COLORS.mutedForeground,
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 12,
    color: COLORS.foreground,
  },
  daySelected: {
    backgroundColor: COLORS.primaryMuted,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  markerBase: {
    marginTop: 4,
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  markerCompleted: {
    backgroundColor: COLORS.statusLow,
  },
  markerPlanned: {
    backgroundColor: "#0EA5E9",
  },
  markerMissed: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.statusHigh,
  },
  selectedInfo: {
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 10,
    gap: 6,
  },
  selectedDateLabel: {
    fontSize: 13,
    color: COLORS.foreground,
    fontWeight: "600",
  },
  selectedWorkout: {
    fontSize: 13,
    color: COLORS.mutedForeground,
  },
  completeButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.workspaceBg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completeButtonDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  completeButtonRunning: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  pauseButton: {
    backgroundColor: "#64748B",
    borderColor: "#64748B",
  },
  resumeButton: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  completeButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "500",
  },
  completeButtonTextRunning: {
    color: "#fff",
  },
  completeButtonTextDone: {
    color: "#fff",
  },
  timerText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginLeft: "auto",
  },
});
