const loadVideo = useCallback(
  async (id: string) => {
    if (!id) {
      console.error('loadVideo: missing episode id');
      return false;
    }

    if (loadingVideoRef.current) {
      console.log('loadVideo: already loading');
      return false;
    }

    loadingVideoRef.current = true;

    try {
      console.log(
        'loadVideo: requesting secure URL for:',
        id
      );

      const videoUrl = await fetchVideoUrl(id);

      if (!videoUrl) {
        console.error(
          'loadVideo: no video URL returned'
        );

        if (mountedRef.current) {
          setIsPlaying(false);
          setError(true);
        }

        return false;
      }

      console.log(
        'loadVideo: secure URL received:',
        videoUrl
      );

      if (!mountedRef.current) {
        return false;
      }

      // Stop previous video
      try {
        player.pause();
      } catch (pauseError) {
        console.warn(
          'loadVideo: pause failed:',
          pauseError
        );
      }

      // Reset playback state
      setCurrentPosition(0);
      setDuration(0);
      setIsPlaying(false);
      setError(false);

      console.log(
        'loadVideo: loading video source...'
      );

      // Load the signed URL
      await player.replaceAsync(videoUrl);

      if (!mountedRef.current) {
        return false;
      }

      console.log(
        'loadVideo: video source loaded'
      );

      // Start playback
      try {
        player.play();
      } catch (playError) {
        console.error(
          'loadVideo: play failed:',
          playError
        );

        setIsPlaying(false);
        setError(true);

        return false;
      }

      if (mountedRef.current) {
        setIsPlaying(true);
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
