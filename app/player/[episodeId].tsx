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
import { useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function PlayerScreen() {
  const { episodeId } =
    useLocalSearchParams<{ episodeId: string }>();

  const mountedRef = useRef(true);
  const loadingVideoRef = useRef(false);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(false);

  /*
   * IMPORTANT:
   * هذا المتغير سيحتوي على رابط الفيديو الذي يرجعه
   * نظامك الحالي.
   *
   * لا نضع URL ثابت هنا.
   */
  const fetchVideoUrl = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        /*
         * استخدم API الخاص بك هنا.
         *
         * إذا كان fetchVideoUrl موجودًا في ملف آخر عندك،
         * استبدل محتوى هذه الدالة باستدعائه.
         */

        console.error(
          'fetchVideoUrl is not configured in player screen:',
          id
        );

        return null;
      } catch (err) {
        console.error(
          'fetchVideoUrl error:',
          err
        );

        return null;
      }
    },
    []
  );

  /*
   * إنشاء Player بدون مصدر في البداية.
   * هذا أكثر أمانًا من إنشاء player برابط قد لا يكون جاهزًا.
   */
  const player = useVideoPlayer(null, (player) => {
    try {
      player.loop = false;
    } catch (err) {
      console.warn(
        'Player configuration failed:',
        err
      );
    }
  });

  /*
   * مراقبة دورة حياة الشاشة.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      loadingVideoRef.current = false;

      try {
        player.pause();
      } catch (err) {
        console.warn(
          'Player cleanup pause failed:',
          err
        );
      }
    };
  }, [player]);

  /*
   * تحميل الفيديو بطريقة آمنة.
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
          'loadVideo: screen not mounted'
        );

        return false;
      }

      loadingVideoRef.current = true;

      setIsLoading(true);
      setError(false);
      setIsPlaying(false);

      try {
        console.log(
          'loadVideo: requesting secure URL for:',
          id
        );

        const url =
          await fetchVideoUrl(id);

        if (!mountedRef.current) {
          return false;
        }

        if (
          !url ||
          typeof url !== 'string' ||
          !url.trim()
        ) {
          console.error(
            'loadVideo: invalid video URL'
          );

          setError(true);
          setIsLoading(false);

          return false;
        }

        const cleanUrl = url.trim();

        console.log(
          'loadVideo: secure URL received'
        );

        /*
         * إيقاف الفيديو القديم قبل تبديل المصدر.
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
         * لا نستدعي replaceAsync إلا والـscreen ما زالت
         * موجودة.
         */
        try {
          console.log(
            'loadVideo: replacing source...'
          );

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
          }

          return false;
        }

        if (!mountedRef.current) {
          return false;
        }

        setVideoUrl(cleanUrl);

        /*
         * تأخير صغير لتجنب race condition على Android.
         */
        await new Promise<void>(
          (resolve) =>
            setTimeout(resolve, 150)
        );

        if (!mountedRef.current) {
          return false;
        }

        /*
         * تشغيل الفيديو.
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
            setIsPlaying(false);
            setIsLoading(false);
          }

          return false;
        }

        if (mountedRef.current) {
          setIsPlaying(true);
          setIsLoading(false);
          setError(false);
        }

        console.log(
          'loadVideo: playback started'
        );

        return true;
      } catch (err) {
        console.error(
          'loadVideo: VIDEO PLAYBACK ERROR:',
          err
        );

        if (mountedRef.current) {
          setError(true);
          setIsPlaying(false);
          setIsLoading(false);
        }

        return false;
      } finally {
        loadingVideoRef.current = false;
      }
    },
    [fetchVideoUrl, player]
  );

  /*
   * تشغيل الحلقة تلقائيًا عند فتح الشاشة.
   */
  useEffect(() => {
    if (!episodeId) {
      setError(true);
      setIsLoading(false);
      return;
    }

    loadVideo(episodeId);

    return () => {
      mountedRef.current = false;
    };
  }, [episodeId, loadVideo]);

  /*
   * شاشة خطأ بدون إغلاق التطبيق.
   */
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>
          تعذر تشغيل الفيديو
        </Text>

        <Text style={styles.errorText}>
          حدث خطأ أثناء تحميل الحلقة.
          يرجى المحاولة مرة أخرى.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            if (episodeId) {
              loadVideo(episodeId);
            }
          }}
        >
          <Text style={styles.retryText}>
            إعادة المحاولة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            العودة
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture
        />

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator
              size="large"
            />

            <Text style={styles.loadingText}>
              جاري تحميل الحلقة...
            </Text>
          </View>
        )}

        {!isLoading &&
          !isPlaying &&
          videoUrl && (
            <TouchableOpacity
              style={styles.playOverlay}
              onPress={() => {
                try {
                  player.play();
                  setIsPlaying(true);
                } catch (err) {
                  console.error(
                    'Manual play failed:',
                    err
                  );

                  setError(true);
                }
              }}
            >
              <Text style={styles.playIcon}>
                ▶
              </Text>
            </TouchableOpacity>
          )}
      </View>

      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={styles.backButton}
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
          <Text style={styles.backText}>
            ← العودة
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  loadingText: {
    marginTop: 14,
    color: '#fff',
    fontSize: 16,
  },

  playOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  playIcon: {
    color: '#000',
    fontSize: 28,
    marginLeft: 4,
  },

  bottomArea: {
    padding: 16,
    backgroundColor: '#000',
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#222',
  },

  backText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  errorTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 120,
  },

  errorText: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 30,
    lineHeight: 24,
  },

  retryButton: {
    alignSelf: 'center',
    marginTop: 25,
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
  },

  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
