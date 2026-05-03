import { Redirect } from "expo-router";
import { useAuth } from "@/utils/auth/useAuth";
import { useEffect, useState } from "react";

export default function Index() {
  const { onboardingCompleted, setOnboardingCompleted } = useAuth();
  const [ready, setReady] = useState(false);

  // Reset onboarding state for testing the new UI
  useEffect(() => {
    if (setOnboardingCompleted && onboardingCompleted) {
      setOnboardingCompleted(false);
    }
    setReady(true);
  }, [setOnboardingCompleted, onboardingCompleted]);

  if (!ready) return null;

  return <Redirect href={onboardingCompleted ? "/(tabs)" : "/onboarding"} />;
}
