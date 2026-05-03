import React, { useRef, useCallback, memo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  StatusBar,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  Shield,
  FileText,
  Star,
  Mail,
  Zap,
  RotateCcw,
  ChevronRight,
  ArrowUpRight,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";

/* -------------------- ROW -------------------- */
const SettingRow = memo(
  ({ icon: Icon, title, subtitle, onPress, isLast }) => {
    const handlePress = () => {
      Haptics.selectionAsync();
      onPress?.();
    };

    return (
      <>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.iconBox}>
            <Icon size={20} color="#6366F1" strokeWidth={2} />
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>

          <ChevronRight size={16} color="#CBD5E1" />
        </Pressable>

        {!isLast && <View style={styles.separator} />}
      </>
    );
  }
);

/* -------------------- SCREEN -------------------- */
const SettingsScreen = () => {
  const sheetRef = useRef(null);

  const openSheet = () => sheetRef.current?.present();
  const closeSheet = () => sheetRef.current?.dismiss();

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
      />
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

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

          <View style={styles.headerIcon}>
            <SettingsIcon size={20} color="#64748B" />
          </View>
        </View>

        {/* PREMIUM CARD */}
        <LinearGradient
          colors={["#0F172A", "#1E293B"]}
          style={styles.card}
        >
          <View style={styles.badge}>
            <Zap size={10} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.badgeText}>PRO</Text>
          </View>

          <Text style={styles.cardTitle}>Upgrade to Premium</Text>

          <Pressable style={styles.cta} onPress={openSheet}>
            <Text style={styles.ctaText}>View Plans</Text>
            <ArrowUpRight size={18} />
          </Pressable>
        </LinearGradient>

        {/* ACCOUNT */}
        <Text style={styles.section}>Account</Text>
        <View style={styles.box}>
          <SettingRow
            icon={RotateCcw}
            title="Restore Purchases"
            subtitle="Recover previous purchases"
            isLast
          />
        </View>

        {/* FEEDBACK */}
        <Text style={styles.section}>Feedback</Text>
        <View style={styles.box}>
          <SettingRow
            icon={Star}
            title="Rate Us"
            subtitle="Share your experience"
          />
          <SettingRow
            icon={Mail}
            title="Contact Us"
            subtitle="Support anytime"
            isLast
          />
        </View>

        {/* LEGAL */}
        <Text style={styles.section}>Legal</Text>
        <View style={styles.box}>
          <SettingRow icon={Shield} title="Privacy Policy" />
          <SettingRow icon={FileText} title="Terms of Use" isLast />
        </View>
      </ScrollView>

      {/* BOTTOM SHEET */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["45%"]}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.sheet}>
          <Text style={styles.sheetTitle}>Premium Plans</Text>

          <Pressable style={styles.sheetBtn} onPress={closeSheet}>
            <Text style={styles.sheetBtnText}>Close</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
};

/* -------------------- ROOT -------------------- */
export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <SettingsScreen />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

/* -------------------- STYLES -------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    alignItems: "center",
  },
  heading: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
  },
  version: {
    fontSize: 12,
    color: "#94A3B8",
  },
  headerIcon: {
    padding: 10,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  /* CARD */
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  badgeText: {
    color: "#F59E0B",
    marginLeft: 6,
    fontWeight: "800",
    fontSize: 11,
  },
  cardTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 15,
  },
  cta: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  ctaText: {
    fontWeight: "700",
    marginRight: 8,
  },

  /* SECTIONS */
  section: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 10,
  },
  box: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },

  /* ROW */
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  rowPressed: {
    backgroundColor: "#F1F5F9",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  textWrap: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  subtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 70,
  },

  /* SHEET */
  sheet: {
    padding: 24,
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 20,
  },
  sheetBtn: {
    backgroundColor: "#0F172A",
    padding: 14,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  sheetBtnText: {
    color: "#FFF",
    fontWeight: "700",
  },
});