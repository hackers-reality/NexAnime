'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { AniListAiringSchedule } from '@/types';
import styles from './ScheduleClient.module.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRelativeTime(entry: AniListAiringSchedule): string {
  const { airingStatus, delayedUntil, delayedFrom } = entry;
  const status = (airingStatus || '').toLowerCase();

  if (status.includes('aired') || status.includes('finished')) return 'Aired';
  if (status.includes('delayed')) {
    if (delayedUntil && delayedUntil * 1000 > Date.now()) {
      const diff = delayedUntil * 1000 - Date.now();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor(diff / (1000 * 60));
      if (hours > 24) return `Delayed → ${Math.floor(hours / 24)}d`;
      if (hours > 0) return `Delayed → ${hours}h ${minutes % 60}m`;
      return `Delayed → ${minutes}m`;
    }
    return 'Delayed';
  }
  if (status.includes('upcoming') || status.includes('not yet') || status.includes('not aired')) {
    const diff = entry.airingAt * 1000 - Date.now();
    if (diff <= 0) return 'Airing soon';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    if (hours > 24) return `in ${Math.floor(hours / 24)}d`;
    if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
    return `in ${minutes}m`;
  }
  if (status.includes('airing') || status.includes('releas')) {
    return 'Airing';
  }

  // Fallback: timestamp-based
  const now = Date.now();
  const diff = entry.airingAt * 1000 - now;
  if (diff <= 0) return 'Aired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  if (hours > 24) return `in ${Math.floor(hours / 24)}d`;
  if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
  return `in ${minutes}m`;
}

function statusClass(entry: AniListAiringSchedule): string {
  const status = (entry.airingStatus || '').toLowerCase();
  if (status.includes('aired') || status.includes('finished')) return 'aired';
  if (status.includes('delayed')) return 'delayed';
  if (status.includes('airing') || status.includes('releas')) return 'airing';
  return '';
}

export default function ScheduleClient({ initialSchedule }: { initialSchedule: AniListAiringSchedule[] }) {
  const today = new Date();
  const todayDayIndex = (today.getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState(todayDayIndex);

  const scheduleByDay = useMemo(() => {
    const byDay: AniListAiringSchedule[][] = Array.from({ length: 7 }, () => []);
    const seenByDay: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>());
    for (const entry of initialSchedule) {
      const airDate = new Date(entry.airingAt * 1000);
      const dayIndex = (airDate.getDay() + 6) % 7;
      // Dedupe by "<mediaId>::<episode>" so the same episode airing twice doesn't appear twice
      const key = `${entry.mediaId}::${entry.episode}`;
      if (seenByDay[dayIndex].has(key)) continue;
      seenByDay[dayIndex].add(key);
      byDay[dayIndex].push(entry);
    }
    // Sort each day by airing time
    for (const day of byDay) {
      day.sort((a, b) => a.airingAt - b.airingAt);
    }
    return byDay;
  }, [initialSchedule]);

  const daySchedule = scheduleByDay[selectedDay] || [];
  const totalThisWeek = initialSchedule.length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Airing Schedule</h1>
        <p className={styles.subtitle}>{totalThisWeek} episodes airing this week</p>
      </div>

      {/* Day tabs */}
      <div className={styles.dayTabs}>
        {DAYS.map((day, i) => {
          const count = (scheduleByDay[i] || []).length;
          return (
            <button
              key={day}
              className={`${styles.dayTab} ${selectedDay === i ? styles.dayTabActive : ''} ${i === todayDayIndex ? styles.dayTabToday : ''}`}
              onClick={() => setSelectedDay(i)}
            >
              <span className={styles.dayTabLabel}>{DAY_ABBREVS[i]}</span>
              {count > 0 && <span className={styles.dayTabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Episodes for selected day */}
      <div className={styles.episodeList}>
        {daySchedule.length === 0 ? (
          <div className={styles.emptyDay}>
            <p>No episodes scheduled for {DAYS[selectedDay]}.</p>
          </div>
        ) : (
          daySchedule.map((entry) => (
            <Link
              key={entry.id}
              href={`/anime/${entry.media.id}`}
              className={styles.episodeCard}
              data-status={statusClass(entry)}
            >
              <div className={styles.episodeImage}>
                <img
                  src={entry.media.coverImage?.large || entry.media.coverImage?.medium || '/logo.svg'}
                  alt={entry.media.title?.english || entry.media.title?.romaji || ''}
                  loading="lazy"
                />
              </div>
              <div className={styles.episodeInfo}>
                <div className={styles.episodeTitle}>
                  {entry.media.title?.english || entry.media.title?.romaji || 'Unknown'}
                </div>
                <div className={styles.episodeMeta}>
                  <span className={styles.episodeNumber}>EP {entry.episode}</span>
                  <span className={styles.episodeTime}>{formatTime(entry.airingAt)}</span>
                  <span className={styles.episodeRelative}>{formatRelativeTime(entry)}</span>
                </div>
                {entry.media.genres && entry.media.genres.length > 0 && (
                  <div className={styles.episodeGenres}>
                    {entry.media.genres.slice(0, 3).map((g) => (
                      <span key={g} className={styles.genreTag}>{g}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
