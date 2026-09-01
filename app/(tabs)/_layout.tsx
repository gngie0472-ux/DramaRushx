import { Tabs } from 'expo-router';
import { Colors } from '@/lib/theme';
import { Home, LayoutGrid, Search, Heart, User } from 'lucide-react-native';
import { Platform, I18nManager } from 'react-native';

I18nManager.forceRTL(true);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary[500],
        tabBarInactiveTintColor: Colors.dark.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.dark.surface,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 60 : 80,
          paddingBottom: Platform.OS === 'android' ? 8 : 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'Cairo-Regular',
          fontSize: 11,
        },
        tabBarPosition: I18nManager.isRTL ? 'left' : 'right',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'التصنيفات',
          tabBarIcon: ({ size, color }) => <LayoutGrid size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'البحث',
          tabBarIcon: ({ size, color }) => <Search size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'المفضلة',
          tabBarIcon: ({ size, color }) => <Heart size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
