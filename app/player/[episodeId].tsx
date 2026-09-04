import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useVideoPlayer,
  VideoView,
} from 'expo-video';

import { supabase } from '../../lib/supabase';

/*
 * ============================================================
 * Storage keys
 * ============================================================
 */

const LAST_EPISODE_KEY =
  '@dramarush_last_episode';

const POSITION_KEY_PREFIX =
  '@dramarush_video_position_';

/*
 * Save the current position every 5 seconds.
 */
const POSITION_SAVE_INTERVAL = 5000;

/*
 * Consider the episode completed when the user reaches
 * approximately the last 10 seconds.
 */
const COMPLETION_THRESHOLD = 10;

export default function PlayerScreen() {
  const params =
    useLocalSearchParams<{
      episodeId?: string | string[];
    }>();

  const episodeId = Array.isArray(
    params.episodeId
  )
    ? params.episodeId[0]
    : params.episodeId;

  /*
   * ============================================================
   * Refs
   * ============================================================
   */

  const mountedRef = useRef(true);

  const loadingVideoRef =
    useRef(false);

  const savePositionRef =
    useRef<(() => Promise<void>) | null>(null);

  /*
   * ============================================================
   * State
   * ============================================================
   */

  const [videoUrl, setVideoUrl] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [error, setError] =
    useState(false);

  /*
   * ============================================================
   * Video player
   * ============================================================
   */

  const player = useVideoPlayer(
    null,
    (videoPlayer) => {
      try {
        videoPlayer.loop = false;
      } catch (err) {
        console.warn(
          'Player configuration failed:',
          err
        );
      }
    }
  );

  /*
   * ============================================================
   * Get secure video URL from Supabase
   * ============================================================
   */

  const fetchVideoUrl = useCallback(
    async (
      id: string
    ): Promise<string | null> => {
      try {
        if (!id) {
          console.error(
            'fetchVideoUrl: missing episode id'
          );

          return null;
        }

        /*
         * Get current authenticated session.
         */

        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          console.error(
            'fetchVideoUrl: session error:',
            sessionError
          );

          return null;
        }

        const accessToken =
          sessionData.session
            ?.access_token;

        if (!accessToken) {
          console.error(
            'fetchVideoUrl: no authenticated session'
          );

          return null;
        }

        console.log(
          'fetchVideoUrl: requesting secure URL for:',
          id
        );

        /*
         * Existing Supabase Edge Function.
         */

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
              },
            }
          );

        if (functionError) {
          console.error(
            'fetchVideoUrl: Edge Function error:',
            functionError
          );

          return null;
        }

        const url = data?.url;

        if (
          !url ||
          typeof url !== 'string' ||
          !url.trim()
        ) {
          console.error(
            'fetchVideoUrl: invalid URL returned:',
            data
          );

          return null;
        }

        console.log(
          'fetchVideoUrl: secure URL received'
        );

        return url.trim();
      } catch (err) {
        console.error(
          'fetchVideoUrl: unexpected error:',
          err
        );

        return null;
      }
    },
    []
  );

  /*
   * ============================================================
   * Get saved position
   * ============================================================
   */

  const getSavedPosition =
    useCallback(
      async (
        id: string
      ): Promise<number> => {
        try {
          if (!id) {
            return 0;
          }

          const key =
            `${POSITION_KEY_PREFIX}${id}`;

          const saved =
            await AsyncStorage.getItem(
              key
            );

          if (!saved) {
            return 0;
          }

          const position =
            Number(saved);

          if (
            !Number.isFinite(position) ||
            position < 0
          ) {
            return 0;
          }

          console.log(
            'getSavedPosition: restored position:',
            position
          );

          return position;
        } catch (err) {
          console.warn(
            'getSavedPosition: failed:',
            err
          );

          return 0;
        }
      },
      []
    );

  /*
   * ============================================================
   * Save current video position
   * ============================================================
   */

  const saveCurrentPosition =
    useCallback(
      async () => {
        try {
          if (!episodeId) {
            return;
          }

          if (!mountedRef.current) {
            return;
          }

          const currentTime =
            Number(player.currentTime || 0);

          const duration =
            Number(player.duration || 0);

          if (
            !Number.isFinite(currentTime) ||
            currentTime < 0
          ) {
            return;
          }

          /*
           * If the video is essentially finished,
           * remove the saved position so the next
           * viewing starts from the beginning.
           */

          if (
            Number.isFinite(duration) &&
            duration > 0 &&
            currentTime >=
              duration -
                COMPLETION_THRESHOLD
          ) {
            const key =
              `${POSITION_KEY_PREFIX}${episodeId}`;

            await AsyncStorage.removeItem(
              key
            );

            console.log(
              'saveCurrentPosition: episode completed'
            );

            return;
          }

          const key =
            `${POSITION_KEY_PREFIX}${episodeId}`;

          await AsyncStorage.setItem(
            key,
            String(currentTime)
          );

          /*
           * Also remember the last episode.
           */

          await AsyncStorage.setItem(
            LAST_EPISODE_KEY,
            episodeId
          );

          console.log(
            'saveCurrentPosition: saved:',
            currentTime
          );
        } catch (err) {
          console.warn(
            'saveCurrentPosition: failed:',
            err
          );
        }
      },
      [episodeId, player]
    );

  /*
   * Keep a ref to the latest save function.
   * This allows cleanup to save the final position.
   */

  useEffect(() => {
    savePositionRef.current =
      saveCurrentPosition;
  }, [saveCurrentPosition]);

  /*
   * ============================================================
   * Save position periodically
   * ============================================================
   */

  useEffect(() => {
    if (!episodeId) {
      return;
    }

    const interval =
      setInterval(() => {
        if (
          mountedRef.current &&
          isPlaying
        ) {
          saveCurrentPosition();
        }
      }, POSITION_SAVE_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [
    episodeId,
    isPlaying,
    saveCurrentPosition,
  ]);

  /*
   * ============================================================
   * Player lifecycle protection
   * ============================================================
   */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      loadingVideoRef.current = false;

      /*
       * Save the last position before leaving.
       */

      if (
        savePositionRef.current
      ) {
        savePositionRef.current().catch(
          (err) => {
            console.warn(
              'Final position save failed:',
              err
            );
          }
        );
      }

      /*
       * Pause only.
       *
       * useVideoPlayer manages the player
       * lifecycle.
       */

      try {
        player.pause();
      } catch (err) {
        console.warn(
          'Player cleanup failed:',
          err
        );
      }
    };
  }, [player]);

  /*
   * ============================================================
   * Load and start video
   * ============================================================
   */

  const loadVideo = useCallback(
    async (id: string) => {
      if (!id) {
        console.error(
          'loadVideo: missing episode id'
        );

        return false;
      }

      if (
        loadingVideoRef.current
      ) {
        console.log(
          'loadVideo: already loading'
        );

        return false;
      }

      if (
        !mountedRef.current
      ) {
        console.log(
          'loadVideo: screen is not mounted'
        );

        return false;
      }

      loadingVideoRef.current =
        true;

      setIsLoading(true);
      setIsPlaying(false);
      setError(false);
      setVideoUrl(null);

      try {
        /*
         * ======================================================
         * 1. Request secure URL
         * ======================================================
         */

        console.log(
          'loadVideo: requesting secure URL...'
        );

        const secureUrl =
          await fetchVideoUrl(id);

        if (
          !mountedRef.current
        ) {
          console.log(
            'loadVideo: screen unmounted after URL request'
          );

          return false;
        }

        if (
          !secureUrl ||
          typeof secureUrl !== 'string' ||
          !secureUrl.trim()
        ) {
          console.error(
            'loadVideo: invalid secure URL'
          );

          setError(true);
          setIsLoading(false);

          return false;
        }

        const cleanUrl =
          secureUrl.trim();

        /*
         * ======================================================
         * 2. Get saved position
         * ======================================================
         */

        const savedPosition =
          await getSavedPosition(id);

        if (
          !mountedRef.current
        ) {
          return false;
        }

        console.log(
          'loadVideo: saved position:',
          savedPosition
        );

        /*
         * ======================================================
         * 3. Remember last episode
         * ======================================================
         */

        try {
          await AsyncStorage.setItem(
            LAST_EPISODE_KEY,
            id
          );
        } catch (storageError) {
          console.warn(
            'loadVideo: unable to save last episode:',
            storageError
          );
        }

        /*
         * ======================================================
         * 4. Pause previous video
         * ======================================================
         */

        try {
          player.pause();
        } catch (err) {
          console.warn(
            'loadVideo: pause failed:',
            err
          );
        }

        if (
          !mountedRef.current
        ) {
          return false;
        }

        /*
         * ======================================================
         * 5. Small Android safety delay
         * ======================================================
         */

        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              100
            );
          }
        );

        if (
          !mountedRef.current
        ) {
          return false;
        }

        /*
         * ======================================================
         * 6. Replace video source
         * ======================================================
         */

        console.log(
          'loadVideo: loading secure video...'
        );

        try {
          await player.replaceAsync(
            cleanUrl
          );
        } catch (replaceError) {
          console.error(
            'loadVideo: replaceAsync failed:',
            replaceError
          );

          if (
            mountedRef.current
          ) {
            setError(true);
            setIsLoading(false);
            setIsPlaying(false);
          }

          return false;
        }

        if (
          !mountedRef.current
        ) {
          return false;
        }

        setVideoUrl(cleanUrl);

        console.log(
          'loadVideo: video source loaded successfully'
        );

        /*
         * ======================================================
         * 7. Restore previous position
         * ======================================================
         */

        if (
          savedPosition > 0
        ) {
          try {
            const duration =
              Number(
                player.duration || 0
              );

            /*
             * Only seek if the saved position
             * is valid for this video.
             */

            if (
              !Number.isFinite(
                duration
              ) ||
              duration <= 0 ||
              savedPosition <
                duration
            ) {
              player.currentTime =
                savedPosition;

              console.log(
                'loadVideo: restored playback position:',
                savedPosition
              );
            }
          } catch (seekError) {
            console.warn(
              'loadVideo: failed to restore position:',
              seekError
            );
          }
        }

        /*
         * ======================================================
         * 8. Small delay before play
         * ======================================================
         */

        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              150
            );
          }
        );

        if (
          !mountedRef.current
        ) {
          return false;
        }

        /*
         * ======================================================
         * 9. Start playback
         * ======================================================
         */

        try {
          player.play();
        } catch (playError) {
          console.error(
            'loadVideo: play failed:',
            playError
          );

          if (
            mountedRef.current
          ) {
            setError(true);
            setIsLoading(false);
            setIsPlaying(false);
          }

          return false;
        }

        if (
          !mountedRef.current
        ) {
          return false;
        }

        setIsPlaying(true);
        setIsLoading(false);
        setError(false);

        console.log(
          'loadVideo: playback started successfully'
        );

        return true;
      } catch (err) {
        console.error(
          'loadVideo: VIDEO PLAYBACK ERROR:',
          err
        );

        if (
          mountedRef.current
        ) {
          setError(true);
          setIsLoading(false);
          setIsPlaying(false);
        }

        return false;
      } finally {
        loadingVideoRef.current =
          false;
      }
    },
    [
      fetchVideoUrl,
      getSavedPosition,
      player,
    ]
  );

  /*
   * ============================================================
   * Automatically load episode
   * ============================================================
   */

  useEffect(() => {
    if (!episodeId) {
      console.error(
        'PlayerScreen: missing episodeId'
      );

      setError(true);
      setIsLoading(false);

      return;
    }

    mountedRef.current = true;

    loadVideo(episodeId);

    return () => {
      /*
       * The main cleanup effect handles
       * saving the final position.
       */
      mountedRef.current = false;
    };
  }, [
    episodeId,
    loadVideo,
  ]);

  /*
   * ============================================================
   * Error screen
   * ============================================================
   */

  if (error) {
    return (
      <View
        style={
          styles.errorContainer
        }
      >
        <Text
          style={
            styles.errorIcon
          }
        >
          ⚠️
        </Text>

        <Text
          style={
            styles.errorTitle
          }
        >
          تعذر تشغيل الحلقة
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          حدث خطأ أثناء تحميل الفيديو.
          تأكد من اتصال الإنترنت ثم حاول
          مرة أخرى.
        </Text>

        <TouchableOpacity
          style={
            styles.retryButton
          }
          onPress={() => {
            if (!episodeId) {
              return;
            }

            if (
              loadingVideoRef.current
            ) {
              return;
            }

            mountedRef.current =
              true;

            loadVideo(
              episodeId
            );
          }}
        >
          <Text
            style={
              styles.retryText
            }
          >
            إعادة المحاولة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={() => {
            router.back();
          }}
        >
          <Text
            style={
              styles.backText
            }
          >
            ← العودة
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * ============================================================
   * Video screen
   * ============================================================
   */

  return (
    <View
      style={styles.container}
    >
      <View
        style={
          styles.videoContainer
        }
      >
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture
        />

        /*
         * Loading overlay
         */

        {isLoading && (
          <View
            style={
              styles.loadingOverlay
            }
          >
            <ActivityIndicator
              size="large"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              جاري تحميل الحلقة...
            </Text>
          </View>
        )}

        /*
         * Fallback play button
         */

        {!isLoading &&
          videoUrl &&
          !isPlaying && (
            <TouchableOpacity
              style={
                styles.playButton
              }
              onPress={() => {
                try {
                  if (
                    !mountedRef.current
                  ) {
                    return;
                  }

                  player.play();

                  setIsPlaying(
                    true
                  );

                  setError(
                    false
                  );
                } catch (err) {
                  console.error(
                    'Manual play failed:',
                    err
                  );

                  if (
                    mountedRef.current
                  ) {
                    setError(
                      true
                    );
                  }
                }
              }}
            >
              <Text
                style={
                  styles.playIcon
                }
              >
                ▶
              </Text>
            </TouchableOpacity>
          )}
      </View>

      /*
       * ========================================================
       * Bottom navigation
       * ========================================================
       */

      <View
        style={styles.bottomBar}
      >
        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={async () => {
            /*
             * Save position before going back.
             */

            try {
              await saveCurrentPosition();
            } catch (err) {
              console.warn(
                'Save before back failed:',
                err
              );
            }

            /*
             * Pause video.
             */

            try {
              player.pause();
            } catch (err) {
              console.warn(
                'Pause before back failed:',
                err
              );
            }

            router.back();
          }}
        >
          <Text
            style={
              styles.backText
            }
          >
            ← العودة
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
 * ==============================================================
 * Styles
 * ==============================================================
 */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },

    videoContainer: {
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },

    video: {
      width: '100%',
      height: '100%',
    },

    loadingOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(0,0,0,0.70)',
    },

    loadingText: {
      marginTop: 16,
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },

    playButton: {
      position: 'absolute',
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(255,255,255,0.92)',
    },

    playIcon: {
      color: '#000',
      fontSize: 30,
      marginLeft: 4,
    },

    bottomBar: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: '#000',
    },

    backButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: '#222',
    },

    backText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },

    errorContainer: {
      flex: 1,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },

    errorIcon: {
      fontSize: 42,
      marginBottom: 18,
    },

    errorTitle: {
      color: '#fff',
      fontSize: 23,
      fontWeight: '800',
      textAlign: 'center',
    },

    errorText: {
      color: '#aaa',
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 25,
    },

    retryButton: {
      paddingHorizontal: 32,
      paddingVertical: 13,
      borderRadius: 10,
      backgroundColor: '#7c3aed',
      marginBottom: 12,
    },

    retryText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },
  });
