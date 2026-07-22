'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Hls from 'hls.js';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  src: string | null;
  subtitleUrl?: string | null;
  animeId: number;
  episodeNumber: number;
  totalEpisodes?: number;
  introStart?: number;
  introEnd?: number;
  outroStart?: number;
  outroEnd?: number;
}

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({
  src,
  subtitleUrl,
  animeId,
  episodeNumber,
  totalEpisodes = 999,
  introStart = 0,
  introEnd = 0,
  outroStart = 0,
  outroEnd = 0,
}: VideoPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // ── State ──────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isMini, setIsMini] = useState(false);
  const [dismissedMini, setDismissedMini] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [autoSkip, setAutoSkip] = useState(false);
  const [miniPlayerEnabled, setMiniPlayerEnabled] = useState(true);
  const [showNextCountdown, setShowNextCountdown] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(5);
  const [ambientColor, setAmbientColor] = useState<string | null>(null);
  const [showAmbient, setShowAmbient] = useState(false);
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [doubleTapAmount, setDoubleTapAmount] = useState(0);
  const autoPlayRef = useRef(true);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isEmbed = src
    ? src.includes('zokoanime.video/stream') ||
      src.includes('megaplay.buzz/stream') ||
      src.includes('animeplay.cfd/stream') ||
      (!src.endsWith('.m3u8') && !src.endsWith('.mp4') && !src.endsWith('.mkv') && !src.includes('.m3u8?') && !src.includes('.mp4?'))
    : false;

  // ── Load settings from DB ──────────────────────────
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setAutoPlayNext(!!data.settings.auto_next);
          setAutoSkip(!!data.settings.auto_skip_intro_outro);
          setShowAmbient(!!data.settings.ambient_mode);
          setMiniPlayerEnabled(data.settings.mini_player !== false);
          autoPlayRef.current = !!data.settings.auto_play;
        }
      })
      .catch(() => {});
  }, []);

  // ── HLS Source Setup ───────────────────────────────
  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          if (src.includes('aniwatchtv.uk')) {
            xhr.setRequestHeader('Referer', 'https://zokoanime.video/');
          }
        },
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlayRef.current) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { hls.destroy(); setError('Fatal playback error occurred.'); }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => { if (autoPlayRef.current) video.play().catch(() => {}); });
    } else if (!src.includes('.m3u8')) {
      video.src = src;
      if (autoPlayRef.current) video.play().catch(() => {});
    } else {
      setError('Your browser does not support HLS video playback.');
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [src, isEmbed]);

  // ── Subtitle track ─────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitleUrl) return;
    // Remove existing tracks
    while (video.firstChild) {
      const child = video.firstChild;
      if (child instanceof HTMLTrackElement) video.removeChild(child);
      else break;
    }
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = subtitleUrl;
    track.label = 'English';
    track.default = true;
    video.appendChild(track);
    video.textTracks[0].mode = 'showing';
  }, [subtitleUrl, src]);

  // ── Resume + Progress tracking ─────────────────────
  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video) return;

    fetch(`/api/progress?anilistId=${animeId}&episodeNumber=${episodeNumber}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.secondsWatched && data.secondsWatched > 10) {
          video.currentTime = data.secondsWatched;
        }
      })
      .catch(() => {});

    const onTimeUpdate = () => {
      const t = video.currentTime;
      const d = video.duration;
      if (!d || isNaN(d)) return;

      setCurrentTime(t);

      // Skip intro
      if (introEnd > introStart && t >= introStart && t < introEnd) {
        setShowSkipIntro(true);
        if (autoSkip) { video.currentTime = introEnd; setShowSkipIntro(false); }
      } else {
        setShowSkipIntro(false);
      }

      // Skip outro
      if (outroEnd > outroStart && t >= outroStart && t < outroEnd) {
        setShowSkipOutro(true);
        if (autoSkip) { video.currentTime = outroEnd; setShowSkipOutro(false); }
      } else {
        setShowSkipOutro(false);
      }

      // Sync every 10s
      if (t - lastSyncRef.current > 10 || t === d) {
        lastSyncRef.current = t;
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anilistId: animeId, episodeNumber, secondsWatched: Math.floor(t), durationSeconds: Math.floor(d) }),
        }).catch(() => {});
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [animeId, episodeNumber, isEmbed, introStart, introEnd, outroStart, outroEnd, autoSkip]);

  // ── Play state ─────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onDuration = () => setDuration(video.duration);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onDuration);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onDuration);
    };
  }, [src, isEmbed]);

  // ── Video ended → auto advance ─────────────────────
  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video) return;
    const handleEnded = () => {
      if (autoPlayNext && episodeNumber < totalEpisodes) {
        setShowNextCountdown(true);
        setNextCountdown(5);
      }
    };
    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [animeId, episodeNumber, autoPlayNext, totalEpisodes, isEmbed]);

  // ── Countdown timer ────────────────────────────────
  useEffect(() => {
    if (!showNextCountdown) return;
    if (nextCountdown <= 0) {
      router.push(`/watch/${animeId}/${episodeNumber + 1}`);
      return;
    }
    const timer = setTimeout(() => setNextCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showNextCountdown, nextCountdown, animeId, episodeNumber, router]);

  // ── Mini player ────────────────────────────────────
  useEffect(() => {
    if (isEmbed || !miniPlayerEnabled) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setIsMini(false); setDismissedMini(false); }
        else setIsMini(true);
      },
      { threshold: 0.1 }
    );
    const c = containerRef.current;
    if (c) observer.observe(c);
    return () => { if (c) observer.unobserve(c); };
  }, [animeId, episodeNumber, miniPlayerEnabled]);

  // ── Keyboard shortcuts ─────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'j':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'l':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          break;
        case 's':
          e.preventDefault();
          takeScreenshot();
          break;
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // ── Controls auto-hide ─────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  // ── Double-tap to seek (mobile) ────────────────────
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || isEmbed) return;

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return;
      const touch = e.changedTouches[0];
      const now = Date.now();
      const rect = container.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const isLeft = x < rect.width / 3;
      const isRight = x > (rect.width * 2) / 3;

      if (!isLeft && !isRight) return;

      const last = lastTapRef.current;
      if (last && now - last.time < 300 && Math.abs(last.x - x) < 60) {
        if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
        lastTapRef.current = null;
        const amount = isLeft ? -10 : 10;
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + amount));
        setDoubleTapSide(isLeft ? 'left' : 'right');
        setDoubleTapAmount(amount);
        setTimeout(() => { setDoubleTapSide(null); setDoubleTapAmount(0); }, 600);
        showControlsTemporarily();
      } else {
        lastTapRef.current = { time: now, x };
        doubleTapTimerRef.current = setTimeout(() => { lastTapRef.current = null; }, 350);
      }
    };

    container.addEventListener('touchend', handleTouchEnd);
    return () => container.removeEventListener('touchend', handleTouchEnd);
  }, [isEmbed, showControlsTemporarily]);

  // ── Ambient mode ───────────────────────────────────
  useEffect(() => {
    if (!showAmbient) return;

    if (isEmbed) {
      // For embeds: extract color from poster image instead
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `https://img.anili.st/media/${animeId}`;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 9;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 9);
        const data = ctx.getImageData(6, 3, 4, 3).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        r = Math.round(r / count * 0.35);
        g = Math.round(g / count * 0.35);
        b = Math.round(b / count * 0.35);
        setAmbientColor(`rgb(${r},${g},${b})`);
      };
      img.onerror = () => setAmbientColor('rgb(20,20,40)');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 9;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const sample = () => {
      if (video.paused || video.ended) { frameId = requestAnimationFrame(sample); return; }
      ctx.drawImage(video, 0, 0, 16, 9);
      const data = ctx.getImageData(6, 3, 4, 3).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
      r = Math.round(r / count * 0.4);
      g = Math.round(g / count * 0.4);
      b = Math.round(b / count * 0.4);
      setAmbientColor(`rgb(${r},${g},${b})`);
      frameId = requestAnimationFrame(sample);
    };
    frameId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frameId);
  }, [showAmbient, isEmbed, animeId]);

  // ── Controls ───────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const handleVolumeChange = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    if (val > 0 && v.muted) { v.muted = false; setIsMuted(false); }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = parseFloat(e.target.value);
  };

  const toggleFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) { document.exitFullscreen(); setIsFullscreen(false); }
    else { c.requestFullscreen(); setIsFullscreen(true); }
  };

  const setSpeed = (rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const handleSkipIntro = () => {
    const v = videoRef.current;
    if (v && introEnd) { v.currentTime = introEnd; setShowSkipIntro(false); }
  };

  const handleSkipOutro = () => {
    const v = videoRef.current;
    if (v && outroEnd) { v.currentTime = outroEnd; setShowSkipOutro(false); }
  };

  const takeScreenshot = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `nexanime-ep${episodeNumber}-${Math.floor(v.currentTime)}s.png`;
    a.click();
  };

  // ── Render ─────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`${styles.playerContainer} ${isMini && !dismissedMini ? styles.miniPlayer : ''}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => { if (videoRef.current && !videoRef.current.paused) setShowControls(false); }}
    >
      {/* Ambient glow */}
      {showAmbient && ambientColor && (
        <div className={styles.ambientGlow} style={{ background: `radial-gradient(ellipse at center, ${ambientColor} 0%, transparent 70%)` }} />
      )}

      {/* Double-tap seek indicator */}
      {doubleTapSide && (
        <div className={`${styles.doubleTapIndicator} ${doubleTapSide === 'left' ? styles.doubleTapLeft : styles.doubleTapRight}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="32" height="32">
            {doubleTapSide === 'left' ? (
              <>
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </>
            ) : (
              <>
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
              </>
            )}
          </svg>
          <span>{Math.abs(doubleTapAmount)}s</span>
        </div>
      )}

      {/* Mini player close */}
      {isMini && !dismissedMini && (
        <button className={styles.closeMiniBtn} onClick={() => setDismissedMini(true)} aria-label="Close mini player">✕</button>
      )}

      {/* Error */}
      {error && <div className={styles.errorOverlay}><p>{error}</p></div>}

      {/* Loading */}
      {!src && !error && <div className={styles.loadingOverlay}><div className={styles.spinner} /><p>Loading video source...</p></div>}

      {/* Embed */}
      {src && isEmbed ? (
        <>
          <iframe src={src} className={styles.iframe} allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
          {/* Minimal controls for embeds */}
          <div className={styles.controlsOverlay} style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
            <div className={styles.topBar}>
              <span className={styles.epLabel}>EP {episodeNumber}</span>
              <div className={styles.topActions}>
                <button className={styles.ctrlBtn} onClick={() => setShowAmbient(!showAmbient)} aria-label="Toggle ambient mode" style={{ color: showAmbient ? 'var(--primary)' : undefined }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                </button>
              </div>
            </div>
            {showSkipIntro && (
              <button className={styles.skipBtn} onClick={handleSkipIntro}>Skip Intro ▶▶</button>
            )}
            {showSkipOutro && (
              <button className={styles.skipBtn} onClick={handleSkipOutro}>Skip Outro ▶▶</button>
            )}
            {showNextCountdown && (
              <div className={styles.nextEpisodeOverlay}>
                <p>Next episode in {nextCountdown}s...</p>
                <button className={styles.nextBtn} onClick={() => router.push(`/watch/${animeId}/${episodeNumber + 1}`)}>
                  Skip ▶
                </button>
              </div>
            )}
            {autoPlayNext && !showNextCountdown && (
              <button
                className={styles.skipBtn}
                style={{ position: 'absolute', bottom: 50, right: 16, fontSize: 11, padding: '6px 12px' }}
                onClick={() => router.push(`/watch/${animeId}/${episodeNumber + 1}`)}
              >
                Next Ep ▶
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <video ref={videoRef} className={styles.video} crossOrigin="anonymous" onClick={togglePlay} />

          {/* Custom Controls Overlay */}
          {!isEmbed && showControls && (
            <div className={styles.controlsOverlay}>
              {/* Top bar */}
              <div className={styles.topBar}>
                <span className={styles.epLabel}>EP {episodeNumber}</span>
                <div className={styles.topActions}>
                  {subtitleUrl && (
                    <button className={styles.ctrlBtn} onClick={() => {
                      const v = videoRef.current;
                      if (v?.textTracks[0]) v.textTracks[0].mode = v.textTracks[0].mode === 'showing' ? 'hidden' : 'showing';
                    }} aria-label="Toggle subtitles">CC</button>
                  )}
                  <button className={styles.ctrlBtn} onClick={() => setShowAmbient(!showAmbient)} aria-label="Toggle ambient mode" style={{ color: showAmbient ? 'var(--primary)' : undefined }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  </button>
                </div>
              </div>

              {/* Center play button */}
              {!isPlaying && (
                <button className={styles.centerPlayBtn} onClick={togglePlay} aria-label="Play">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><path d="M8 5v14l11-7z"/></svg>
                </button>
              )}

              {/* Skip buttons */}
              {showSkipIntro && (
                <button className={styles.skipBtn} onClick={handleSkipIntro}>
                  Skip Intro ▶▶
                </button>
              )}
              {showSkipOutro && (
                <button className={styles.skipBtn} onClick={handleSkipOutro}>
                  Skip Outro ▶▶
                </button>
              )}

              {/* Auto advance countdown */}
              {showNextCountdown && (
                <div className={styles.nextCountdown}>
                  <p>Next episode in {nextCountdown}s...</p>
                  <div className={styles.countdownBar}>
                    <div className={styles.countdownFill} style={{ width: `${(nextCountdown / 5) * 100}%` }} />
                  </div>
                  <div className={styles.countdownActions}>
                    <button className={styles.countdownBtn} onClick={() => router.push(`/watch/${animeId}/${episodeNumber + 1}`)}>Play Now</button>
                    <button className={`${styles.countdownBtn} ${styles.countdownCancel}`} onClick={() => setShowNextCountdown(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Bottom controls */}
              <div className={styles.bottomBar}>
                {/* Play/Pause */}
                <button className={styles.ctrlBtn} onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>

                {/* Skip back 10s */}
                <button className={styles.ctrlBtn} onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} aria-label="Rewind 10 seconds">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">10</text></svg>
                </button>

                {/* Skip forward 10s */}
                <button className={styles.ctrlBtn} onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} aria-label="Forward 10 seconds">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">10</text></svg>
                </button>

                {/* Seek bar */}
                <div className={styles.seekBarWrap} ref={progressRef}>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    step={0.1}
                    onChange={handleSeek}
                    className={styles.seekBar}
                    style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
                  />
                </div>

                {/* Time */}
                <span className={styles.timeLabel}>{formatTime(currentTime)} / {formatTime(duration)}</span>

                {/* Volume */}
                <div className={styles.volumeWrap} onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
                  <button className={styles.ctrlBtn} onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted || volume === 0 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                    ) : volume < 0.5 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    )}
                  </button>
                  {showVolumeSlider && (
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className={styles.volumeSlider}
                      style={{ '--progress': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
                    />
                  )}
                </div>

                {/* Speed */}
                <div className={styles.speedWrap}>
                  <button className={styles.ctrlBtn} onClick={() => setShowSpeedMenu(!showSpeedMenu)} aria-label="Playback speed">
                    {playbackRate}x
                  </button>
                  {showSpeedMenu && (
                    <div className={styles.speedMenu}>
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button key={rate} className={`${styles.speedOption} ${playbackRate === rate ? styles.speedActive : ''}`} onClick={() => setSpeed(rate)}>
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Screenshot */}
                <button className={styles.ctrlBtn} onClick={takeScreenshot} aria-label="Take screenshot">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </button>

                {/* Fullscreen */}
                <button className={styles.ctrlBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M8 3H5a2 2 0 0 0-2 2v3m20 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
