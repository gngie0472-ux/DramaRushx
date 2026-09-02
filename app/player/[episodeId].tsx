import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  LayoutChangeEvent,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useVideoPlayer,
  VideoView,
} from 'expo-video';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import type {
  Episode,
  Series,
} from '@/lib/types';

import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Coins,
  Play,
} from 'lucide-react-native';

export default function PlayerScreen() {
  /*
   * ============================================================
   * PARAMS
   * ============================================================
   */

  const params =
    useLocalSearchParams<{
      episodeId?: string | string[];
    }>();

  const episodeId =
    Array.isArray(params.episodeId)
      ? params.episodeId[0]
      : params.episodeId;

  const { session } = useAuth();

  /*
   * ============================================================
   * STATE
   * ============================================================
   */

  const [episode, setEpisode] =
    useState<Episode | null>(null);

  const [series, setSeries] =
    useState<Series | null>(null);

  const [allEpisodes, setAllEpisodes] =
    useState<Episode[]>([]);

  const [isUnlocked, setIsUnlocked] =
    useState(false);

  const [hasSubscription, setHasSubscription] =
    useState(false);

  const [unlockedEpisodeIds, setUnlockedEpisodeIds] =
    useState<Set<string>>(new Set());

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [showControls, setShowControls] =
    useState(true);

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const [currentPosition, setCurrentPosition] =
    useState(0);

  const [duration, setDuration] =
    useState(0);

  const [progressWidth, setProgressWidth] =
    useState(0);

  /*
   * ============================================================
   * REFS
   * ============================================================
   */

  const mountedRef =
    useRef(true);

  const loadingVideoRef =
    useRef(false);

  const controlsTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const viewRecordedRef =
    useRef(false);

  const viewSessionIdRef =
    useRef<string | null>(null);

  /*
   * ============================================================
   * VIDEO PLAYER
   * ============================================================
   */

  const player =
    useVideoPlayer(null, (p) => {
      p.loop = false;
      p.muted = false;
    });

  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (controlsTimer.current) {
        clearTimeout(
          controlsTimer.current
        );

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

  const makeUuid =
    useCallback(() => {
      const cryptoObject =
        globalThis.crypto as
          | Crypto
          | undefined;

      if (
        cryptoObject &&
        typeof cryptoObject.randomUUID ===
          'function'
      ) {
        return cryptoObject.randomUUID();
      }

      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        (character) => {
          const random =
            Math.floor(
              Math.random() * 16
            );

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
   * CONTROL VISIBILITY
   * ============================================================
   */

  const showPlayerControls =
    useCallback(() => {
      setShowControls(true);

      if (controlsTimer.current) {
        clearTimeout(
          controlsTimer.current
        );
      }

      /*
       * Hide controls automatically while playing.
       */
      if (isPlaying) {
        controlsTimer.current =
          setTimeout(() => {
            if (
              mountedRef.current
            ) {
              setShowControls(false);
            }
          }, 4000);
      }
    }, [isPlaying]);

  /*
   * ============================================================
   * GET SECURE VIDEO URL
   * ============================================================
   */

  const fetchVideoUrl =
    useCallback(
      async (id: string) => {
        try {
          if (!id) {
            console.error(
              'Missing episode ID'
            );

            return null;
          }

          const {
            data: sessionData,
          } =
            await supabase.auth.getSession();

          const accessToken =
            sessionData.session
              ?.access_token;

          if (!accessToken) {
            console.error(
              'No authenticated session'
            );

            return null;
          }

          const {
            data,
            error: functionError,
          } =
            await supabase.functions.invoke(
              'get-video-url',
              {
                body: {
                  episodeId: id,
                },

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,

                  'Content-Type':
                    'application/json',
                },
              }
            );

          if (functionError) {
            console.error(
              'get-video-url failed:',
              functionError
            );

            return null;
          }

          if (!data) {
            console.error(
              'get-video-url returned no data'
            );

            return null;
          }

          console.log(
            'get-video-url response:',
            data
          );

          if (
            typeof data.url !==
              'string' ||
            !data.url.trim()
          ) {
            console.error(
              'Invalid video URL:',
              data
            );

            return null;
          }

          return data.url.trim();
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

  const loadVideo =
    useCallback(
      async (id: string) => {
        if (
          !id ||
          loadingVideoRef.current
        ) {
          return false;
        }

        loadingVideoRef.current =
          true;

        try {
          const videoUrl =
            await fetchVideoUrl(id);

          if (!videoUrl) {
            if (
              mountedRef.current
            ) {
              setIsPlaying(false);
              setError(true);
            }

            return false;
          }

          if (
            !mountedRef.current
          ) {
            return false;
          }

          try {
            player.pause();
          } catch {
            // Ignore.
          }

          setCurrentPosition(0);
          setDuration(0);
          setIsPlaying(false);
          setError(false);

          /*
           * Load the signed URL.
           */

          await player.replaceAsync(
            videoUrl
          );

          if (
            !mountedRef.current
          ) {
            return false;
          }

          /*
           * Start playback.
           */

          player.play();

          setIsPlaying(true);
          setError(false);

          return true;
        } catch (err) {
          console.error(
            'Video loading error:',
            err
          );

          if (
            mountedRef.current
          ) {
            setIsPlaying(false);
            setError(true);
          }

          return false;
        } finally {
          loadingVideoRef.current =
            false;
        }
      },
      [
        fetchVideoUrl,
        player,
      ]
    );

  /*
   * ============================================================
   * FETCH EPISODE DATA
   * ============================================================
   */

  const fetchData =
    useCallback(
      async () => {
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
          } =
            await supabase
              .from('episodes')
              .select(
                episodeColumns
              )
              .eq(
                'id',
                episodeId
              )
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

          const ep =
            epData as Episode;

          if (
            !mountedRef.current
          ) {
            return;
          }

          setEpisode(ep);

          /*
           * Get series + episodes.
           */

          const [
            seriesRes,
            episodesRes,
          ] =
            await Promise.all([
              supabase
                .from('series')
                .select('*')
                .eq(
                  'id',
                  ep.series_id
                )
                .maybeSingle(),

              supabase
                .from('episodes')
                .select(
                  episodeColumns
                )
                .eq(
                  'series_id',
                  ep.series_id
                )
                .order(
                  'episode_number',
                  {
                    ascending:
                      true,
                  }
                ),
            ]);

          if (
            seriesRes.error
          ) {
            console.error(
              'Series query error:',
              seriesRes.error
            );
          }

          if (
            episodesRes.error
          ) {
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
            (episodesRes.data ||
              []) as Episode[];

          if (
            !mountedRef.current
          ) {
            return;
          }

          setSeries(
            currentSeries
          );

          setAllEpisodes(
            currentEpisodes
          );

          /*
           * ====================================================
           * ACCESS CONTROL
           * ====================================================
           */

          const seriesIsFree =
            currentSeries?.is_free ===
            true;

          const episodeIsFree =
            ep.is_free === true;

          const isFree =
            episodeIsFree ||
            seriesIsFree;

          let subscribed =
            false;

          const userUnlockIds =
            new Set<string>();

          if (
            session?.user?.id
          ) {
            const [
              subscriptionResult,
              unlockResult,
            ] =
              await Promise.all([
                supabase.rpc(
                  'has_active_subscription'
                ),

                supabase
                  .from(
                    'unlocked_episodes'
                  )
                  .select(
                    'episode_id'
                  )
                  .eq(
                    'user_id',
                    session.user.id
                  ),
              ]);

            if (
              subscriptionResult.error
            ) {
              console.error(
                'Subscription check error:',
                subscriptionResult.error
              );
            }

            subscribed =
              subscriptionResult.data ===
              true;

            if (
              unlockResult.error
            ) {
              console.error(
                'Unlocked episodes query error:',
                unlockResult.error
              );
            }

            for (
              const row of
                unlockResult.data ||
                []
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
            userUnlockIds.has(
              ep.id
            );

          if (
            !mountedRef.current
          ) {
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
           * Load only if authorized.
           */

          if (unlocked) {
            const videoLoaded =
              await loadVideo(
                ep.id
              );

            if (!videoLoaded) {
              return;
            }

            /*
             * Restore watch position.
             */

            if (
              session?.user?.id
            ) {
              const {
                data:
                  historyData,
                error:
                  historyError,
              } =
                await supabase
                  .from(
                    'watch_history'
                  )
                  .select(
                    'position, duration'
                  )
                  .eq(
                    'user_id',
                    session.user.id
                  )
                  .eq(
                    'episode_id',
                    ep.id
                  )
                  .maybeSingle();

              if (
                historyError
              ) {
                console.error(
                  'Watch history query error:',
                  historyError
                );
              }

              if (
                historyData &&
                typeof historyData.position ===
                  'number' &&
                historyData.position >
                  0
              ) {
                /*
                 * Do not restore if the video
                 * is basically finished.
                 */

                const savedPosition =
                  historyData.position;

                const savedDuration =
                  Number(
                    historyData.duration
                  ) || 0;

                if (
                  savedDuration <= 0 ||
                  savedPosition <
                    savedDuration -
                      2
                ) {
                  setTimeout(() => {
                    if (
                      !mountedRef.current
                    ) {
                      return;
                    }

                    try {
                      player.currentTime =
                        savedPosition;

                      setCurrentPosition(
                        savedPosition
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
          }
        } catch (err) {
          console.error(
            'Player fetch error:',
            err
          );

          if (
            mountedRef.current
          ) {
            setError(true);
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(false);
          }
        }
      },
      [
        episodeId,
        session?.user?.id,
        makeUuid,
        loadVideo,
        player,
      ]
    );

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
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
  }, [
    fetchData,
    player,
  ]);

  /*
   * ============================================================
   * PLAY / PAUSE STATE
   * ============================================================
   */

  useEffect(() => {
    const subscription =
      player.addListener(
        'playingChange',
        (event) => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          const playing =
            !!event.isPlaying;

          setIsPlaying(
            playing
          );
        }
      );

    return () => {
      subscription.remove();
    };
  }, [player]);

  /*
   * ============================================================
   * VIDEO STATUS
   * ============================================================
   */

  useEffect(() => {
    const subscription =
      player.addListener(
        'statusChange',
        (event) => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          const status =
            String(
              (event as any)
                ?.status || ''
            ).toLowerCase();

          if (
            status.includes(
              'error'
            )
          ) {
            setIsPlaying(false);
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, [player]);

  /*
   * ============================================================
   * POSITION + VIEW TRACKING
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
      setInterval(
        async () => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          try {
            const position =
              Number(
                player.currentTime
              ) || 0;

            const videoDuration =
              Number(
                player.duration
              ) || 0;

            setCurrentPosition(
              position
            );

            setDuration(
              videoDuration
            );

            /*
             * Record view after meaningful playback.
             */

            const threshold =
              videoDuration > 0
                ? Math.min(
                    30,
                    videoDuration *
                      0.1
                  )
                : 30;

            if (
              !viewRecordedRef.current &&
              position >=
                threshold &&
              viewSessionIdRef.current
            ) {
              viewRecordedRef.current =
                true;

              const {
                error:
                  viewError,
              } =
                await supabase.rpc(
                  'record_episode_view',
                  {
                    p_episode_id:
                      episode.id,

                    p_session_id:
                      viewSessionIdRef.current,
                  }
                );

              if (
                viewError
              ) {
                console.error(
                  'View recording error:',
                  viewError
                );
              }
            }

            /*
             * Save watch position.
             */

            if (
              videoDuration >
                0 &&
              session.user.id
            ) {
              await supabase
                .from(
                  'watch_history'
                )
                .upsert(
                  {
                    user_id:
                      session.user.id,

                    episode_id:
                      episode.id,

                    position,

                    duration:
                      videoDuration,

                    updated_at:
                      new Date().toISOString(),
                  },
                  {
                    onConflict:
                      'user_id,episode_id',
                  }
                );
            }
          } catch (err) {
            console.error(
              'Playback tracking error:',
              err
            );
          }
        },
        5000
      );

    return () => {
      clearInterval(
        interval
      );
    };
  }, [
    isUnlocked,
    episode,
    session?.user?.id,
    player,
  ]);

  /*
   * ============================================================
   * SEEK
   * ============================================================
   */

  const seekBy =
    useCallback(
      (seconds: number) => {
        try {
          const total =
            Number(
              player.duration
            ) || duration || 0;

          if (total <= 0) {
            return;
          }

          const current =
            Number(
              player.currentTime
            ) || 0;

          const nextPosition =
            Math.min(
              total,
              Math.max(
                0,
                current +
                  seconds
              )
            );

          player.currentTime =
            nextPosition;

          setCurrentPosition(
            nextPosition
          );

          showPlayerControls();
        } catch (err) {
          console.error(
            'Seek error:',
            err
          );
        }
      },
      [
        player,
        duration,
        showPlayerControls,
      ]
    );

  /*
   * ============================================================
   * SEEK TO PROGRESS BAR POSITION
   * ============================================================
   */

  const handleProgressPress =
    useCallback(
      (
        event: any
      ) => {
        try {
          if (
            progressWidth <= 0
          ) {
            return;
          }

          const total =
            Number(
              player.duration
            ) || duration || 0;

          if (total <= 0) {
            return;
          }

          const x =
            event.nativeEvent
              .locationX;

          const percentage =
            Math.max(
              0,
              Math.min(
                1,
                x /
                  progressWidth
              )
            );

          const nextPosition =
            total *
            percentage;

          player.currentTime =
            nextPosition;

          setCurrentPosition(
            nextPosition
          );

          showPlayerControls();
        } catch (err) {
          console.error(
            'Progress seek error:',
            err
          );
        }
      },
      [
        player,
        duration,
        progressWidth,
        showPlayerControls,
      ]
    );

  /*
   * ============================================================
   * PLAY / PAUSE
   * ============================================================
   */

  const togglePlayback =
    useCallback(() => {
      try {
        const total =
          Number(
            player.duration
          ) || duration || 0;

        const current =
          Number(
            player.currentTime
          ) || 0;

        /*
         * If video has finished,
         * start it again.
         */

        if (
          total > 0 &&
          current >=
            total - 0.5
        ) {
          player.currentTime =
            0;

          setCurrentPosition(
            0
          );

          player.play();

          setIsPlaying(true);

          showPlayerControls();

          return;
        }

        if (isPlaying) {
          player.pause();

          setIsPlaying(false);

          setShowControls(true);
        } else {
          player.play();

          setIsPlaying(true);

          showPlayerControls();
        }
      } catch (err) {
        console.error(
          'Playback toggle error:',
          err
        );
      }
    }, [
      player,
      duration,
      isPlaying,
      showPlayerControls,
    ]);

  /*
   * ============================================================
   * END OF VIDEO
   * ============================================================
   */

  useEffect(() => {
    const subscription =
      player.addListener(
        'playToEnd',
        () => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          setCurrentPosition(
            Number(
              player.duration
            ) || duration
          );

          setIsPlaying(
            false
          );

          setShowControls(
            true
          );

          const currentIndex =
            allEpisodes.findIndex(
              (item) =>
                item.id ===
                episode?.id
            );

          /*
           * Automatically go to next unlocked episode.
           */

          if (
            currentIndex >= 0 &&
            currentIndex <
              allEpisodes.length -
                1
          ) {
            const nextEpisode =
              allEpisodes[
                currentIndex + 1
              ];

            const nextUnlocked =
              nextEpisode.is_free ===
                true ||
              series?.is_free ===
                true ||
              hasSubscription ||
              unlockedEpisodeIds.has(
                nextEpisode.id
              );

            if (
              nextUnlocked
            ) {
              router.replace(
                `/player/${nextEpisode.id}`
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
    duration,
    allEpisodes,
    episode?.id,
    series?.is_free,
    hasSubscription,
    unlockedEpisodeIds,
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
          series?.is_free ===
            true ||
          hasSubscription ||
          unlockedEpisodeIds.has(
            ep.id
          );

        if (unlocked) {
          router.replace(
            `/player/${ep.id}`
          );

          return;
        }

        Alert.alert(
          'Episode locked',
          `Unlock this episode for ${ep.coin_price} coins.`
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
   * UNLOCK EPISODE
   * ============================================================
   */

  const handleUnlock =
    useCallback(
      async () => {
        if (
          !session?.user?.id
        ) {
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
              onPress:
                async () => {
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

                    if (
                      unlockError
                    ) {
                      console.error(
                        'Unlock error:',
                        unlockError
                      );

                      Alert.alert(
                        'Unlock failed',
                        unlockError.message ||
                          'Unable to unlock this episode.'
                      );

                      return;
                    }

                    console.log(
                      'Unlock result:',
                      data
                    );

                    Alert.alert(
                      'Unlocked',
                      'The episode has been unlocked.'
                    );

                    /*
                     * Reload access state + video.
                     */

                    await fetchData();
                  } catch (err) {
                    console.error(
                      'Unlock exception:',
                      err
                    );

                    Alert.alert(
                      'Unlock failed',
                      'Something went wrong while unlocking the episode.'
                    );
                  }
                },
            },
          ]
        );
      },
      [
        session?.user?.id,
        episode,
        fetchData,
      ]
    );

  /*
   * ============================================================
   * FORMAT TIME
   * ============================================================
   */

  const formatTime =
    useCallback(
      (seconds: number) => {
        if (
          !Number.isFinite(
            seconds
          ) ||
          seconds < 0
        ) {
          return '0:00';
        }

        const totalSeconds =
          Math.floor(seconds);

        const minutes =
          Math.floor(
            totalSeconds /
              60
          );

        const remaining =
          totalSeconds % 60;

        return `${minutes}:${String(
          remaining
        ).padStart(2, '0')}`;
      },
      []
    );

  /*
   * ============================================================
   * PROGRESS LAYOUT
   * ============================================================
   */

  const handleProgressLayout =
    useCallback(
      (
        event: LayoutChangeEvent
      ) => {
        setProgressWidth(
          event.nativeEvent
            .layout.width
        );
      },
      []
    );

  /*
   * ============================================================
   * PREVIOUS / NEXT
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
          styles.loadingContainer
        }
      >
        <Text
          style={
            styles.loadingText
          }
        >
          Loading episode...
        </Text>
      </View>
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
      <View
        style={
          styles.errorContainer
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Unable to load episode
        </Text>

        <TouchableOpacity
          style={
            styles.retryButton
          }
          onPress={() =>
            fetchData()
          }
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            Try Again
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.backButtonError
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * ============================================================
   * MAIN
   * ============================================================
   */

  return (
    <View
      style={[
        styles.container,
        isFullscreen &&
          styles.fullscreenContainer,
      ]}
    >
      <StatusBar
        hidden={isFullscreen}
        barStyle="light-content"
      />

      {/* ======================================================
          VIDEO AREA
          ====================================================== */}

      <View
        style={[
          styles.videoContainer,
          isFullscreen &&
            styles.videoContainerFullscreen,
        ]}
      >
        {isUnlocked ? (
          <>
            <VideoView
              player={player}
              style={
                styles.video
              }
              nativeControls={
                false
              }
              contentFit="contain"
              allowsFullscreen={
                false
              }
            />

            {/* =================================================
                TRANSPARENT TOUCH AREA
                ================================================= */}

            <TouchableOpacity
              activeOpacity={1}
              style={
                styles.videoTouchArea
              }
              onPress={() => {
                if (
                  showControls
                ) {
                  setShowControls(
                    false
                  );

                  if (
                    controlsTimer.current
                  ) {
                    clearTimeout(
                      controlsTimer.current
                    );
                  }
                } else {
                  showPlayerControls();
                }
              }}
            />

            {/* =================================================
                TOP BAR
                ================================================= */}

            {showControls && (
              <View
                style={
                  styles.topBar
                }
              >
                <TouchableOpacity
                  style={
                    styles.backButton
                  }
                  onPress={() => {
                    if (
                      isFullscreen
                    ) {
                      setIsFullscreen(
                        false
                      );

                      return;
                    }

                    router.back();
                  }}
                >
                  <ChevronLeft
                    size={30}
                    color={
                      Colors.dark
                        .text
                    }
                    strokeWidth={
                      2.5
                    }
                  />
                </TouchableOpacity>

                <Text
                  numberOfLines={1}
                  style={
                    styles.videoTitle
                  }
                >
                  {episode.title}
                </Text>

                <View
                  style={
                    styles.topSpacer
                  }
                />
              </View>
            )}

            {/* =================================================
                CENTER CONTROLS
                ================================================= */}

            {showControls && (
              <View
                pointerEvents="box-none"
                style={
                  styles.centerControls
                }
              >
                {/* REWIND */}

                <TouchableOpacity
                  style={
                    styles.seekCircle
                  }
                  onPress={() =>
                    seekBy(-10)
                  }
                >
                  <Text
                    style={
                      styles.seekArrow
                    }
                  >
                    ↶
                  </Text>

                  <Text
                    style={
                      styles.seekNumber
                    }
                  >
                    10
                  </Text>
                </TouchableOpacity>

                {/* PLAY / PAUSE */}

                <TouchableOpacity
                  style={
                    styles.playCircle
                  }
                  onPress={
                    togglePlayback
                  }
                >
                  {isPlaying ? (
                    <Text
                      style={
                        styles.pauseText
                      }
                    >
                      ❚❚
                    </Text>
                  ) : (
                    <Play
                      size={34}
                      color={
                        Colors.dark
                          .text
                      }
                      fill={
                        Colors.dark
                          .text
                      }
                    />
                  )}
                </TouchableOpacity>

                {/* FORWARD */}

                <TouchableOpacity
                  style={
                    styles.seekCircle
                  }
                  onPress={() =>
                    seekBy(10)
                  }
                >
                  <Text
                    style={
                      styles.seekArrow
                    }
                  >
                    ↷
                  </Text>

                  <Text
                    style={
                      styles.seekNumber
                    }
                  >
                    10
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* =================================================
                BOTTOM CONTROLS
                ================================================= */}

            {showControls && (
              <View
                style={
                  styles.bottomControls
                }
              >
                {/* PROGRESS */}

                <TouchableOpacity
                  activeOpacity={
                    1
                  }
                  onLayout={
                    handleProgressLayout
                  }
                  onPress={
                    handleProgressPress
                  }
                  style={
                    styles.progressContainer
                  }
                >
                  <View
                    style={
                      styles.progressTrack
                    }
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width:
                            duration >
                              0 &&
                            progressWidth >
                              0
                              ? `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    (currentPosition /
                                      duration) *
                                      100
                                  )
                                )}%`
                              : '0%',
                        },
                      ]}
                    />
                  </View>

                  <View
                    style={[
                      styles.progressThumb,
                      {
                        left:
                          duration >
                            0 &&
                          progressWidth >
                            0
                            ? Math.max(
                                0,
                                Math.min(
                                  progressWidth -
                                    14,
                                  (currentPosition /
                                    duration) *
                                    progressWidth -
                                    7
                                )
                              )
                            : 0,
                      },
                    ]}
                  />
                </TouchableOpacity>

                {/* TIME + BUTTONS */}

                <View
                  style={
                    styles.controlsRow
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
                      styles.bottomCenterButtons
                    }
                  >
                    {/* PREVIOUS */}

                    {prevEpisode ? (
                      <TouchableOpacity
                        style={
                          styles.smallNavButton
                        }
                        onPress={() =>
                          goToEpisode(
                            prevEpisode
                          )
                        }
                      >
                        <ChevronLeft
                          size={22}
                          color={
                            Colors
                              .dark
                              .text
                          }
                        />

                        <Text
                          style={
                            styles.smallButtonText
                          }
                        >
                          Previous
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={{
                          width: 82,
                        }}
                      />
                    )}

                    {/* FULLSCREEN */}

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

                    {/* NEXT */}

                    {nextEpisode ? (
                      <TouchableOpacity
                        style={
                          styles.smallNavButton
                        }
                        onPress={() =>
                          goToEpisode(
                            nextEpisode
                          )
                        }
                      >
                        <Text
                          style={
                            styles.smallButtonText
                          }
                        >
                          Next
                        </Text>

                        <ChevronRight
                          size={22}
                          color={
                            Colors
                              .dark
                              .text
                          }
                        />
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={{
                          width: 82,
                        }}
                      />
                    )}
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
              {
                episode.coin_price
              }{' '}
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
                  Colors.dark
                    .text
                }
                strokeWidth={2}
              />

              <Text
                style={
                  styles.unlockButtonText
                }
              >
                Unlock for{' '}
                {
                  episode.coin_price
                }
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ======================================================
          EPISODE INFORMATION
          ====================================================== */}

      {!isFullscreen &&
        isUnlocked && (
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
                {
                  episode.description
                }
              </Text>
            ) : null}

            <View
              style={
                styles.episodeMeta
              }
            >
              <Text
                style={
                  styles.metaText
                }
              >
                Episode{' '}
                {
                  episode.episode_number
                }
              </Text>

              <Text
                style={
                  styles.metaText
                }
              >
                •
              </Text>

              <Text
                style={
                  styles.metaText
                }
              >
                {formatTime(
                  duration ||
                    Number(
                      episode.duration
                    ) ||
                    0
                )}
              </Text>
            </View>
          </View>
        )}
    </View>
  );
}

/*
 * ==============================================================
 * STYLES
 * ==============================================================
 */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        Colors.dark.background,
    },

    fullscreenContainer: {
      backgroundColor:
        '#000',
    },

    videoContainer: {
      width: '100%',
      height: 300,
      backgroundColor:
        '#000',
      position: 'relative',
    },

    videoContainerFullscreen: {
      ...StyleSheet.absoluteFillObject,
      height: undefined,
      zIndex: 100,
    },

    video: {
      width: '100%',
      height: '100%',
      backgroundColor:
        '#000',
    },

    videoTouchArea: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },

    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      minHeight: 62,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        'rgba(0,0,0,0.55)',
      zIndex: 10,
    },

    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    videoTitle: {
      flex: 1,
      marginHorizontal: 8,
      color: Colors.dark.text,
      fontSize: 17,
      fontWeight: '600',
      textAlign: 'center',
    },

    topSpacer: {
      width: 44,
    },

    centerControls: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 70,
      alignItems: 'center',
      justifyContent:
        'center',
      flexDirection: 'row',
      gap: 34,
      zIndex: 8,
    },

    playCircle: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 2,
      borderColor:
        'rgba(255,255,255,0.55)',
      backgroundColor:
        'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    pauseText: {
      color: Colors.dark.text,
      fontSize: 25,
      fontWeight: '700',
      letterSpacing: 2,
    },

    seekCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent:
        'center',
      position: 'relative',
    },

    seekArrow: {
      color: Colors.dark.text,
      fontSize: 25,
      lineHeight: 25,
      fontWeight: '600',
    },

    seekNumber: {
      position: 'absolute',
      color: Colors.dark.text,
      fontSize: 9,
      fontWeight: '800',
      top: 25,
    },

    bottomControls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 8,
      backgroundColor:
        'rgba(0,0,0,0.72)',
      zIndex: 10,
    },

    progressContainer: {
      width: '100%',
      height: 22,
      justifyContent:
        'center',
      position: 'relative',
    },

    progressTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor:
        'rgba(255,255,255,0.28)',
      overflow: 'hidden',
    },

    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor:
        Colors.primary[500],
    },

    progressThumb: {
      position: 'absolute',
      top: 5,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor:
        Colors.primary[500],
    },

    controlsRow: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    bottomCenterButtons: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 8,
    },

    timeText: {
      width: 48,
      color: Colors.dark.text,
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
    },

    smallNavButton: {
      minWidth: 82,
      height: 38,
      paddingHorizontal: 7,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.08)',
    },

    smallButtonText: {
      color: Colors.dark.text,
      fontSize: 11,
      fontWeight: '600',
    },

    fullscreenButton: {
      height: 38,
      paddingHorizontal: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.08)',
    },

    fullscreenText: {
      color: Colors.dark.text,
      fontSize: 11,
      fontWeight: '600',
    },

    lockedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 24,
      backgroundColor:
        Colors.dark.background,
    },

    lockedIconContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.04)',
      marginBottom: 18,
    },

    lockedTitle: {
      color: Colors.dark.text,
      fontSize: 21,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },

    lockedSubtitle: {
      color: Colors.dark.muted,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 22,
    },

    unlockButton: {
      minHeight: 48,
      paddingHorizontal: 22,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 8,
      backgroundColor:
        Colors.primary[500],
    },

    unlockButtonText: {
      color: Colors.dark.text,
      fontSize: 14,
      fontWeight: '700',
    },

    infoContainer: {
      flex: 1,
      padding: 18,
      backgroundColor:
        Colors.dark.background,
    },

    infoTitle: {
      color: Colors.dark.text,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 10,
    },

    infoDescription: {
      color: Colors.dark.muted,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 14,
    },

    episodeMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    metaText: {
      color: Colors.dark.muted,
      fontSize: 12,
    },

    loadingContainer: {
      flex: 1,
      backgroundColor:
        Colors.dark.background,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color: Colors.dark.text,
      fontSize: 16,
    },

    errorContainer: {
      flex: 1,
      backgroundColor:
        Colors.dark.background,
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 24,
    },

    errorTitle: {
      color: Colors.dark.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 18,
      textAlign: 'center',
    },

    retryButton: {
      minWidth: 130,
      minHeight: 46,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        Colors.primary[500],
      marginBottom: 10,
    },

    retryButtonText: {
      color: Colors.dark.text,
      fontSize: 14,
      fontWeight: '700',
    },

    backButtonError: {
      minWidth: 130,
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.08)',
    },

    backButtonText: {
      color: Colors.dark.text,
      fontSize: 14,
      fontWeight: '600',
    },
  });
