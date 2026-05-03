import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { useAuth } from '@/utils/auth/useAuth';

export default function SignInScreen() {
  const router = useRouter();
  const { setOnboardingCompleted } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const [fontsLoaded, fontsError] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
  });

  const handleAuth = async () => {
    if (!email || !password) {
      alert('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && !name) {
      alert('Please enter your name');
      return;
    }

    setLoading(true);
    // Simulate auth delay
    setTimeout(async () => {
      try {
        await setOnboardingCompleted(true);
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Auth error:', error);
        alert('Authentication failed. Please try again.');
      }
      setLoading(false);
    }, 1000);
  };

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* Header with Back Button */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
            <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <ArrowLeft size={24} color="#111827" strokeWidth={2.5} />
              <Text style={{ fontFamily: 'Poppins-SemiBold', marginLeft: 8, color: '#111827' }}>Back</Text>
            </Pressable>

            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 32, color: '#111827', marginBottom: 8, lineHeight: 40 }}>
              {mode === 'signin' ? 'Welcome Back' : 'Get Started'}
            </Text>
            <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 16, color: '#6B7280' }}>
              {mode === 'signin'
                ? 'Sign in to access your running plans and track your progress'
                : 'Create an account and start your running journey'}
            </Text>
          </View>

          {/* Form */}
          <View style={{ paddingHorizontal: 20, flex: 1 }}>
            {/* Name Input (Sign Up only) */}
            {mode === 'signup' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: '#111827', marginBottom: 8, fontSize: 14 }}>Full Name</Text>
                <TextInput
                  placeholder="John Doe"
                  placeholderTextColor="#D1D5DB"
                  value={name}
                  onChangeText={setName}
                  style={{
                    backgroundColor: '#F9FAFB',
                    padding: 14,
                    borderRadius: 12,
                    fontFamily: 'Poppins-Regular',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                />
              </View>
            )}

            {/* Email Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Poppins-SemiBold', color: '#111827', marginBottom: 8, fontSize: 14 }}>Email</Text>
              <TextInput
                placeholder="you@example.com"
                placeholderTextColor="#D1D5DB"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                style={{
                  backgroundColor: '#F9FAFB',
                  padding: 14,
                  borderRadius: 12,
                  fontFamily: 'Poppins-Regular',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              />
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontFamily: 'Poppins-SemiBold', color: '#111827', marginBottom: 8, fontSize: 14 }}>Password</Text>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#D1D5DB"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={{
                  backgroundColor: '#F9FAFB',
                  padding: 14,
                  borderRadius: 12,
                  fontFamily: 'Poppins-Regular',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              />
            </View>

            {/* Primary Button */}
            <Pressable
              onPress={handleAuth}
              disabled={loading}
              style={{
                backgroundColor: '#FF6A2C',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 12,
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: 'Poppins-SemiBold', fontSize: 16 }}>
                {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            </Pressable>

            {/* Toggle Mode Button */}
            <Pressable
              onPress={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setEmail('');
                setPassword('');
                setName('');
              }}
              style={{ padding: 14, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#6B7280', fontFamily: 'Poppins-SemiBold', fontSize: 14 }}>
                {mode === 'signin'
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={{ color: '#FF6A2C' }}>
                  {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 24, marginTop: 24, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 20 }}>
            <Text style={{ fontFamily: 'Poppins-Regular', color: '#9CA3AF', textAlign: 'center', fontSize: 13, lineHeight: 20 }}>
              By signing in, you agree to our Terms of Service and Privacy Policy. Your data is encrypted and secure.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
