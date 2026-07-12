'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './ScheduleWidget.module.css';

interface ScheduleEntry {
  id: number;
  airingAt: number; // UTC timestamp
  episode: number;
  mediaId: number;
  title: string;
  coverImage: string | null;
}

interface GroupedSchedules {
  [dayKey: string]: {
    label: string; // e.g. "Mon 13"
    entries: ScheduleEntry[];
  };
}

export default function ScheduleWidget({ schedules }: { schedules: ScheduleEntry[] }) {
  const [grouped, setGrouped] = useState<GroupedSchedules>({});
  const [dayKeys, setDayKeys] = useState<string[]>([]);
  const [activeDay, setActiveDay] = useState<string>('');

  useEffect(() => {
    // Generate 7 days headers starting from today in system local time
    const localGrouped: GroupedSchedules = {};
    const keys: string[] = [];

    // Initialize 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const dayKey = date.toDateString(); // unique key for grouping (local date)
      const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = date.getDate();
      
      localGrouped[dayKey] = {
        label: `${dayName} ${dayNum}`,
        entries: []
      };
      keys.push(dayKey);
    }

    // Group schedules based on local timezone date conversion
    schedules.forEach((entry) => {
      const airingDate = new Date(entry.airingAt * 1000);
      const airingKey = airingDate.toDateString(); // maps to the local day key

      if (localGrouped[airingKey]) {
        localGrouped[airingKey].entries.push(entry);
      }
    });

    // Sort entries on each day by local airing time
    keys.forEach((key) => {
      localGrouped[key].entries.sort((a, b) => a.airingAt - b.airingAt);
    });

    setGrouped(localGrouped);
    setDayKeys(keys);
    setActiveDay(keys[0] || '');
  }, [schedules]);

  if (dayKeys.length === 0) return null;

  const currentGroup = grouped[activeDay];
  const activeEntries = currentGroup?.entries || [];

  const formatLocalTime = (airingAt: number) => {
    return new Date(airingAt * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={styles.widget}>
      {/* Day Tabs */}
      <div className={styles.tabs}>
        {dayKeys.map((key) => {
          const isToday = key === new Date().toDateString();
          return (
            <button
              key={key}
              className={`${styles.tab} ${activeDay === key ? styles.activeTab : ''}`}
              onClick={() => setActiveDay(key)}
            >
              <span className={styles.tabLabel}>{grouped[key].label}</span>
              {isToday && <span className={styles.todayIndicator}>Today</span>}
            </button>
          );
        })}
      </div>

      {/* Airing list for active day */}
      <div className={styles.list}>
        {activeEntries.length === 0 ? (
          <div className={styles.empty}>No anime airing today.</div>
        ) : (
          activeEntries.map((entry) => (
            <Link
              key={entry.id}
              href={`/anime/${entry.mediaId}`}
              className={styles.item}
            >
              <div className={styles.imgContainer}>
                {entry.coverImage && (
                  <Image
                    src={entry.coverImage}
                    alt={entry.title}
                    fill
                    sizes="48px"
                    className={styles.coverImg}
                  />
                )}
              </div>
              <div className={styles.info}>
                <h4 className={styles.title}>{entry.title}</h4>
                <div className={styles.badgeRow}>
                  <span className={styles.episodeBadge}>Ep {entry.episode}</span>
                  <span className={styles.timeLabel}>🕗 {formatLocalTime(entry.airingAt)}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
