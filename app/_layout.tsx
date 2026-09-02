import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/auth-context';
import { useFonts } from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import { SplashScreen } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, I18nManager } from 'react-native';
import { Colors } from '@/lib/theme';

// English layout: Left-to-right
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Regular': Cairo_400Regular,
    'Cairo-Medium': Cairo_500Medium,
    'Cairo-SemiBold': Cairo_600SemiBold,
    'Cairo-Bold': Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={Colors.primary[500]}
        />
      </View>
    );
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="auth/login"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="auth/signup"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="auth/forgot-password"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="series/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />

        <Stack.Screen
          name="player/[episodeId]"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="admin/index"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="+not-found"
          options={{ headerShown: false }}
        />
      </Stack>

      <StatusBar style="light" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
  },
});
