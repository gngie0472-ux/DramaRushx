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
import {
  Star,
  Play,
  TrendingUp,
  Crown,
} from 'lucide-react-native';

export default function HomeScreen() {
  const { session } = useAuth();

  const [featured, setFeatured] = useState<Series[]>([]);
  const [trending, setTrending] = useState<Series[]>([]);
  const [latest, setLatest] = useState<Series[]>([]);
  const [romance, setRomance] = useState<Series[]>([]);
  const [thriller, setThriller] = useState<Series[]>([]);
  const [family, setFamily] = useState<Series[]>([]);
  const [completed, setCompleted] = useState<Series[]>([]);
  const [continueWatching, setContinueWatching] =
    useState<ContinueWatchingItem[]>([]);

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
          : Promise.resolve({
              data: [],
              error: null,
            }),

        catMap['thriller']
          ? supabase
              .from('series')
              .select('*')
              .eq('category_id', catMap['thriller'])
              .limit(10)
          : Promise.resolve({
              data: [],
              error: null,
            }),

        catMap['family']
          ? supabase
              .from('series')
              .select('*')
              .eq('category_id', catMap['family'])
              .limit(10)
          : Promise.resolve({
              data: [],
              error: null,
            }),

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

      setFeatured(
        (featuredRes.data as Series[]) || []
      );

      setTrending(
        (trendingRes.data as Series[]) || []
      );

      setLatest(
        (latestRes.data as Series[]) || []
      );

      setRomance(
        (romanceRes.data as Series[]) || []
      );

      setThriller(
        (thrillerRes.data as Series[]) || []
      );

      setFamily(
        (familyRes.data as Series[]) || []
      );

      setCompleted(
        (completedRes.data as Series[]) || []
      );

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
      .order('watched_at', {
        ascending: false,
      })
      .limit(10);

    if (!error && data) {
      const items: ContinueWatchingItem[] =
        (data as any[]).map((row) => ({
          series_id: row.series_id,
          episode_id: row.episode_id,
          position: row.position,
          duration: row.duration,
          watched_at: row.watched_at,
          series_title:
            row.series?.title ?? '',
          series_cover:
            row.series?.cover_image_url ?? null,
          episode_number:
            row.episode?.episode_number ?? 0,
          episode_title:
            row.episode?.title ?? '',
        }));

      const unique = items.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.series_id === item.series_id
          )
      );

      setContinueWatching(
        unique.slice(0, 6)
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (featured.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentBanner(
        (prev) =>
          (prev + 1) % featured.length
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

  const handleVipPress = () => {
    router.push('/store');
  };

  if (loading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.loadingContent
        }
      >
        <HomeHeader
          onVipPress={handleVipPress}
        />

        <BannerSkeleton />
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <HomeHeader
          onVipPress={handleVipPress}
        />

        <ErrorState
          message="An error occurred while loading content. Please check your internet connection."
          onRetry={fetchData}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeHeader
        onVipPress={handleVipPress}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={
              Colors.primary[500]
            }
          />
        }
      >
        {featured.length > 0 && (
          <FeaturedBanner
            series={
              featured[currentBanner]
            }
            onPress={
              handleSeriesPress
            }
          />
        )}

        {continueWatching.length >
          0 && (
          <View style={styles.section}>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Continue Watching
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.rowContent
              }
            >
              {continueWatching.map(
                (item) => (
                  <ContinueWatchingCard
                    key={
                      item.series_id
                    }
                    item={item}
                    onPress={() =>
                      router.push(
                        `/player/${item.episode_id}`
                      )
                    }
                  />
                )
              )}
            </ScrollView>
          </View>
        )}

        <SeriesRow
          title="Most Watched"
          series={trending}
          onSeriesPress={
            handleSeriesPress
          }
        />

        <SeriesRow
          title="Latest Drama"
          series={latest}
          onSeriesPress={
            handleSeriesPress
          }
        />

        <SeriesRow
          title="Romance"
          series={romance}
          onSeriesPress={
            handleSeriesPress
          }
        />

        <SeriesRow
          title="Thriller"
          series={thriller}
          onSeriesPress={
            handleSeriesPress
          }
        />

        <SeriesRow
          title="Family Drama"
          series={family}
          onSeriesPress={
            handleSeriesPress
          }
        />

        <SeriesRow
          title="Completed"
          series={completed}
          onSeriesPress={
            handleSeriesPress
          }
        />

        <View
          style={styles.bottomPadding}
        />
      </ScrollView>
    </View>
  );
}

/* ============================================================
   HOME HEADER
   ============================================================ */

