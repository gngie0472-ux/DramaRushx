import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ImageBackground,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@/lib/theme';

import {
  Star,
  Lock,
  Play,
} from 'lucide-react-native';

import type { Series } from '@/lib/types';

interface SeriesCardProps {
  series: Series;
  onPress: (series: Series) => void;
  width?: number;
}

export function SeriesCard({
  series,
  onPress,
  width = 110,
}: SeriesCardProps) {
  const imageHeight = Math.round(width * 1.42);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(series)}
      style={[
        styles.card,
        {
          width,
        },
      ]}
    >
      <View
        style={[
          styles.imageContainer,
          {
            height: imageHeight,
          },
        ]}
      >
        {series.cover_image_url ? (
          <ImageBackground
            source={{
              uri: series.cover_image_url,
            }}
            style={styles.image}
            imageStyle={styles.imageRadius}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[
                'transparent',
                'rgba(0,0,0,0.88)',
              ]}
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
                    size={8}
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
                  size={15}
                  color={Colors.dark.text}
                  strokeWidth={2}
                  fill={Colors.dark.text}
                />
              </View>
            </View>

            <View style={styles.bottomInfo}>
              <View style={styles.ratingRow}>
                <Star
                  size={10}
                  color={Colors.warning[400]}
                  fill={Colors.warning[400]}
                />

                <Text style={styles.ratingText}>
                  {Number(series.rating).toFixed(1)}
                </Text>
              </View>

              <Text
                style={styles.episodeCount}
                numberOfLines={1}
              >
                {series.total_episodes} Ep
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
              size={24}
              color={Colors.dark.textMuted}
            />
          </View>
        )}
      </View>

      <Text
        style={styles.title}
        numberOfLines={2}
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
    gap: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },

  imageContainer: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surfaceLight,
  },

  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  imageRadius: {
    borderRadius: 10,
  },

  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },

  badges: {
    position: 'absolute',
    top: 6,
    right: 6,
    left: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  freeBadge: {
    backgroundColor: Colors.success[600],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },

  freeBadgeText: {
    fontSize: 8,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },

  paidBadgeText: {
    fontSize: 8,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },

  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  ratingText: {
    fontSize: 9,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },

  episodeCount: {
    fontSize: 8,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },

  title: {
    fontSize: 12,
    lineHeight: 16,
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
    backgroundColor: Colors.dark.surfaceLight,
  },
});
