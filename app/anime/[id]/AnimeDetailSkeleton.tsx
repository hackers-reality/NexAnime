'use client';

import styles from './page.module.css';

export default function AnimeDetailSkeleton() {
  return (
    <div className={styles.page}>
      {/* Banner skeleton */}
      <div className={styles.bannerWrap}>
        <div className={styles.skeletonBanner} />
      </div>

      {/* Content skeleton */}
      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div className={styles.skeletonPoster} />
          <div className={styles.skeletonLine} style={{ width: '100%', height: 36 }} />
          <div className={styles.skeletonLine} style={{ width: '60%', height: 20 }} />
          <div className={styles.skeletonLine} style={{ width: '80%', height: 16 }} />
          <div className={styles.skeletonLine} style={{ width: '40%', height: 16 }} />
        </div>

        <div className={styles.mainDetails}>
          <div className={styles.skeletonLine} style={{ width: 120, height: 14 }} />
          <div className={styles.skeletonLine} style={{ width: '70%', height: 32 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className={styles.skeletonPill} />
            <div className={styles.skeletonPill} />
            <div className={styles.skeletonPill} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <div className={styles.skeletonButton} />
            <div className={styles.skeletonButton} />
          </div>
          <div className={styles.skeletonBlock} style={{ marginTop: 24 }} />
          <div className={styles.skeletonBlock} style={{ width: '80%' }} />
          <div className={styles.skeletonBlock} style={{ width: '60%' }} />

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeletonTab} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginTop: 16 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={styles.skeletonEpisodeCard} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
