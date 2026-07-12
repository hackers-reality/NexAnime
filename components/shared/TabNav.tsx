'use client';

import styles from './TabNav.module.css';

export interface Tab {
  key: string;
  label: string;
  count?: number;
}

export interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  variant?: 'default' | 'pill' | 'underline';
}

export default function TabNav({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
}: TabNavProps) {
  return (
    <nav className={`${styles.nav} ${styles[variant]}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={styles.count}>{tab.count}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
