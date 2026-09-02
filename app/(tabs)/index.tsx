import {
  useState,
  useCallback,
  useEffect,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  RefreshControl,
  Dimensions,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import type {
  Series,
  ContinueWatchingItem,
} from '@/lib/types';

import { SeriesRow } from '@/components/SeriesRow';
import {
  BannerSkeleton,
  RowSkeleton,
} from '@/components/Skeleton';

import { ErrorState } from '@/components/States';

import {
  Star,
  Play,
  TrendingUp,
  Crown,
  ChevronRight,
} from 'lucide-react-native';

const SCREEN_HEIGHT =
  Dimensions.get('window').height;

const HERO_HEIGHT = Math.round(
  SCREEN_HEIGHT * 0.27
);

export default function HomeScreen() {
  const { session } = useAuth();

  const [featured, setFeatured] =
    useState<Series[]>([]);

  const [trending, setTrending] =
    useState<Series[]>([]);

  const [latest, setLatest] =
    useState<Series[]>([]);

  const [romance, setRomance] =
    useState<Series[]>([]);

  const [thriller, setThriller] =
    useState<Series[]>([]);

  const [family, setFamily] =
    useState<Series[]>([]);

  const [completed, setCompleted] =
    useState<Series[]>([]);

  const [
    continueWatching,
    setContinueWatching,
  ] = useState<ContinueWatchingItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [currentBanner, setCurrentBanner] =
    useState(0);

  const fetchData = useCallback(
    async () => {
      setError(false);

      try {
        const { data: cats } =
          await supabase
            .from('categories')
            .select('id, slug');

        const catMap: Record<
          string,
          string
        > = {};

        (cats || []).forEach(
          (c: any) => {
            catMap[c.slug] = c.id;
          }
        );

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
            .order('view_count', {
              ascending: false,
            })
            .limit(5),

          supabase
            .from('series')
            .select('*')
            .order('view_count', {
              ascending: false,
            })
            .limit(10),

          supabase
            .from('series')
            .select('*')
            .order('created_at', {
              ascending: false,
            })
            .limit(10),

          catMap['romance']
            ? supabase
                .from('series')
                .select('*')
                .eq(
                  'category_id',
                  catMap['romance']
                )
                .limit(10)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          catMap['thriller']
            ? supabase
                .from('series')
                .select('*')
                .eq(
                  'category_id',
                  catMap['thriller']
                )
                .limit(10)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          catMap['family']
            ? supabase
                .from('series')
                .select('*')
                .eq(
                  'category_id',
                  catMap['family']
                )
                .limit(10)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          supabase
            .from('series')
            .select('*')
            .eq(
              'status',
              'completed'
            )
            .limit(10),
        ]);

        if (
          featuredRes.error ||
          trendingRes.error ||
          latestRes.error
        ) {
          throw new Error(
            'Failed to load content'
          );
        }

        setFeatured(
          (featuredRes.data as Series[]) ||
            []
        );

        setTrending(
          (trendingRes.data as Series[]) ||
            []
        );

        setLatest(
          (latestRes.data as Series[]) ||
            []
        );

        setRomance(
          (romanceRes.data as Series[]) ||
            []
        );

        setThriller(
          (thrillerRes.data as Series[]) ||
            []
        );

        setFamily(
          (familyRes.data as Series[]) ||
            []
        );

        setCompleted(
          (completedRes.data as Series[]) ||
            []
        );

        if (session?.user) {
          await fetchContinueWatching();
        }
      } catch (err) {
        console.error(
          'HomeScreen fetch error:',
          err
        );

        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  const fetchContinueWatching =
    async () => {
      if (!session?.user) return;

      const { data, error } =
        await supabase
          .from('watch_history')
          .select(`
            series_id,
            episode_id,
            position,
            duration,
            watched_at,
            series:series!inner(
              title,
              cover_image_url
            ),
            episode:episodes!inner(
              episode_number,
              title
            )
          `)
          .eq(
            'user_id',
            session.user.id
          )
          .order('watched_at', {
            ascending: false,
          })
          .limit(10);

      if (!error && data) {
        const items:
          ContinueWatchingItem[] =
          (data as any[]).map(
            (row) => ({
              series_id:
                row.series_id,

              episode_id:
                row.episode_id,

              position:
                row.position,

              duration:
                row.duration,

              watched_at:
                row.watched_at,

              series_title:
                row.series?.title ?? '',

              series_cover:
                row.series
                  ?.cover_image_url ??
                null,

              episode_number:
                row.episode
                  ?.episode_number ?? 0,

              episode_title:
                row.episode?.title ?? '',
            })
          );

        const unique =
          items.filter(
            (
              item,
              index,
              self
            ) =>
              index ===
              self.findIndex(
                (t) =>
                  t.series_id ===
                  item.series_id
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

  /*
   * HERO SLIDER
   *
   * Use Featured first.
   * If Featured is empty, automatically
   * use Latest Drama.
   */
  const heroSeries =
    featured.length > 0
      ? featured
      : latest.slice(0, 5);

  useEffect(() => {
    setCurrentBanner(0);
  }, [heroSeries.length]);

  useEffect(() => {
    if (heroSeries.length <= 1) {
      return;
    }

    const interval =
      setInterval(() => {
        setCurrentBanner(
          (prev) =>
            (prev + 1) %
            heroSeries.length
        );
      }, 4000);

    return () =>
      clearInterval(interval);
  }, [heroSeries.length]);

  const onRefresh = useCallback(
    () => {
      setRefreshing(true);
      fetchData();
    },
    [fetchData]
  );

  const handleSeriesPress = (
    series: Series
  ) => {
    router.push(
      `/series/${series.id}`
    );
  };

  const handleVipPress = () => {
    router.push('/store');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HomeHeader
          onVipPress={
            handleVipPress
          }
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.loadingContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <BannerSkeleton />

          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <HomeHeader
          onVipPress={
            handleVipPress
          }
        />

        <ErrorState
          message="An error occurred while loading content. Please check your internet connection."
          onRetry={fetchData}
        />
      </View>
    );
  }

  const activeHero =
    heroSeries.length > 0
      ? heroSeries[
          Math.min(
            currentBanner,
            heroSeries.length - 1
          )
        ]
      : null;

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
        showsVerticalScrollIndicator={
          false
        }
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
        {activeHero && (
          <FeaturedBanner
            series={activeHero}
            currentIndex={
              currentBanner
            }
            total={
              heroSeries.length
            }
            onPress={
              handleSeriesPress
            }
          />
        )}

        {continueWatching.length >
          0 && (
          <View
            style={
              styles.continueSection
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Continue Watching
              </Text>

              <ChevronRight
                size={18}
                color={
                  Colors.dark.textMuted
                }
              />
            </View>

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
          style={
            styles.bottomPadding
          }
        />
      </ScrollView>
    </View>
  );
}

/* ============================================================
   HEADER
   ============================================================ */

function HomeHeader({
  onVipPress,
}: {
  onVipPress: () => void;
}) {
  return (
    <View style={styles.header}>
      <View
        style={styles.logoArea}
      >
        <Text style={styles.logoText}>
          Drama
          <Text style={styles.logoAccent}>
            Rush
          </Text>
        </Text>

        <View
          style={styles.liveDot}
        />
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onVipPress}
        style={styles.vipButton}
      >
        <View
          style={
            styles.vipIconCircle
          }
        >
          <Crown
            size={18}
            color={
              Colors.primary[400]
            }
            fill={
              Colors.primary[400]
            }
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
   FEATURED / LATEST HERO SLIDER
   ============================================================ */

function FeaturedBanner({
  series,
  currentIndex,
  total,
  onPress,
}: {
  series: Series;
  currentIndex: number;
  total: number;
  onPress: (s: Series) => void;
}) {
  const imageUrl =
    series.banner_image_url ||
    series.cover_image_url ||
    '';

  return (
    <View style={styles.heroWrapper}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() =>
          onPress(series)
        }
        style={
          styles.bannerContainer
        }
      >
        {imageUrl ? (
          <ImageBackground
            source={{
              uri: imageUrl,
            }}
            style={styles.bannerImage}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[
                'rgba(7,7,12,0.04)',
                'rgba(7,7,12,0.28)',
                'rgba(7,7,12,0.96)',
              ]}
              locations={[
                0,
                0.45,
                1,
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
                    styles.latestBadge
                  }
                >
                  <TrendingUp
                    size={12}
                    color={
                      Colors.primary[300]
                    }
                    strokeWidth={2.5}
                  />

                  <Text
                    style={
                      styles.latestBadgeText
                    }
                  >
                    {series.is_featured
                      ? 'Featured'
                      : 'Latest Drama'}
                  </Text>
                </View>

                <View
                  style={
                    styles.ratingContainer
                  }
                >
                  <Star
                    size={13}
                    color={
                      Colors.warning[400]
                    }
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

                  <View
                    style={
                      styles.metaDot
                    }
                  />

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
                    <>
                      <View
                        style={
                          styles.metaDot
                        }
                      />

                      <Text
                        style={
                          styles.bannerFree
                        }
                      >
                        Free
                      </Text>
                    </>
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={
                    styles.playButton
                  }
                  onPress={() =>
                    onPress(series)
                  }
                >
                  <Play
                    size={15}
                    color={
                      Colors.dark.background
                    }
                    fill={
                      Colors.dark.background
                    }
                    strokeWidth={2.5}
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
        ) : (
          <View
            style={
              styles.bannerPlaceholder
            }
          >
            <View
              style={
                styles.placeholderPlay
              }
            >
              <Play
                size={30}
                color={
                  Colors.dark.textMuted
                }
              />
            </View>

            <Text
              style={
                styles.placeholderTitle
              }
            >
              {series.title}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {total > 1 && (
        <View
          style={styles.dotsContainer}
        >
          {Array.from({
            length: total,
          }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index ===
                  currentIndex &&
                  styles.activeDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
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

  const imageUrl =
    item.series_cover || '';

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.cwCard}
    >
      {imageUrl ? (
        <ImageBackground
          source={{
            uri: imageUrl,
          }}
          style={styles.cwImage}
          imageStyle={
            styles.cwImageRadius
          }
        >
          <LinearGradient
            colors={[
              'transparent',
              'rgba(0,0,0,0.86)',
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
      ) : (
        <View
          style={[
            styles.cwImage,
            styles.cwPlaceholder,
          ]}
        >
          <Play
            size={25}
            color={
              Colors.dark.textMuted
            }
          />
        </View>
      )}

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

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        Colors.dark.background,
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingBottom: 24,
    },

    loadingContent: {
      paddingBottom: 30,
    },

    /* =========================
       HEADER
       ========================= */

    header: {
      height: 68,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      backgroundColor:
        Colors.dark.background,
      borderBottomWidth: 1,
      borderBottomColor:
        Colors.dark.border,
      zIndex: 20,
    },

    logoArea: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    logoText: {
      color: Colors.dark.text,
      fontSize: 25,
      lineHeight: 31,
      fontFamily: 'Cairo-Bold',
      letterSpacing: -0.5,
    },

    logoAccent: {
      color:
        Colors.primary[400],
    },

    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginLeft: 7,
      marginTop: -16,
      backgroundColor:
        Colors.primary[500],
    },

    vipButton: {
      height: 43,
      minWidth: 91,
      paddingHorizontal: 8,
      borderRadius: 23,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(249,115,22,0.12)',
      borderWidth: 1,
      borderColor:
        'rgba(249,115,22,0.48)',
      gap: 6,
    },

    vipIconCircle: {
      width: 31,
      height: 31,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(249,115,22,0.16)',
    },

    vipText: {
      color:
        Colors.primary[400],
      fontSize: 14,
      fontFamily: 'Cairo-Bold',
    },

    /* =========================
       HERO
       ========================= */

    heroWrapper: {
      marginTop: 12,
      marginBottom: 5,
    },

    bannerContainer: {
      marginHorizontal: 14,
      height: HERO_HEIGHT,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor:
        Colors.dark.surfaceLight,
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.07)',
    },

    bannerImage: {
      flex: 1,
      justifyContent:
        'flex-end',
    },

    bannerGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },

    bannerContent: {
      flex: 1,
      justifyContent:
        'space-between',
      padding: 15,
    },

    bannerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    latestBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor:
        'rgba(15,15,20,0.72)',
      borderWidth: 1,
      borderColor:
        'rgba(249,115,22,0.48)',
    },

    latestBadgeText: {
      color:
        Colors.primary[300],
      fontSize: 10,
      fontFamily: 'Cairo-Bold',
    },

    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor:
        'rgba(5,5,8,0.7)',
    },

    ratingText: {
      color: Colors.dark.text,
      fontSize: 11,
      fontFamily: 'Cairo-Bold',
    },

    bannerBottom: {
      alignItems: 'flex-start',
    },

    bannerTitle: {
      color: Colors.dark.text,
      fontSize: 23,
      lineHeight: 29,
      fontFamily: 'Cairo-Bold',
      maxWidth: '88%',
    },

    bannerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 5,
    },

    bannerEpisodes: {
      color: Colors.dark.text,
      fontSize: 10,
      fontFamily: 'Cairo-Bold',
    },

    bannerStatus: {
      color:
        Colors.dark.textSecondary,
      fontSize: 10,
      fontFamily: 'Cairo-Regular',
    },

    bannerFree: {
      color:
        Colors.primary[400],
      fontSize: 10,
      fontFamily: 'Cairo-Bold',
    },

    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor:
        Colors.dark.textMuted,
    },

    playButton: {
      marginTop: 9,
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor:
        Colors.primary[500],
    },

    playButtonText: {
      color:
        Colors.dark.background,
      fontSize: 10,
      fontFamily: 'Cairo-Bold',
    },

    bannerPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        Colors.dark.surfaceLight,
    },

    placeholderPlay: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(0,0,0,0.3)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.16)',
    },

    placeholderTitle: {
      marginTop: 10,
      color:
        Colors.dark.textSecondary,
      fontSize: 13,
      fontFamily: 'Cairo-SemiBold',
    },

    dotsContainer: {
      height: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },

    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor:
        'rgba(255,255,255,0.25)',
    },

    activeDot: {
      width: 17,
      backgroundColor:
        Colors.primary[500],
    },

    /* =========================
       CONTINUE WATCHING
       ========================= */

    continueSection: {
      marginTop: 8,
      marginBottom: 4,
    },

    sectionHeader: {
      paddingHorizontal: 18,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize: 19,
      fontFamily: 'Cairo-Bold',
      color:
        Colors.dark.text,
    },

    rowContent: {
      paddingHorizontal: 14,
      gap: 12,
    },

    cwCard: {
      width: 165,
    },

    cwImage: {
      height: 100,
      width: 165,
      justifyContent:
        'flex-end',
      overflow: 'hidden',
      borderRadius: 12,
      backgroundColor:
        Colors.dark.surfaceLight,
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
      color:
        Colors.dark.text,
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
      color:
        Colors.dark.textMuted,
      fontSize: 8,
      fontFamily: 'Cairo-Regular',
    },

    cwTitle: {
      color:
        Colors.dark.text,
      fontSize: 11,
      fontFamily: 'Cairo-Bold',
      marginTop: 6,
    },

    cwPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    bottomPadding: {
      height: 35,
    },
  });
