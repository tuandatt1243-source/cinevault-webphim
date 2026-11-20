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
 * Full-bleed Netflix-style HD 16:9 YouTube Trailer background player.
 * Uses YouTube IFrame API to enforce highest available resolution (hd1080/highres),
 * allows smooth Mute/Unmute & Play/Pause without reloading, and keeps a 1280x720
 * maxresdefault.jpg backdrop visible until playback is cleanly active.
 */
export function YouTubeBackdropPlayer({
  videoId,
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbUrl, setThumbUrl] = useState('');

  mutedRef.current = muted;
  pausedRef.current = paused;

  useEffect(() => {
    setIsPlaying(false);
    if (videoId) {
      setThumbUrl(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    } else {
      setThumbUrl(posterFallback || '');
    }
  }, [videoId, posterFallback]);

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
                setIsPlaying(true);
              } else if (event.data === YT.PlayerState.BUFFERING) {
                forceHighestQuality(event.target);
              } else if (event.data === YT.PlayerState.ENDED) {
                event.target.seekTo(startSeconds, true);
                event.target.playVideo();
              }
            },
            onError: () => {
              if (!destroyed) setIsPlaying(false);
            },
          },
        });
      })
      .catch(() => {});

    return () => {
      destroyed = true;
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

  // Smooth pause/resume when opening modals or user pauses
  useEffect(() => {
    const p = playerRef.current;
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
    if (videoId && thumbUrl.includes('maxresdefault.jpg')) {
      setThumbUrl(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    } else if (posterFallback && thumbUrl !== posterFallback) {
      setThumbUrl(posterFallback);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0E0E12]">
      {/* High-res 16:9 YouTube thumbnail underneath (instant render, zero black flash) */}
      {thumbUrl && (
        <img
          src={thumbUrl}
          alt={title || ''}
          onError={handleThumbError}
          className="h-full w-full object-cover object-center transition-opacity duration-700"
        />
      )}

      {/* Scaled full-bleed YouTube HD iframe layer (crops YouTube chrome & black bars) */}
      {videoId && (
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            isPlaying && !paused ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            ref={hostRef}
            className="h-full w-full scale-[1.24] [&_iframe]:h-full [&_iframe]:w-full"
          />
        </div>
      )}
    </div>
  );
}
