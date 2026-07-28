'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

type ThemeChoice = 'dark' | 'light' | 'system';

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: string; desc: string }[] = [
  { value: 'dark', label: 'Dark', icon: '🌙', desc: 'Easy on the eyes at night' },
  { value: 'light', label: 'Light', icon: '☀️', desc: 'Clean and bright' },
  { value: 'system', label: 'System', icon: '💻', desc: 'Follows your OS preference' },
];

function applyTheme(choice: ThemeChoice) {
  let resolved: 'dark' | 'light' = 'dark';
  if (choice === 'light') {
    resolved = 'light';
  } else if (choice === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);
  localStorage.setItem('theme', resolved);
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: resolved }),
  }).catch(() => {});
}

export default function AppearanceSettingsPage() {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('dark');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          const saved = data.settings.theme as 'dark' | 'light' | null;
          if (saved) {
            setThemeChoice(saved);
          } else {
            const ls = localStorage.getItem('theme') as 'dark' | 'light' | null;
            setThemeChoice(ls || 'dark');
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = async (choice: ThemeChoice) => {
    setThemeChoice(choice);
    setSaving(true);
    applyTheme(choice);
    setTimeout(() => setSaving(false), 600);
  };

  if (loading) {
    return <div className={styles.loading}>Loading appearance settings...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>Appearance</h2>
      <p className={styles.desc}>Choose how NexAnime looks on your device.</p>

      <div className={styles.themeGrid}>
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`${styles.themeCard} ${themeChoice === opt.value ? styles.themeCardActive : ''}`}
            onClick={() => handleSelect(opt.value)}
            aria-pressed={themeChoice === opt.value}
          >
            <span className={styles.themeIcon}>{opt.icon}</span>
            <span className={styles.themeLabel}>{opt.label}</span>
            <span className={styles.themeDesc}>{opt.desc}</span>
          </button>
        ))}
      </div>

      {saving && <span className={styles.saving}>Saved</span>}
    </div>
  );
}
