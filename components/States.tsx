import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/lib/theme';
import { RefreshCw } from 'lucide-react-native';

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <RefreshCw size={16} color={Colors.dark.text} strokeWidth={2} />
          <Text style={styles.retryText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  text: {
    fontSize: 15,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary[600],
    borderRadius: 12,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
});
