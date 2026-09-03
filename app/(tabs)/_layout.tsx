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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const isAndroid = Platform.OS === 'android';

  // ارتفاع أساسي للشريط + المساحة التي يحجزها شريط نظام Android
  const baseTabBarHeight = isAndroid ? 62 : 62;
  const bottomInset = isAndroid ? Math.max(insets.bottom, 0) : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // اللون النشط
        tabBarActiveTintColor: Colors.primary[500],

        // اللون غير النشط
        tabBarInactiveTintColor: Colors.dark.textMuted,

        // مهم: الشريط دائمًا في الأسفل
        tabBarPosition: 'bottom',

        // منع تداخل الشريط مع أزرار Android السفلية
        tabBarStyle: {
          position: 'relative',

          backgroundColor: Colors.dark.surface,

          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,

          height: baseTabBarHeight + bottomInset,

          paddingTop: 6,

          // إضافة مساحة أسفل الأيقونات حسب Safe Area
          paddingBottom: bottomInset + (isAndroid ? 5 : 12),

          elevation: 10,

          // Android
          shadowOpacity: 0,

          // منع أي تمدد غريب
          overflow: 'hidden',
        },

        tabBarLabelStyle: {
          fontFamily: 'Cairo-Regular',
          fontSize: 10,
          marginTop: 1,
        },

        tabBarItemStyle: {
          paddingVertical: 1,
        },

        // جعل منطقة المحتوى لا تختفي خلف الشريط
        tabBarHideOnKeyboard: false,
      }}
    >
      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      {/* CATEGORIES */}
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarAccessibilityLabel: 'Categories',
          tabBarIcon: ({ size, color }) => (
            <LayoutGrid
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      {/* SEARCH */}
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search',
          tabBarIcon: ({ size, color }) => (
            <Search
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      {/* FAVORITES */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarAccessibilityLabel: 'Favorites',
          tabBarIcon: ({ size, color }) => (
            <Heart
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      {/* PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile',
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
