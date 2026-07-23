'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './HomeCarousel.module.css';

interface CarouselItem {
  id: number;
  title: { romaji?: string; english?: string };
  bannerImage: string | null;
  coverImage: { extraLarge: string | null };
  description: string | null;
  genres: string[];
  trailer: string | null;
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export default function HomeCarousel({ items }: { items: CarouselItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredSlide, setHoveredSlide] = useState<number | null>(null);
  const [touchPlayed, setTouchPlayed] = useState<number | null>(null);
  const [trailerActive, setTrailerActive] = useState(true);
  const trailerEnabledRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTouch = useRef(false);

  useEffect(() => {
    isTouch.current = isTouchDevice();
  }, []);

  // Read autoplay_trailers setting
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const enabled = data.settings?.autoplay_trailers === 1;
        trailerEnabledRef.current = enabled;
        setTrailerActive(enabled);
      })
      .catch(() => {});
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 12000);
  }, [items.length]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (hoveredSlide === null) {
      startTimer();
    } else {
      stopTimer();
    }
    return stopTimer;
  }, [hoveredSlide, startTimer, stopTimer]);

  if (items.length === 0) return null;

  const current = items[activeIndex];
  const bgImage = current.bannerImage || current.coverImage.extraLarge || '';
  const title = current.title.english || current.title.romaji || 'Unknown Anime';

  const handleMouseEnter = (idx: number) => {
    if (isTouch.current) return;
    setHoveredSlide(idx);
  };

  const handleMouseLeave = () => {
    if (isTouch.current) return;
    setHoveredSlide(null);
  };

  const handleTouchToggle = (idx: number) => {
    if (!isTouch.current) return;
    if (touchPlayed === idx) {
      setTouchPlayed(null);
    } else {
      setTouchPlayed(idx);
      stopTimer();
    }
  };

  const handleDotClick = (idx: number) => {
    setActiveIndex(idx);
    setTouchPlayed(null);
  };

  return (
    <div className={styles.carousel} suppressHydrationWarning={true}>
      {items.map((item, idx) => {
        const isActive = idx === activeIndex;
        const isHovered = hoveredSlide === idx;
        const isTouchActive = touchPlayed === idx;
        const showTrailer = (isActive && trailerActive && item.trailer) || isHovered || isTouchActive;
        const slideBg = item.bannerImage || item.coverImage.extraLarge || '';
        const slideTitle = item.title.english || item.title.romaji || 'Unknown Anime';

        return (
          <div
            key={item.id}
            className={`${styles.slide} ${isActive ? styles.activeSlide : ''}`}
            onMouseEnter={() => handleMouseEnter(idx)}
            onMouseLeave={handleMouseLeave}
            onClick={() => isTouch.current && handleTouchToggle(idx)}
            role="group"
            aria-label={`Slide ${idx + 1}: ${slideTitle}`}
          >
            {/* Background Image */}
            <div className={styles.imageContainer} suppressHydrationWarning={true}>
              {slideBg && (
                <Image
                  src={slideBg}
                  alt={slideTitle}
                  fill
                  priority={idx === 0}
                  sizes="100vw"
                  className={styles.bgImage}
                  suppressHydrationWarning={true}
                />
              )}
            </div>

            {/* YouTube Trailer Iframe */}
            {showTrailer && (
              <div className={styles.trailerContainer}>
                <iframe
                  src={`https://www.youtube.com/embed/${item.trailer}?autoplay=1&mute=0&controls=0&loop=1&playlist=${item.trailer}&rel=0&showinfo=0&enablejsapi=1`}
                  className={styles.trailerIframe}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={`${slideTitle} Trailer`}
                />
              </div>
            )}

            {/* Gradient overlay (on top of both image and trailer) */}
            <div className={styles.gradientOverlay} />

            {/* Trailer Badge */}
            {item.trailer && (
              <div className={styles.trailerBadge}>
                {showTrailer ? '▶ Playing' : '▶ Trailer'}
              </div>
            )}

            {/* Info Block */}
            {isActive && !isTouchActive && (
              <div className={styles.content}>
                <div className={styles.genres}>
                  {item.genres.slice(0, 3).map((g) => (
                    <span key={g} className={styles.genrePill}>{g}</span>
                  ))}
                </div>
                <h1 className={styles.title}>{slideTitle}</h1>
                <p className={styles.description}>
                  {item.description
                    ? item.description.replace(/<[^>]*>/g, '').slice(0, 160) + '...'
                    : 'No description available.'}
                </p>

                <div className={styles.buttons}>
                  <Link href={`/watch/${item.id}/1`} className={styles.playBtn}>
                    ▶ Watch Episode 1
                  </Link>
                  <Link href={`/anime/${item.id}`} className={styles.detailBtn}>
                    Details
                  </Link>
                </div>
              </div>
            )}

            {/* Touch: show play button overlay when not playing */}
            {isActive && isTouch.current && !isTouchActive && item.trailer && (
              <div className={styles.touchPlayOverlay}>
                <span className={styles.touchPlayBtn}>▶ Tap to play trailer</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Slide Indicators */}
      <div className={styles.indicators}>
        {items.map((_, idx) => (
          <button
            key={idx}
            className={`${styles.dot} ${idx === activeIndex ? styles.activeDot : ''}`}
            onClick={() => handleDotClick(idx)}
            title={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
