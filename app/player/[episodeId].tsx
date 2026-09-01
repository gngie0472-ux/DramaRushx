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
  const params = useLocalSearchParams<{
    episodeId?: string | string[];
  }>();

  const episodeId = Array.isArray(params.episodeId)
    ? params.episodeId[0]
    : params.episodeId;

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

  const [unlockedEpisodeIds, setUnlockedEpisodeIds] =
    useState<Set<string>>(new Set());

  const [isPlaying, setIsPlaying] = useState(false);

  const viewRecordedRef = useRef(false);
  const viewSessionIdRef = useRef<string | null>(null);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mountedRef = useRef(true);
  const loadingVideoRef = useRef(false);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
        controlsTimer.current = null;
      }

      try {
        player.pause();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [player]);

  /*
   * ============================================================
   * UUID
   * ============================================================
   */

  const makeUuid = useCallback(() => {
    const cryptoObject = globalThis.crypto as
      | Crypto
      | undefined;

    if (
      cryptoObject &&
      typeof cryptoObject.randomUUID === 'function'
    ) {
      return cryptoObject.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (character) => {
        const random = Math.floor(Math.random() * 16);

        const value =
          character === 'x'
            ? random
            : (random & 0x3) | 0x8;

        return value.toString(16);
      }
    );
  }, []);

  /*
   * ============================================================
   * GET SECURE VIDEO URL
   * ============================================================
   */

  const fetchVideoUrl = useCallback(
    async (id: string) => {
      try {
        if (!id) {
          console.error('fetchVideoUrl: missing episode id');
          return null;
        }

        const {
          data,
          error: functionError,
        } = await supabase.functions.invoke(
          'get-video-url',
          {
            body: {
              episodeId: id,
            },
          }
        );

        if (functionError) {
          console.error(
            'get-video-url error:',
            functionError
          );

          return null;
        }

        if (!data) {
          console.error(
            'get-video-url returned empty response'
          );

          return null;
        }

        if (
          typeof data.url !== 'string' ||
          data.url.length === 0
        ) {
          console.error(
            'get-video-url did not return a valid URL:',
            data
          );

          return null;
        }

        return data.url;
      } catch (err) {
        console.error(
          'fetchVideoUrl exception:',
          err
        );

        return null;
      }
    },
    []
  );

  /*
   * ============================================================
   * LOAD VIDEO
   * ============================================================
   */

  const loadVideo = useCallback(
    async (id: string) => {
      if (!id) {
        return false;
      }

      if (loadingVideoRef.current) {
        return false;
      }

      loadingVideoRef.current = true;

      try {
        const videoUrl = await fetchVideoUrl(id);

        if (!videoUrl) {
          if (mountedRef.current) {
            setIsPlaying(false);
            setError(true);
          }

          return false;
        }

        if (!mountedRef.current) {
          return false;
        }

        /*
         * Stop previous video before replacing it.
         */

        try {
          player.pause();
        } catch {
          // Ignore.
        }

        /*
         * Reset UI state.
         */

        setCurrentPosition(0);
        setDuration(0);
        setIsPlaying(false);

        /*
         * Load the secure URL.
         */

        player.replace(videoUrl);

        /*
         * Start playback.
         */

        player.play();

        if (mountedRef.current) {
          setIsPlaying(true);
          setError(false);
        }

        return true;
      } catch (err) {
        console.error(
          'loadVideo error:',
          err
        );

        if (mountedRef.current) {
          setIsPlaying(false);
          setError(true);
        }

        return false;
      } finally {
        loadingVideoRef.current = false;
      }
    },
    [fetchVideoUrl, player]
  );

  /*
   * ============================================================
   * FETCH EPISODE DATA
   * ============================================================
   */

  const fetchData = useCallback(async () => {
    if (!episodeId) {
      setError(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      /*
       * Get episode.
       */

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
        console.error(
          'Episode query error:',
          epError
        );

        setError(true);
        return;
      }

      if (!epData) {
        console.error(
          'Episode not found:',
          episodeId
        );

        setError(true);
        return;
      }

      const ep = epData as Episode;

      if (!mountedRef.current) {
        return;
      }

      setEpisode(ep);

      /*
       * Get series and all episodes.
       */

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
          'Series query error:',
          seriesRes.error
        );
      }

      if (episodesRes.error) {
        console.error(
          'Episodes query error:',
          episodesRes.error
        );
      }

      const currentSeries =
        seriesRes.data
          ? (seriesRes.data as Series)
          : null;

      const currentEpisodes =
        (episodesRes.data || []) as Episode[];

      if (!mountedRef.current) {
        return;
      }

      setSeries(currentSeries);
      setAllEpisodes(currentEpisodes);

      /*
       * ========================================================
       * ACCESS CONTROL
       * ========================================================
       *
       * Free episode
       * OR free series
       * OR active subscription
       * OR unlocked episode
       */

      const seriesIsFree =
        currentSeries?.is_free === true;

      const episodeIsFree =
        ep.is_free === true;

      const isFree =
        episodeIsFree ||
        seriesIsFree;

      let subscribed = false;

      const userUnlockIds =
        new Set<string>();

      if (session?.user?.id) {
        /*
         * Check subscription and unlocked episodes.
         */

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
          subscriptionResult.data === true;

        if (unlockResult.error) {
          console.error(
            'Unlocked episodes query error:',
            unlockResult.error
          );
        }

        for (
          const row of unlockResult.data || []
        ) {
          if (
            row &&
            typeof row.episode_id ===
              'string'
          ) {
            userUnlockIds.add(
              row.episode_id
            );
          }
        }
      }

      const unlocked =
        isFree ||
        subscribed ||
        userUnlockIds.has(ep.id);

      if (!mountedRef.current) {
        return;
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

      /*
       * New view session.
       */

      viewRecordedRef.current =
        false;

      viewSessionIdRef.current =
        makeUuid();

      /*
       * ========================================================
       * LOAD VIDEO ONLY IF AUTHORIZED
       * ========================================================
       */

      if (unlocked) {
        const videoLoaded =
          await loadVideo(ep.id);

        if (!videoLoaded) {
          return;
        }

        /*
         * Restore watch position.
         */

        if (session?.user?.id) {
          const {
            data: historyData,
            error: historyError,
          } = await supabase
            .from('watch_history')
            .select('position, duration')
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
              'Watch history query error:',
              historyError
            );
          }

          if (
            historyData &&
            typeof historyData.position ===
              'number' &&
            historyData.position > 0
          ) {
            /*
             * Wait briefly so the player can
             * initialize the media.
             */

            setTimeout(() => {
              if (!mountedRef.current) {
                return;
              }

              try {
                player.currentTime =
                  historyData.position;

                setCurrentPosition(
                  historyData.position
                );
              } catch (err) {
                console.error(
                  'Restore position error:',
                  err
                );
              }
            }, 500);
          }
        }
      }
    } catch (err) {
      console.error(
        'Player fetch error:',
        err
      );

      if (mountedRef.current) {
        setError(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [
    episodeId,
    session?.user?.id,
    makeUuid,
    loadVideo,
    player,
  ]);

  /*
   * Reload whenever episodeId changes.
   */

  useEffect(() => {
    fetchData();

    return () => {
      try {
        player.pause();
      } catch {
        // Ignore.
      }
    };
  }, [fetchData, player]);

  /*
   * ============================================================
   * PLAYER STATUS LISTENER
   * ============================================================
   */

  useEffect(() => {
    const statusSubscription =
      player.addListener(
        'statusChange',
        (event) => {
          if (!mountedRef.current) {
            return;
          }

          /*
           * expo-video reports status changes.
           * Keep UI synchronized where possible.
           */

          const status =
            String(
              (event as any)?.status ||
                ''
            ).toLowerCase();

          if (
            status.includes('error')
          ) {
            setIsPlaying(false);
          }
        }
      );

    return () => {
      statusSubscription.remove();
    };
  }, [player]);

  /*
   * ============================================================
   * PLAYBACK POSITION / VIEW TRACKING
   * ============================================================
   */

  useEffect(() => {
    if (
      !isUnlocked ||
      !episode ||
      !session?.user?.id
    ) {
      return;
    }

    const interval =
      setInterval(async () => {
        if (!mountedRef.current) {
          return;
        }

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
           * Record a view after meaningful playback.
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

              /*
               * Allow another attempt if
               * the database call failed.
               */

              viewRecordedRef.current =
                false;
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
      }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [
    isUnlocked,
    episode,
    session?.user?.id,
    player,
  ]);

  /*
   * ============================================================
   * PLAY / PAUSE LISTENER
   * ============================================================
   */

  useEffect(() => {
    const subscription =
      player.addListener(
        'playingChange',
        (event) => {
          if (!mountedRef.current) {
            return;
          }

          setIsPlaying(
            !!event.isPlaying
          );
        }
      );

    return () => {
      subscription.remove();
    };
  }, [player]);

  /*
   * ============================================================
   * AUTO NEXT EPISODE
   * ============================================================
   */

  useEffect(() => {
    const subscription =
      player.addListener(
        'playToEnd',
        () => {
          if (!mountedRef.current) {
            return;
          }

          const currentIndex =
            allEpisodes.findIndex(
              (item) =>
                item.id ===
                episode?.id
            );

          if (
            currentIndex < 0 ||
            currentIndex >=
              allEpisodes.length - 1
          ) {
            return;
          }

          const nextEp =
            allEpisodes[
              currentIndex + 1
            ];

          const nextUnlocked =
            nextEp.is_free === true ||
            series?.is_free === true ||
            hasSubscription ||
            unlockedEpisodeIds.has(
              nextEp.id
            );

          if (nextUnlocked) {
            router.replace(
              `/player/${nextEp.id}`
            );
          } else {
            /*
             * Stop at locked episode.
             */

            setIsPlaying(false);
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    player,
    allEpisodes,
    episode?.id,
    hasSubscription,
    unlockedEpisodeIds,
    series?.is_free,
  ]);

  /*
   * ============================================================
   * UNLOCK EPISODE
   * ============================================================
   */

  const handleUnlock =
    useCallback(async () => {
      if (!session?.user?.id) {
        Alert.alert(
          'Sign in required',
          'Please sign in to unlock episodes.'
        );

        router.push('/auth/login');

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
                  error: unlockError,
                } = await supabase.rpc(
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
                    unlockError.message ||
                      'Failed to unlock episode.'
                  );

                  return;
                }

                const result =
                  data as
                    | {
                        success?: boolean;
                        message?: string;
                      }
                    | null;

                if (
                  !result?.success
                ) {
                  Alert.alert(
                    'Cannot unlock',
                    result?.message ||
                      'Insufficient coins.'
                  );

                  return;
                }

                /*
                 * Update local entitlement.
                 */

                if (!mountedRef.current) {
                  return;
                }

                setIsUnlocked(true);

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
                 * Load secure video.
                 */

                const videoLoaded =
                  await loadVideo(
                    episode.id
                  );

                if (!videoLoaded) {
                  Alert.alert(
                    'Video error',
                    'Episode unlocked successfully, but the secure video could not be loaded.'
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
      session?.user?.id,
      episode,
      loadVideo,
    ]);

  /*
   * ============================================================
   * NAVIGATE TO EPISODE
   * ============================================================
   */

  const goToEpisode =
    useCallback(
      (ep: Episode) => {
        const unlocked =
          ep.is_free === true ||
          series?.is_free === true ||
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
        series?.is_free,
        hasSubscription,
        unlockedEpisodeIds,
      ]
    );

  /*
   * ============================================================
   * CONTROLS
   * ============================================================
   */

  const toggleControls =
    useCallback(() => {
      setShowControls(
        (previous) => {
          const next = !previous;

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
                if (
                  mountedRef.current
                ) {
                  setShowControls(
                    false
                  );
                }
              }, 4000);
          }

          return next;
        }
      );
    }, [isPlaying]);

  useEffect(() => {
    if (
      controlsTimer.current
    ) {
      clearTimeout(
        controlsTimer.current
      );

      controlsTimer.current =
        null;
    }

    if (
      showControls &&
      isPlaying
    ) {
      controlsTimer.current =
        setTimeout(() => {
          if (
            mountedRef.current
          ) {
            setShowControls(
              false
            );
          }
        }, 4000);
    }

    return () => {
      if (
        controlsTimer.current
      ) {
        clearTimeout(
          controlsTimer.current
        );

        controlsTimer.current =
          null;
      }
    };
  }, [
    showControls,
    isPlaying,
  ]);

  /*
   * ============================================================
   * FORMAT TIME
   * ============================================================
   */

  const formatTime = (
    seconds: number
  ) => {
    if (
      !Number.isFinite(
        seconds
      ) ||
      seconds <= 0
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

  /*
   * ============================================================
   * EPISODE NAVIGATION
   * ============================================================
   */

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
   * ============================================================
   * LOADING
   * ============================================================
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
   * ============================================================
   * ERROR
   * ============================================================
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

  /*
   * ============================================================
   * PROGRESS
   * ============================================================
   */

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

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

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

      {/* ======================================================
          VIDEO PLAYER
          ====================================================== */}

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
                    onPress={() => {
                      if (
                        isFullscreen
                      ) {
                        setIsFullscreen(
                          false
                        );
                      } else {
                        router.back();
                      }
                    }}
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

                {/* CENTER PLAY */}

                <TouchableOpacity
                  style={
                    styles.centerPlayButton
                  }
                  onPress={() => {
                    try {
                      if (
                        isPlaying
                      ) {
                        player.pause();
                      } else {
                        player.play();
                      }
                    } catch (err) {
                      console.error(
                        'Play/pause error:',
                        err
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
          /* ==================================================
             LOCKED EPISODE
             ================================================== */

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

      {/* ======================================================
          EPISODE INFORMATION
          ====================================================== */}

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
