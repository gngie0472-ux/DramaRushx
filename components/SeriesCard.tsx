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
  width = 150,
}: SeriesCardProps) {
  const imageHeight = Math.round(width * 1.34);

  const imageUrl =
    series.cover_image_url ||
    series.banner_image_url ||
    '';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(series)}
      style={[styles.card, { width }]}
    >
      <View
        style={[
          styles.imageContainer,
          { height: imageHeight },
        ]}
      >
        {imageUrl ? (
          <ImageBackground
            source={{ uri: imageUrl }}
            style={styles.image}
            imageStyle={styles.imageRadius}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[
                'transparent',
                'rgba(8,8,12,0.18)',
                'rgba(8,8,12,0.94)',
              ]}
              style={styles.gradient}
            />

            <View style={styles.badges}>
              {series.is_free ? (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>
                    FREE
                  </Text>
                </View>
              ) : (
                <View style={styles.paidBadge}>
                  <Lock
                    size={10}
                    color={Colors.primary[300]}
                    strokeWidth={2.5}
                  />

                  <Text style={styles.paidBadgeText}>
                    VIP
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.playOverlay}>
              <View style={styles.playCircle}>
                <Play
                  size={18}
                  color={Colors.dark.text}
                  strokeWidth={2.4}
                  fill={Colors.dark.text}
                />
              </View>
            </View>

            <View style={styles.bottomInfo}>
              <View style={styles.ratingRow}>
                <Star
                  size={12}
                  color={Colors.warning[400]}
                  fill={Colors.warning[400]}
                  strokeWidth={1.5}
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
          <View
            style={[
              styles.image,
              styles.placeholder,
            ]}
          >
            <Play
              size={30}
              color={Colors.dark.textMuted}
              strokeWidth={1.8}
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

      <Text
        style={styles.status}
        numberOfLines={1}
      >
        {series.status === 'completed'
          ? 'Completed'
          : 'Ongoing'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 5,
  },

  imageContainer: {
    width: '100%',
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor:
      Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.06)',
  },

  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  imageRadius: {
    borderRadius: 13,
  },

  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },

  badges: {
    position: 'absolute',
    top: 9,
    right: 9,
  },

  freeBadge: {
    backgroundColor:
      Colors.success[600],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },

  freeBadgeText: {
    fontSize: 9,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor:
      'rgba(20,15,25,0.88)',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
  },

  paidBadgeText: {
    fontSize: 9,
    fontFamily: 'Cairo-Bold',
    color: Colors.primary[300],
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      'rgba(10,10,15,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.38)',
  },

  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingBottom: 9,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  ratingText: {
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  episodeCount: {
    fontSize: 9,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },

  title: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
    paddingHorizontal: 2,
  },

  status: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,
    paddingHorizontal: 2,
  },

  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      Colors.dark.surfaceLight,
  },
});
