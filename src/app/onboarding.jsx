import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  ImageBackground,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TRACK_WIDTH = SCREEN_WIDTH * 0.85;
const KNOB_SIZE = 60;
const ONBOARDING_DATA_KEY = 'paceRunner-onboarding-data';

const GOAL_OPTIONS = [
  { key: 'beginner', label: 'Beginner', description: 'Just starting' },
  { key: 'stamina', label: 'Improve stamina', description: 'Build endurance' },
  { key: 'distance', label: 'Train for distance', description: 'Run farther' },
];

const DISTANCE_OPTIONS = [
  { key: '3 km', label: '3 km' },
  { key: '5 km', label: '5 km' },
  { key: '10 km', label: '10 km' },
  { key: 'custom', label: 'Custom' },
];

const FREQUENCY_OPTIONS = [
  { key: '2 days/week', label: '2 days/week' },
  { key: '3 days/week', label: '3 days/week' },
  { key: '5 days/week', label: '5 days/week' },
];

const PACE_OPTIONS = [
  { key: 'slow', label: 'Slow', detail: '7-8 min/km' },
  { key: 'moderate', label: 'Moderate', detail: '5-6 min/km' },
  { key: 'fast', label: 'Fast', detail: '3-4 min/km' },
  { key: 'auto', label: "I don't know", detail: 'We will set a safe default' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedDistance, setSelectedDistance] = useState('');
  const [customDistance, setCustomDistance] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState('');
  const [selectedPace, setSelectedPace] = useState('auto');
  const [saving, setSaving] = useState(false);
  
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newX = Math.max(0, Math.min(gestureState.dx, TRACK_WIDTH - KNOB_SIZE - 8));
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = (TRACK_WIDTH - KNOB_SIZE) * 0.7;
        if (gestureState.dx >= threshold) {
          Animated.spring(translateX, {
            toValue: TRACK_WIDTH - KNOB_SIZE - 8,
            useNativeDriver: true,
            friction: 8,
          }).start(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setStep(1);
          });
          return;
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  const selectedDistanceLabel =
    selectedDistance === 'custom'
      ? customDistance.trim()
        ? `${customDistance.trim()} km`
        : 'Custom'
      : selectedDistance;

  const canContinueStepTwo = Boolean(selectedGoal && selectedDistance);
  const currentGoalLabel = GOAL_OPTIONS.find((option) => option.key === selectedGoal)?.label ?? 'Not set';

  const persistOnboarding = async () => {
    if (selectedDistance === 'custom' && !customDistance.trim()) {
      Alert.alert('Add a distance', 'Enter a custom distance to continue.');
      return;
    }
    const onboardingData = {
      goal: currentGoalLabel,
      distance: selectedDistanceLabel,
      pace: selectedPace,
      frequency: selectedFrequency,
    };
    try {
      setSaving(true);
      await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(onboardingData));
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const renderStepHeader = () => (
    <View style={styles.stepHeader}>
      <Text style={styles.stepCount}>Step {step + 1} of 3</Text>
      <View style={styles.progressRow}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={[styles.progressDot, index <= step && styles.progressDotActive]} />
        ))}
      </View>
    </View>
  );

  if (step === 0) {
    return (
      <View style={styles.darkSlide}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=2070' }}
          style={StyleSheet.absoluteFillObject}
        >
          <LinearGradient colors={['transparent', 'rgba(15, 23, 42, 0.8)', '#0F172A']} style={StyleSheet.absoluteFillObject} />
        </ImageBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}><Text style={styles.logoBase}>PACE<Text style={styles.logoHighlight}>RUNNER</Text></Text></View>
          <View style={styles.content}>
            <Text style={styles.title}>Push Your{'\n'}Boundaries</Text>
            <Text style={styles.subtitle}>The only premium tracking experience designed for elite performance.</Text>
          </View>
          <View style={styles.footer}>
            <View style={[styles.track, { width: TRACK_WIDTH }]}>
              <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
                <ArrowRight size={28} color="#FFFFFF" />
              </Animated.View>
              <Text style={styles.hintText}>❯ ❯ ❯</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.lightSafeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.lightScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.slideCard}>
          {renderStepHeader()}
          <Text style={styles.lightTitle}>{step === 1 ? "What's your goal?" : "Set your pace"}</Text>

          {step === 1 ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Running goal</Text>
                {GOAL_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setSelectedGoal(option.key)}
                    style={[styles.optionCard, selectedGoal === option.key && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, selectedGoal === option.key && styles.optionLabelActive]}>{option.label}</Text>
                    <Text style={styles.optionDetail}>{option.description}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Distance</Text>
                <View style={styles.choiceGrid}>
                  {DISTANCE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => setSelectedDistance(option.key)}
                      style={[styles.distanceChip, selectedDistance === option.key && styles.distanceChipActive]}
                    >
                      <Text style={[styles.distanceText, selectedDistance === option.key && styles.distanceTextActive]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.section}>
              {PACE_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setSelectedPace(option.key)}
                  style={[styles.paceOption, selectedPace === option.key && styles.paceOptionActive]}
                >
                  <View>
                    <Text style={styles.paceOptionLabel}>{option.label}</Text>
                    <Text style={styles.paceOptionDetail}>{option.detail}</Text>
                  </View>
                  <View style={[styles.radio, selectedPace === option.key && styles.radioActive]}>
                    {selectedPace === option.key && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            onPress={step === 1 ? () => setStep(2) : persistOnboarding}
            disabled={step === 1 && !canContinueStepTwo}
            style={[styles.primaryButton, (step === 1 && !canContinueStepTwo) && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{step === 1 ? 'Continue' : 'Start Running'}</Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkSlide: { flex: 1, backgroundColor: '#0F172A' },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  header: { height: 60, alignItems: 'center', marginTop: 10 },
  logoBase: { fontSize: 22, color: '#FFFFFF', letterSpacing: 4, fontWeight: '700' },
  logoHighlight: { color: '#FF6A2C' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 42, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 16, color: '#94A3B8', marginTop: 16 },
  footer: { paddingBottom: 40, alignItems: 'center' },
  track: { height: 72, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 36, justifyContent: 'center', paddingHorizontal: 6 },
  knob: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF6A2C', alignItems: 'center', justifyContent: 'center' },
  hintText: { position: 'absolute', right: 30, color: '#FFFFFF', opacity: 0.3 },
  lightSafeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  lightScroll: { paddingBottom: 40 },
  slideCard: { padding: 20, backgroundColor: '#FFF', margin: 16, borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  stepHeader: { marginBottom: 20 },
  stepCount: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  progressRow: { flexDirection: 'row', marginTop: 8 },
  progressDot: { height: 4, flex: 1, backgroundColor: '#E2E8F0', marginRight: 4, borderRadius: 2 },
  progressDotActive: { backgroundColor: '#FF6A2C' },
  lightTitle: { fontSize: 28, fontWeight: '700', color: '#0F172A' },
  section: { marginTop: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 12 },
  optionCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  optionCardActive: { borderColor: '#FF6A2C', backgroundColor: '#FFF4EF' },
  optionLabel: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  optionLabelActive: { color: '#B34416' },
  optionDetail: { fontSize: 13, color: '#64748B', marginTop: 4 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  distanceChip: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFF' },
  distanceChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  distanceText: { fontWeight: '600', color: '#0F172A' },
  distanceTextActive: { color: '#FFF' },
  buttonContainer: { paddingHorizontal: 16, marginTop: 10 },
  primaryButton: { height: 56, backgroundColor: '#0F172A', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  paceOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  paceOptionActive: { borderColor: '#FF6A2C', backgroundColor: '#FFF4EF' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1' },
  radioActive: { borderColor: '#FF6A2C' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6A2C', margin: 3 }
});