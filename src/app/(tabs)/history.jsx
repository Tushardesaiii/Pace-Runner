import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppShell, COLORS, Pill, Button } from "../../components/DesignSystem";
import {
  Activity,
  Plus,
  X,
  Calendar,
} from "lucide-react-native";
import {
  parseTimeToSeconds,
  safeNumber,
  formatDateForInput,
  formatSecondsToHms,
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

export default function HistoryScreen() {
  const [runs, setRuns] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRun, setNewRun] = useState({
    date: new Date().toISOString().split("T")[0],
    distance: "",
    time: "",
    notes: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      const saved = await AsyncStorage.getItem("runHistory");
      if (saved) {
        setRuns(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load runs:", error);
    }
  };

  const saveRuns = async (newRuns) => {
    try {
      await AsyncStorage.setItem("runHistory", JSON.stringify(newRuns));
      setRuns(newRuns);
    } catch (error) {
      console.error("Failed to save runs:", error);
    }
  };

  const syncRunToPlan = async (run) => {
    try {
      const rawPlan = await AsyncStorage.getItem("trainingPlan");
      if (!rawPlan) return;

      const parsedPlan = JSON.parse(rawPlan);
      if (!parsedPlan?.plan?.length || !parsedPlan?.startDate) return;

      const getScheduledDate = (weekNum, dayLabel) => {
        const base = new Date(parsedPlan.startDate);
        const dayOffset = DAY_INDEX[dayLabel] ?? 0;
        base.setDate(base.getDate() + (weekNum - 1) * 7 + dayOffset);
        return base.toISOString().split("T")[0];
      };

      let matched = false;
      const updatedPlan = parsedPlan.plan.map((week) => {
        const updatedWorkouts = week.dailyWorkouts.map((workout) => {
          if (matched) return workout;
          if (workout.type === "REST" || workout.completed) return workout;
          const plannedDate = getScheduledDate(week.week, workout.day);
          const sameDate = plannedDate === run.date;
          const closeDistance = Math.abs((workout.distance ?? 0) - run.distance) <= 1;
          if (sameDate && closeDistance) {
            matched = true;
            return {
              ...workout,
              completed: true,
              startedAt: null,
              isPaused: false,
              elapsedBeforePauseSec: 0,
              actualDurationSec: parseTimeToSeconds(run.time) ?? undefined,
            };
          }
          return workout;
        });
        return { ...week, dailyWorkouts: updatedWorkouts };
      });

      if (!matched) return;
      await AsyncStorage.setItem(
        "trainingPlan",
        JSON.stringify({ ...parsedPlan, plan: updatedPlan }),
      );
    } catch (error) {
      console.error("Failed to sync run to training plan:", error);
    }
  };

  const addRun = () => {
    if (!newRun.distance || !newRun.time) {
      return;
    }

    const totalSeconds = parseTimeToSeconds(newRun.time);
    const distance = safeNumber(newRun.distance);
    if (!totalSeconds || totalSeconds <= 0 || !distance || distance <= 0) {
      return;
    }
    const totalMinutes = totalSeconds / 60;
    const pace = totalMinutes / distance;

    const run = {
      id: Date.now().toString(),
      date: newRun.date,
      distance,
      time: newRun.time,
      pace,
      notes: newRun.notes,
    };

    const updatedRuns = [run, ...runs].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
    saveRuns(updatedRuns);
    syncRunToPlan(run);

    setNewRun({
      date: new Date().toISOString().split("T")[0],
      distance: "",
      time: "",
      notes: "",
    });
    setShowAddModal(false);
  };

  const deleteRun = (id) => {
    const updatedRuns = runs.filter((r) => r.id !== id);
    saveRuns(updatedRuns);
  };

  const formatPace = (pace) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")} /km`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalDistance = runs.reduce((sum, r) => sum + r.distance, 0);
  const totalRuns = runs.length;
  const avgPace =
    totalRuns > 0 ? runs.reduce((sum, r) => sum + r.pace, 0) / totalRuns : 0;
  const suggestedGoalTime =
    totalRuns > 0 ? formatSecondsToHms(avgPace * 60 * 42.195) : null;

  const applySuggestedGoal = async () => {
    if (!suggestedGoalTime) return;
    try {
      const existing = await AsyncStorage.getItem("knack_race");
      const parsed = existing ? JSON.parse(existing) : {};
      const payload = {
        date: parsed.date || new Date().toISOString().split("T")[0],
        time: suggestedGoalTime,
      };
      await AsyncStorage.setItem("knack_race", JSON.stringify(payload));
      router.push("/(tabs)/race");
    } catch (error) {
      console.error("Failed to set suggested goal:", error);
    }
  };

  return (
    <AppShell title="History" subtitle="Run Log">
      <View style={{ marginBottom: 24 }}>
        <Pill
          label="Track Your Progress"
          icon={Activity}
          color={COLORS.statusLow}
          bgColor={COLORS.statusLowBg}
        />
      </View>

      {totalRuns > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalRuns}</Text>
            <Text style={styles.statLabel}>Total Runs</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalDistance.toFixed(1)} km</Text>
            <Text style={styles.statLabel}>Total Distance</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatPace(avgPace)}</Text>
            <Text style={styles.statLabel}>Avg Pace</Text>
          </View>
        </View>
      )}

      {suggestedGoalTime && (
        <View style={styles.suggestedCard}>
          <Text style={styles.suggestedLabel}>Suggested from your average pace</Text>
          <Text style={styles.suggestedValue}>{suggestedGoalTime}</Text>
          <Button title="Use as Race Goal" onPress={applySuggestedGoal} />
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text style={styles.sectionTitle}>Recent Runs</Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={styles.addButton}
        >
          <Plus size={20} color={COLORS.primary} />
          <Text style={styles.addButtonText}>Log Run</Text>
        </TouchableOpacity>
      </View>

      {runs.length === 0 ? (
        <View style={styles.emptyState}>
          <Activity size={48} color={COLORS.mutedForeground} />
          <Text style={styles.emptyText}>No runs logged yet</Text>
          <Text style={styles.emptySubtext}>
            Tap "Log Run" to record your first workout
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {runs.map((run) => (
            <View key={run.id} style={styles.runCard}>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <Calendar size={14} color={COLORS.mutedForeground} />
                  <Text style={styles.runDate}>{formatDate(run.date)}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View>
                    <Text style={styles.runMetric}>{run.distance} km</Text>
                    <Text style={styles.runMetricLabel}>Distance</Text>
                  </View>
                  <View>
                    <Text style={styles.runMetric}>{run.time}</Text>
                    <Text style={styles.runMetricLabel}>Time</Text>
                  </View>
                  <View>
                    <Text style={styles.runMetric}>{formatPace(run.pace)}</Text>
                    <Text style={styles.runMetricLabel}>Pace</Text>
                  </View>
                </View>
                {typeof run.notes === "string" &&
                  run.notes.startsWith("Auto-logged from Training Plan") && (
                    <Text style={styles.planTag}>From Training Plan</Text>
                  )}
                {run.notes && <Text style={styles.runNotes}>{run.notes}</Text>}
              </View>
              <TouchableOpacity
                onPress={() => deleteRun(run.id)}
                style={styles.deleteButton}
              >
                <X size={18} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log New Run</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color={COLORS.foreground} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 16 }}>
              <View>
                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.pickerValue}>{newRun.date}</Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={styles.inputLabel}>Distance (km)</Text>
                <TextInput
                  style={styles.input}
                  value={newRun.distance}
                  onChangeText={(text) =>
                    setNewRun({ ...newRun, distance: text })
                  }
                  placeholder="5.0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={COLORS.mutedForeground}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Time (HH:MM:SS)</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.pickerValue}>
                    {newRun.time || "Select time"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  value={newRun.notes}
                  onChangeText={(text) => setNewRun({ ...newRun, notes: text })}
                  placeholder="How did it feel?"
                  multiline
                  placeholderTextColor={COLORS.mutedForeground}
                />
              </View>

              <Button title="Save Run" onPress={addRun} />
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={new Date(newRun.date)}
                mode="date"
                display="default"
                onChange={(_, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setNewRun((prev) => ({
                      ...prev,
                      date: formatDateForInput(selectedDate),
                    }));
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={new Date()}
                mode="time"
                is24Hour
                display="default"
                onChange={(_, selectedTime) => {
                  setShowTimePicker(false);
                  if (selectedTime) {
                    const h = `${selectedTime.getHours()}`.padStart(2, "0");
                    const m = `${selectedTime.getMinutes()}`.padStart(2, "0");
                    setNewRun((prev) => ({ ...prev, time: `${h}:${m}:00` }));
                  }
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.foreground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.workspaceBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.workspaceBg,
  },
  addButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.foreground,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: "center",
  },
  runCard: {
    backgroundColor: COLORS.workspaceBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },
  runDate: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    fontWeight: "500",
  },
  runMetric: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.foreground,
  },
  runMetricLabel: {
    fontSize: 10,
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
    marginTop: 2,
  },
  runNotes: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 8,
    fontStyle: "italic",
  },
  planTag: {
    alignSelf: "flex-start",
    marginTop: 8,
    fontSize: 11,
    color: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontWeight: "600",
  },
  deleteButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.workspaceBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.foreground,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.foreground,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.canvasBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: COLORS.foreground,
    justifyContent: "center",
  },
  pickerValue: {
    fontSize: 14,
    color: COLORS.foreground,
  },
  suggestedCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 16,
    backgroundColor: COLORS.canvasBg,
    gap: 6,
  },
  suggestedLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    color: COLORS.mutedForeground,
    fontWeight: "500",
  },
  suggestedValue: {
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: "600",
  },
});
