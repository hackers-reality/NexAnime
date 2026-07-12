'use client';

import { useState, useEffect } from 'react';
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
}

export default function HomeCarousel({ items }: { items: CarouselItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[activeIndex];
  const bgImage = current.bannerImage || current.coverImage.extraLarge || '';
  const title = current.title.english || current.title.romaji || 'Unknown Anime';
  const cleanDescription = current.description 
    ? current.description.replace(/<[^>]*>/g, '').slice(0, 160) + '...'
    : 'No description available.';

  return (
    <div className={styles.carousel}>
      {/* Background Image */}
      <div className={styles.imageContainer}>
        {bgImage && (
          <Image
            src={bgImage}
            alt={title}
            fill
            priority
            sizes="100vw"
            className={styles.bgImage}
          />
        )}
        <div className={styles.gradientOverlay} />
      </div>

      {/* Info Block */}
      <div className={styles.content}>
        <div className={styles.genres}>
          {current.genres.slice(0, 3).map((g) => (
            <span key={g} className={styles.genrePill}>{g}</span>
          ))}
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{cleanDescription}</p>

        <div className={styles.buttons}>
          <Link href={`/watch/${current.id}/1`} className={styles.playBtn}>
            ▶ Watch Episode 1
          </Link>
          <Link href={`/anime/${current.id}`} className={styles.detailBtn}>
            ℹ️ Details
          </Link>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className={styles.indicators}>
        {items.map((_, idx) => (
          <button
            key={idx}
            className={`${styles.dot} ${idx === activeIndex ? styles.activeDot : ''}`}
            onClick={() => setActiveIndex(idx)}
            title={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
