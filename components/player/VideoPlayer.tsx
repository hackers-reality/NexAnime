'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  src: string | null;
  animeId: number;
  episodeNumber: number;
  autoPlay?: boolean;
}

export default function VideoPlayer({ src, animeId, episodeNumber, autoPlay = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  // Handle Progress tracking
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
  }, [animeId, episodeNumber, isEmbed]);

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
        <video
          ref={videoRef}
          controls
          className={styles.video}
          crossOrigin="anonymous"
        />
      )}
    </div>
  );
}
