import React, { useRef, useState, memo } from 'react';
import {
  Animated,
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
import { ArrowRight, Activity, Zap, Heart, Target, ChevronLeft, User, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Optimized Sub-Components (Memoized for zero-lag) ---
const StepIndicator = memo(({ activeStep }) => (
  <View style={styles.stepIndicator}>
    {[1, 2, 3].map(i => (
      <View key={i} style={[styles.dot, activeStep === i && styles.dotActive]} />
    ))}
  </View>
));

export default function UltimateOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 is Splash
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // Data State Hub
  const [data, setData] = useState({
    name: '', age: '', weight: '', height: '',
    level: 'Inter', hrMax: '185',
    goal: 'Endurance', frequency: '4x'
  });

  const next = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 3) {
      router.replace('/(tabs)');
      return;
    }

    Animated.spring(scrollX, {
      toValue: -(SCREEN_WIDTH * step),
      useNativeDriver: true,
      tension: 50,
      friction: 10
    }).start(() => setStep(step + 1));
  };

  const back = () => {
    if (step <= 1) {
      setStep(0);
      scrollX.setValue(0);
      return;
    }
    Animated.spring(scrollX, {
      toValue: -(SCREEN_WIDTH * (step - 2)),
      useNativeDriver: true,
      tension: 50,
      friction: 10
    }).start(() => setStep(step - 1));
  };

  // --- RENDERS ---

  if (step === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ImageBackground 
          source={{ uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=2070' }} 
          style={StyleSheet.absoluteFillObject}
        >
          <LinearGradient colors={['rgba(15, 23, 42, 0.4)', '#0F172A']} style={StyleSheet.absoluteFillObject} />
        </ImageBackground>
        <SafeAreaView style={styles.splashContent}>
          <View>
            <Text style={styles.logo}>PACE<Text style={{color: '#FF6A2C'}}>RUNNER</Text></Text>
            <Text style={styles.splashTitle}>Engineered for{'\n'}the Elite.</Text>
            <Text style={styles.splashSub}>Personalized biomechanics and AI-driven training cycles.</Text>
          </View>
          <Pressable style={styles.entryButton} onPress={next}>
            <Text style={styles.entryButtonText}>BEGIN INITIALIZATION</Text>
            <ArrowRight color="#FFF" size={20} />
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.navBar}>
            <Pressable onPress={back} hitSlop={20}><ChevronLeft color="#0F172A" size={28} /></Pressable>
            <StepIndicator activeStep={step} />
            <Shield color="#94A3B8" size={20} />
          </View>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
            keyboardVerticalOffset={20}
          >
            <Animated.View style={[styles.slider, { transform: [{ translateX: scrollX }] }]}>
              
              {/* PAGE 1: BIOMETRICS */}
              <View style={styles.page}>
                <Text style={styles.hubLabel}>01 . BIOMETRICS</Text>
                <Text style={styles.hubTitle}>Identity &{'\n'}Physics</Text>
                
                <View style={styles.formContainer}>
                  <Text style={styles.fieldLabel}>FULL NAME</Text>
                  <TextInput 
                    placeholder="Chitti" 
                    style={styles.bigInput} 
                    onChangeText={(v) => setData({...data, name: v})}
                  />
                  
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.fieldLabel}>AGE</Text>
                      <TextInput placeholder="24" keyboardType="numeric" style={styles.statInput} />
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.fieldLabel}>WEIGHT</Text>
                      <TextInput placeholder="72kg" keyboardType="numeric" style={styles.statInput} />
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.fieldLabel}>HEIGHT</Text>
                      <TextInput placeholder="180cm" keyboardType="numeric" style={styles.statInput} />
                    </View>
                  </View>
                </View>
              </View>

              {/* PAGE 2: PERFORMANCE */}
              <View style={styles.page}>
                <Text style={styles.hubLabel}>02 . CAPABILITY</Text>
                <Text style={styles.hubTitle}>Performance{'\n'}Calibration</Text>
                
                <View style={styles.levelGroup}>
                  {['Novice', 'Inter', 'Pro'].map(lvl => (
                    <Pressable 
                      key={lvl}
                      onPress={() => { Haptics.selectionAsync(); setData({...data, level: lvl})}}
                      style={[styles.levelChip, data.level === lvl && styles.levelChipActive]}
                    >
                      <Text style={[styles.levelChipText, data.level === lvl && styles.levelChipTextActive]}>{lvl.toUpperCase()}</Text>
                      {data.level === lvl && <Zap size={14} color="#FFF" fill="#FFF" />}
                    </Pressable>
                  ))}
                </View>

                <View style={styles.hrCard}>
                  <View style={styles.hrHeader}>
                    <Heart size={18} color="#FF6A2C" />
                    <Text style={styles.hrTitle}>RESTING HEART RATE</Text>
                  </View>
                  <TextInput placeholder="60" keyboardType="numeric" style={styles.hrInput} />
                  <Text style={styles.hrSub}>Used to calculate Zone 2 thresholds.</Text>
                </View>
              </View>

              {/* PAGE 3: STRATEGY */}
              <View style={styles.page}>
                <Text style={styles.hubLabel}>03 . OBJECTIVE</Text>
                <Text style={styles.hubTitle}>Mission{'\n'}Parameters</Text>
                
                <View style={styles.goalStack}>
                  {[
                    { id: 'Endurance', title: 'Endurance Build', icon: Activity },
                    { id: 'Speed', title: 'Speed & Power', icon: Zap },
                    { id: 'Weight', title: 'Metabolic Optimization', icon: Target },
                  ].map(g => (
                    <Pressable 
                      key={g.id}
                      onPress={() => setData({...data, goal: g.id})}
                      style={[styles.goalRow, data.goal === g.id && styles.goalRowActive]}
                    >
                      <View style={[styles.iconWrap, data.goal === g.id && { backgroundColor: '#FF6A2C' }]}>
                        <g.icon size={20} color={data.goal === g.id ? "#FFF" : "#FF6A2C"} />
                      </View>
                      <Text style={[styles.goalText, data.goal === g.id && styles.goalTextActive]}>{g.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

            </Animated.View>
          </KeyboardAvoidingView>

          <View style={styles.footer}>
            <Pressable style={styles.mainButton} onPress={next}>
              <Text style={styles.mainButtonText}>{step === 3 ? "LAUNCH ENGINE" : "CONTINUE"}</Text>
              <ArrowRight color="#FFF" size={20} />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  // Splash Styles
  splashContent: { flex: 1, padding: 40, justifyContent: 'space-between' },
  logo: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 4 },
  splashTitle: { color: '#FFF', fontSize: 52, fontWeight: '800', marginTop: 20, lineHeight: 56 },
  splashSub: { color: '#94A3B8', fontSize: 18, marginTop: 15, lineHeight: 26 },
  entryButton: { height: 74, backgroundColor: '#0F172A', borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  entryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 2 },

  // Onboarding Hub Styles
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, height: 60 },
  stepIndicator: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E2E8F0' },
  dotActive: { width: 22, backgroundColor: '#0F172A' },

  slider: { flexDirection: 'row', width: SCREEN_WIDTH * 3, flex: 1 },
  page: { width: SCREEN_WIDTH, padding: 30 },
  hubLabel: { fontSize: 11, fontWeight: '900', color: '#FF6A2C', letterSpacing: 2 },
  hubTitle: { fontSize: 42, fontWeight: '800', color: '#0F172A', marginTop: 10, lineHeight: 48 },

  // Inputs & Grid
  formContainer: { marginTop: 40 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginBottom: 8, letterSpacing: 1 },
  bigInput: { fontSize: 28, fontWeight: '700', color: '#0F172A', borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9', paddingBottom: 15, marginBottom: 35 },
  statsGrid: { flexDirection: 'row', gap: 20 },
  statItem: { flex: 1 },
  statInput: { fontSize: 20, fontWeight: '700', color: '#0F172A', borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9', paddingBottom: 10 },

  // Performance (Page 2)
  levelGroup: { flexDirection: 'row', gap: 10, marginTop: 30, marginBottom: 40 },
  levelChip: { flex: 1, height: 54, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  levelChipActive: { backgroundColor: '#0F172A' },
  levelChipText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  levelChipTextActive: { color: '#FFF' },
  hrCard: { padding: 25, backgroundColor: '#FFF7F5', borderRadius: 30 },
  hrHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  hrTitle: { fontSize: 11, fontWeight: '900', color: '#FF6A2C' },
  hrInput: { fontSize: 40, fontWeight: '800', color: '#0F172A' },
  hrSub: { fontSize: 12, color: '#94A3B8', marginTop: 10 },

  // Strategic (Page 3)
  goalStack: { gap: 15, marginTop: 30 },
  goalRow: { height: 84, backgroundColor: '#F8FAFC', borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 15, borderWidth: 1, borderColor: 'transparent' },
  goalRowActive: { backgroundColor: '#FFF', borderColor: '#FF6A2C', shadowColor: '#FF6A2C', shadowOpacity: 0.05, shadowRadius: 10 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  goalText: { fontSize: 17, fontWeight: '700', color: '#475569' },
  goalTextActive: { color: '#0F172A' },

  footer: { padding: 30, paddingBottom: 40 },
  mainButton: { height: 74, backgroundColor: '#0F172A', borderRadius: 26, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  mainButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 1 }
});