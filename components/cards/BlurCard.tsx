'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import styles from './BlurCard.module.css';

interface BlurCardProps {
  id: number;
  poster: string | null;
  title: string;
  format?: string | null;
  year?: number | null;
  score?: number | null;
}

export default function BlurCard({ id, poster, title, format, year, score }: BlurCardProps) {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <Link href={`/anime/${id}`} className={styles.link}>
      <div
        ref={cardRef}
        className={`${styles.card} ${hovered ? styles.hovered : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className={styles.posterWrap}>
          {poster ? (
            <img
              src={poster}
              alt={title}
              className={styles.posterImage}
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className={styles.noImage}>No Image</div>
          )}
          <div className={styles.overlay}>
            <div className={styles.titleOverlay}>{title}</div>
            {score != null && score > 0 && (
              <div className={styles.scoreBadge}>★ {score}%</div>
            )}
          </div>
        </div>
        <div className={styles.info}>
          <div className={styles.title}>{title}</div>
          <div className={styles.meta}>
            {format && <span>{format.replace('_', ' ')}</span>}
            {format && year && <span className={styles.dot} />}
            {year && <span>{year}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
