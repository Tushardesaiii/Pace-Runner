/**
 * SettingsScreen — FAANG-grade minimal
 *
 * Dependencies (all Expo Go compatible):
 *   expo-linear-gradient
 *   react-native-safe-area-context
 *
 * No @gorhom/bottom-sheet, no lucide, no expo-haptics, no custom fonts.
 * Every effect uses core React Native Animated API only.
 */

import React, {
  useRef,
  memo,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  StatusBar,
  Modal,
  Animated,
  PanResponder,
  Platform,
  Dimensions,
  BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const { height: H, width: W } = Dimensions.get("window");

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
const T = {
  bg:          "#F2F2F7",
  surface:     "#FFFFFF",
  label:       "#000000",
  sub:         "#8E8E93",
  sep:         "#E5E5EA",
  accent:      "#6366F1",
  accentDeep:  "#4F46E5",
  amber:       "#F59E0B",
  dark:        "#0A0F1E",
  darkMid:     "#1B2E50",
  pressed:     "#F2F2F7",
  radius:      14,
  radiusLg:    20,
  radiusXl:    26,
};

/* ─────────────────────────────────────────────────────────
   SPRING PRESSABLE  — scale + opacity feedback
───────────────────────────────────────────────────────── */
const SpringPressable = ({ children, onPress, style, disabled }) => {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.965, useNativeDriver: true, tension: 300, friction: 20 }),
      Animated.timing(opacity, { toValue: 0.78,  useNativeDriver: true, duration: 80 }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,    useNativeDriver: true, tension: 300, friction: 20 }),
      Animated.timing(opacity, { toValue: 1,    useNativeDriver: true, duration: 120 }),
    ]).start();
  };

  return (
    <Pressable
      onPress={disabled ? null : onPress}
      onPressIn={disabled ? null : pressIn}
      onPressOut={disabled ? null : pressOut}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   CHEVRON  (pure RN)
───────────────────────────────────────────────────────── */
const Chevron = ({ color = "#C7C7CC" }) => (
  <View style={ch.wrap}>
    <View style={[ch.bar, ch.top,    { backgroundColor: color }]} />
    <View style={[ch.bar, ch.bottom, { backgroundColor: color }]} />
  </View>
);
const ch = StyleSheet.create({
  wrap:   { width: 8, height: 14, justifyContent: "center" },
  bar:    { position: "absolute", width: 8, height: 1.8, borderRadius: 2 },
  top:    { top: 3,    transform: [{ rotate: "40deg"  }] },
  bottom: { bottom: 3, transform: [{ rotate: "-40deg" }] },
});

/* ─────────────────────────────────────────────────────────
   CHECKMARK  (pure RN)
───────────────────────────────────────────────────────── */
const Check = () => (
  <View style={ck.wrap}>
    <View style={[ck.bar, ck.short]} />
    <View style={[ck.bar, ck.long ]} />
  </View>
);
const ck = StyleSheet.create({
  wrap:  { width: 18, height: 18, justifyContent: "center", alignItems: "center" },
  bar:   { position: "absolute", height: 2.2, backgroundColor: "#FFF", borderRadius: 2 },
  short: { width: 5,  bottom: 4, left: 2,  transform: [{ rotate: "45deg"  }] },
  long:  { width: 9,  bottom: 5, right: 1, transform: [{ rotate: "-50deg" }] },
});

/* ─────────────────────────────────────────────────────────
   SETTING ROW  — stagger-animated entry
───────────────────────────────────────────────────────── */
const SettingRow = memo(({ title, subtitle, onPress, isLast, delay = 0 }) => {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 120, friction: 14, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <SpringPressable onPress={onPress}>
        <View style={s.row}>
          <View style={s.textWrap}>
            <Text style={s.rowTitle}>{title}</Text>
            {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
          </View>
          <Chevron />
        </View>
      </SpringPressable>
      {!isLast && <View style={s.sep} />}
    </Animated.View>
  );
});

/* ─────────────────────────────────────────────────────────
   GROUP SECTION
───────────────────────────────────────────────────────── */
const Group = ({ label, rows }) => (
  <View style={{ marginBottom: 28 }}>
    <Text style={s.sectionLabel}>{label}</Text>
    <View style={s.group}>
      {rows.map((r, i) => (
        <SettingRow
          key={r.title}
          title={r.title}
          subtitle={r.subtitle}
          onPress={r.onPress}
          isLast={i === rows.length - 1}
          delay={i * 40}
        />
      ))}
    </View>
  </View>
);

/* ─────────────────────────────────────────────────────────
   PLAN CARD
───────────────────────────────────────────────────────── */
const PlanCard = ({ label, price, period, highlight, badge, selected, onPress }) => {
  const ring  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(ring,  { toValue: selected ? 1 : 0, tension: 200, friction: 18, useNativeDriver: false }),
      Animated.spring(scale, { toValue: selected ? 1.02 : 1, tension: 200, friction: 18, useNativeDriver: true }),
    ]).start();
  }, [selected]);

  const borderColor = ring.interpolate({ inputRange: [0,1], outputRange: ["transparent", T.accent] });

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          s.planCard,
          highlight && s.planDark,
          {
            transform: [{ scale }],
            borderColor,
            borderWidth: selected ? 2 : 0,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.planLabel, highlight && s.light]}>{label}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
            <Text style={[s.planPrice, highlight && s.light]}>{price}</Text>
            <Text style={[s.planPeriod, highlight && s.dimLight]}>{"  "}{period}</Text>
          </View>
        </View>

        {badge ? (
          <View style={s.planBadge}>
            <Text style={s.planBadgeText}>{badge}</Text>
          </View>
        ) : null}

        {selected ? (
          <View style={[s.planCheck, { backgroundColor: T.accent }]}>
            <Check />
          </View>
        ) : (
          <View style={[s.planCheck, s.planCheckEmpty, highlight && { borderColor: "rgba(255,255,255,0.25)" }]} />
        )}
      </Animated.View>
    </Pressable>
  );
};

