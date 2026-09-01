import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/lib/theme';

export function SkeletonBox({ width, height, radius = 8 }: { width: number | string; height: number; radius?: number }) {
  return (
    <View
      style={{
        width: width as number,
        height,
        borderRadius: radius,
        backgroundColor: Colors.dark.surfaceLight,
        overflow: 'hidden',
      }}
    />
  );
}

export function SeriesCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBox width="100%" height={180} radius={12} />
      <SkeletonBox width="80%" height={14} radius={4} />
      <SkeletonBox width="50%" height={12} radius={4} />
    </View>
  );
}

export function BannerSkeleton() {
  return (
    <View style={styles.banner}>
      <SkeletonBox width="100%" height={220} radius={16} />
    </View>
  );
}

export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <SeriesCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    gap: 8,
  padding: 4,
  borderRadius: 12,
  backgroundColor: Colors.dark.surface,
  overflow: 'hidden',
  borderWidth: 1,
    borderColor: Colors.dark.border,
  shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  banner: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
});
