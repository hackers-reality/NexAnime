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
    dayName: string;
    dayNum: number;
    monthName: string;
    label: string;
    entries: ScheduleEntry[];
  };
}

export default function ScheduleWidget({ schedules }: { schedules: ScheduleEntry[] }) {
  const [grouped, setGrouped] = useState<GroupedSchedules>({});
  const [dayKeys, setDayKeys] = useState<string[]>([]);
  const [activeDay, setActiveDay] = useState<string>('');

  useEffect(() => {
    const localGrouped: GroupedSchedules = {};
    const keys: string[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const dayKey = date.toDateString();
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      localGrouped[dayKey] = {
        dayName,
        dayNum,
        monthName,
        label: `${dayName} ${monthName} ${dayNum}`,
        entries: []
      };
      keys.push(dayKey);
    }

    schedules.forEach((entry) => {
      const airingDate = new Date(entry.airingAt * 1000);
      const airingKey = airingDate.toDateString();

      if (localGrouped[airingKey]) {
        localGrouped[airingKey].entries.push(entry);
      }
    });

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
    const date = new Date(airingAt * 1000);
    const hrs = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  return (
    <div className={styles.widget}>
      {/* Day Tabs */}
      <div className={styles.tabs}>
        {dayKeys.map((key) => {
          const item = grouped[key];
          return (
            <button
              key={key}
              className={`${styles.tab} ${activeDay === key ? styles.activeTab : ''}`}
              onClick={() => setActiveDay(key)}
            >
              <span className={styles.tabDayName}>{item.dayName}</span>
              <span className={styles.tabDayNum}>{item.monthName} {item.dayNum}</span>
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
              <span className={styles.itemTime}>{formatLocalTime(entry.airingAt)}</span>
              <span className={styles.itemTitle}>{entry.title}</span>
              <span className={styles.itemBadge}>Ep {entry.episode}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
