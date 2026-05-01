import { Redirect } from "expo-router";
import { useAuth } from "@/utils/auth/useAuth";

export default function Index() {
  const { onboardingCompleted } = useAuth();
  return <Redirect href={onboardingCompleted ? "/(tabs)" : "/onboarding"} />;
}
