'use client';

import styles from './SkeletonCarousel.module.css';

export default function SkeletonCarousel() {
  return (
    <div className={styles.carousel}>
      <div className={styles.bgPlaceholder}>
        <div className={styles.shimmer} />
      </div>
      <div className={styles.gradientOverlay} />

      <div className={styles.content}>
        <div className={styles.genres}>
          <div className={styles.pill} />
          <div className={styles.pill} />
          <div className={styles.pill} />
          <div className={styles.pill} />
        </div>
        <div className={styles.titleBar} />
        <div className={styles.descriptionBar} />
        <div className={styles.descriptionBar} style={{ width: '80%' }} />
        <div className={styles.descriptionBar} style={{ width: '55%' }} />
      </div>

      <div className={styles.indicators}>
        <div className={`${styles.dot} ${styles.activeDot}`} />
        <div className={styles.dot} />
        <div className={styles.dot} />
        <div className={styles.dot} />
        <div className={styles.dot} />
      </div>
    </div>
  );
}
