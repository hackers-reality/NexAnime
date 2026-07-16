import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Hls from 'hls.js';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  src: string | null;
  animeId: number;
  episodeNumber: number;
  autoPlay?: boolean;
  autoPlayNext?: boolean;
  autoSkipIntro?: boolean;
}

export default function VideoPlayer({ 
  src, 
  animeId, 
  episodeNumber, 
  autoPlay = true,
  autoPlayNext = true,
  autoSkipIntro = false
}: VideoPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const lastSyncRef = useRef<number>(0);
  const isEmbed = src ? (
    src.includes('zokoanime.video/stream') ||
    src.includes('megaplay.buzz/stream') ||
    src.includes('embed') ||
    src.includes('iframe') ||
    (!src.endsWith('.m3u8') && !src.endsWith('.mp4') && !src.endsWith('.mkv') && !src.includes('.m3u8?') && !src.includes('.mp4?'))
  ) : false;

  useEffect(() => {
    if (isEmbed) return;

    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);

    // Clean up previous HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported() && src.endsWith('.m3u8')) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch(e => console.error("Autoplay prevented", e));
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setError("Fatal playback error occurred.");
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        if (autoPlay) {
          video.play().catch(e => console.error("Autoplay prevented", e));
        }
      });
    } else if (!src.endsWith('.m3u8')) {
      // Direct MP4 or other supported format
      video.src = src;
      if (autoPlay) {
        video.play().catch(e => console.error("Autoplay prevented", e));
      }
    } else {
      setError("Your browser does not support HLS video playback.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay, isEmbed]);

  // Handle video ended for autoplay next
  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (autoPlayNext) {
        router.push(`/watch/${animeId}/${episodeNumber + 1}`);
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [animeId, episodeNumber, autoPlayNext, isEmbed, router]);

  // Handle Progress tracking & Skip Intro triggers
  useEffect(() => {
    if (isEmbed) return;

    const video = videoRef.current;
    if (!video) return;

    // Load initial progress
    fetch(`/api/progress?anilistId=${animeId}&episodeNumber=${episodeNumber}`)
      .then(res => res.json())
      .then(data => {
        if (data.secondsWatched && data.secondsWatched > 0) {
          video.currentTime = data.secondsWatched;
        }
      })
      .catch(console.error);

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      const duration = video.duration;

      if (!duration || isNaN(duration)) return;

      // Skip button overlay logic (show from 5s to 85s)
      if (currentTime >= 5 && currentTime <= 85) {
        setShowSkipButton(true);
      } else {
        setShowSkipButton(false);
      }

      // Auto skip intro logic
      if (autoSkipIntro && currentTime >= 5 && currentTime < 85) {
        video.currentTime = 85;
        setShowSkipButton(false);
      }

      // Sync progress every 10 seconds
      if (currentTime - lastSyncRef.current > 10 || currentTime === duration) {
        lastSyncRef.current = currentTime;
        
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anilistId: animeId,
            episodeNumber,
            secondsWatched: Math.floor(currentTime),
            durationSeconds: Math.floor(duration),
          })
        }).catch(console.error);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [animeId, episodeNumber, isEmbed, autoSkipIntro]);

  const handleSkipIntro = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 85;
      setShowSkipButton(false);
    }
  };

  return (
    <div className={styles.playerWrapper}>
      {error && (
        <div className={styles.errorOverlay}>
          <p>{error}</p>
        </div>
      )}
      {!src && !error && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <p>Loading video source...</p>
        </div>
      )}
      {src && isEmbed ? (
        <iframe
          src={src}
          className={styles.iframe}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          scrolling="no"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            controls
            className={styles.video}
            crossOrigin="anonymous"
          />
          {showSkipButton && (
            <button className={styles.skipIntroBtn} onClick={handleSkipIntro}>
              Skip Intro
            </button>
          )}
        </>
      )}
    </div>
  );
}
