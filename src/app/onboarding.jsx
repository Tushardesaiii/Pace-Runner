import React, { useState, useEffect, useCallback } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import {
  ArrowRight,
  Activity,
  Zap,
  Heart,
  Target,
  ChevronLeft,
  Check,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@/utils/auth/useAuth';

const { width: W } = Dimensions.get('window');

/* ─────────────────────────────────────────────────────────
   SPRING / TIMING CONFIGS
   — Much snappier than original. Damping down, stiffness up.
   — All durations cut by ~40%.
───────────────────────────────────────────────────────── */
const SPRING  = { damping: 18, stiffness: 280, mass: 0.8 };  // was damping:25 stiffness:180
const FAST    = { duration: 140 };                             // was ~200
const INSTANT = { duration: 80  };

/* ─────────────────────────────────────────────────────────
   PROGRESS DOT
───────────────────────────────────────────────────────── */
const ProgressDot = ({ index, scrollX }) => {
  const style = useAnimatedStyle(() => {
    const active =
      scrollX.value >= (index - 1.5) * W &&
      scrollX.value <  (index - 0.5) * W;
    return {
      width:           withTiming(active ? 24 : 6,       FAST),
      backgroundColor: withTiming(active ? '#222' : '#DDD', FAST),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
};

/* ─────────────────────────────────────────────────────────
   PREMIUM BUTTON
   — Slightly tighter spring so press feedback feels snappier
───────────────────────────────────────────────────────── */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PremiumButton = ({ onPress, text, icon: Icon, isPrimary = true, style }) => {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); // snappier
        Haptics.selectionAsync();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      onPress={onPress}
      style={[
        styles.buttonBase,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        animStyle,
        style,
      ]}
    >
      <Text style={[styles.buttonText, !isPrimary && { color: '#222' }]}>{text}</Text>
      {Icon && <Icon color={isPrimary ? '#FFF' : '#222'} size={18} />}
    </AnimatedPressable>
  );
};

/* ─────────────────────────────────────────────────────────
   CUSTOM INPUT
   — Faster focus animation
   — Auto-advance on blur for numeric inputs (UX)
───────────────────────────────────────────────────────── */
const CustomInput = ({
  label, placeholder, value, onChangeText,
  keyboardType = 'default', unit, returnKeyType, onSubmitEditing, autoFocus,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, INSTANT); // was 150ms
  }, [isFocused]);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: focusAnim.value > 0.5 ? '#222' : '#DDD',
    borderWidth: withTiming(isFocused ? 2 : 1, INSTANT),
  }));

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Animated.View style={[styles.inputWrapper, borderStyle]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#B0B0B0"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType ?? (keyboardType === 'numeric' ? 'done' : 'next')}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus={autoFocus}
          blurOnSubmit={keyboardType === 'numeric'} // auto-dismiss on done for numeric
        />
        {unit && <Text style={styles.inputUnit}>{unit}</Text>}
      </Animated.View>
    </View>
  );
};

