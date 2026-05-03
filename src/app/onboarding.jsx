import React, { useState, useEffect } from 'react';
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
import { ArrowRight, Activity, Zap, Heart, Target, ChevronLeft, Shield, Check } from 'lucide-react-native';
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
} from 'react-native-reanimated';
import { useAuth } from '@/utils/auth/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Reusable Premium Components ---
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ProgressDot = ({ index, scrollX }) => {
  const animatedDotStyle = useAnimatedStyle(() => {
    const isActive = scrollX.value >= (index - 1.5) * SCREEN_WIDTH && scrollX.value < (index - 0.5) * SCREEN_WIDTH;

    return {
      width: withTiming(isActive ? 24 : 6, { duration: 200 }),
      backgroundColor: withTiming(isActive ? '#222222' : '#DDDDDD', { duration: 200 }),
    };
  });

  return <Animated.View style={[styles.dot, animatedDotStyle]} />;
};

const PremiumButton = ({ onPress, text, icon: Icon, isPrimary = true, style }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 20, stiffness: 200 });
        Haptics.selectionAsync();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
      }}
      onPress={onPress}
      style={[
        styles.buttonBase,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        animatedStyle,
        style
      ]}
    >
      <Text style={[styles.buttonText, !isPrimary && { color: '#222222' }]}>{text}</Text>
      {Icon && <Icon color={isPrimary ? "#FFFFFF" : "#222222"} size={18} />}
    </AnimatedPressable>
  );
};

const CustomInput = ({ label, placeholder, value, onChangeText, keyboardType = 'default', unit }) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 150 });
  }, [isFocused]);

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: interpolate(focusAnim.value, [0, 1], [0, 1]) === 1 ? '#222222' : '#DDDDDD',
    borderWidth: interpolate(focusAnim.value, [0, 1], [1, 2]),
  }));

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Animated.View style={[styles.inputWrapper, animatedBorder]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#B0B0B0"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {unit && <Text style={styles.inputUnit}>{unit}</Text>}
      </Animated.View>
    </View>
  );
};

