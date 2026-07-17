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

function formatRelativeTime(unix: number): string {
  const now = Date.now();
  const diff = unix * 1000 - now;

  if (diff <= 0) return 'Aired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  if (hours > 24) return `in ${Math.floor(hours / 24)}d`;
  if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
  return `in ${minutes}m`;
}

export default function ScheduleClient({ initialSchedule }: { initialSchedule: AniListAiringSchedule[] }) {
  const today = new Date();
  const todayDayIndex = (today.getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState(todayDayIndex);

  const scheduleByDay = useMemo(() => {
    const byDay: AniListAiringSchedule[][] = Array.from({ length: 7 }, () => []);
    for (const entry of initialSchedule) {
      const airDate = new Date(entry.airingAt * 1000);
      const dayIndex = (airDate.getDay() + 6) % 7;
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
                  <span className={styles.episodeRelative}>{formatRelativeTime(entry.airingAt)}</span>
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
