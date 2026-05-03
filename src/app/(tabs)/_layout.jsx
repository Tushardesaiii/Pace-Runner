/**
 * app/(tabs)/_layout.tsx  —  Tab Layout
 *
 * KEY FIXES vs original:
 *
 * 1. REMOVED font loading + SplashScreen from here entirely.
 *    Both are handled in root _layout.tsx. Having them here too
 *    caused a double-load race condition → lag → multi-press needed.
 *
 * 2. REMOVED the null return guard. Since fonts/splash are root's
 *    responsibility, this component always renders immediately.
 *    The old null return was causing the tab bar to unmount and
 *    remount, resetting navigation state.
 *
 * 3. CUSTOM TAB BAR with native feel:
 *    - Animated scale + opacity on each tab press (instant feedback)
 *    - Active indicator pill under active tab
 *    - No label (icon-only is cleaner and faster to parse)
 *    - Hit slop expanded so taps register on first press
 *    - Platform-aware safe area padding (iOS home indicator)
 *
 * 4. PERFORMANCE:
 *    - lazy={true} — screens mount only when first visited
 *    - detachInactiveScreens={true} — inactive screens unmount from GPU
 *    - freezeOnBlur={true} — inactive screens stop rendering
 */

import { useCallback, useRef } from "react";
import { Tabs } from "expo-router";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Calculator,
  Calendar,
  Trophy,
  Activity,
  Settings,
} from "lucide-react-native";

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
const C = {
  active:   "#0F172A",
  inactive: "#94A3B8",
  bg:       "#FFFFFF",
  pill:     "#F1F5F9",
  border:   "#F1F5F9",
  label:    "#0F172A",
};

const TABS = [
  { name: "index",    label: "Calc",     Icon: Calculator },
  { name: "plan",     label: "Plan",     Icon: Calendar   },
  { name: "history",  label: "History",  Icon: Activity   },
  { name: "race",     label: "Race",     Icon: Trophy     },
  { name: "settings", label: "Settings", Icon: Settings   },
];

/* ─────────────────────────────────────────────────────────
   SINGLE TAB BUTTON
   — spring scale feedback on press
   — active pill indicator
   — large hit area so first tap always registers
───────────────────────────────────────────────────────── */
const TabButton = ({ label, Icon, isFocused, onPress, onLongPress }) => {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.88,
        tension: 300,
        friction: 18,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.7,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 300,
        friction: 18,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabBtn}
      // Large hit slop — key fix for "need to press twice"
      hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
      android_ripple={null} // disable ripple — we do our own feedback
    >
      <Animated.View
        style={[
          styles.tabInner,
          { transform: [{ scale }], opacity },
        ]}
      >
        {/* Active pill background */}
        {isFocused && <View style={styles.activePill} />}

        <Icon
          size={22}
          strokeWidth={isFocused ? 2.2 : 1.8}
          color={isFocused ? C.active : C.inactive}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? C.active : C.inactive },
            isFocused && styles.tabLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   CUSTOM TAB BAR
───────────────────────────────────────────────────────── */
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Platform.OS === "ios"
            ? Math.max(insets.bottom, 8)  // respect home indicator
            : 10,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused   = state.index === index;
        const tab         = TABS.find((t) => t.name === route.name);

        if (!tab) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            // navigate without resetting the stack if already on tab
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: route.key });
        };

        return (
          <TabButton
            key={route.key}
            label={tab.label}
            Icon={tab.Icon}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
};

/* ─────────────────────────────────────────────────────────
   TAB LAYOUT
───────────────────────────────────────────────────────── */
export default function TabLayout() {
  return (
    <Tabs
      // Performance flags
      screenOptions={{
        headerShown: false,
        // These three kill the most common source of tab lag:
        lazy: true,                  // don't mount screens until visited
        freezeOnBlur: true,          // pause rendering on inactive screens
        detachInactiveScreens: true, // remove inactive screens from GPU layer
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.label }}
        />
      ))}
    </Tabs>
  );
}

/* ─────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* TAB BAR */
  bar: {
    flexDirection:   "row",
    backgroundColor: C.bg,
    borderTopWidth:  1,
    borderTopColor:  C.border,
    paddingTop:      8,
    // Soft shadow above bar (iOS)
    ...Platform.select({
      ios: {
        shadowColor:   "#000",
        shadowOffset:  { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius:  8,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  /* EACH TAB BUTTON */
  tabBtn: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
  },
  tabInner: {
    alignItems:     "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius:   12,
    minWidth:       52,
    position:       "relative",
  },

  /* ACTIVE PILL */
  activePill: {
    position:     "absolute",
    top:          0,
    left:         0,
    right:        0,
    bottom:       0,
    borderRadius: 12,
    backgroundColor: C.pill,
  },

  /* LABELS */
  tabLabel: {
    fontSize:    10,
    marginTop:   3,
    fontFamily:  "Poppins-Medium",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontFamily: "Poppins-SemiBold",
  },
});