export default function UltimateOnboarding() {
  const router = useRouter();
  const { setOnboardingCompleted } = useAuth();
  const [step, setStep] = useState(0);
  const scrollX = useSharedValue(0);

  const SPRING_CONFIG = { damping: 25, stiffness: 180 };

  const [data, setData] = useState({
    name: '', age: '', weight: '', height: '',
    level: 'Inter', hrMax: '185', restingHr: '',
    goal: 'Endurance', frequency: '4x'
  });

  const next = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (step === 0) {
      setStep(1);
      scrollX.value = withSpring(SCREEN_WIDTH * 1, SPRING_CONFIG);
      return;
    }
    if (step === 3) {
      if (setOnboardingCompleted) {
        setOnboardingCompleted(true);
      }
      router.replace('/(tabs)');
      return;
    }

    setStep(step + 1);
    scrollX.value = withSpring(SCREEN_WIDTH * (step + 1), SPRING_CONFIG);
  };

  const back = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    if (step <= 1) {
      setStep(0);
      scrollX.value = withSpring(0, SPRING_CONFIG);
      return;
    }
    setStep(step - 1);
    scrollX.value = withSpring(SCREEN_WIDTH * (step - 1), SPRING_CONFIG);
  };

  const animatedSliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.value }],
  }));

  const renderIndicators = () => (
    <View style={styles.indicatorContainer}>
      {[1, 2, 3].map((i) => {
        return <ProgressDot key={i} index={i} scrollX={scrollX} />;
      })}
    </View>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        {/* SPLASH SCREEN */}
        <Animated.View style={[StyleSheet.absoluteFillObject, useAnimatedStyle(() => ({
          opacity: interpolate(scrollX.value, [0, SCREEN_WIDTH * 0.5], [1, 0], Extrapolation.CLAMP),
          pointerEvents: step === 0 ? 'auto' : 'none',
          backgroundColor: '#FFFFFF',
          zIndex: 10
        }))]}>
          <ImageBackground 
            source={{ uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=2070' }} 
            style={StyleSheet.absoluteFillObject}
            imageStyle={{ opacity: 0.4 }}
          />
          <SafeAreaView style={styles.splashContent}>
            <Animated.View entering={FadeInDown.delay(100).springify().stiffness(200)}>
              <Text style={styles.logo}>PACE<Text style={{color: '#FF385C'}}>RUNNER</Text></Text>
            </Animated.View>
            <View>
              <Animated.Text entering={FadeInDown.delay(200).springify().stiffness(200)} style={styles.splashTitle}>
                Your running,{'\n'}perfected.
              </Animated.Text>
              <Animated.Text entering={FadeInDown.delay(300).springify().stiffness(200)} style={styles.splashSub}>
                Personalized plans. Biomechanical tracking. Designed for everyday athletes.
              </Animated.Text>
              <Animated.View entering={FadeInUp.delay(400).springify().stiffness(200)}>
                <PremiumButton 
                  text="Get Started" 
                  icon={ArrowRight} 
                  onPress={next} 
                  style={{ marginTop: 40 }}
                />
              </Animated.View>
            </View>
          </SafeAreaView>
        </Animated.View>

        {/* MAIN ONBOARDING FLOW */}
        <SafeAreaView style={[StyleSheet.absoluteFillObject, { pointerEvents: step === 0 ? 'none' : 'auto' }]}>
          <Animated.View style={[styles.navBar, useAnimatedStyle(() => ({
            opacity: interpolate(scrollX.value, [0, SCREEN_WIDTH * 0.5], [0, 1], Extrapolation.CLAMP),
          }))]}>
            <Pressable onPress={back} hitSlop={20} style={styles.backButton}>
              <ChevronLeft color="#222222" size={20} />
            </Pressable>
            {renderIndicators()}
            <View style={{width: 40}} /> {/* Spacer for centering */}
          </Animated.View>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <Animated.View style={[styles.slider, animatedSliderStyle]}>
              
              {/* PAGE 1: BIOMETRICS */}
              <View style={[styles.page, { marginLeft: SCREEN_WIDTH }]}>
                <Animated.Text entering={FadeInRight.delay(100)} style={styles.hubTitle}>About you</Animated.Text>
                <Animated.Text entering={FadeInRight.delay(150)} style={styles.hubSub}>Let's tailor the experience to your body.</Animated.Text>
                
                <Animated.View entering={FadeInRight.delay(200)} style={styles.formContainer}>
                  <CustomInput 
                    label="First Name" 
                    placeholder="e.g. John" 
                    value={data.name}
                    onChangeText={(v) => setData({...data, name: v})}
                  />
                  
                  <View style={styles.rowGrid}>
                    <View style={{flex: 1}}>
                      <CustomInput label="Age" placeholder="28" keyboardType="numeric" value={data.age} onChangeText={(v) => setData({...data, age: v})} />
                    </View>
                    <View style={{flex: 1}}>
                      <CustomInput label="Weight" placeholder="75" keyboardType="numeric" unit="kg" value={data.weight} onChangeText={(v) => setData({...data, weight: v})} />
                    </View>
                    <View style={{flex: 1}}>
                      <CustomInput label="Height" placeholder="180" keyboardType="numeric" unit="cm" value={data.height} onChangeText={(v) => setData({...data, height: v})} />
                    </View>
                  </View>
                </Animated.View>
              </View>

              {/* PAGE 2: CAPABILITY */}
              <View style={styles.page}>
                <Text style={styles.hubTitle}>Your baseline</Text>
                <Text style={styles.hubSub}>Where are you starting from?</Text>
                
                <View style={styles.formContainer}>
                  <Text style={styles.inputLabel}>Experience Level</Text>
                  <View style={styles.levelGroup}>
                    {['Novice', 'Intermediate', 'Advanced'].map((lvl, idx) => {
                      const shortLvl = ['Novice', 'Inter', 'Pro'][idx];
                      const isActive = data.level === shortLvl;
                      return (
                        <Pressable 
                          key={shortLvl}
                          onPress={() => { Haptics.selectionAsync(); setData({...data, level: shortLvl})}}
                          style={[styles.levelChip, isActive && styles.levelChipActive]}
                        >
                          <Text style={[styles.levelChipText, isActive && styles.levelChipTextActive]}>{lvl}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{marginTop: 20}}>
                    <CustomInput 
                      label="Resting Heart Rate (Optional)" 
                      placeholder="60" 
                      keyboardType="numeric" 
                      unit="bpm" 
                      value={data.restingHr}
                      onChangeText={(v) => setData({...data, restingHr: v})}
                    />
                    <View style={styles.infoRow}>
                      <Heart size={14} color="#717171" />
                      <Text style={styles.infoText}>Helps us calculate accurate heart rate zones.</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* PAGE 3: OBJECTIVE */}
              <View style={styles.page}>
                <Text style={styles.hubTitle}>Your goal</Text>
                <Text style={styles.hubSub}>What are we training for?</Text>
                
                <View style={styles.goalStack}>
                  {[
                    { id: 'Endurance', title: 'Distance & Endurance', desc: 'Build stamina for longer runs.', icon: Activity },
                    { id: 'Speed', title: 'Speed & Power', desc: 'Improve 5k/10k times and sprinting.', icon: Zap },
                    { id: 'Weight', title: 'Fitness & Health', desc: 'General conditioning and fat loss.', icon: Target },
                  ].map(g => {
                    const isActive = data.goal === g.id;
                    return (
                      <Pressable 
                        key={g.id}
                        onPress={() => { Haptics.selectionAsync(); setData({...data, goal: g.id})}}
                        style={[styles.goalRow, isActive && styles.goalRowActive]}
                      >
                        <View style={styles.iconWrap}>
                          <g.icon size={22} color={isActive ? "#FF385C" : "#717171"} />
                        </View>
                        <View style={{flex: 1}}>
                          <Text style={styles.goalText}>{g.title}</Text>
                          <Text style={styles.goalDesc}>{g.desc}</Text>
                        </View>
                        <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                          {isActive && <View style={styles.radioInner} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

            </Animated.View>
          </KeyboardAvoidingView>

          <Animated.View style={[styles.footer, useAnimatedStyle(() => ({
            opacity: interpolate(scrollX.value, [0, SCREEN_WIDTH * 0.5], [0, 1], Extrapolation.CLAMP),
            transform: [{
              translateY: interpolate(scrollX.value, [0, SCREEN_WIDTH * 0.5], [20, 0], Extrapolation.CLAMP)
            }]
          }))]}>
            <PremiumButton 
              text={step === 3 ? "Complete Profile" : "Continue"} 
              icon={step === 3 ? Check : undefined} 
              onPress={next} 
              isPrimary={true}
            />
          </Animated.View>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  // Splash Styles
  splashContent: { flex: 1, padding: 32, justifyContent: 'space-between' },
  logo: { color: '#222222', fontSize: 16, fontWeight: '600', fontFamily: 'Poppins-Medium', letterSpacing: 2, marginTop: 20 },
  splashTitle: { color: '#222222', fontSize: 44, fontWeight: '600', fontFamily: 'Poppins-SemiBold', marginTop: 20, lineHeight: 48, letterSpacing: -1 },
  splashSub: { color: '#717171', fontSize: 18, marginTop: 16, lineHeight: 26, fontWeight: '400', fontFamily: 'Poppins-Regular' },
  
  // Premium Button (Airbnb style: smaller, fully rounded or subtle rounded)
  buttonBase: { height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonPrimary: { backgroundColor: '#222222' },
  buttonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: 'Poppins-Medium' },

  // Nav
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, height: 56, marginTop: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F7F7', justifyContent: 'center', alignItems: 'center' },
  indicatorContainer: { flexDirection: 'row', gap: 6 },
  dot: { height: 6, borderRadius: 3 },

  slider: { flexDirection: 'row', width: SCREEN_WIDTH * 4, flex: 1 },
  page: { width: SCREEN_WIDTH, padding: 32, paddingTop: 10 },
  hubTitle: { fontSize: 32, fontWeight: '600', fontFamily: 'Poppins-SemiBold', color: '#222222', lineHeight: 38, letterSpacing: -0.5 },
  hubSub: { fontSize: 16, color: '#717171', marginTop: 8, fontWeight: '400', fontFamily: 'Poppins-Regular' },

  // Custom Inputs
  formContainer: { marginTop: 32, gap: 24 },
  inputContainer: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', fontFamily: 'Poppins-Medium', color: '#222222' },
  inputWrapper: { height: 56, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input: { flex: 1, color: '#222222', fontSize: 16, fontWeight: '500', fontFamily: 'Poppins-Regular', height: '100%' },
  inputUnit: { color: '#717171', fontSize: 14, fontWeight: '500', fontFamily: 'Poppins-Medium', marginLeft: 8 },
  rowGrid: { flexDirection: 'row', gap: 12 },

  // Level Selection
  levelGroup: { flexDirection: 'column', gap: 12, marginTop: 8 },
  levelChip: { width: '100%', height: 56, borderRadius: 12, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: '#DDDDDD' },
  levelChipActive: { borderColor: '#222222', backgroundColor: '#F7F7F7', borderWidth: 2 },
  levelChipText: { fontSize: 16, fontWeight: '500', color: '#717171' },
  levelChipTextActive: { color: '#222222', fontWeight: '600' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  infoText: { fontSize: 13, color: '#717171', fontWeight: '400' },

  // Goals
  goalStack: { gap: 16, marginTop: 32 },
  goalRow: { padding: 20, backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#DDDDDD' },
  goalRowActive: { borderColor: '#222222', backgroundColor: '#F7F7F7', borderWidth: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7F7F7', justifyContent: 'center', alignItems: 'center' },
  goalText: { fontSize: 16, fontWeight: '600', color: '#222222', marginBottom: 4 },
  goalDesc: { fontSize: 14, color: '#717171', fontWeight: '400' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#DDDDDD', justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: '#222222', borderWidth: 2 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#222222' },

  footer: { padding: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 32 },
});