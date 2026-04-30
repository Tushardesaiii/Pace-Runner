import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Font from 'expo-font';
import { useAuth } from '@/utils/auth/useAuth';

const AView = Animated.View;

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingCompleted } = useAuth();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          'Poppins-Regular': require('@/assets/fonts/Poppins-Regular.ttf'),
          'Poppins-Medium': require('@/assets/fonts/Poppins-Medium.ttf'),
          'Poppins-SemiBold': require('@/assets/fonts/Poppins-SemiBold.ttf'),
          'Poppins-Bold': require('@/assets/fonts/Poppins-Bold.ttf'),
          'Poppins-Black': require('@/assets/fonts/Poppins-Black.ttf'),
        });
      } catch (e) {
        console.log('Note: Add Poppins font files to assets/fonts for better typography');
      } finally {
        setFontsLoaded(true);
      }
    };
    loadFonts();
  }, []);

  useEffect(() => {
    // Staggered entry for a more sophisticated feel
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetStarted = async () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      try {
        await setOnboardingCompleted(true);
        router.replace('/(tabs)');
      } catch (error) {
        console.error("Onboarding error:", error);
      }
    });
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />

      {/* Background Image */}
      <Image
        source={{ uri: 'https://images.pexels.com/photos/35765666/pexels-photo-35765666.jpeg' }}
        resizeMode="cover"
        style={StyleSheet.absoluteFillObject}
      />

      {/* Modern Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top Header */}
      <AView
        className="px-8 pt-6"
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <Text style={{ fontFamily: 'Poppins-Bold' }} className="text-black text-xl text-center mt-4 tracking-widest uppercase">
          Pace<Text className="text-[#FF6A2C]">Runner</Text>
        </Text>
      </AView>

      {/* Bottom Content */}
      <View className="flex-1 justify-end px-8 pb-12">
        <AView style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={{ fontFamily: 'Poppins-Black' }} className="text-white text-[42px] leading-[48px] tracking-tight mb-2">
            Start Your{`\n`}Running Journey
          </Text>

          <Text style={{ fontFamily: 'Poppins-Regular' }} className="text-white/60 text-base leading-7 mb-6 max-w-[90%]">
            Take your steps towards healthier living with PaceRunner
          </Text>

          {/* Action Button */}
          <AView style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable 
              onPress={handleGetStarted}
              className="bg-white/10 border border-white/20 rounded-full h-16 flex-row items-center px-2 overflow-hidden"
            >
              <View className="w-12 h-12 rounded-full bg-[#FF6A2C] items-center justify-center shadow-lg shadow-[#FF6A2C]/50">
                <ArrowRight size={24} color="#FFFFFF" />
              </View>
              
              <Text style={{ fontFamily: 'Poppins-SemiBold' }} className="text-white text-base ml-4 flex-1">Get Started</Text>
              
              <View className="flex-row pr-4 opacity-40">
                <Text className="text-white text-xl">›</Text>
                <Text className="text-white text-xl -ml-1">›</Text>
                <Text className="text-white text-xl -ml-1">›</Text>
              </View>
            </Pressable>
          </AView>

          
        </AView>
      </View>
      
    
    </SafeAreaView>
  );
}