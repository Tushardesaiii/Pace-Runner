import { Tabs } from "expo-router";
import { Calculator, Calendar, Trophy, Activity } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderColor: "#E2E8F0",
        },
        tabBarActiveTintColor: "#0F172A",
        tabBarInactiveTintColor: "#64748B",
        tabBarLabelStyle: {
          fontFamily: "System",
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Calculator",
          tabBarIcon: ({ color, size }) => (
            <Calculator color={color} size={24} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={24} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Activity color={color} size={24} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="race"
        options={{
          title: "Race",
          tabBarIcon: ({ color, size }) => (
            <Trophy color={color} size={24} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  );
}
