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
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.profile) {
        setDisplayName(data.profile.display_name);
        if (data.profile.avatar_char_id) {
          // Look up character image by ID directly
          const charRes = await fetch('/api/anilist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'getCharacterById',
              id: data.profile.avatar_char_id,
            })
          });
          const charData = await charRes.json();
          if (charData.character) {
            setAvatarUrl(charData.character.image?.large || '/avatars/default.svg');
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
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = saved || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchNotificationCount();
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
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
        {/* Theme toggle */}
        <button
          className={styles.themeBtn}
          title="Toggle theme"
          onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark';
            setTheme(next);
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
          }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

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

        {/* Profile avatar & dropdown */}
        <div className={styles.avatarWrapper} ref={profileDropdownRef}>
          <button 
            className={styles.avatarBtn}
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            title="Profile & Settings"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className={styles.avatarImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/avatars/default.svg';
                }}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {displayName ? displayName[0].toUpperCase() : 'U'}
              </div>
            )}
          </button>

          {showProfileDropdown && (
            <div className={styles.profileDropdown}>
              <div className={styles.profileDropdownHeader}>
                <span className={styles.userName}>{displayName || 'Anonymous User'}</span>
              </div>
              <div className={styles.profileDropdownDivider} />
              <Link href="/profile" className={styles.dropdownItem} onClick={() => setShowProfileDropdown(false)}>
                👤 Public Profile
              </Link>
              <Link href="/settings/account" className={styles.dropdownItem} onClick={() => setShowProfileDropdown(false)}>
                ✏️ Edit Profile
              </Link>
              <Link href="/settings/playback" className={styles.dropdownItem} onClick={() => setShowProfileDropdown(false)}>
                ⚙️ Settings
              </Link>
              <div className={styles.profileDropdownDivider} />
              <button 
                className={`${styles.dropdownItem} ${styles.signOutBtn}`} 
                onClick={async () => {
                  setShowProfileDropdown(false);
                  const confirmReset = window.confirm('Are you sure you want to sign out and reset all data?');
                  if (confirmReset) {
                    await fetch('/api/profile', { method: 'DELETE' });
                    window.location.href = '/onboarding';
                  }
                }}
              >
                🚪 Sign Out &amp; Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
