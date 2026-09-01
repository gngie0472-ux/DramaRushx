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
  const [unlockedEpisodeIds, setUnlockedEpisodeIds] = useState<Set<string>>(new Set());
  const viewRecordedRef = useRef(false);
  const viewSessionIdRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const makeUuid = useCallback(() => {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0;
      const v = ch === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const episodeColumns = 'id, series_id, episode_number, title, description, thumbnail_url, video_path, duration, is_free, coin_price, view_count, created_at';
      const { data: epData, error: epError } = await supabase
        .from('episodes')
        .select(episodeColumns)
        .eq('id', episodeId)
        .maybeSingle();

      if (epError || !epData) {
        setError(true);
        return;
      }

      const ep = epData as Episode;
      setEpisode(ep);

      const [seriesRes, episodesRes] = await Promise.all([
        supabase.from('series').select('*').eq('id', ep.series_id).maybeSingle(),
        supabase
          .from('episodes')
          .select(episodeColumns)
          .eq('series_id', ep.series_id)
          .order('episode_number', { ascending: true }),
      ]);

      if (seriesRes.data) setSeries(seriesRes.data as Series);
      setAllEpisodes((episodesRes.data as Episode[]) || []);

      // Check entitlement: free episode/series, active subscription, or purchased unlock.
      const seriesIsFree = !!seriesRes.data && (seriesRes.data as Series).is_free;
      const free = ep.is_free || seriesIsFree;
      let unlocked = free;
      let subscribed = false;
      let userUnlockIds = new Set<string>();
      if (session?.user) {
        const [{ data: subData }, { data: unlockRows }] = await Promise.all([
          supabase.rpc('has_active_subscription'),
          supabase.from('unlocked_episodes').select('episode_id').eq('user_id', session.user.id),
        ]);
        subscribed = !!subData;
        (unlockRows || []).forEach((row: any) => userUnlockIds.add(row.episode_id));
      }
      setUnlockedEpisodeIds(userUnlockIds);
      if (!free) unlocked = subscribed || userUnlockIds.has(ep.id);
      setHasSubscription(subscribed);
      setIsUnlocked(unlocked);
      viewRecordedRef.current = false;
      viewSessionIdRef.current = makeUuid();

      if (unlocked) {
        const { data: videoData, error: videoError } = await supabase.functions.invoke('get-video-url', {
          body: { episodeId: ep.id },
        });
        if (videoError || !videoData?.url) {
          setError(true);
          return;
        }
        player.replace(videoData.url);
        player.play();
        setIsPlaying(true);

        // Fetch saved position
        if (session?.user) {
          const { data: historyData } = await supabase
            .from('watch_history')
            .select('position')
            .eq('user_id', session.user.id)
            .eq('episode_id', ep.id)
            .maybeSingle();
          if (historyData && (historyData as any).position > 0) {
            const pos = (historyData as any).position;
            player.currentTime = pos;
            setCurrentPosition(pos);
          }
        }
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [episodeId, session, player, makeUuid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Track playback position
  useEffect(() => {
    if (!isUnlocked || !episode || !session?.user) return;
    const interval = setInterval(async () => {
      try {
        const pos = player.currentTime;
        const dur = player.duration;
        setCurrentPosition(pos);
        setDuration(dur);

        // Count a view only after meaningful playback (30s or 10%, whichever comes first).
        const threshold = dur > 0 ? Math.min(30, dur * 0.10) : 30;
        if (!viewRecordedRef.current && pos >= threshold && viewSessionIdRef.current) {
          viewRecordedRef.current = true;
          await supabase.rpc('record_episode_view', {
            p_episode_id: episode.id,
            p_session_id: viewSessionIdRef.current,
          });
        }

        // Save to watch history
        await supabase
          .from('watch_history')
          .upsert({
            user_id: session.user.id,
            series_id: episode.series_id,
            episode_id: episode.id,
            position: Math.floor(pos),
            duration: Math.floor(dur),
            watched_at: new Date().toISOString(),
          });
      } catch (e) {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isUnlocked, episode, session, player]);

  // Auto-play next episode
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      const currentIndex = allEpisodes.findIndex((e) => e.id === episode?.id);
      if (currentIndex >= 0 && currentIndex < allEpisodes.length - 1) {
        const nextEp = allEpisodes[currentIndex + 1];
        const nextUnlocked = nextEp.is_free || !!series?.is_free || hasSubscription || unlockedEpisodeIds.has(nextEp.id);
        if (nextUnlocked) {
          router.replace(`/player/${nextEp.id}`);
        }
      }
    });
    return () => { sub.remove(); };
  }, [player, allEpisodes, episode, hasSubscription, unlockedEpisodeIds, series]);

  const handleUnlock = useCallback(async () => {
    if (!session?.user) {
      Alert.alert('Sign in required', 'Please sign in to unlock episodes');
      router.push('/auth/login');
      return;
    }
    Alert.alert(
      'Unlock Episode',
      `Unlock "${episode?.title}" for ${episode?.coin_price} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          onPress: async () => {
            const { data, error } = await supabase.rpc('unlock_episode', {
              p_episode_id: episode!.id,
            });
            if (error) {
              Alert.alert('Error', 'Failed to unlock episode');
              return;
            }
            const result = data as any;
            if (result?.success) {
              setIsUnlocked(true);
              setUnlockedEpisodeIds((prev) => new Set(prev).add(episode!.id));
              const { data: videoData, error: videoError } = await supabase.functions.invoke('get-video-url', {
                body: { episodeId: episode!.id },
              });
              if (videoError || !videoData?.url) {
                Alert.alert('Error', 'Episode unlocked, but the video could not be loaded.');
                return;
              }
              player.replace(videoData.url);
              player.play();
              Alert.alert('Success', 'Episode unlocked!');
            } else {
              Alert.alert('Cannot unlock', result?.message || 'Insufficient coins');
            }
          },
        },
      ]
    );
  }, [session, episode, player]);

  const goToEpisode = useCallback(
    (ep: Episode) => {
      const unlocked = ep.is_free || !!series?.is_free || hasSubscription || unlockedEpisodeIds.has(ep.id);
      if (!unlocked) {
        Alert.alert('Locked', 'This episode is locked. Unlock it first.');
        return;
      }
      router.replace(`/player/${ep.id}`);
    },
    [hasSubscription, unlockedEpisodeIds, series]
  );

  const toggleControls = useCallback(() => {
    setShowControls((prev) => {
      const next = !prev;
      if (next && isPlaying) {
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
      }
      return next;
    });
  }, [isPlaying]);

  useEffect(() => {
    if (showControls && isPlaying) {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [showControls, isPlaying]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentIndex = allEpisodes.findIndex((e) => e.id === episode?.id);
  const prevEpisode = currentIndex > 0 ? allEpisodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex >= 0 && currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null;

  if (loading) {
    return <View style={styles.container} />;
  }

  if (error || !episode) {
    return <ErrorState message="Failed to load episode." onRetry={fetchData} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} />

      {/* Video Player */}
      <View style={[styles.playerContainer, isFullscreen && styles.playerFullscreen]}>
        {isUnlocked ? (
          <>
            <VideoView
              player={player}
              style={isFullscreen ? styles.videoFullscreen : styles.video}
              contentFit="contain"
              nativeControls={false}
              onFullscreenEnter={() => setIsFullscreen(true)}
              onFullscreenExit={() => setIsFullscreen(false)}
            />
            <TouchableOpacity
              style={styles.videoOverlay}
              onPress={toggleControls}
              activeOpacity={1}
            />
            {showControls && (
              <View style={styles.controlsOverlay}>
                <View style={styles.controlsTop}>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => (isFullscreen ? setIsFullscreen(false) : router.back())}
                  >
                    <ChevronLeft size={24} color={Colors.dark.text} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={styles.episodeLabel} numberOfLines={1}>
                    {series?.title} - Ep {episode.episode_number}
                  </Text>
                  <View style={{ width: 24 }} />
                </View>

                <TouchableOpacity
                  style={styles.centerPlayButton}
                  onPress={() => {
                    if (isPlaying) {
                      player.pause();
                      setIsPlaying(false);
                    } else {
                      player.play();
                      setIsPlaying(true);
                    }
                  }}
                >
                  <View style={styles.centerPlayCircle}>
                    {isPlaying ? (
                      <Text style={styles.pauseIcon}>❚❚</Text>
                    ) : (
                      <Play size={28} color={Colors.dark.text} strokeWidth={2} fill={Colors.dark.text} />
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.controlsBottom}>
                  <View style={styles.progressContainer}>
                    <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>
                  <View style={styles.bottomControls}>
                    {prevEpisode && (
                      <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => goToEpisode(prevEpisode)}
                      >
                        <ChevronLeft size={20} color={Colors.dark.text} strokeWidth={2} />
                        <Text style={styles.navButtonText}>Previous</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.fullscreenButton}
                      onPress={() => setIsFullscreen(!isFullscreen)}
                    >
                      <Text style={styles.fullscreenText}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</Text>
                    </TouchableOpacity>
                    {nextEpisode && (
                      <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => goToEpisode(nextEpisode)}
                      >
                        <Text style={styles.navButtonText}>Next</Text>
                        <ChevronRight size={20} color={Colors.dark.text} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.lockedContainer}>
            <View style={styles.lockedIconContainer}>
              <Lock size={48} color={Colors.primary[500]} strokeWidth={2} />
            </View>
            <Text style={styles.lockedTitle}>This episode is locked</Text>
            <Text style={styles.lockedSubtitle}>
              Unlock it with {episode.coin_price} coins to watch
            </Text>
            <TouchableOpacity style={styles.unlockButton} onPress={handleUnlock}>
              <Coins size={18} color={Colors.dark.text} strokeWidth={2} />
              <Text style={styles.unlockButtonText}>Unlock for {episode.coin_price}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Episode info below player (non-fullscreen) */}
      {!isFullscreen && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>{episode.title}</Text>
          {episode.description && (
            <Text style={styles.infoDescription}>{episode.description}</Text>
          )}

          {nextEpisode && (
            <TouchableOpacity
              style={styles.nextEpisodeButton}
              onPress={() => goToEpisode(nextEpisode)}
            >
              <SkipForward size={18} color={Colors.dark.text} strokeWidth={2} />
              <View style={styles.nextEpisodeInfo}>
                <Text style={styles.nextEpisodeLabel}>Next Episode</Text>
                <Text style={styles.nextEpisodeTitle} numberOfLines={1}>{nextEpisode.title}</Text>
              </View>
              <ChevronRight size={20} color={Colors.dark.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
  },
  video: {
    flex: 1,
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
    justifyContent: 'space-between',
  },
  controlsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 56,
    backgroundColor: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  episodeLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
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
    justifyContent: 'center',
  },
  centerPlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pauseIcon: {
    fontSize: 22,
    color: Colors.dark.text,
    fontWeight: 'bold',
    letterSpacing: -2,
  },
  controlsBottom: {
    padding: 16,
    gap: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.text,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary[500],
    borderRadius: 2,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navButtonText: {
    fontSize: 13,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  fullscreenButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fullscreenText: {
    fontSize: 12,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  lockedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    fontSize: 20,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  lockedSubtitle: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  unlockButtonText: {
    fontSize: 15,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  infoContainer: {
    padding: 16,
    gap: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
  nextEpisodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  nextEpisodeInfo: {
    flex: 1,
    gap: 2,
  },
  nextEpisodeLabel: {
    fontSize: 11,
    fontFamily: 'Cairo-Regular',
    color: Colors.primary[400],
  },
  nextEpisodeTitle: {
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
});
