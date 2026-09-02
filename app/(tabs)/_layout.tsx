import { Tabs } from 'expo-router';
import { Colors } from '@/lib/theme';
import {
  Home,
  LayoutGrid,
  Search,
  Heart,
  User,
} from 'lucide-react-native';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: Colors.primary[500],
        tabBarInactiveTintColor: Colors.dark.textMuted,

        /*
         * IMPORTANT:
         * The old layout used:
         * tabBarPosition: 'left'
         *
         * That created the permanent white/gray sidebar.
         *
         * We now use the normal Android bottom navigation.
         */
        tabBarPosition: 'bottom',

        tabBarStyle: {
          backgroundColor: Colors.dark.surface,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,

          height: Platform.OS === 'android' ? 62 : 82,

          paddingBottom:
            Platform.OS === 'android' ? 7 : 20,

          paddingTop: 6,

          elevation: 10,
        },

        tabBarLabelStyle: {
          fontFamily: 'Cairo-Regular',
          fontSize: 10,
          marginTop: 1,
        },

        tabBarItemStyle: {
          paddingVertical: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ size, color }) => (
            <LayoutGrid
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ size, color }) => (
            <Search
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ size, color }) => (
            <Heart
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => (
            <User
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
