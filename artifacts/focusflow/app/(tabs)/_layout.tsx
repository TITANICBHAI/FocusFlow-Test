import { BlurView } from "expo-blur";
import { router, Tabs, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { COLORS } from "@/styles/theme";
import { useTheme } from "@/hooks/useTheme";

const TAB_PATHS = [
  "/(tabs)/focus",
  "/(tabs)",
  "/(tabs)/defense",
  "/(tabs)/stats",
  "/(tabs)/settings",
] as const;

type TabPath = (typeof TAB_PATHS)[number];

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { theme, isDark } = useTheme();

  const tabBarH = isWeb ? 84 : 60 + insets.bottom;
  const currentTabIndex = TAB_PATHS.indexOf(pathname as TabPath);

  const navigateToTab = useCallback((index: number) => {
    const nextPath = TAB_PATHS[index];
    if (nextPath && index !== currentTabIndex) router.replace(nextPath);
  }, [currentTabIndex]);

  const tabSwipeGesture = Gesture.Pan()
    .activeOffsetX([-32, 32])
    .failOffsetY([-14, 14])
    .minDistance(32)
    .runOnJS(true)
    .onEnd((event) => {
      if (currentTabIndex < 0) return;
      if (event.translationX <= -60 && currentTabIndex < TAB_PATHS.length - 1) {
        navigateToTab(currentTabIndex + 1);
      } else if (event.translationX >= 60 && currentTabIndex > 0) {
        navigateToTab(currentTabIndex - 1);
      }
    });

  return (
    <GestureDetector gesture={tabSwipeGesture}>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: theme.muted,
            headerShown: false,
            tabBarStyle: {
              position: "absolute",
              backgroundColor: isDark
                ? theme.tabBar
                : isIOS
                ? "transparent"
                : theme.tabBar,
              borderTopWidth: isWeb || isDark ? 1 : 0,
              borderTopColor: theme.tabBarBorder,
              elevation: 8,
              height: tabBarH,
              paddingBottom: isWeb ? 34 : insets.bottom + 6,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "600",
              color: theme.textSecondary,
            },
            tabBarBackground: () =>
              isIOS && !isDark ? (
                <BlurView
                  intensity={100}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: theme.tabBar },
                  ]}
                />
              ),
          }}
        >
        <Tabs.Screen
          name="focus"
          options={{
            title: "Focus",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "timer" : "timer-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: "Schedule",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "calendar" : "calendar-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="defense"
          options={{
            title: "Defense",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused ? "shield-checkmark" : "shield-checkmark-outline"
                }
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "bar-chart" : "bar-chart-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        </Tabs>
      </View>
    </GestureDetector>
  );
}