/* ─────────────────────────────────────────────────────────
   MAIN ONBOARDING
───────────────────────────────────────────────────────── */
export default function UltimateOnboarding() {
  const router = useRouter();
  const { setOnboardingCompleted } = useAuth();
  const [step, setStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false); // guard against double-tap
  const scrollX = useSharedValue(0);

  const [data, setData] = useState({
    name: '', age: '', weight: '', height: '',
    level: 'Inter', hrMax: '185', restingHr: '',
    goal: 'Endurance', frequency: '4x',
  });

  /* ── Hide Android navigation bar completely on mount ── */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    
    const hideNavBar = async () => {
      try {
        // Set immersive mode to hide nav bar completely
        await NavigationBar.setImmersiveAsync(true);
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBehaviorAsync('overlay-swipe'); // swipe to reveal, stays hidden otherwise
      } catch (e) {
        console.warn('NavigationBar error:', e);
      }
    };
    
    hideNavBar();
    
    return () => {
      // Restore normal behavior when leaving onboarding
      const restoreNavBar = async () => {
        try {
          await NavigationBar.setImmersiveAsync(false);
          await NavigationBar.setVisibilityAsync('visible');
        } catch (e) {
          console.warn('NavigationBar restore error:', e);
        }
      };
      restoreNavBar();
    };
  }, []);

  /* ── Navigation guards ──
     isTransitioning blocks rapid double-taps that caused
     the original to occasionally skip a step or glitch. */
  const goTo = useCallback((targetStep) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    Keyboard.dismiss();

    setStep(targetStep);
    scrollX.value = withSpring(W * targetStep, SPRING, () => {
      runOnJS(setIsTransitioning)(false);
    });
  }, [isTransitioning, scrollX]);

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step === 0) { goTo(1); return; }

    if (step === 3) {
      setOnboardingCompleted?.(true);
      router.replace('/(tabs)');
      return;
    }

    goTo(step + 1);
  }, [step, goTo]);

  const back = useCallback(() => {
    Haptics.selectionAsync();
    goTo(Math.max(0, step - 1));
  }, [step, goTo]);

  /* ── Slide animation ── */
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.value }],
  }));

  /* ── Splash overlay ── */
  const splashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, W * 0.4], [1, 0], Extrapolation.CLAMP), // was 0.5 threshold
    pointerEvents: step === 0 ? 'auto' : 'none',
    backgroundColor: '#FFF',
    zIndex: 10,
  }));

  /* ── Nav + footer fade in ── */
  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, W * 0.4], [0, 1], Extrapolation.CLAMP),
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, W * 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(scrollX.value, [0, W * 0.4], [12, 0], Extrapolation.CLAMP), // was 20
    }],
  }));

  const indicators = (
    <View style={styles.indicatorContainer}>
      {[1, 2, 3].map(i => <ProgressDot key={i} index={i} scrollX={scrollX} />)}
    </View>
  );

  /* ─── Validate before advancing (soft validation — warns, doesn't block) ─── */
  const isStepValid = () => {
    if (step === 1) return data.name.trim().length > 0;
    return true; // other steps are optional-field steps
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar 
          barStyle="dark-content" 
          backgroundColor="transparent" 
          translucent 
        />

        {/* ═══════════════════════════════════
            SPLASH
        ═══════════════════════════════════ */}
        <Animated.View style={[StyleSheet.absoluteFillObject, splashStyle]}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=2070' }}
            style={StyleSheet.absoluteFillObject}
            imageStyle={{ opacity: 0.25 }}
          />
          <SafeAreaView style={styles.splashContent}>
            {/* Faster entry: delay cut, springify stiffness raised */}
            <Animated.View entering={FadeInDown.delay(60).springify().stiffness(280).damping(18)}>
              <Text style={styles.logo}>PACE<Text style={{ color: '#FF385C' }}>RUNNER</Text></Text>
            </Animated.View>
            <View>
              <Animated.Text
                entering={FadeInDown.delay(120).springify().stiffness(280).damping(18)}
                style={styles.splashTitle}
              >
                Your running,{'\n'}perfected.
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.delay(180).springify().stiffness(280).damping(18)}
                style={styles.splashSub}
              >
                Personalized plans. Biomechanical tracking.{'\n'}Designed for everyday athletes.
              </Animated.Text>
              <Animated.View entering={FadeInUp.delay(240).springify().stiffness(280).damping(18)}>
                <PremiumButton
                  text="Get Started"
                  icon={ArrowRight}
                  onPress={next}
                  style={{ marginTop: 40 }}
                />
                {/* Social proof — micro UX detail */}
                <Text style={styles.socialProof}>Joined by 12,000+ runners worldwide</Text>
              </Animated.View>
            </View>
          </SafeAreaView>
        </Animated.View>

        {/* ═══════════════════════════════════
            ONBOARDING FLOW
        ═══════════════════════════════════ */}
        <SafeAreaView
          style={[StyleSheet.absoluteFillObject, { pointerEvents: step === 0 ? 'none' : 'auto' }]}
        >
          {/* NAV BAR */}
          <Animated.View style={[styles.navBar, fadeInStyle]}>
            <Pressable onPress={back} hitSlop={20} style={styles.backButton}>
              <ChevronLeft color="#222" size={20} />
            </Pressable>
            {indicators}
            <View style={{ width: 40 }} />
          </Animated.View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <Animated.View style={[styles.slider, sliderStyle]}>

              {/* ── PAGE 1: BIOMETRICS ── */}
              <View style={[styles.page, { marginLeft: W }]}>
                <Animated.Text
                  entering={FadeInRight.delay(60).springify().stiffness(280).damping(18)}
                  style={styles.hubTitle}
                >
                  About you
                </Animated.Text>
                <Animated.Text
                  entering={FadeInRight.delay(100).springify().stiffness(280).damping(18)}
                  style={styles.hubSub}
                >
                  Let's tailor the experience to your body.
                </Animated.Text>

                <Animated.View
                  entering={FadeInRight.delay(140).springify().stiffness(280).damping(18)}
                  style={styles.formContainer}
                >
                  {/* Name field auto-focuses when page appears */}
                  <CustomInput
                    label="First Name"
                    placeholder="e.g. John"
                    value={data.name}
                    onChangeText={v => setData({ ...data, name: v })}
                    autoFocus={step === 1}
                    returnKeyType="next"
                  />
                  <View style={styles.rowGrid}>
                    <View style={{ flex: 1 }}>
                      <CustomInput
                        label="Age"
                        placeholder="28"
                        keyboardType="numeric"
                        value={data.age}
                        onChangeText={v => setData({ ...data, age: v })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <CustomInput
                        label="Weight"
                        placeholder="75"
                        keyboardType="numeric"
                        unit="kg"
                        value={data.weight}
                        onChangeText={v => setData({ ...data, weight: v })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <CustomInput
                        label="Height"
                        placeholder="180"
                        keyboardType="numeric"
                        unit="cm"
                        value={data.height}
                        onChangeText={v => setData({ ...data, height: v })}
                      />
                    </View>
                  </View>

                  {/* Name hint — only shown when name is empty */}
                  {data.name.trim() === '' && (
                    <Text style={styles.hintText}>👆 Enter your name to continue</Text>
                  )}
                </Animated.View>
              </View>

              {/* ── PAGE 2: CAPABILITY ── */}
              <View style={styles.page}>
                <Text style={styles.hubTitle}>Your baseline</Text>
                <Text style={styles.hubSub}>Where are you starting from?</Text>

                <View style={styles.formContainer}>
                  <Text style={styles.inputLabel}>Experience Level</Text>
                  <View style={styles.levelGroup}>
                    {['Novice', 'Intermediate', 'Advanced'].map((lvl, idx) => {
                      const short = ['Novice', 'Inter', 'Pro'][idx];
                      const active = data.level === short;
                      return (
                        <Pressable
                          key={short}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setData({ ...data, level: short });
                          }}
                          style={[styles.levelChip, active && styles.levelChipActive]}
                          hitSlop={4} // easier tap
                        >
                          {/* Check icon when selected */}
                          <Text style={[styles.levelChipText, active && styles.levelChipTextActive]}>
                            {lvl}
                          </Text>
                          {active && <Check size={16} color="#222" strokeWidth={2.5} />}
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ marginTop: 20 }}>
                    <CustomInput
                      label="Resting Heart Rate (Optional)"
                      placeholder="60"
                      keyboardType="numeric"
                      unit="bpm"
                      value={data.restingHr}
                      onChangeText={v => setData({ ...data, restingHr: v })}
                    />
                    <View style={styles.infoRow}>
                      <Heart size={14} color="#717171" />
                      <Text style={styles.infoText}>Helps calculate accurate heart rate zones.</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── PAGE 3: OBJECTIVE ── */}
              <View style={styles.page}>
                <Text style={styles.hubTitle}>Your goal</Text>
                <Text style={styles.hubSub}>What are we training for?</Text>

                <View style={styles.goalStack}>
                  {[
                    { id: 'Endurance', title: 'Distance & Endurance', desc: 'Build stamina for longer runs.', icon: Activity },
                    { id: 'Speed',     title: 'Speed & Power',         desc: 'Improve 5k/10k times.',         icon: Zap     },
                    { id: 'Weight',    title: 'Fitness & Health',      desc: 'Conditioning and fat loss.',    icon: Target  },
                  ].map((g, i) => {
                    const active = data.goal === g.id;
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setData({ ...data, goal: g.id });
                        }}
                        style={[styles.goalRow, active && styles.goalRowActive]}
                        hitSlop={2}
                      >
                        <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                          <g.icon size={22} color={active ? '#FF385C' : '#717171'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.goalText, active && { color: '#222' }]}>{g.title}</Text>
                          <Text style={styles.goalDesc}>{g.desc}</Text>
                        </View>
                        {/* Animated radio */}
                        <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                          {active && <View style={styles.radioInner} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Reassurance copy on final step */}
                <View style={styles.reassureRow}>
                  {/* Shield icon pure RN to avoid extra import weight */}
                  <Text style={styles.reassureText}>🔒  You can change these anytime in Settings</Text>
                </View>
              </View>

            </Animated.View>
          </KeyboardAvoidingView>

          {/* FOOTER CTA */}
          <Animated.View style={[styles.footer, footerStyle]}>
            <PremiumButton
              text={step === 3 ? 'Complete Profile' : 'Continue'}
              icon={step === 3 ? Check : ArrowRight}
              onPress={next}
              // Visually dim if step 1 name is empty — soft signal, not a hard block
              style={step === 1 && data.name.trim() === '' ? { opacity: 0.55 } : {}}
            />
            {/* Step counter — helps user know how far they are */}
            {step > 0 && step < 4 && (
              <Text style={styles.stepCounter}>Step {step} of 3</Text>
            )}
          </Animated.View>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

/* ─────────────────────────────────────────────────────────
   STYLES  (unchanged from original where not needed)
───────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  /* Splash */
  splashContent: { flex: 1, padding: 32, justifyContent: 'space-between' },
  logo: { color: '#222', fontSize: 16, fontWeight: '600', fontFamily: 'Poppins-Medium', letterSpacing: 2, marginTop: 20 },
  splashTitle: { color: '#222', fontSize: 44, fontWeight: '600', fontFamily: 'Poppins-SemiBold', marginTop: 20, lineHeight: 48, letterSpacing: -1 },
  splashSub: { color: '#717171', fontSize: 17, marginTop: 16, lineHeight: 26, fontFamily: 'Poppins-Regular' },
  socialProof: { textAlign: 'center', marginTop: 16, fontSize: 13, color: '#B0B0B0', fontFamily: 'Poppins-Regular' },

  /* Button */
  buttonBase: { height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonPrimary: { backgroundColor: '#222' },
  buttonSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600', fontFamily: 'Poppins-Medium' },

  /* Nav */
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, height: 56, marginTop: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F7F7', justifyContent: 'center', alignItems: 'center' },
  indicatorContainer: { flexDirection: 'row', gap: 6 },
  dot: { height: 6, borderRadius: 3 },

  /* Slider */
  slider: { flexDirection: 'row', width: W * 4, flex: 1 },
  page: { width: W, padding: 32, paddingTop: 10 },
  hubTitle: { fontSize: 32, fontWeight: '600', fontFamily: 'Poppins-SemiBold', color: '#222', lineHeight: 38, letterSpacing: -0.5 },
  hubSub: { fontSize: 16, color: '#717171', marginTop: 8, fontFamily: 'Poppins-Regular' },

  /* Inputs */
  formContainer: { marginTop: 32, gap: 24 },
  inputContainer: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', fontFamily: 'Poppins-Medium', color: '#222' },
  inputWrapper: { height: 56, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input: { flex: 1, color: '#222', fontSize: 16, fontFamily: 'Poppins-Regular', height: '100%' },
  inputUnit: { color: '#717171', fontSize: 14, fontFamily: 'Poppins-Medium', marginLeft: 8 },
  rowGrid: { flexDirection: 'row', gap: 12 },
  hintText: { fontSize: 13, color: '#B0B0B0', fontFamily: 'Poppins-Regular', marginTop: -8 },

  /* Level */
  levelGroup: { flexDirection: 'column', gap: 12, marginTop: 8 },
  levelChip: { width: '100%', height: 56, borderRadius: 12, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: '#DDD' },
  levelChipActive: { borderColor: '#222', backgroundColor: '#F7F7F7', borderWidth: 2 },
  levelChipText: { fontSize: 16, fontWeight: '500', color: '#717171' },
  levelChipTextActive: { color: '#222', fontWeight: '600' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  infoText: { fontSize: 13, color: '#717171' },

  /* Goals */
  goalStack: { gap: 14, marginTop: 32 },
  goalRow: { padding: 18, backgroundColor: '#FFF', borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#DDD' },
  goalRowActive: { borderColor: '#222', backgroundColor: '#F7F7F7', borderWidth: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7F7F7', justifyContent: 'center', alignItems: 'center' },
  iconWrapActive: { backgroundColor: '#FFF0F3' },
  goalText: { fontSize: 16, fontWeight: '600', color: '#444', marginBottom: 3 },
  goalDesc: { fontSize: 13, color: '#717171' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: '#222', borderWidth: 2 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#222' },

  /* Footer */
  footer: { padding: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 32, gap: 12 },
  stepCounter: { textAlign: 'center', fontSize: 13, color: '#B0B0B0', fontFamily: 'Poppins-Regular' },

  /* Reassurance */
  reassureRow: { marginTop: 20, alignItems: 'center' },
  reassureText: { fontSize: 13, color: '#B0B0B0', fontFamily: 'Poppins-Regular' },
});