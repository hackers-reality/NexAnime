'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from '@/components/shared/Header';
import styles from './layout.module.css';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    const confirmSignOut = window.confirm(
      'Are you sure you want to sign out? This will reset all your watchlist, watch history, settings and local database profile, returning NexAnime back to onboarding.'
    );
    if (!confirmSignOut) return;

    try {
      const res = await fetch('/api/profile', { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/onboarding';
      } else {
        alert('Failed to sign out / reset.');
      }
    } catch (err) {
      console.error('Sign Out failed:', err);
      alert('An error occurred during sign out.');
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.wrapper}>
        <aside className={styles.sidebar}>
          <h2 className={styles.title}>Settings</h2>
          <nav className={styles.nav}>
            <Link 
              href="/settings/account" 
              className={`${styles.navLink} ${isActive('/settings/account') ? styles.activeLink : ''}`}
            >
              👤 My Account
            </Link>
            <Link 
              href="/settings/anime" 
              className={`${styles.navLink} ${isActive('/settings/anime') ? styles.activeLink : ''}`}
            >
              📺 Anime Settings
            </Link>
            <Link 
              href="/settings/playback" 
              className={`${styles.navLink} ${isActive('/settings/playback') ? styles.activeLink : ''}`}
            >
              ⚙️ Playback
            </Link>
            <Link 
              href="/settings/import" 
              className={`${styles.navLink} ${isActive('/settings/import') ? styles.activeLink : ''}`}
            >
              📥 Import List
            </Link>
            <button 
              className={`${styles.navLink} ${styles.navBtn}`}
              onClick={() => alert('Device management is synced automatically with your active session.')}
            >
              🖥️ Devices
            </button>
            <button 
              className={`${styles.navLink} ${styles.signOutBtn}`}
              onClick={handleSignOut}
            >
              🚪 Sign Out & Reset
            </button>
          </nav>
        </aside>
        <main id="main-content" className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