/* ─────────────────────────────────────────────────────────
   PLANS BOTTOM SHEET
   — spring slide-up
   — swipe-down PanResponder to dismiss
   — Android BackHandler
───────────────────────────────────────────────────────── */
const PLANS = [
  { id: "monthly", label: "Monthly", price: "$4.99",  period: "/ month", highlight: false },
  { id: "annual",  label: "Annual",  price: "$39.99", period: "/ year",  highlight: true,  badge: "Best Value" },
];

const PlansSheet = ({ visible, onClose }) => {
  const insets       = useSafeAreaInsets();
  const [sel, setSel] = useState("annual");
  const slideY        = useRef(new Animated.Value(H)).current;
  const backdropOpac  = useRef(new Animated.Value(0)).current;

  /* Android back button */
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      animateOut();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(slideY,       { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
      Animated.timing(backdropOpac, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  };

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideY,       { toValue: H, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpac, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  }, [onClose]);

  /* Swipe-down to dismiss */
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          animateOut();
        } else {
          Animated.spring(slideY, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={animateIn}
      onRequestClose={animateOut}
    >
      {/* Backdrop */}
      <Animated.View
        style={[s.backdrop, { opacity: backdropOpac }]}
        pointerEvents="box-none"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={animateOut} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Drag zone */}
        <View {...pan.panHandlers} style={s.dragZone}>
          <View style={s.handle} />
        </View>

        <Text style={s.sheetTitle}>Choose a Plan</Text>
        <Text style={s.sheetSub}>Cancel anytime · No hidden fees</Text>

        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            {...p}
            selected={sel === p.id}
            onPress={() => setSel(p.id)}
          />
        ))}

        {/* CTA */}
        <SpringPressable onPress={animateOut} style={{ marginTop: 14 }}>
          <LinearGradient
            colors={[T.accent, T.accentDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGrad}
          >
            <Text style={s.ctaText}>Continue with {PLANS.find(p => p.id === sel)?.label}</Text>
          </LinearGradient>
        </SpringPressable>

        <Pressable style={s.sheetClose} onPress={animateOut}>
          <Text style={s.sheetCloseText}>Maybe Later</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

/* ─────────────────────────────────────────────────────────
   SCROLL-AWARE HEADER
───────────────────────────────────────────────────────── */
const Header = ({ scrollY, onSettings }) => {
  const titleSize = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [32, 22],
    extrapolate: "clamp",
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0.85],
    extrapolate: "clamp",
  });

  return (
    <View style={s.header}>
      <View>
        <Animated.Text style={[s.heading, { fontSize: titleSize, opacity: titleOpacity }]}>
          Settings
        </Animated.Text>
        <Text style={s.version}>Version 4.0.2</Text>
      </View>
      <SpringPressable onPress={onSettings}>
        <View style={s.headerBtn}>
          {/* Hamburger-dots icon — pure RN */}
          <View style={s.dot} />
          <View style={s.dot} />
          <View style={s.dot} />
        </View>
      </SpringPressable>
    </View>
  );
};

