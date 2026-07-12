import Link from 'next/link';
import Header from '@/components/shared/Header';
import styles from './layout.module.css';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.wrapper}>
        <aside className={styles.sidebar}>
          <h2 className={styles.title}>Settings</h2>
          <nav className={styles.nav}>
            <Link href="/settings/account" className={styles.navLink}>
              👤 My Account
            </Link>
            <Link href="/settings/anime" className={styles.navLink}>
              📺 Anime Settings
            </Link>
            <Link href="/settings/playback" className={styles.navLink}>
              ⚙️ Playback
            </Link>
            <Link href="/settings/import" className={styles.navLink}>
              📥 Import List
            </Link>
          </nav>
        </aside>
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
