import React from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const COLORS = {
  canvasBg: "#F8FAFC",
  workspaceBg: "#FFFFFF",
  foreground: "#020617",
  mutedForeground: "#64748B",
  primary: "#0F172A",
  primaryHover: "#1E293B",
  primaryMuted: "#F1F5F9",
  border: "#E2E8F0",
  borderStrong: "#0F172A",
  statusLow: "#065F46",
  statusLowBg: "#D1FAE5",
  statusMedium: "#92400E",
  statusMediumBg: "#FEF3C7",
  statusHigh: "#991B1B",
  statusHighBg: "#FEE2E2",
};

export const AppShell = ({ children, title, subtitle }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvasBg }}>
      <View
        style={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={[styles.workspace, { paddingBottom: 0 }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom }}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
};

export const Pill = ({
  label,
  color = COLORS.primary,
  bgColor = COLORS.primaryMuted,
  icon: Icon,
}) => (
  <View style={[styles.pill, { backgroundColor: bgColor }]}>
    {Icon && <Icon size={14} color={color} style={{ marginRight: 6 }} />}
    <Text style={[styles.pillText, { color }]}>{label}</Text>
  </View>
);

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.mutedForeground}
      keyboardType={keyboardType}
    />
  </View>
);

export const Button = ({ title, onPress, type = "primary" }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.button,
      type === "primary" ? styles.buttonPrimary : styles.buttonSecondary,
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        type === "primary"
          ? styles.buttonTextPrimary
          : styles.buttonTextSecondary,
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontWeight: "400",
    fontFamily: "Poppins-Regular",
    color: COLORS.foreground,
    letterSpacing: -0.64,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Poppins-Medium",
    color: COLORS.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.24,
    marginBottom: 4,
  },
  workspace: {
    flex: 1,
    backgroundColor: COLORS.workspaceBg,
    borderTopLeftRadius: 16,
    borderLeftWidth: 1,
    borderColor: COLORS.border,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Poppins-Medium",
    letterSpacing: 0.24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "Poppins-Regular",
    color: COLORS.mutedForeground,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
    color: COLORS.foreground,
  },
  button: {
    height: 48,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: COLORS.canvasBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Poppins-Medium",
  },
  buttonTextPrimary: {
    color: "#FFFFFF",
  },
  buttonTextSecondary: {
    color: COLORS.primary,
  },
});
