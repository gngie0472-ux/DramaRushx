import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import { ChevronLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = useCallback(async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signUpError } = await signUp(email.trim(), password, name.trim());
    if (signUpError) {
      setError(signUpError);
      setLoading(false);
    } else {
      router.replace('/(tabs)');
    }
  }, [name, email, password, signUp]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'android' ? undefined : 'padding'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join DramaRush and start watching</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <User size={20} color={Colors.dark.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={Colors.dark.textMuted}
            value={name}
            onChangeText={setName}
            textAlign="left"
          />
        </View>

        <View style={styles.inputContainer}>
          <Mail size={20} color={Colors.dark.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.dark.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textAlign="left"
          />
        </View>

        <View style={styles.inputContainer}>
          <Lock size={20} color={Colors.dark.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.dark.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textAlign="left"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            {showPassword ? (
              <EyeOff size={18} color={Colors.dark.textMuted} strokeWidth={2} />
            ) : (
              <Eye size={18} color={Colors.dark.textMuted} strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.error[500],
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.error[400],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 10 : 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.text,
    padding: 0,
  },
  eyeButton: {
    padding: 4,
  },
  primaryButton: {
    backgroundColor: Colors.primary[600],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
    color: Colors.primary[400],
  },
});
