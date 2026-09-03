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

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useVideoPlayer,
  VideoView,
} from 'expo-video';

import { supabase } from '../../lib/supabase';

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

  const mountedRef = useRef(true);
  const loadingVideoRef = useRef(false);

  const [videoUrl, setVideoUrl] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [error, setError] =
    useState(false);

  /*
   * Create the video player without an initial source.
   * The secure URL is loaded later from Supabase.
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
   * Get the secure video URL from Supabase.
   *
   * Flow:
   *
   * App
   *   ↓
   * get-video-url
   *   ↓
   * entitlement check
   *   ↓
   * private videos bucket
   *   ↓
   * temporary signed URL
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
         * Get the current authenticated session.
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
         * Call the existing Supabase Edge Function.
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

        /*
         * Expected response:
         *
         * {
         *   success: true,
         *   episodeId: "...",
         *   url: "...",
         *   expiresIn: 300
         * }
         */
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
   * Player lifecycle protection.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      loadingVideoRef.current = false;

      /*
       * Pause only.
       *
       * useVideoPlayer manages the player lifecycle.
       * We intentionally do not call release().
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
   * Load and start the video safely.
   */
  const loadVideo = useCallback(
    async (id: string) => {
      if (!id) {
        console.error(
          'loadVideo: missing episode id'
        );

        return false;
      }

      if (loadingVideoRef.current) {
        console.log(
          'loadVideo: already loading'
        );

        return false;
      }

      if (!mountedRef.current) {
        console.log(
          'loadVideo: screen is not mounted'
        );

        return false;
      }

      loadingVideoRef.current = true;

      setIsLoading(true);
      setIsPlaying(false);
      setError(false);
      setVideoUrl(null);

      try {
        /*
         * ========================================
         * 1. Request secure URL
         * ========================================
         */
        console.log(
          'loadVideo: requesting secure URL...'
        );

        const secureUrl =
          await fetchVideoUrl(id);

        if (!mountedRef.current) {
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
         * ========================================
         * 2. Pause previous video
         * ========================================
         */
        try {
          player.pause();
        } catch (err) {
          console.warn(
            'loadVideo: pause failed:',
            err
          );
        }

        if (!mountedRef.current) {
          return false;
        }

        /*
         * ========================================
         * 3. Small Android safety delay
         * ========================================
         */
        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              100
            );
          }
        );

        if (!mountedRef.current) {
          return false;
        }

        /*
         * ========================================
         * 4. Replace video source
         * ========================================
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

          if (mountedRef.current) {
            setError(true);
            setIsLoading(false);
            setIsPlaying(false);
          }

          return false;
        }

        if (!mountedRef.current) {
          return false;
        }

        setVideoUrl(cleanUrl);

        console.log(
          'loadVideo: video source loaded successfully'
        );

        /*
         * ========================================
         * 5. Small delay before play
         * ========================================
         */
        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              150
            );
          }
        );

        if (!mountedRef.current) {
          return false;
        }

        /*
         * ========================================
         * 6. Start playback
         * ========================================
         */
        try {
          player.play();
        } catch (playError) {
          console.error(
            'loadVideo: play failed:',
            playError
          );

          if (mountedRef.current) {
            setError(true);
            setIsLoading(false);
            setIsPlaying(false);
          }

          return false;
        }

        if (!mountedRef.current) {
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

        if (mountedRef.current) {
          setError(true);
          setIsLoading(false);
          setIsPlaying(false);
        }

        return false;
      } finally {
        loadingVideoRef.current = false;
      }
    },
    [
      fetchVideoUrl,
      player,
    ]
  );

  /*
   * ============================================
   * Automatically load episode
   * ============================================
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

    loadVideo(episodeId);

    return () => {
      mountedRef.current = false;
    };
  }, [
    episodeId,
    loadVideo,
  ]);

  /*
   * ============================================
   * Error screen
   * ============================================
   */
  if (error) {
    return (
      <View
        style={styles.errorContainer}
      >
        <Text
          style={styles.errorIcon}
        >
          ⚠️
        </Text>

        <Text
          style={styles.errorTitle}
        >
          تعذر تشغيل الحلقة
        </Text>

        <Text
          style={styles.errorText}
        >
          حدث خطأ أثناء تحميل الفيديو.
          تأكد من اتصال الإنترنت ثم حاول
          مرة أخرى.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            if (!episodeId) {
              return;
            }

            if (
              loadingVideoRef.current
            ) {
              return;
            }

            mountedRef.current = true;

            loadVideo(
              episodeId
            );
          }}
        >
          <Text
            style={styles.retryText}
          >
            إعادة المحاولة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            router.back();
          }}
        >
          <Text
            style={styles.backText}
          >
            ← العودة
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * ============================================
   * Video screen
   * ============================================
   */
  return (
    <View
      style={styles.container}
    >
      <View
        style={styles.videoContainer}
      >
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture
        />

        {/* Loading overlay */}
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

        {/* Fallback play button */}
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

      {/* Bottom navigation */}
      <View
        style={styles.bottomBar}
      >
        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={() => {
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
 * ==============================================
 * Styles
 * ==============================================
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
