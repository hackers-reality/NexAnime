'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './NotificationPanel.module.css';

interface NotificationItem {
  id: number;
  anilist_id: number;
  type: 'new_episode' | 'airing_soon';
  message: string;
  read: number;
  created_at: string;
}

interface NotificationPanelProps {
  onClose: () => void;
  onRefreshCount: () => void;
}

export default function NotificationPanel({ onClose, onRefreshCount }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'new_episode' | 'airing_soon'>('all');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: 1 } : n))
        );
        onRefreshCount();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
        onRefreshCount();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    return n.type === activeTab;
  });

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Notifications</h3>
        {notifications.some((n) => !n.read) && (
          <button onClick={handleMarkAllRead} className={styles.markAllBtn}>
            Mark all read
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'new_episode' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('new_episode')}
        >
          New Episodes
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'airing_soon' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('airing_soon')}
        >
          Airing Soon
        </button>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : filteredNotifs.length === 0 ? (
          <div className={styles.empty}>No notifications found</div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              className={`${styles.item} ${notif.read ? styles.readItem : styles.unreadItem}`}
            >
              <div className={styles.dot} />
              <div className={styles.content}>
                <p className={styles.msg}>{notif.message}</p>
                <div className={styles.meta}>
                  <Link
                    href={`/anime/${notif.anilist_id}`}
                    onClick={onClose}
                    className={styles.link}
                  >
                    View Details
                  </Link>
                  {!notif.read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className={styles.readBtn}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
