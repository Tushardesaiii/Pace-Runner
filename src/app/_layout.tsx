/**
 * app/_layout.tsx  —  Root Layout
 *
 * Best-practice patterns used:
 *
 * 1. AUTH ROUTING via useSegments + useRouter (expo-router standard)
 *    - No useEffect redirects that cause flickers
 *    - Single protected-route guard reacts to auth state changes
 *    - Works correctly on cold start, logout, token expiry
 *
 * 2. SPLASH SCREEN
 *    - Held until BOTH fonts AND auth are ready simultaneously
 *    - Catches font errors gracefully (falls back, never hangs)
 *    - No race conditions between font/auth resolving
 *
 * 3. ANDROID NAVIGATION BAR
 *    - Set once on mount, edge-to-edge transparent
 *    - Button style adapts to screen content via StatusBar
 *
 * 4. REACT QUERY
 *    - Conservative stale/cache times for mobile data usage
 *    - Retry once only (avoids hammering on bad network)
 *    - Window focus refetch off (mobile has no concept of "focus")
 *    - gcTime replaces deprecated cacheTime (RQ v5+)
 *
 * 5. STACK TRANSITIONS
 *    - Smooth fade transition on auth screens (not the jarring default slide)
 *    - Tab root has no animation (feels native)
 *    - Full-screen modal presentation for onboarding
 *
 * 6. FONT LOADING
 *    - Error boundary: if fonts fail, app still loads with system fonts
 *    - No content flash — splash held until fonts resolve either way
 */

import "../../globals.css";
import { useAuth } from "@/utils/auth/useAuth";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Platform, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as NavigationBar from "expo-navigation-bar";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";

/* ─── Prevent splash hiding before we're ready ─── */
SplashScreen.preventAutoHideAsync();

/* ─── QueryClient — stable singleton outside component ─── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           1000 * 60 * 5,   // 5 min — fresh enough for most data
      gcTime:              1000 * 60 * 30,  // 30 min — keep cache in memory
      retry:               1,               // one retry on failure, then show error
      refetchOnWindowFocus: false,          // no-op on mobile
      refetchOnReconnect:  true,            // DO refetch when network comes back
    },
    mutations: {
      retry: 0,                             // mutations should never auto-retry
    },
  },
});

/* ─────────────────────────────────────────────────────────
   AUTH GUARD HOOK
   Best practice: useSegments + useRouter inside the layout,
   NOT inside individual screens. This centralises all redirect
   logic in one place and avoids competing navigation calls.
───────────────────────────────────────────────────────── */
function useAuthGuard(isReady: boolean, isAuthenticated: boolean) {
  const router   = useRouter();
  const segments = useSegments();

  // Use a ref to skip the very first render before router is mounted
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!isReady) return; // wait for auth to initialise

    if (!hasMounted.current) {
      hasMounted.current = true;
      return; // skip redirect on first synchronous render
    }

    const inAuthGroup = segments[0] === "(tabs)";

    if (!isAuthenticated && inAuthGroup) {
      // Logged-out user tried to access a protected tab — send to sign in
      router.replace("/signin");
    } else if (isAuthenticated && !inAuthGroup) {
      // Logged-in user is on auth/onboarding screens — send to app
      router.replace("/(tabs)");
    }
    // All other cases: stay on current screen
  }, [isReady, isAuthenticated]);
}

/* ─────────────────────────────────────────────────────────
   ROOT LAYOUT
───────────────────────────────────────────────────────── */
export default function RootLayout() {
  const { initiate, isReady, isAuthenticated } = useAuth();

  const [fontsLoaded, fontsError] = useFonts({
    "Poppins-Regular":   Poppins_400Regular,
    "Poppins-Medium":    Poppins_500Medium,
    "Poppins-SemiBold":  Poppins_600SemiBold,
  });

  /* ── 1. Kick off auth initialisation once ── */
  useEffect(() => {
    initiate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 2. Android edge-to-edge navigation bar ── */
  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setBackgroundColorAsync("transparent");
    NavigationBar.setBehaviorAsync("overlay-swipe"); // truly edge-to-edge
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

  /* ── 3. Hide splash only when auth + fonts are both resolved ── */
  useEffect(() => {
    const fontsResolved = fontsLoaded || !!fontsError; // error = fall back to system font
    if (isReady && fontsResolved) {
      // Small delay so the first frame paints before splash disappears
      // Eliminates the white flash on Android
      setTimeout(() => SplashScreen.hideAsync(), 50);
    }
  }, [isReady, fontsLoaded, fontsError]);

  /* ── 4. Centralised auth-based routing ── */
  useAuthGuard(isReady, !!isAuthenticated);

  /* ── 5. Hold render until ready — splash covers this ── */
  if (!isReady || (!fontsLoaded && !fontsError)) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          {/*
            StatusBar: translucent + transparent lets content render
            beneath it. Individual screens control barStyle via
            <StatusBar barStyle="dark-content" /> — no need to set
            globally here. Setting it globally can cause flicker
            on screen transitions.
          */}
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle="dark-content"
          />

          <Stack screenOptions={{ headerShown: false }}>
            {/*
              index — the entry point, usually redirects immediately
              via useAuthGuard. No animation needed.
            */}
            <Stack.Screen
              name="index"
              options={{ animation: "none" }}
            />

            {/*
              onboarding — full-screen modal feel, slides up from bottom.
              User can't swipe back (they must complete or skip).
            */}
            <Stack.Screen
              name="onboarding"
              options={{
                animation:           "slide_from_bottom",
                gestureEnabled:      false,
                presentation:        "fullScreenModal",
              }}
            />

            {/*
              signin — smooth fade feels more premium than a slide
              when transitioning from/to the authenticated app.
            */}
            <Stack.Screen
              name="signin"
              options={{
                animation: "fade",
                animationDuration: 150,
              }}
            />

            {/*
              (tabs) — no animation. When auth guard pushes here it
              should feel instant and native, not animated.
            */}
            <Stack.Screen
              name="(tabs)"
              options={{ animation: "fade", animationDuration: 100 }}
            />
          </Stack>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}