function HomeHeader({
  onVipPress,
}: {
  onVipPress: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>
          DramaRush
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onVipPress}
        style={styles.vipButton}
      >
        <View style={styles.vipIconCircle}>
          <Crown
            size={16}
            color={Colors.primary[400]}
            fill={Colors.primary[400]}
            strokeWidth={2}
          />
        </View>

        <Text style={styles.vipText}>
          VIP
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ============================================================
   FEATURED BANNER
   ============================================================ */

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
      onPress={() =>
        onPress(series)
      }
      style={
        styles.bannerContainer
      }
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
          style={
            styles.bannerGradient
          }
        />

        <View
          style={
            styles.bannerContent
          }
        >
          <View
            style={
              styles.bannerTopRow
            }
          >
            <View
              style={
                styles.featuredBadge
              }
            >
              <TrendingUp
                size={12}
                color={
                  Colors.primary[500]
                }
                strokeWidth={2.5}
              />

              <Text
                style={
                  styles.featuredText
                }
              >
                Featured
              </Text>
            </View>

            <View
              style={
                styles.ratingContainer
              }
            >
              <Star
                size={14}
                color={
                  Colors.warning[400]
                }
                strokeWidth={2}
                fill={
                  Colors.warning[400]
                }
              />

              <Text
                style={
                  styles.ratingText
                }
              >
                {Number(
                  series.rating
                ).toFixed(1)}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.bannerBottom
            }
          >
            <Text
              style={
                styles.bannerTitle
              }
              numberOfLines={2}
            >
              {series.title}
            </Text>

            {series.description && (
              <Text
                style={
                  styles.bannerDescription
                }
                numberOfLines={2}
              >
                {series.description}
              </Text>
            )}

            <View
              style={
                styles.bannerMeta
              }
            >
              <Text
                style={
                  styles.bannerEpisodes
                }
              >
                {series.total_episodes}{' '}
                Episodes
              </Text>

              <Text
                style={
                  styles.bannerStatus
                }
              >
                {series.status ===
                'completed'
                  ? 'Completed'
                  : 'Ongoing'}
              </Text>

              {series.is_free && (
                <Text
                  style={
                    styles.bannerFree
                  }
                >
                  Free
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={
                styles.playButton
              }
              onPress={() =>
                onPress(series)
              }
            >
              <Play
                size={16}
                color={
                  Colors.dark.background
                }
                strokeWidth={2.5}
                fill={
                  Colors.dark.background
                }
              />

              <Text
                style={
                  styles.playButtonText
                }
              >
                Watch Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

/* ============================================================
   CONTINUE WATCHING
   ============================================================ */

function ContinueWatchingCard({
  item,
  onPress,
}: {
  item: ContinueWatchingItem;
  onPress: () => void;
}) {
  const progress =
    item.duration > 0
      ? (item.position /
          item.duration) *
        100
      : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.cwCard}
    >
      <ImageBackground
        source={{
          uri:
            item.series_cover || '',
        }}
        style={styles.cwImage}
        imageStyle={
          styles.cwImageRadius
        }
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,0,0,0.8)',
          ]}
          style={styles.cwGradient}
        />

        <View
          style={
            styles.cwPlayOverlay
          }
        >
          <View
            style={
              styles.cwPlayCircle
            }
          >
            <Play
              size={14}
              color={
                Colors.dark.text
              }
              strokeWidth={2}
              fill={
                Colors.dark.text
              }
            />
          </View>
        </View>

        <View
          style={styles.cwInfo}
        >
          <Text
            style={
              styles.cwEpisode
            }
            numberOfLines={1}
          >
            {item.episode_title}
          </Text>

          <View
            style={
              styles.cwProgressContainer
            }
          >
            <View
              style={
                styles.cwProgressBar
              }
            >
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

            <Text
              style={
                styles.cwProgressText
              }
            >
              {Math.round(
                progress
              )}
              %
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

/* ============================================================
   STYLES
   ============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      Colors.dark.background,
  },

  scroll: {
    flex: 1,
  },

  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor:
      Colors.dark.background,
    borderBottomWidth: 1,
    borderBottomColor:
      Colors.dark.border,
    zIndex: 10,
  },

  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoText: {
    color: Colors.dark.text,
    fontSize: 21,
    fontFamily: 'Cairo-Bold',
    letterSpacing: 0.2,
  },

  vipButton: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor:
      'rgba(249,115,22,0.45)',
    gap: 6,
  },

  vipIconCircle: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      'rgba(249,115,22,0.14)',
  },

  vipText: {
    color: Colors.primary[400],
    fontSize: 13,
    fontFamily: 'Cairo-Bold',
  },

  content: {
    paddingBottom: 24,
  },

  loadingContent: {
    paddingBottom: 24,
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

  /* =========================
     BANNER
     ========================= */

  bannerContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    height: 260,
    backgroundColor:
      Colors.dark.surfaceLight,
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
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor:
      'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor:
      Colors.primary[500],
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
    backgroundColor:
      'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },

  ratingText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: 'Cairo-Bold',
  },

  bannerBottom: {
    alignItems: 'flex-start',
  },

  bannerTitle: {
    color: Colors.dark.text,
    fontSize: 25,
    lineHeight: 31,
    fontFamily: 'Cairo-Bold',
    maxWidth: '90%',
  },

  bannerDescription: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
    maxWidth: '90%',
  },

  bannerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 7,
  },

  bannerEpisodes: {
    color: Colors.dark.text,
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
  },

  bannerStatus: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontFamily: 'Cairo-Regular',
  },

  bannerFree: {
    color: Colors.primary[400],
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
  },

  playButton: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor:
      Colors.primary[500],
  },

  playButtonText: {
    color: Colors.dark.background,
    fontSize: 11,
    fontFamily: 'Cairo-Bold',
  },

  /* =========================
     CONTINUE WATCHING
     ========================= */

  cwCard: {
    width: 165,
  },

  cwImage: {
    height: 100,
    width: 165,
    justifyContent: 'flex-end',
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
    height: '75%',
  },

  cwPlayOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cwPlayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.25)',
  },

  cwInfo: {
    padding: 8,
  },

  cwEpisode: {
    color: Colors.dark.text,
    fontSize: 9,
    fontFamily: 'Cairo-Bold',
  },

  cwProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },

  cwProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor:
      'rgba(255,255,255,0.2)',
  },

  cwProgressFill: {
    height: '100%',
    backgroundColor:
      Colors.primary[500],
  },

  cwProgressText: {
    color: Colors.dark.textMuted,
    fontSize: 8,
    fontFamily: 'Cairo-Regular',
  },

  cwTitle: {
    color: Colors.dark.text,
    fontSize: 11,
    fontFamily: 'Cairo-Bold',
    marginTop: 6,
  },

  bottomPadding: {
    height: 30,
  },
});
