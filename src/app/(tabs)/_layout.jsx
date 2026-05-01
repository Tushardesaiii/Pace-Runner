import { useEffect } from "react";
import { Tabs } from "expo-router";
import { SplashScreen } from "expo-router";
import { 
  useFonts, 
  Poppins_500Medium 
} from "@expo-google-fonts/poppins";
import { 
  Calculator, 
  Calendar, 
  Trophy, 
  Activity 
} from "lucide-react-native";

// Prevent splash screen from hiding until fonts load
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const [loaded, error] = useFonts({
    "Poppins-Medium": Poppins_500Medium,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderColor: "#E2E8F0",
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#0F172A",
        tabBarInactiveTintColor: "#64748B",
        tabBarLabelStyle: {
          fontFamily: "Poppins-Medium",
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Calculator",
          tabBarIcon: ({ color }) => <Calculator color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <Activity color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="race"
        options={{
          title: "Race",
          tabBarIcon: ({ color }) => <Trophy color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}