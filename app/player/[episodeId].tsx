import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import type { Episode, Series } from '@/lib/types';
import { ErrorState } from '@/components/States';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Coins,
  Play,
  SkipForward,
} from 'lucide-react-native';

export default function PlayerScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const { session } = useAuth();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const [unlockedEpisodeIds, setUnlockedEpisodeIds] = useState<Set<string>>(
    new Set()
  );

  const [isPlaying, setIsPlaying] = useState(false);

  const viewRecordedRef = useRef(false);
  const viewSessionIdRef = useRef<string | null>(null);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const makeUuid = useCallback(() => {
    const cryptoObject = globalThis.crypto as Crypto | undefined;

    if (cryptoObject?.randomUUID) {
      return cryptoObject.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (character) => {
        const random = (Math.random() * 16) | 0;
        const value =
          character === 'x'
            ? random
            : (random & 0x3) | 0x8;

        return value.toString(16);
      }
    );
  }, []);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  const fetchVideoUrl = useCallback(
    async (id: string) => {
      try {
        const { data, error: functionError } =
          await supabase.functions.invoke('get-video-url', {
            body: {
              episodeId: id,
            },
          });

        if (functionError) {
          console.error(
            'get-video-url function error:',
            functionError
          );
          return null;
        }

        if (!data?.url) {
          console.error(
            'get-video-url returned no URL:',
            data
          );
          return null;
        }

        return data.url as string;
      } catch (err) {
        console.error(
          'Failed to invoke get-video-url:',
          err
        );
        return null;
      }
    },
    []
  );

  const loadVideo = useCallback(
    async (id: string) => {
      const videoUrl = await fetchVideoUrl(id);

      if (!videoUrl) {
        setError(true);
        return false;
      }

      try {
        player.replace(videoUrl);
        player.play();
        setIsPlaying(true);
        return true;
      } catch (err) {
        console.error('Video player error:', err);
        setError(true);
        return false;
      }
    },
    [fetchVideoUrl, player]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      if (!episodeId) {
        setError(true);
        return;
      }

      const episodeColumns =
        'id, series_id, episode_number, title, description, thumbnail_url, video_path, duration, is_free, coin_price, view_count, created_at';

      const {
        data: epData,
        error: epError,
      } = await supabase
        .from('episodes')
        .select(episodeColumns)
        .eq('id', episodeId)
        .maybeSingle();

      if (epError) {
        console.error('Episode error:', epError);
        setError(true);
        return;
      }

      if (!epData) {
        setError(true);
        return;
      }

      const ep = epData as Episode;

      setEpisode(ep);

      const [
        seriesRes,
        episodesRes,
      ] = await Promise.all([
        supabase
          .from('series')
          .select('*')
          .eq('id', ep.series_id)
          .maybeSingle(),

        supabase
          .from('episodes')
          .select(episodeColumns)
          .eq('series_id', ep.series_id)
          .order('episode_number', {
            ascending: true,
          }),
      ]);

      if (seriesRes.error) {
        console.error(
          'Series error:',
          seriesRes.error
        );
      }

      if (episodesRes.error) {
        console.error(
          'Episodes error:',
          episodesRes.error
        );
      }

      if (seriesRes.data) {
        setSeries(seriesRes.data as Series);
      }

      setAllEpisodes(
        (episodesRes.data as Episode[]) || []
      );

      /*
       * Determine access.
       *
       * Free episode
       * OR free series
       * OR active subscription
       * OR purchased/unlocked episode
       */

      const seriesIsFree =
        !!seriesRes.data &&
        !!(seriesRes.data as Series).is_free;

      const episodeIsFree = !!ep.is_free;

      const isFree =
        episodeIsFree || seriesIsFree;

      let unlocked = isFree;
      let subscribed = false;

      const userUnlockIds = new Set<string>();

      if (session?.user) {
        const [
          subscriptionResult,
          unlockResult,
        ] = await Promise.all([
          supabase.rpc(
            'has_active_subscription'
          ),

          supabase
            .from('unlocked_episodes')
            .select('episode_id')
            .eq(
              'user_id',
              session.user.id
            ),
        ]);

        if (subscriptionResult.error) {
          console.error(
            'Subscription check error:',
            subscriptionResult.error
          );
        }

        subscribed =
          !!subscriptionResult.data;

        if (unlockResult.error) {
          console.error(
            'Unlock check error:',
            unlockResult.error
          );
        }

        (
          unlockResult.data || []
        ).forEach((row: any) => {
          if (row?.episode_id) {
            userUnlockIds.add(
              row.episode_id
            );
          }
        });
      }

      if (!isFree) {
        unlocked =
          subscribed ||
          userUnlockIds.has(ep.id);
      }

      setUnlockedEpisodeIds(
        userUnlockIds
      );

      setHasSubscription(
        subscribed
      );

      setIsUnlocked(
        unlocked
      );

      viewRecordedRef.current =
        false;

      viewSessionIdRef.current =
        makeUuid();

      /*
       * Load protected video only
       * after entitlement is confirmed.
       */

      if (unlocked) {
        const success =
          await loadVideo(ep.id);

        if (!success) {
          return;
        }

        /*
         * Restore watch position.
         */

        if (session?.user) {
          const {
            data: historyData,
            error: historyError,
          } = await supabase
            .from('watch_history')
            .select('position')
            .eq(
              'user_id',
              session.user.id
            )
            .eq(
              'episode_id',
              ep.id
            )
            .maybeSingle();

          if (historyError) {
            console.error(
              'Watch history error:',
              historyError
            );
          }

          if (
            historyData &&
            typeof historyData.position ===
              'number' &&
            historyData.position > 0
          ) {
            player.currentTime =
              historyData.position;

            setCurrentPosition(
              historyData.position
            );
          }
        }
      }
    } catch (err) {
      console.error(
        'Player fetch error:',
        err
      );

      setError(true);
    } finally {
      setLoading(false);
    }
  }, [
    episodeId,
    session,
    player,
    makeUuid,
    loadVideo,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /*
   * Track playback position,
   * views and watch history.
   */

  useEffect(() => {
    if (
      !isUnlocked ||
      !episode ||
      !session?.user
    ) {
      return;
    }

    const interval = setInterval(
      async () => {
        try {
          const position =
            Number(player.currentTime) || 0;

          const videoDuration =
            Number(player.duration) || 0;

          setCurrentPosition(
            position
          );

          setDuration(
            videoDuration
          );

          /*
           * Count view after meaningful playback.
           * 10% for short videos,
           * maximum 30 seconds.
           */

          const threshold =
            videoDuration > 0
              ? Math.min(
                  30,
                  videoDuration * 0.1
                )
              : 30;

          if (
            !viewRecordedRef.current &&
            position >= threshold &&
            viewSessionIdRef.current
          ) {
            viewRecordedRef.current =
              true;

            const {
              error: viewError,
            } = await supabase.rpc(
              'record_episode_view',
              {
                p_episode_id:
                  episode.id,
                p_session_id:
                  viewSessionIdRef.current,
              }
            );

            if (viewError) {
              console.error(
                'View recording error:',
                viewError
              );
            }
          }

          /*
           * Save watch history.
           */

          await supabase
            .from('watch_history')
            .upsert(
              {
                user_id:
                  session.user.id,

                series_id:
                  episode.series_id,

                episode_id:
                  episode.id,

                position:
                  Math.floor(position),

                duration:
                  Math.floor(
                    videoDuration
                  ),

                watched_at:
                  new Date().toISOString(),
              },
              {
                onConflict:
                  'user_id,episode_id',
              }
            );
        } catch (err) {
          console.error(
            'Playback tracking error:',
            err
          );
        }
      },
      5000
    );

    return () =>
      clearInterval(interval);
  }, [
    isUnlocked,
    episode,
    session,
    player,
  ]);

  /*
   * Automatically move to next episode
   * when the current episode finishes.
   */

  useEffect(() => {
    const subscription =
      player.addListener(
        'playToEnd',
        () => {
          const currentIndex =
            allEpisodes.findIndex(
              (item) =>
                item.id ===
                episode?.id
            );

          if (
            currentIndex >= 0 &&
            currentIndex <
              allEpisodes.length - 1
          ) {
            const nextEp =
              allEpisodes[
                currentIndex + 1
              ];

            const nextUnlocked =
              nextEp.is_free ||
              !!series?.is_free ||
              hasSubscription ||
              unlockedEpisodeIds.has(
                nextEp.id
              );

            if (nextUnlocked) {
              router.replace(
                `/player/${nextEp.id}`
              );
            }
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    player,
    allEpisodes,
    episode,
    hasSubscription,
    unlockedEpisodeIds,
    series,
  ]);

  /*
   * Unlock paid episode.
   */

  const handleUnlock =
    useCallback(async () => {
      if (!session?.user) {
        Alert.alert(
          'Sign in required',
          'Please sign in to unlock episodes.'
        );

        router.push(
          '/auth/login'
        );

        return;
      }

      if (!episode) {
        return;
      }

      Alert.alert(
        'Unlock Episode',
        `Unlock "${episode.title}" for ${episode.coin_price} coins?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Unlock',
            onPress: async () => {
              try {
                const {
                  data,
                  error:
                    unlockError,
                } =
                  await supabase.rpc(
                    'unlock_episode',
                    {
                      p_episode_id:
                        episode.id,
                    }
                  );

                if (unlockError) {
                  console.error(
                    'Unlock error:',
                    unlockError
                  );

                  Alert.alert(
                    'Error',
                    'Failed to unlock episode.'
                  );

                  return;
                }

                const result =
                  data as any;

                if (!result?.success) {
                  Alert.alert(
                    'Cannot unlock',
                    result?.message ||
                      'Insufficient coins.'
                  );

                  return;
                }

                /*
                 * Unlock succeeded.
                 */

                setIsUnlocked(
                  true
                );

                setUnlockedEpisodeIds(
                  (previous) => {
                    const next =
                      new Set(
                        previous
                      );

                    next.add(
                      episode.id
                    );

                    return next;
                  }
                );

                /*
                 * Get secure signed URL.
                 */

                const success =
                  await loadVideo(
                    episode.id
                  );

                if (!success) {
                  Alert.alert(
                    'Error',
                    'Episode unlocked, but the video could not be loaded.'
                  );

                  return;
                }

                Alert.alert(
                  'Success',
                  'Episode unlocked!'
                );
              } catch (err) {
                console.error(
                  'Unlock exception:',
                  err
                );

                Alert.alert(
                  'Error',
                  'Something went wrong while unlocking the episode.'
                );
              }
            },
          },
        ]
      );
    }, [
      session,
      episode,
      loadVideo,
    ]);

  /*
   * Navigate to another episode.
   */

  const goToEpisode =
    useCallback(
      (ep: Episode) => {
        const unlocked =
          ep.is_free ||
          !!series?.is_free ||
          hasSubscription ||
          unlockedEpisodeIds.has(
            ep.id
          );

        if (!unlocked) {
          Alert.alert(
            'Locked',
            'This episode is locked. Unlock it first.'
          );

          return;
        }

        router.replace(
          `/player/${ep.id}`
        );
      },
      [
        hasSubscription,
        unlockedEpisodeIds,
        series,
      ]
    );

  /*
   * Toggle controls.
   */

  const toggleControls =
    useCallback(() => {
      setShowControls(
        (previous) => {
          const next =
            !previous;

          if (
            next &&
            isPlaying
          ) {
            if (
              controlsTimer.current
            ) {
              clearTimeout(
                controlsTimer.current
              );
            }

            controlsTimer.current =
              setTimeout(() => {
                setShowControls(
                  false
                );
              }, 4000);
          }

          return next;
        }
      );
    }, [isPlaying]);

  useEffect(() => {
    if (
      showControls &&
      isPlaying
    ) {
      if (
        controlsTimer.current
      ) {
        clearTimeout(
          controlsTimer.current
        );
      }

      controlsTimer.current =
        setTimeout(() => {
          setShowControls(
            false
          );
        }, 4000);
    }

    return () => {
      if (
        controlsTimer.current
      ) {
        clearTimeout(
          controlsTimer.current
        );
      }
    };
  }, [
    showControls,
    isPlaying,
  ]);

  /*
   * Format video time.
   */

  const formatTime = (
    seconds: number
  ) => {
    if (
      !seconds ||
      Number.isNaN(seconds)
    ) {
      return '0:00';
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    const remainingSeconds =
      Math.floor(
        seconds % 60
      );

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  };

  const currentIndex =
    allEpisodes.findIndex(
      (item) =>
        item.id ===
        episode?.id
    );

  const prevEpisode =
    currentIndex > 0
      ? allEpisodes[
          currentIndex - 1
        ]
      : null;

  const nextEpisode =
    currentIndex >= 0 &&
    currentIndex <
      allEpisodes.length - 1
      ? allEpisodes[
          currentIndex + 1
        ]
      : null;

  /*
   * Loading state.
   */

  if (loading) {
    return (
      <View
        style={
          styles.container
        }
      />
    );
  }

  /*
   * Error state.
   */

  if (
    error ||
    !episode
  ) {
    return (
      <ErrorState
        message="Failed to load episode."
        onRetry={fetchData}
      />
    );
  }

  const progress =
    duration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (currentPosition /
              duration) *
              100
          )
        )
      : 0;

  return (
    <View
      style={
        styles.container
      }
    >
      <StatusBar
        hidden={
          isFullscreen
        }
      />

      {/* ================= VIDEO PLAYER ================= */}

      <View
        style={[
          styles.playerContainer,
          isFullscreen &&
            styles.playerFullscreen,
        ]}
      >
        {isUnlocked ? (
          <>
            <VideoView
              player={player}
              style={
                isFullscreen
                  ? styles.videoFullscreen
                  : styles.video
              }
              contentFit="contain"
              nativeControls={false}
              onFullscreenEnter={() =>
                setIsFullscreen(
                  true
                )
              }
              onFullscreenExit={() =>
                setIsFullscreen(
                  false
                )
              }
            />

            {/* Transparent touch layer */}

            <TouchableOpacity
              style={
                styles.videoOverlay
              }
              onPress={
                toggleControls
              }
              activeOpacity={1}
            />

            {showControls && (
              <View
                style={
                  styles.controlsOverlay
                }
              >
                {/* TOP CONTROLS */}

                <View
                  style={
                    styles.controlsTop
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.controlButton
                    }
                    onPress={() =>
                      isFullscreen
                        ? setIsFullscreen(
                            false
                          )
                        : router.back()
                    }
                  >
                    <ChevronLeft
                      size={24}
                      color={
                        Colors.dark
                          .text
                      }
                      strokeWidth={
                        2
                      }
                    />
                  </TouchableOpacity>

                  <Text
                    style={
                      styles.episodeLabel
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {series?.title ||
                      'DramaRush'}{' '}
                    - Ep{' '}
                    {
                      episode.episode_number
                    }
                  </Text>

                  <View
                    style={{
                      width: 40,
                    }}
                  />
                </View>

                {/* CENTER PLAY BUTTON */}

                <TouchableOpacity
                  style={
                    styles.centerPlayButton
                  }
                  onPress={() => {
                    if (
                      isPlaying
                    ) {
                      player.pause();
                      setIsPlaying(
                        false
                      );
                    } else {
                      player.play();
                      setIsPlaying(
                        true
                      );
                    }
                  }}
                >
                  <View
                    style={
                      styles.centerPlayCircle
                    }
                  >
                    {isPlaying ? (
                      <Text
                        style={
                          styles.pauseIcon
                        }
                      >
                        ❚❚
                      </Text>
                    ) : (
                      <Play
                        size={28}
                        color={
                          Colors.dark
                            .text
                        }
                        strokeWidth={
                          2
                        }
                        fill={
                          Colors.dark
                            .text
                        }
                      />
                    )}
                  </View>
                </TouchableOpacity>

                {/* BOTTOM CONTROLS */}

                <View
                  style={
                    styles.controlsBottom
                  }
                >
                  {/* Progress */}

                  <View
                    style={
                      styles.progressContainer
                    }
                  >
                    <Text
                      style={
                        styles.timeText
                      }
                    >
                      {formatTime(
                        currentPosition
                      )}
                    </Text>

                    <View
                      style={
                        styles.progressBar
                      }
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={
                        styles.timeText
                      }
                    >
                      {formatTime(
                        duration
                      )}
                    </Text>
                  </View>

                  {/* Navigation */}

                  <View
                    style={
                      styles.bottomControls
                    }
                  >
                    {prevEpisode ? (
                      <TouchableOpacity
                        style={
                          styles.navButton
                        }
                        onPress={() =>
                          goToEpisode(
                            prevEpisode
                          )
                        }
                      >
                        <ChevronLeft
                          size={20}
                          color={
                            Colors.dark
                              .text
                          }
                          strokeWidth={
                            2
                          }
                        />

                        <Text
                          style={
                            styles.navButtonText
                          }
                        >
                          Previous
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={{
                          width: 80,
                        }}
                      />
                    )}

                    <TouchableOpacity
                      style={
                        styles.fullscreenButton
                      }
                      onPress={() =>
                        setIsFullscreen(
                          !isFullscreen
                        )
                      }
                    >
                      <Text
                        style={
                          styles.fullscreenText
                        }
                      >
                        {isFullscreen
                          ? 'Exit Fullscreen'
                          : 'Fullscreen'}
                      </Text>
                    </TouchableOpacity>

                    {nextEpisode ? (
                      <TouchableOpacity
                        style={
                          styles.navButton
                        }
                        onPress={() =>
                          goToEpisode(
                            nextEpisode
                          )
                        }
                      >
                        <Text
                          style={
                            styles.navButtonText
                          }
                        >
                          Next
                        </Text>

                        <ChevronRight
                          size={20}
                          color={
                            Colors.dark
                              .text
                          }
                          strokeWidth={
                            2
                          }
                        />
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={{
                          width: 80,
                        }}
                      />
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          /* ================= LOCKED EPISODE ================= */

          <View
            style={
              styles.lockedContainer
            }
          >
            <View
              style={
                styles.lockedIconContainer
              }
            >
              <Lock
                size={48}
                color={
                  Colors.primary[500]
                }
                strokeWidth={2}
              />
            </View>

            <Text
              style={
                styles.lockedTitle
              }
            >
              This episode is locked
            </Text>

            <Text
              style={
                styles.lockedSubtitle
              }
            >
              Unlock it with{' '}
              {episode.coin_price}{' '}
              coins to watch
            </Text>

            <TouchableOpacity
              style={
                styles.unlockButton
              }
              onPress={
                handleUnlock
              }
            >
              <Coins
                size={18}
                color={
                  Colors.dark.text
                }
                strokeWidth={2}
              />

              <Text
                style={
                  styles.unlockButtonText
                }
              >
                Unlock for{' '}
                {episode.coin_price}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ================= EPISODE INFORMATION ================= */}

      {!isFullscreen && (
        <View
          style={
            styles.infoContainer
          }
        >
          <Text
            style={
              styles.infoTitle
            }
          >
            {episode.title}
          </Text>

          {episode.description ? (
            <Text
              style={
                styles.infoDescription
              }
            >
              {episode.description}
            </Text>
          ) : null}

          {nextEpisode && (
            <TouchableOpacity
              style={
                styles.nextEpisodeButton
              }
              onPress={() =>
                goToEpisode(
                  nextEpisode
                )
              }
            >
              <SkipForward
                size={18}
                color={
                  Colors.dark.text
                }
                strokeWidth={2}
              />

              <View
                style={
                  styles.nextEpisodeInfo
                }
              >
                <Text
                  style={
                    styles.nextEpisodeLabel
                  }
                >
                  Next Episode
                </Text>

                <Text
                  style={
                    styles.nextEpisodeTitle
                  }
                  numberOfLines={1}
                >
                  {
                    nextEpisode.title
                  }
                </Text>
              </View>

              <ChevronRight
                size={20}
                color={
                  Colors.dark
                    .textMuted
                }
                strokeWidth={2}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
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

  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },

  playerFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    aspectRatio: undefined,
    zIndex: 100,
    elevation: 100,
  },

  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  videoFullscreen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent:
      'space-between',
  },

  controlsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    padding: 16,
    paddingTop:
      Platform.OS === 'android'
        ? 32
        : 48,
    backgroundColor:
      'rgba(0,0,0,0.45)',
  },

  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent:
      'center',
    backgroundColor:
      'rgba(0,0,0,0.55)',
  },

  episodeLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily:
      'Cairo-SemiBold',
    color:
      Colors.dark.text,
    textAlign: 'center',
    marginHorizontal: 8,
  },

  centerPlayButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  centerPlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor:
      'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent:
      'center',
    borderWidth: 2,
    borderColor:
      'rgba(255,255,255,0.3)',
  },

  pauseIcon: {
    fontSize: 22,
    color:
      Colors.dark.text,
    fontWeight: 'bold',
    letterSpacing: -2,
  },

  controlsBottom: {
    padding: 16,
    gap: 12,
    backgroundColor:
      'rgba(0,0,0,0.35)',
  },

  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  timeText: {
    fontSize: 12,
    fontFamily:
      'Cairo-Regular',
    color:
      Colors.dark.text,
    minWidth: 38,
  },

  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor:
      'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor:
      Colors.primary[500],
    borderRadius: 2,
  },

  bottomControls: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },

  navButtonText: {
    fontSize: 13,
    fontFamily:
      'Cairo-SemiBold',
    color:
      Colors.dark.text,
  },

  fullscreenButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor:
      'rgba(255,255,255,0.15)',
  },

  fullscreenText: {
    fontSize: 12,
    fontFamily:
      'Cairo-SemiBold',
    color:
      Colors.dark.text,
  },

  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent:
      'center',
    gap: 16,
    padding: 32,
  },

  lockedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor:
      'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent:
      'center',
  },

  lockedTitle: {
    fontSize: 20,
    fontFamily:
      'Cairo-Bold',
    color:
      Colors.dark.text,
    textAlign: 'center',
  },

  lockedSubtitle: {
    fontSize: 14,
    fontFamily:
      'Cairo-Regular',
    color:
      Colors.dark.textSecondary,
    textAlign: 'center',
  },

  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor:
      Colors.primary[500],
    marginTop: 4,
  },

  unlockButtonText: {
    fontSize: 14,
    fontFamily:
      'Cairo-Bold',
    color:
      Colors.dark.text,
  },

  infoContainer: {
    flex: 1,
    padding: 16,
  },

  infoTitle: {
    fontSize: 20,
    fontFamily:
      'Cairo-Bold',
    color:
      Colors.dark.text,
    marginBottom: 8,
  },

  infoDescription: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily:
      'Cairo-Regular',
    color:
      Colors.dark.textSecondary,
    marginBottom: 20,
  },

  nextEpisodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor:
      Colors.dark.surface,
  },

  nextEpisodeInfo: {
    flex: 1,
  },

  nextEpisodeLabel: {
    fontSize: 12,
    fontFamily:
      'Cairo-Regular',
    color:
      Colors.dark.textMuted,
    marginBottom: 2,
  },

  nextEpisodeTitle: {
    fontSize: 14,
    fontFamily:
      'Cairo-SemiBold',
    color:
      Colors.dark.text,
  },
});