/* ─────────────────────────────────────────────────────────
   PREMIUM CARD
───────────────────────────────────────────────────────── */
const PremiumCard = ({ onPress }) => {
  const shimmer = useRef(new Animated.Value(-W)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: W * 2, duration: 2800, useNativeDriver: true, delay: 800 })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <LinearGradient
      colors={["#0A0F1E", "#1B2E50"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.card}
    >
      {/* Glow orb */}
      <View style={s.cardOrb} />

      {/* Shimmer sweep */}
      <Animated.View
        style={[s.shimmer, { transform: [{ translateX: shimmer }] }]}
        pointerEvents="none"
      />

      <View style={s.proBadge}>
        <Text style={s.proBadgeText}>⚡  PRO</Text>
      </View>

      <Text style={s.cardTitle}>Upgrade to Premium</Text>
      <Text style={s.cardSub}>Unlock everything. Cancel anytime.</Text>

      <SpringPressable onPress={onPress}>
        <LinearGradient
          colors={[T.accent, T.accentDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.cardCTA}
        >
          <Text style={s.cardCTAText}>View Plans</Text>
          {/* Arrow */}
          <View style={s.arrow}>
            <View style={s.arrowLine} />
            <View style={[s.arrowTip, s.arrowTipTop]} />
            <View style={[s.arrowTip, s.arrowTipBot]} />
          </View>
        </LinearGradient>
      </SpringPressable>
    </LinearGradient>
  );
};

/* ─────────────────────────────────────────────────────────
   SETTINGS SCREEN
───────────────────────────────────────────────────────── */
const SettingsScreen = () => {
  const [sheetVisible, setSheetVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const ROWS = {
    ACCOUNT: [
      { title: "Restore Purchases", subtitle: "Recover your previous purchases" },
    ],
    FEEDBACK: [
      { title: "Rate Us",          subtitle: "Share your experience"  },
      { title: "Contact Support",  subtitle: "We're here to help"     },
    ],
    LEGAL: [
      { title: "Privacy Policy" },
      { title: "Terms of Use"   },
    ],
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <Header scrollY={scrollY} onSettings={() => {}} />
        <PremiumCard onPress={() => setSheetVisible(true)} />

        {Object.entries(ROWS).map(([label, rows]) => (
          <Group key={label} label={label} rows={rows} />
        ))}

        <Text style={s.footer}>{"Made with \u2764\uFE0F  \u00B7  v4.0.2"}</Text>
      </Animated.ScrollView>

      <PlansSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </SafeAreaView>
  );
};

/* ─────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────── */
export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsScreen />
    </SafeAreaProvider>
  );
}

