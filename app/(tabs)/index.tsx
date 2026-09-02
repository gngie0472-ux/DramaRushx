import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import type { Series, ContinueWatchingItem } from '@/lib/types';
import { SeriesRow } from '@/components/SeriesRow';
import { BannerSkeleton, RowSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { Star, Play, TrendingUp } from 'lucide-react-native';

export default function HomeScreen() {
  const { session } = useAuth();

  const [featured, setFeatured] = useState<Series[]>([]);
  const [trending, setTrending] = useState<Series[]>([]);
  const [latest, setLatest] = useState<Series[]>([]);
  const [romance, setRomance] = useState<Series[]>([]);
  const [thriller, setThriller] = useState<Series[]>([]);
  const [family, setFamily] = useState<Series[]>([]);
  const [completed, setCompleted] = useState<Series[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);

  const fetchData = useCallback(async () => {
    setError(false);

    try {
      const { data: cats } = await supabase
        .from('categories')
        .select('id, slug');

      const catMap: Record<string, string> = {};

      (cats || []).forEach((c: any) => {
        catMap[c.slug] = c.id;
      });

      const [
        featuredRes,
        trendingRes,
        latestRes,
        romanceRes,
        thrillerRes,
        familyRes,
        completedRes,
      ] = await Promise.all([
        supabase
          .from('series')
          .select('*')
          .eq('is_featured', true)
          .order('view_count', { ascending: false })
          .limit(5),

        supabase
          .from('series')
          .select('*')
          .order('view_count', { ascending: false })
          .limit(10),

        supabase
          .from('series')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),

        catMap['romance']
          ? supabase
              .from('series')
              .select('*')
              .eq('category_id', catMap['romance'])
              .limit(10)
          : Promise.resolve({ data: [], error: null }),

        catMap['thriller']
          ? supabase
              .from('series')
              .select('*')
              .eq('category_id', catMap['thriller'])
              .limit(10)
          : Promise.resolve({ data: [], error: null }),

        catMap['family']
          ? supabase
              .from('series')
              .select('*')
              .eq('category_id', catMap['family'])
              .limit(10)
          : Promise.resolve({ data: [], error: null }),

        supabase
          .from('series')
          .select('*')
          .eq('status', 'completed')
          .limit(10),
      ]);

      if (
        featuredRes.error ||
        trendingRes.error ||
        latestRes.error
      ) {
        throw new Error('Failed to load content');
      }

      setFeatured((featuredRes.data as Series[]) || []);
      setTrending((trendingRes.data as Series[]) || []);
      setLatest((latestRes.data as Series[]) || []);
      setRomance((romanceRes.data as Series[]) || []);
      setThriller((thrillerRes.data as Series[]) || []);
      setFamily((familyRes.data as Series[]) || []);
      setCompleted((completedRes.data as Series[]) || []);

      if (session?.user) {
        await fetchContinueWatching();
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  const fetchContinueWatching = async () => {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('watch_history')
      .select(`
        series_id,
        episode_id,
        position,
        duration,
        watched_at,
        series:series!inner(title, cover_image_url),
        episode:episodes!inner(episode_number, title)
      `)
      .eq('user_id', session.user.id)
      .order('watched_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      const items: ContinueWatchingItem[] = (data as any[]).map((row) => ({
        series_id: row.series_id,
        episode_id: row.episode_id,
        position: row.position,
        duration: row.duration,
        watched_at: row.watched_at,
        series_title: row.series?.title ?? '',
        series_cover: row.series?.cover_image_url ?? null,
        episode_number: row.episode?.episode_number ?? 0,
        episode_title: row.episode?.title ?? '',
      }));

      const unique = items.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (t) => t.series_id === item.series_id
          )
      );

      setContinueWatching(unique.slice(0, 6));
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (featured.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentBanner(
        (prev) => (prev + 1) % featured.length
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [featured.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleSeriesPress = (series: Series) => {
    router.push(`/series/${series.id}`);
  };

  if (loading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.loadingContent}
      >
        <BannerSkeleton />
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ErrorState
        message="An error occurred while loading content. Please check your internet connection."
        onRetry={fetchData}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary[500]}
        />
      }
    >
      {featured.length > 0 && (
        <FeaturedBanner
          series={featured[currentBanner]}
          onPress={handleSeriesPress}
        />
      )}

      {continueWatching.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Continue Watching
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowContent}
          >
            {continueWatching.map((item) => (
              <ContinueWatchingCard
                key={item.series_id}
                item={item}
                onPress={() =>
                  router.push(`/player/${item.episode_id}`)
                }
              />
            ))}
          </ScrollView>
        </View>
      )}

      <SeriesRow
        title="Most Watched"
        series={trending}
        onSeriesPress={handleSeriesPress}
      />

      <SeriesRow
        title="Latest Drama"
        series={latest}
        onSeriesPress={handleSeriesPress}
      />

      <SeriesRow
        title="Romance"
        series={romance}
        onSeriesPress={handleSeriesPress}
      />

      <SeriesRow
        title="Thriller"
        series={thriller}
        onSeriesPress={handleSeriesPress}
      />

      <SeriesRow
        title="Family Drama"
        series={family}
        onSeriesPress={handleSeriesPress}
      />

      <SeriesRow
        title="Completed"
        series={completed}
        onSeriesPress={handleSeriesPress}
      />

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function FeaturedBanner({
  series,
  onPress,
}: {
  series: Series;
  onPress: (s: Series) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(series)}
      style={styles.bannerContainer}
    >
      <ImageBackground
        source={{
          uri:
            series.banner_image_url ||
            series.cover_image_url ||
            '',
        }}
        style={styles.bannerImage}
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(10,10,15,0.5)',
            Colors.dark.background,
          ]}
          style={styles.bannerGradient}
        />

        <View style={styles.bannerContent}>
          <View style={styles.bannerTopRow}>
            <View style={styles.featuredBadge}>
              <TrendingUp
                size={12}
                color={Colors.primary[500]}
                strokeWidth={2.5}
              />

              <Text style={styles.featuredText}>
                Featured
              </Text>
            </View>

            <View style={styles.ratingContainer}>
              <Star
                size={14}
                color={Colors.warning[400]}
                strokeWidth={2}
                fill={Colors.warning[400]}
              />

              <Text style={styles.ratingText}>
                {Number(series.rating).toFixed(1)}
              </Text>
            </View>
          </View>

          <View style={styles.bannerBottom}>
            <Text
              style={styles.bannerTitle}
              numberOfLines={2}
            >
              {series.title}
            </Text>

            {series.description && (
              <Text
                style={styles.bannerDescription}
                numberOfLines={2}
              >
                {series.description}
              </Text>
            )}

            <View style={styles.bannerMeta}>
              <Text style={styles.bannerEpisodes}>
                {series.total_episodes} Episodes
              </Text>

              <Text style={styles.bannerStatus}>
                {series.status === 'completed'
                  ? 'Completed'
                  : 'Ongoing'}
              </Text>

              {series.is_free && (
                <Text style={styles.bannerFree}>
                  Free
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.playButton}
              onPress={() => onPress(series)}
            >
              <Play
                size={16}
                color={Colors.dark.background}
                strokeWidth={2.5}
                fill={Colors.dark.background}
              />

              <Text style={styles.playButtonText}>
                Watch Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

function ContinueWatchingCard({
  item,
  onPress,
}: {
  item: ContinueWatchingItem;
  onPress: () => void;
}) {
  const progress =
    item.duration > 0
      ? (item.position / item.duration) * 100
      : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.cwCard}
    >
      <ImageBackground
        source={{ uri: item.series_cover || '' }}
        style={styles.cwImage}
        imageStyle={styles.cwImageRadius}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.cwGradient}
        />

        <View style={styles.cwPlayOverlay}>
          <View style={styles.cwPlayCircle}>
            <Play
              size={14}
              color={Colors.dark.text}
              strokeWidth={2}
              fill={Colors.dark.text}
            />
          </View>
        </View>

        <View style={styles.cwInfo}>
          <Text
            style={styles.cwEpisode}
            numberOfLines={1}
          >
            {item.episode_title}
          </Text>

          <View style={styles.cwProgressContainer}>
            <View style={styles.cwProgressBar}>
              <View
                style={[
                  styles.cwProgressFill,
                  {
                    width: `${Math.min(
                      progress,
                      100
                    )}%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.cwProgressText}>
              {Math.round(progress)}%
            </Text>
          </View>
        </View>
      </ImageBackground>

      <Text
        style={styles.cwTitle}
        numberOfLines={1}
      >
        {item.series_title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },

  content: {
    paddingBottom: 24,
  },

  loadingContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 24,
  },

  section: {
    marginVertical: 8,
  },

  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
    paddingHorizontal: 16,
    marginBottom: 12,
    textAlign: 'left',
  },

  rowContent: {
    paddingHorizontal: 12,
    gap: 12,
  },

  bannerContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    height: 260,
    backgroundColor: Colors.dark.surfaceLight,
  },

  bannerImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },

  bannerContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },

  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary[500],
  },

  featuredText: {
    fontSize: 12,
    fontFamily: 'Cairo-Bold',
    color: Colors.primary[400],
  },

  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  ratingText: {
    fontSize: 13,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },

  bannerBottom: {
    gap: 8,
  },

  bannerTitle: {
    fontSize: 26,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
    textAlign: 'left',
  },

  bannerDescription: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    textAlign: 'left',
  },

  bannerMeta: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  bannerEpisodes: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },

  bannerStatus: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.primary[400],
  },

  bannerFree: {
    fontSize: 12,
    fontFamily: 'Cairo-Bold',
    color: Colors.success[400],
  },

  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },

  playButtonText: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.background,
  },

  cwCard: {
    width: 200,
    gap: 6,
  },

  cwImage: {
    height: 120,
    justifyContent: 'flex-end',
    borderRadius: 12,
    overflow: 'hidden',
  },

  cwImageRadius: {
    borderRadius: 12,
  },

  cwGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },

  cwPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cwPlayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  cwInfo: {
    padding: 8,
    gap: 4,
  },

  cwEpisode: {
    fontSize: 11,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
    textAlign: 'left',
  },

  cwProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cwProgressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  cwProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary[500],
    borderRadius: 2,
  },

  cwProgressText: {
    fontSize: 10,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },

  cwTitle: {
    fontSize: 13,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
    textAlign: 'left',
  },

  bottomPadding: {
    height: 20,
  },
});
