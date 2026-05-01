import React, { useRef } from 'react';
import { 
  StatusBar, 
  StyleSheet, 
  Text, 
  View, 
  Animated, 
  PanResponder, 
  Dimensions, 
  Platform, 
  ImageBackground 
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  const TRACK_WIDTH = SCREEN_WIDTH * 0.85;
  const KNOB_SIZE = 60;
  // Use a ref for X position for native performance
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        // Clamp the movement within the track
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
            router.push('/signin');
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Image with Dark Overlay */}
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=2070' }} 
        style={StyleSheet.absoluteFillObject}
      >
        <LinearGradient
          colors={['transparent', 'rgba(15, 23, 42, 0.8)', '#0F172A']}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safeArea}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.logoBase}>
            PACE<Text style={styles.logoHighlight}>RUNNER</Text>
          </Text>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          <Text style={styles.title}>
            Push Your{'\n'}Boundaries
          </Text>
          <Text style={styles.subtitle}>
            The only premium tracking experience designed for elite performance and daily growth.
          </Text>

         
        </View>

        {/* Footer / Slider Section */}
        <View style={styles.footer}>
          <Text style={styles.swipeLabel}>Slide to get started</Text>
          
          <View style={[styles.track, { width: TRACK_WIDTH }]}>
            {/* Native Progress Glow (Fades in as you slide) */}
            <Animated.View 
              style={[
                styles.progressFill, 
                { 
                  width: TRACK_WIDTH,
                  opacity: translateX.interpolate({
                    inputRange: [0, TRACK_WIDTH - KNOB_SIZE],
                    outputRange: [0, 1]
                  }),
                  transform: [{
                    translateX: translateX.interpolate({
                      inputRange: [0, TRACK_WIDTH - KNOB_SIZE],
                      outputRange: [-TRACK_WIDTH, 0]
                    })
                  }]
                }
              ]} 
            />

            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.knob, { transform: [{ translateX }] }]}
            >
              <ArrowRight size={28} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>

            <Animated.Text 
              style={[
                styles.hintText,
                {
                  opacity: translateX.interpolate({
                    inputRange: [0, 100],
                    outputRange: [0.3, 0],
                    extrapolate: 'clamp'
                  })
                }
              ]}
            >
              ❯  ❯  ❯
            </Animated.Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  logoBase: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  logoHighlight: {
    color: '#FF6A2C',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 48,
    lineHeight: 54,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
    lineHeight: 24,
    maxWidth: '85%',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 24,
  },
  featureBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#E2E8F0',
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 40,
    alignItems: 'center',
  },
  swipeLabel: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 20,
  },
  track: {
    height: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden', // Crucial for the progress fill
  },
  progressFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#FF6A2C',
    borderRadius: 36,
  },
  knob: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6A2C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6A2C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  hintText: {
    position: 'absolute',
    right: 30,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
    fontSize: 18,
  },
});