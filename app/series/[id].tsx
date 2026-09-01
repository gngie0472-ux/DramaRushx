import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  FlatList,
  Alert,
  Platform,
  Share as NativeShare,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import type { Series, Episode } from '@/lib/types';
import { ErrorState } from '@/components/States';
import {
  ChevronLeft,
  Star,
  Play,
  Heart,
  Lock,
  Coins,
  CheckCircle,
  Share,
  Clock,
} from 'lucide-react-native';

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [series, setSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [unlockedEpisodes, setUnlockedEpisodes] = useState<Set<string>>(new Set());
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const [seriesRes, episodesRes] = await Promise.all([
        supabase.from('series').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('episodes')
          .select('id, series_id, episode_number, title, description, thumbnail_url, video_path, duration, is_free, coin_price, view_count, created_at')
          .eq('series_id', id)
          .order('episode_number', { ascending: true }),
      ]);

      if (seriesRes.error || !seriesRes.data) {
        setError(true);
        return;
      }

      setSeries(seriesRes.data as Series);
      setEpisodes((episodesRes.data as Episode[]) || []);

      if (session?.user) {
        const [favRes, unlockRes, subRes] = await Promise.all([
          supabase
            .from('favorites')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('series_id', id)
            .maybeSingle(),
          supabase
            .from('unlocked_episodes')
            .select('episode_id')
            .eq('user_id', session.user.id)
            .in('episode_id', ((episodesRes.data as Episode[]) || []).map((e) => e.id)),
          supabase.rpc('has_active_subscription'),
        ]);
        setIsFavorite(!!favRes.data);
        const unlocked = new Set<string>(
          ((unlockRes.data as any[]) || []).map((r) => r.episode_id)
        );
        setUnlockedEpisodes(unlocked);
        setHasSubscription(!!subRes.data);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleFavorite = useCallback(async () => {
    if (!session?.user) {
      Alert.alert('Sign in required', 'Please sign in to add favorites');
      router.push('/auth/login');
      return;
    }
    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', session.user.id)
        .eq('series_id', id);
      setIsFavorite(false);
    } else {
      await supabase
        .from('favorites')
        .insert({ user_id: session.user.id, series_id: id });
      setIsFavorite(true);
    }
  }, [session, isFavorite, id]);

  const handleEpisodePress = useCallback(
    (episode: Episode) => {
      const isUnlocked = episode.is_free || series?.is_free || hasSubscription || unlockedEpisodes.has(episode.id);
      if (!isUnlocked && !session?.user) {
        Alert.alert('Sign in required', 'Please sign in to unlock episodes');
        router.push('/auth/login');
        return;
      }
      router.push(`/player/${episode.id}`);
    },
    [unlockedEpisodes, session, hasSubscription, series]
  );

  const handleUnlock = useCallback(
    async (episode: Episode) => {
      if (!session?.user) {
        Alert.alert('Sign in required', 'Please sign in to unlock episodes');
        router.push('/auth/login');
        return;
      }
      Alert.alert(
        'Unlock Episode',
        `Unlock "${episode.title}" for ${episode.coin_price} coins?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unlock',
            onPress: async () => {
              const { data, error } = await supabase.rpc('unlock_episode', {
                p_episode_id: episode.id,
              });
              if (error) {
                Alert.alert('Error', 'Failed to unlock episode');
                return;
              }
              const result = data as any;
              if (result?.success) {
                setUnlockedEpisodes((prev) => new Set([...prev, episode.id]));
                Alert.alert('Success', result.message || 'Episode unlocked!');
              } else {
                Alert.alert('Cannot unlock', result?.message || 'Insufficient coins');
              }
            },
          },
        ]
      );
    },
    [session]
  );

  if (loading) {
    return <View style={styles.container} />;
  }

  if (error || !series) {
    return <ErrorState message="Failed to load series data." onRetry={fetchData} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.bannerContainer}>
          <ImageBackground
            source={{ uri: series.banner_image_url || series.cover_image_url || '' }}
            style={styles.banner}
          >
            <LinearGradient
              colors={['transparent', 'rgba(10,10,15,0.6)', Colors.dark.background]}
              style={styles.bannerGradient}
            />
            <View style={styles.bannerHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <ChevronLeft size={24} color={Colors.dark.text} strokeWidth={2} />
              </TouchableOpacity>
              <View style={styles.bannerActions}>
                <TouchableOpacity style={styles.iconButton} onPress={toggleFavorite}>
                  <Heart
                    size={22}
                    color={isFavorite ? Colors.error[500] : Colors.dark.text}
                    strokeWidth={2}
                    fill={isFavorite ? Colors.error[500] : 'transparent'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => NativeShare.share({ message: `${series.title} — شاهد الآن في DramaRush` })}
                >
                  <Share size={20} color={Colors.dark.text} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{series.title}</Text>
          <View style={styles.metaRow}>
            <View style={styles.ratingContainer}>
              <Star size={16} color={Colors.warning[400]} strokeWidth={2} fill={Colors.warning[400]} />
              <Text style={styles.ratingText}>{Number(series.rating).toFixed(1)}</Text>
            </View>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={styles.metaText}>{series.total_episodes} Episodes</Text>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={[styles.metaText, { color: series.status === 'completed' ? Colors.success[400] : Colors.primary[400] }]}>
              {series.status === 'completed' ? 'Completed' : 'Ongoing'}
            </Text>
            {series.is_free && (
              <>
                <Text style={styles.metaDivider}>|</Text>
                <Text style={[styles.metaText, { color: Colors.success[400] }]}>Free</Text>
              </>
            )}
          </View>

          {series.description && (
            <Text style={styles.description}>{series.description}</Text>
          )}

          {episodes.length > 0 && (
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => handleEpisodePress(episodes[0])}
            >
              <Play size={18} color={Colors.dark.background} strokeWidth={2.5} fill={Colors.dark.background} />
              <Text style={styles.playButtonText}>
                {episodes[0].is_free || unlockedEpisodes.has(episodes[0].id) ? 'Play First Episode' : 'Watch Preview'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Episodes */}
        <View style={styles.episodesSection}>
          <Text style={styles.episodesTitle}>Episodes</Text>
          <Text style={styles.episodesCount}>{episodes.length} episodes</Text>
        </View>

        <FlatList
          data={episodes}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.episodesList}
          renderItem={({ item }) => (
            <EpisodeRow
              episode={item}
              isUnlocked={item.is_free || series.is_free || hasSubscription || unlockedEpisodes.has(item.id)}
              onPress={() => handleEpisodePress(item)}
              onUnlock={() => handleUnlock(item)}
            />
          )}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function EpisodeRow({
  episode,
  isUnlocked,
  onPress,
  onUnlock,
}: {
  episode: Episode;
  isUnlocked: boolean;
  onPress: () => void;
  onUnlock: () => void;
}) {
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={styles.episodeRow}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.episodeThumb}>
        {episode.thumbnail_url ? (
          <ImageBackground
            source={{ uri: episode.thumbnail_url }}
            style={styles.episodeThumbImage}
            imageStyle={styles.episodeThumbRadius}
          >
            <View style={styles.episodePlayOverlay}>
              <Play size={16} color={Colors.dark.text} strokeWidth={2} fill={Colors.dark.text} />
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.episodeThumbImage, styles.episodeThumbPlaceholder]}>
            <Play size={20} color={Colors.dark.textMuted} strokeWidth={2} />
          </View>
        )}
        <View style={styles.episodeNumberBadge}>
          <Text style={styles.episodeNumberText}>{episode.episode_number}</Text>
        </View>
      </View>

      <View style={styles.episodeInfo}>
        <Text style={styles.episodeTitle} numberOfLines={1}>{episode.title}</Text>
        {episode.description && (
          <Text style={styles.episodeDescription} numberOfLines={2}>{episode.description}</Text>
        )}
        <View style={styles.episodeMeta}>
          <View style={styles.durationContainer}>
            <Clock size={12} color={Colors.dark.textMuted} strokeWidth={2} />
            <Text style={styles.durationText}>{formatDuration(episode.duration)}</Text>
          </View>
          {episode.is_free ? (
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>Free</Text>
            </View>
          ) : isUnlocked ? (
            <View style={styles.unlockedBadge}>
              <CheckCircle size={12} color={Colors.success[400]} strokeWidth={2} />
              <Text style={styles.unlockedBadgeText}>Unlocked</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.unlockButton} onPress={onUnlock}>
              <Lock size={12} color={Colors.primary[400]} strokeWidth={2} />
              <Coins size={12} color={Colors.primary[400]} strokeWidth={2} />
              <Text style={styles.unlockButtonText}>{episode.coin_price}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  bannerContainer: {
    height: 280,
  },
  banner: {
    flex: 1,
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Platform.OS === 'android' ? 40 : 56,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.warning[400],
  },
  metaDivider: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  metaText: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary[600],
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
  },
  playButtonText: {
    fontSize: 15,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.background,
  },
  episodesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  episodesTitle: {
    fontSize: 18,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  episodesCount: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  episodesList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  episodeRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  episodeThumb: {
    width: 100,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.dark.surfaceLight,
  },
  episodeThumbImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeThumbRadius: {
    borderRadius: 8,
  },
  episodeThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodePlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  episodeNumberBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  episodeNumberText: {
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  episodeInfo: {
    flex: 1,
    gap: 4,
  },
  episodeTitle: {
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  episodeDescription: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  episodeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,
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
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unlockedBadgeText: {
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    color: Colors.success[400],
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary[500],
  },
  unlockButtonText: {
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    color: Colors.primary[400],
  },
});
