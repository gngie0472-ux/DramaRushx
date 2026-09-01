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
import { ChevronLeft, Mail, CheckCircle } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: resetError } = await resetPassword(email.trim());
    if (resetError) {
      setError(resetError);
    } else {
      setSent(true);
    }
    setLoading(false);
  }, [email, resetPassword]);

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
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email to receive a reset link</Text>

        {sent ? (
          <View style={styles.successContainer}>
            <CheckCircle size={48} color={Colors.success[500]} strokeWidth={2} />
            <Text style={styles.successText}>Reset link sent! Check your email.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/auth/login')}
            >
              <Text style={styles.primaryButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

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

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleReset}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>
          </>
        )}
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
  successContainer: {
    alignItems: 'center',
    gap: 20,
    paddingTop: 40,
  },
  successText: {
    fontSize: 16,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.success[500],
    textAlign: 'center',
  },
});
