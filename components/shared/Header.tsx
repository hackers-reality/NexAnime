'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SearchDropdown from './SearchDropdown';
import NotificationPanel from './NotificationPanel';
import styles from './Header.module.css';

export default function Header() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  // Dynamic header state
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.profile) {
        setDisplayName(data.profile.display_name);
        if (data.profile.avatar_char_id) {
          // Look up character image from AniList character API
          const charRes = await fetch('/api/anilist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'searchCharacters',
              search: '', // Default query fetches character details or we fetch specifically
            })
          });
          const charData = await charRes.json();
          // Find matching char in search or default to placeholder
          const char = charData.characters?.find((c: any) => c.id === data.profile.avatar_char_id);
          if (char) {
            setAvatarUrl(char.image.large);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load header profile details:', err);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.notifications) {
        const unread = data.notifications.filter((n: any) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchNotificationCount();
  }, []);

  // Close notifications dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = useCallback(
    (path: string) => pathname === path || pathname?.startsWith(path + '/'),
    [pathname]
  );

  return (
    <header className={styles.header}>
      {/* Logo */}
      <Link href="/" className={styles.logo}>
        <img src="/logo.svg" alt="NexAnime" className={styles.logoImage} />
      </Link>

      {/* Nav links */}
      <nav className={styles.nav}>
        <Link
          href="/browse"
          className={`${styles.navLink} ${isActive('/browse') ? styles.navLinkActive : ''}`}
        >
          Browse
        </Link>
        <Link
          href="/watchlist"
          className={`${styles.navLink} ${isActive('/watchlist') ? styles.navLinkActive : ''}`}
        >
          Watchlist
        </Link>
      </nav>

      {/* Search */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search anime..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearch(e.target.value.length > 0);
          }}
          onFocus={() => {
            if (searchQuery.length > 0) setShowSearch(true);
          }}
          onBlur={() => {
            setTimeout(() => setShowSearch(false), 200);
          }}
        />
        {showSearch && (
          <SearchDropdown
            query={searchQuery}
            onSelect={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
          />
        )}
      </div>

      {/* Right actions */}
      <div className={styles.actions}>
        {/* Notification bell */}
        <div className={styles.bellWrapper} ref={dropdownRef}>
          <button 
            className={styles.bellBtn} 
            title="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            🔔
            {unreadCount > 0 && (
              <span className={styles.bellBadge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <NotificationPanel 
              onClose={() => setShowNotifications(false)} 
              onRefreshCount={fetchNotificationCount}
            />
          )}
        </div>

        {/* Profile avatar */}
        <Link href="/profile" className={styles.avatarLink}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className={styles.avatarImage} />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {displayName ? displayName[0].toUpperCase() : 'U'}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
