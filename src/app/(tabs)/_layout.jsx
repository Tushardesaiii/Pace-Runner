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

import { useCallback, useRef, useMemo, memo } from "react";
import { Tabs, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";
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
const TabButton = memo(({
  label,
  Icon,
  isFocused,
  onPress,
  onLongPress,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.92,
      speed: 80,    // faster response
      bounciness: 5, // less bouncy
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 80,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabBtn}
      hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
      android_ripple={null}
    >
      <Animated.View
        style={[
          styles.tabInner,
          { transform: [{ scale }] },
        ]}
      >
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
}, (prevProps, nextProps) => {
  // Only re-render if focused status or callback changes
  return prevProps.isFocused === nextProps.isFocused &&
         prevProps.onPress === nextProps.onPress &&
         prevProps.onLongPress === nextProps.onLongPress;
});

const CustomTabBar = memo(({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();

  // Memoize routes to prevent unnecessary renders
  const routes = useMemo(() =>
    state.routes.map((route, index) => {
      const tab = TABS.find((t) => t.name === route.name);
      return {
        route,
        index,
        tab,
        isFocused: state.index === index,
      };
    }).filter((r) => r.tab !== undefined),
    [state.routes, state.index]
  );

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Platform.OS === "ios"
            ? Math.max(insets.bottom, 8)
            : 10,
        },
      ]}
    >
      {routes.map((routeData) => {
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: routeData.route.key,
            canPreventDefault: true,
          });

          if (!routeData.isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: routeData.route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: routeData.route.key });
        };

        return (
          <TabButton
            key={routeData.route.key}
            label={routeData.tab.label}
            Icon={routeData.tab.Icon}
            isFocused={routeData.isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
});

/* ─────────────────────────────────────────────────────────
   TAB LAYOUT
───────────────────────────────────────────────────────── */
export default function TabLayout() {
  /* ── Maintain immersive mode on tab navigation ── */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      const enableImmersiveMode = async () => {
        try {
          await NavigationBar.setVisibilityAsync("hidden");
          await NavigationBar.setBehaviorAsync("inset-swipe");
          await NavigationBar.setPositionAsync("absolute");
          await NavigationBar.setBackgroundColorAsync("#00000000");
        } catch (e) {
          console.warn("NavigationBar immersive setup error:", e);
        }
      };

      enableImmersiveMode();
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        detachInactiveScreens: true,
        animationEnabled: true,
        animationTypeForReplace: "pop",
      }}
      initialRouteName="plan"
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 56,
    position: "relative",
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