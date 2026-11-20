import { useEffect, useRef, useState } from 'react';

let ytApiPromise = null;

function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      resolve(window.YT);
    };
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

function forceHighestQuality(player) {
  try {
    const levels = typeof player.getAvailableQualityLevels === 'function' ? player.getAvailableQualityLevels() : [];
    const preferred = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720'];
    const best = preferred.find((q) => levels.includes(q)) || 'hd1080';
    if (typeof player.setPlaybackQualityRange === 'function') {
      player.setPlaybackQualityRange(best, 'highres');
    }
    if (typeof player.setPlaybackQuality === 'function') {
      player.setPlaybackQuality(best);
    }
  } catch {
    // Ignore if YouTube API restricts quality hint
  }
}

/**
 * Full-bleed Netflix-style 4K/1080p 16:9 YouTube Trailer background player.
 * - Uses true cover-ratio widescreen framing (zero black sidebars on ultrawide screens).
 * - Delays reveal by 850ms after PLAYING so YouTube's transient startup/pause HUD never flashes.
 * - Immediately reveals the crisp 1280px still underneath whenever paused or buffering.
 */
export function YouTubeBackdropPlayer({
  videoId,
  backdropUrl,
  posterFallback,
  title,
  muted = true,
  paused = false,
  startSeconds = 12,
}) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const mutedRef = useRef(muted);
  const pausedRef = useRef(paused);
  const revealTimerRef = useRef(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const [thumbUrl, setThumbUrl] = useState('');

  mutedRef.current = muted;
  pausedRef.current = paused;

  const clearRevealTimer = () => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearRevealTimer();
    setVideoVisible(false);
    // Prefer widescreen TMDB 1280px still or 1280x720 YouTube maxresdefault
    if (backdropUrl && backdropUrl.includes('/w1280/')) {
      setThumbUrl(backdropUrl);
    } else if (videoId) {
      setThumbUrl(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    } else {
      setThumbUrl(posterFallback || '');
    }
  }, [videoId, backdropUrl, posterFallback]);

  useEffect(() => {
    if (!videoId || !hostRef.current) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reducedMotion) return;

    let destroyed = false;
    const hostEl = hostRef.current;
    hostEl.innerHTML = '';
    const mountEl = document.createElement('div');
    hostEl.appendChild(mountEl);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (destroyed || !mountEl.isConnected) return;

        playerRef.current = new YT.Player(mountEl, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: pausedRef.current ? 0 : 1,
            mute: 1,
            controls: 0,
            showinfo: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            loop: 1,
            playlist: videoId,
            start: startSeconds,
            vq: 'hd1080',
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (destroyed) return;
              const p = event.target;
              forceHighestQuality(p);
              if (mutedRef.current) {
                p.mute();
              } else {
                p.unMute();
                p.setVolume(85);
              }
              if (!pausedRef.current) {
                p.playVideo();
              }
            },
            onStateChange: (event) => {
              if (destroyed) return;
              if (event.data === YT.PlayerState.PLAYING) {
                forceHighestQuality(event.target);
                clearRevealTimer();
                // Wait 850ms so YouTube's transient title & center play/pause HUD fades completely
                revealTimerRef.current = window.setTimeout(() => {
                  if (!destroyed && !pausedRef.current) {
                    setVideoVisible(true);
                  }
                }, 850);
              } else if (
                event.data === YT.PlayerState.PAUSED ||
                event.data === YT.PlayerState.BUFFERING
              ) {
                clearRevealTimer();
                if (event.data === YT.PlayerState.PAUSED) {
                  setVideoVisible(false);
                } else {
                  forceHighestQuality(event.target);
                }
              } else if (event.data === YT.PlayerState.ENDED) {
                clearRevealTimer();
                setVideoVisible(false);
                event.target.seekTo(startSeconds, true);
                event.target.playVideo();
              }
            },
            onError: () => {
              clearRevealTimer();
              if (!destroyed) setVideoVisible(false);
            },
          },
        });
      })
      .catch(() => {});

    return () => {
      destroyed = true;
      clearRevealTimer();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // noop
        }
        playerRef.current = null;
      }
      hostEl.innerHTML = '';
    };
  }, [videoId, startSeconds]);

  // Smooth mute/unmute without restarting playback
  useEffect(() => {
    const p = playerRef.current;
    if (!p || typeof p.mute !== 'function') return;
    try {
      if (muted) {
        p.mute();
      } else {
        p.unMute();
        p.setVolume(85);
      }
    } catch {
      // noop
    }
  }, [muted]);

  // Smooth pause/resume — immediately hides YouTube pause HUD when paused
  useEffect(() => {
    const p = playerRef.current;
    if (paused) {
      clearRevealTimer();
      setVideoVisible(false);
    }
    if (!p || typeof p.pauseVideo !== 'function') return;
    try {
      if (paused) {
        p.pauseVideo();
      } else {
        forceHighestQuality(p);
        p.playVideo();
      }
    } catch {
      // noop
    }
  }, [paused]);

  const handleThumbError = () => {
    if (videoId && !thumbUrl.includes('i.ytimg.com')) {
      setThumbUrl(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    } else if (videoId && thumbUrl.includes('maxresdefault.jpg')) {
      setThumbUrl(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    } else if (posterFallback && thumbUrl !== posterFallback) {
      setThumbUrl(posterFallback);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0E0E12]">
      {/* High-res 16:9 theatrical still underneath (instant render, clean pause state) */}
      {thumbUrl && (
        <img
          src={thumbUrl}
          alt={title || ''}
          onError={handleThumbError}
          className="h-full w-full object-cover object-center transition-opacity duration-700"
        />
      )}

      {/* True edge-to-edge 16:9 cover layer (eliminates sidebars & YouTube chrome) */}
      {videoId && (
        <div
          className={`absolute inset-0 transition-opacity ${
            videoVisible && !paused ? 'opacity-100 duration-1000' : 'opacity-0 duration-200'
          }`}
        >
          <div
            ref={hostRef}
            className="absolute left-1/2 top-1/2 aspect-video min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 scale-[1.22] [&_iframe]:h-full [&_iframe]:w-full"
          />
        </div>
      )}
    </div>
  );
}
