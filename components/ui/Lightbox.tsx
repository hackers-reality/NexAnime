'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './Lightbox.module.css';

interface LightboxProps {
  images: string[];
  initialIndex?: number;
  alt?: string;
  onClose: () => void;
}

export default function Lightbox({ images, initialIndex = 0, alt = '', onClose }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goPrev, goNext]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <button className={`${styles.navBtn} ${styles.prevBtn}`} onClick={goPrev} aria-label="Previous image">
            ‹
          </button>
        )}

        <div className={styles.imageWrap}>
          {!loaded[currentIndex] && <div className={styles.imageSpinner} />}
          <img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`${alt} ${currentIndex + 1}/${images.length}`}
            className={styles.image}
            onLoad={() => setLoaded((p) => ({ ...p, [currentIndex]: true }))}
          />
        </div>

        {images.length > 1 && (
          <button className={`${styles.navBtn} ${styles.nextBtn}`} onClick={goNext} aria-label="Next image">
            ›
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className={styles.counter}>
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
