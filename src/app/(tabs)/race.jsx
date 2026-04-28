import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppShell, COLORS, Pill } from "../../components/DesignSystem";
import { Trophy, Timer } from "lucide-react-native";
import { differenceInDays, differenceInWeeks, parseISO } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseTimeToSeconds, formatDateForInput } from "../../utils/runMath";

export default function RaceScreen() {
  const [raceDate, setRaceDate] = useState("2026-10-18");
  const [goalTime, setGoalTime] = useState("04:00:00");
  const [countdown, setCountdown] = useState({ days: 0, weeks: 0 });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const saved = await AsyncStorage.getItem("knack_race");
      if (saved) {
        const { date, time } = JSON.parse(saved);
        setRaceDate(date);
        setGoalTime(time);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      "knack_race",
      JSON.stringify({ date: raceDate, time: goalTime }),
    );
  }, [raceDate, goalTime]);

  useEffect(() => {
    try {
      const date = parseISO(raceDate);
      const today = new Date();
      const days = differenceInDays(date, today);
      const weeks = differenceInWeeks(date, today);
      setCountdown({ days: Math.max(0, days), weeks: Math.max(0, weeks) });
    } catch (e) {
      // Invalid date
    }
  }, [raceDate]);

  const calculateSplits = () => {
    const totalSeconds = parseTimeToSeconds(goalTime);
    if (!totalSeconds || totalSeconds <= 0) return [];
    const pacePerKm = totalSeconds / 42.195;

    const splits = [];
    for (let i = 5; i <= 40; i += 5) {
      const splitSeconds = pacePerKm * i;
      const sh = Math.floor(splitSeconds / 3600);
      const sm = Math.floor((splitSeconds % 3600) / 60);
      const ss = Math.round(splitSeconds % 60);
      splits.push({
        km: i,
        time: `${sh > 0 ? sh + ":" : ""}${sm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`,
      });
    }
    // Add final marathon split
    const fh = Math.floor(totalSeconds / 3600);
    const fm = Math.floor((totalSeconds % 3600) / 60);
    const fs = Math.round(totalSeconds % 60);
    splits.push({
      km: 42.2,
      time: `${fh}:${fm.toString().padStart(2, "0")}:${fs.toString().padStart(2, "0")}`,
    });

    return splits;
  };

  const splits = calculateSplits();

  const parsedRaceDate = (() => {
    const d = parseISO(raceDate);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  })();

  const parsedGoalTime = (() => {
    const secs = parseTimeToSeconds(goalTime);
    if (!secs || secs < 0) return new Date();
    const d = new Date();
    d.setHours(Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60, 0);
    return d;
  })();

  return (
    <AppShell title="Race Day" subtitle="Goal Tracking">
      <View style={{ marginBottom: 24 }}>
        <Pill
          label="Final Countdown"
          icon={Trophy}
          color={COLORS.statusHigh}
          bgColor={COLORS.statusHighBg}
        />
      </View>

      <View style={styles.countdownCard}>
        <View style={styles.countdownItem}>
          <Text style={styles.countdownValue}>{countdown.weeks}</Text>
          <Text style={styles.countdownLabel}>Weeks</Text>
        </View>
        <View style={styles.countdownDivider} />
        <View style={styles.countdownItem}>
          <Text style={styles.countdownValue}>{countdown.days}</Text>
          <Text style={styles.countdownLabel}>Days Left</Text>
        </View>
      </View>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Text style={styles.inputLabel}>Race Date</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.pickerButtonText}>{raceDate}</Text>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Goal Finish Time</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.pickerButtonText}>{goalTime}</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={parsedRaceDate}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setRaceDate(formatDateForInput(selectedDate));
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={parsedGoalTime}
          mode="time"
          is24Hour
          display="default"
          onChange={(_, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) {
              const h = `${selectedTime.getHours()}`.padStart(2, "0");
              const m = `${selectedTime.getMinutes()}`.padStart(2, "0");
              setGoalTime(`${h}:${m}:00`);
            }
          }}
        />
      )}

      <View style={styles.splitsContainer}>
        <View style={styles.splitsHeader}>
          <Timer size={16} color={COLORS.mutedForeground} />
          <Text style={styles.splitsTitle}>Kilometer Splits</Text>
        </View>

        {splits.map((s) => (
          <View key={s.km} style={styles.splitRow}>
            <Text style={styles.splitKm}>{s.km} km</Text>
            <Text style={styles.splitTime}>{s.time}</Text>
          </View>
        ))}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  countdownCard: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
    justifyContent: "space-around",
  },
  countdownItem: {
    alignItems: "center",
  },
  countdownValue: {
    fontSize: 32,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  countdownLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    marginTop: 4,
  },
  countdownDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  splitsContainer: {
    marginTop: 32,
    backgroundColor: COLORS.workspaceBg,
  },
  splitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  splitsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  splitKm: {
    fontSize: 16,
    color: COLORS.mutedForeground,
  },
  splitTime: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.foreground,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.mutedForeground,
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
});
