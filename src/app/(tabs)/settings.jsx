import React, { useRef, useCallback, memo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  StatusBar,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/* ─────────────────────────────────────────────
   CHEVRON  (pure RN – no lucide dependency)
───────────────────────────────────────────── */
const Chevron = () => (
  <View style={chevronStyles.wrap}>
    <View style={[chevronStyles.bar, chevronStyles.top]} />
    <View style={[chevronStyles.bar, chevronStyles.bottom]} />
  </View>
);
const chevronStyles = StyleSheet.create({
  wrap: { width: 8, height: 14, justifyContent: "center" },
  bar: {
    position: "absolute",
    width: 8,
    height: 1.8,
    backgroundColor: "#C7C7CC",
    borderRadius: 2,
  },
  top: { top: 3, transform: [{ rotate: "40deg" }] },
  bottom: { bottom: 3, transform: [{ rotate: "-40deg" }] },
});

/* ─────────────────────────────────────────────
   SETTING ROW
───────────────────────────────────────────── */
const SettingRow = memo(({ title, subtitle, onPress, isLast }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.textWrap}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
        <Chevron />
      </Pressable>
      {!isLast && <View style={styles.separator} />}
    </>
  );
});

/* ─────────────────────────────────────────────
   PLAN BOTTOM SHEET  (pure Modal – no deps)
───────────────────────────────────────────── */
const PLANS = [
  { id: "monthly", label: "Monthly", price: "$4.99", period: "/ month", highlight: false },
  { id: "annual",  label: "Annual",  price: "$39.99", period: "/ year", highlight: true, badge: "Best Value" },
];

const PlansSheet = ({ visible, onClose }) => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  const onShow = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 68,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={onShow}
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Handle bar */}
        <View style={styles.sheetHandle} />

        <Text style={styles.sheetTitle}>Choose a Plan</Text>
        <Text style={styles.sheetSub}>Cancel anytime. No hidden fees.</Text>

        {PLANS.map((plan) => (
          <Pressable
            key={plan.id}
            style={({ pressed }) => [
              styles.planCard,
              plan.highlight && styles.planHighlight,
              pressed && styles.planPressed,
            ]}
          >
            <View>
              <Text
                style={[
                  styles.planLabel,
                  plan.highlight && styles.planTextLight,
                ]}
              >
                {plan.label}
              </Text>
              <View style={styles.planPriceRow}>
                <Text
                  style={[
                    styles.planPrice,
                    plan.highlight && styles.planTextLight,
                  ]}
                >
                  {plan.price}
                </Text>
                <Text
                  style={[
                    styles.planPeriod,
                    plan.highlight && styles.planPeriodLight,
                  ]}
                >
                  {"  "}{plan.period}
                </Text>
              </View>
            </View>
            {plan.badge ? (
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}

        <Pressable style={styles.sheetCTA}>
          <LinearGradient
            colors={["#0F172A", "#1E3A5F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sheetCTAGrad}
          >
            <Text style={styles.sheetCTAText}>Get Premium</Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.sheetClose} onPress={handleClose}>
          <Text style={styles.sheetCloseText}>Maybe Later</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

/* ─────────────────────────────────────────────
   SETTINGS SCREEN
───────────────────────────────────────────── */
const SettingsScreen = () => {
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.heading}>Settings</Text>
            <Text style={styles.version}>Version 4.0.2</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>⚙</Text>
          </View>
        </View>

        {/* PREMIUM CARD */}
        <LinearGradient
          colors={["#0A0F1E", "#1E3A5F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.cardOrb} />

          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>{"⚡ PRO"}</Text>
          </View>

          <Text style={styles.cardTitle}>Upgrade to Premium</Text>
          <Text style={styles.cardSub}>
            Unlock all features and remove limits
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.cardCTA,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setSheetVisible(true)}
          >
            <Text style={styles.cardCTAText}>{"View Plans  \u2192"}</Text>
          </Pressable>
        </LinearGradient>

        {/* ACCOUNT */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.group}>
          <SettingRow
            title="Restore Purchases"
            subtitle="Recover your previous purchases"
            isLast
          />
        </View>

        {/* FEEDBACK */}
        <Text style={styles.sectionLabel}>FEEDBACK</Text>
        <View style={styles.group}>
          <SettingRow title="Rate Us" subtitle="Share your experience" />
          <SettingRow
            title="Contact Support"
            subtitle="We're here to help"
            isLast
          />
        </View>

        {/* LEGAL */}
        <Text style={styles.sectionLabel}>LEGAL</Text>
        <View style={styles.group}>
          <SettingRow title="Privacy Policy" />
          <SettingRow title="Terms of Use" isLast />
        </View>

        <Text style={styles.footer}>{"Made with \u2764\uFE0F  \u00B7  v4.0.2"}</Text>
      </ScrollView>

      <PlansSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
};

/* ─────────────────────────────────────────────
   ROOT
───────────────────────────────────────────── */
export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsScreen />
    </SafeAreaProvider>
  );
}

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    marginBottom: 22,
  },
  heading: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.6,
  },
  version: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadgeText: {
    fontSize: 18,
  },

  /* PREMIUM CARD */
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    overflow: "hidden",
  },
  cardOrb: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(99,102,241,0.15)",
    right: -40,
    top: -40,
  },
  proBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  proBadgeText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: "#FFF",
    fontSize: 21,
    fontWeight: "700",
    marginBottom: 5,
    letterSpacing: -0.3,
  },
  cardSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 19,
  },
  cardCTA: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 50,
  },
  cardCTAText: {
    color: "#0A0F1E",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  /* SECTION LABEL */
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.9,
    marginBottom: 8,
    marginLeft: 6,
  },

  /* GROUP */
  group: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    marginBottom: 28,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },

  /* ROW */
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  rowPressed: {
    backgroundColor: "#F2F2F7",
  },
  textWrap: { flex: 1 },
  rowTitle: {
    fontSize: 16,
    color: "#000",
    fontWeight: "400",
  },
  rowSub: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5EA",
    marginLeft: 18,
  },

  /* FOOTER */
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 4,
  },

  /* BACKDROP */
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  /* SHEET */
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 20 },
    }),
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E5EA",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 20,
  },

  /* PLAN CARDS */
  planCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  planHighlight: {
    backgroundColor: "#0A0F1E",
  },
  planPressed: { opacity: 0.85 },
  planLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  planTextLight: { color: "#FFF" },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 3 },
  planPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  planPeriod: {
    fontSize: 13,
    color: "#8E8E93",
  },
  planPeriodLight: { color: "rgba(255,255,255,0.55)" },
  planBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },

  /* SHEET CTA */
  sheetCTA: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 4,
  },
  sheetCTAGrad: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
  },
  sheetCTAText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sheetClose: {
    alignItems: "center",
    paddingVertical: 14,
  },
  sheetCloseText: {
    fontSize: 15,
    color: "#8E8E93",
  },
});