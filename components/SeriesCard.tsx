import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/lib/theme';
import { Star, Lock, Play } from 'lucide-react-native';
import type { Series } from '@/lib/types';

interface SeriesCardProps {
  series: Series;
  onPress: (series: Series) => void;
  width?: number;
}

export function SeriesCard({
  series,
  onPress,
  width = 140,
}: SeriesCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(series)}
      style={[styles.card, { width }]}
    >
      <View style={styles.imageContainer}>
        {series.cover_image_url ? (
          <ImageBackground
            source={{ uri: series.cover_image_url }}
            style={styles.image}
            imageStyle={styles.imageRadius}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={styles.gradient}
            />

            <View style={styles.badges}>
              {series.is_free ? (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>
                    Free
                  </Text>
                </View>
              ) : (
                <View style={styles.paidBadge}>
                  <Lock
                    size={9}
                    color={Colors.dark.text}
                    strokeWidth={2.5}
                  />

                  <Text style={styles.paidBadgeText}>
                    Premium
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.playOverlay}>
              <View style={styles.playCircle}>
                <Play
                  size={16}
                  color={Colors.dark.text}
                  strokeWidth={2}
                  fill={Colors.dark.text}
                />
              </View>
            </View>

            <View style={styles.bottomInfo}>
              <View style={styles.ratingRow}>
                <Star
                  size={11}
                  color={Colors.warning[400]}
                  strokeWidth={2}
                  fill={Colors.warning[400]}
                />

                <Text style={styles.ratingText}>
                  {Number(series.rating).toFixed(1)}
                </Text>
              </View>

              <Text style={styles.episodeCount}>
                {series.total_episodes} Episodes
              </Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Play
              size={24}
              color={Colors.dark.textMuted}
              strokeWidth={2}
            />
          </View>
        )}
      </View>

      <Text
        style={styles.title}
        numberOfLines={1}
      >
        {series.title}
      </Text>

      <Text style={styles.status}>
        {series.status === 'completed'
          ? 'Completed'
          : 'Ongoing'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },

  imageContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surfaceLight,
  },

  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  imageRadius: {
    borderRadius: 12,
  },

  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },

  badges: {
    position: 'absolute',
    top: 8,
    right: 8,
    left: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  freeBadge: {
    backgroundColor: Colors.success[600],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  freeBadgeText: {
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  paidBadgeText: {
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  ratingText: {
    fontSize: 11,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },

  episodeCount: {
    fontSize: 10,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },

  title: {
    fontSize: 13,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
    paddingHorizontal: 4,
    textAlign: 'left',
  },

  status: {
    fontSize: 11,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,
    paddingHorizontal: 4,
    textAlign: 'left',
  },

  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceLight,
  },
});
