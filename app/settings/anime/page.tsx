'use client';

import { useState, useEffect } from 'react';
import { SettingsToggleRow, SettingsSelectRow } from '@/components/settings/SettingsFormComponents';
import styles from './page.module.css';

export default function AnimeSettingsPage() {
  const [titleLanguage, setTitleLanguage] = useState('romaji');
  const [hideAdultContent, setHideAdultContent] = useState(false);
  const [autoplayTrailers, setAutoplayTrailers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setTitleLanguage(data.settings.title_language || 'romaji');
          setHideAdultContent(!!data.settings.hide_adult_content);
          setAutoplayTrailers(!!data.settings.autoplay_trailers);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleUpdateSetting = async (key: string, value: any) => {
    setSaving(true);
    setMessage(null);
    try {
      // Map state update
      const body: Record<string, any> = {};
      if (key === 'titleLanguage') {
        setTitleLanguage(value);
        body.titleLanguage = value;
      } else if (key === 'hideAdultContent') {
        setHideAdultContent(value);
        body.hideAdultContent = value;
      } else if (key === 'autoplayTrailers') {
        setAutoplayTrailers(value);
        body.autoplayTrailers = value;
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage('Settings saved.');
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading settings...</div>;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>Anime Settings</h3>

      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.list}>
        <SettingsSelectRow
          label="Title Language"
          description="Choose how anime titles are displayed throughout the application."
          value={titleLanguage}
          options={[
            { label: 'Romaji', value: 'romaji' },
            { label: 'English', value: 'english' },
            { label: 'Native', value: 'native' },
          ]}
          onChange={(val) => handleUpdateSetting('titleLanguage', val)}
        />

        <SettingsToggleRow
          label="Hide 18+ Content"
          description="Filter out mature or adult content search results and recommendations."
          checked={hideAdultContent}
          onChange={(val) => handleUpdateSetting('hideAdultContent', val)}
        />

        <SettingsToggleRow
          label="Autoplay Trailers"
          description="Automatically play trailers on details pages when supported."
          checked={autoplayTrailers}
          onChange={(val) => handleUpdateSetting('autoplayTrailers', val)}
        />
      </div>
    </div>
  );
}