/* ─────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content:   { paddingHorizontal: 20, paddingBottom: 56 },

  /* HEADER */
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", paddingTop: 10, marginBottom: 24,
  },
  heading: { fontWeight: "700", color: T.label, letterSpacing: -0.6 },
  version: { fontSize: 12, color: T.sub, marginTop: 3 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.surface,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: {width:0,height:1}, shadowOpacity:0.07, shadowRadius:4 },
      android: { elevation: 2 },
    }),
  },
  dot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: T.sub, marginVertical: 1.5,
  },

  /* PREMIUM CARD */
  card: { borderRadius: T.radiusLg, padding: 24, marginBottom: 32, overflow: "hidden" },
  cardOrb: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(99,102,241,0.14)", right: -60, top: -60,
  },
  shimmer: {
    position: "absolute", top: 0, bottom: 0, width: 80,
    backgroundColor: "rgba(255,255,255,0.05)",
    transform: [{ skewX: "-20deg" }],
  },
  proBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1, borderColor: "rgba(245,158,11,0.4)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 14,
  },
  proBadgeText: { color: T.amber, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  cardTitle: { color: "#FFF", fontSize: 21, fontWeight: "700", marginBottom: 5, letterSpacing: -0.3 },
  cardSub:   { color: "rgba(255,255,255,0.48)", fontSize: 13, marginBottom: 20, lineHeight: 19 },
  cardCTA: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 50,
  },
  cardCTAText: { color: "#FFF", fontSize: 14, fontWeight: "700", letterSpacing: 0.1, marginRight: 8 },

  /* Arrow icon — pure RN */
  arrow: { width: 14, height: 14, justifyContent: "center", alignItems: "center" },
  arrowLine: {
    position: "absolute", width: 10, height: 1.8,
    backgroundColor: "#FFF", borderRadius: 1, right: 0,
  },
  arrowTip: {
    position: "absolute", width: 6, height: 1.8,
    backgroundColor: "#FFF", borderRadius: 1, right: 0,
  },
  arrowTipTop: { top: 3,    transform: [{ rotate: "-40deg" }], transformOrigin: "right" },
  arrowTipBot: { bottom: 3, transform: [{ rotate: "40deg"  }], transformOrigin: "right" },

  /* SECTION LABEL */
  sectionLabel: {
    fontSize: 11, fontWeight: "600", color: T.sub,
    letterSpacing: 0.9, marginBottom: 8, marginLeft: 6,
  },

  /* GROUP */
  group: {
    backgroundColor: T.surface, borderRadius: T.radius, overflow: "hidden",
    ...Platform.select({
      ios:     { shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4 },
      android: { elevation: 1 },
    }),
  },

  /* ROW */
  row:      { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 18 },
  textWrap: { flex: 1 },
  rowTitle: { fontSize: 16, color: T.label, fontWeight: "400" },
  rowSub:   { fontSize: 12, color: T.sub,   marginTop: 2 },
  sep:      { height: StyleSheet.hairlineWidth, backgroundColor: T.sep, marginLeft: 18 },

  /* FOOTER */
  footer: { textAlign: "center", fontSize: 12, color: "#C7C7CC", marginTop: 8 },

  /* BACKDROP */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  /* SHEET */
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: T.surface,
    borderTopLeftRadius: T.radiusXl, borderTopRightRadius: T.radiusXl,
    paddingHorizontal: 22, paddingTop: 0,
    ...Platform.select({
      ios:     { shadowColor:"#000", shadowOffset:{width:0,height:-4}, shadowOpacity:0.1, shadowRadius:16 },
      android: { elevation: 24 },
    }),
  },
  dragZone:   { paddingVertical: 14, alignItems: "center" },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0" },
  sheetTitle: { fontSize: 22, fontWeight: "700", color: T.label, letterSpacing: -0.4, marginBottom: 4 },
  sheetSub:   { fontSize: 14, color: T.sub, marginBottom: 18 },

  /* PLAN CARDS */
  planCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F2F2F7", borderRadius: T.radius,
    padding: 16, marginBottom: 10, borderWidth: 0,
  },
  planDark:    { backgroundColor: T.dark },
  planLabel:   { fontSize: 15, fontWeight: "600", color: T.label },
  light:       { color: "#FFF" },
  dimLight:    { color: "rgba(255,255,255,0.48)" },
  planPrice:   { fontSize: 20, fontWeight: "700", color: T.label },
  planPeriod:  { fontSize: 13, color: T.sub },
  planBadge: {
    backgroundColor: T.amber,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginRight: 10,
  },
  planBadgeText: { fontSize: 11, fontWeight: "700", color: "#FFF" },
  planCheck: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: "center", alignItems: "center",
  },
  planCheckEmpty: {
    borderWidth: 1.5, borderColor: "#C7C7CC",
    backgroundColor: "transparent",
  },

  /* CTA */
  ctaGrad: { paddingVertical: 16, borderRadius: T.radius, alignItems: "center" },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.1 },

  sheetClose:     { alignItems: "center", paddingVertical: 16 },
  sheetCloseText: { fontSize: 15, color: T.sub },
});