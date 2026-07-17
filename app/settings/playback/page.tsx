'use client';

import { useState, useEffect } from 'react';
import { SettingsToggleRow, SettingsSelectRow } from '@/components/settings/SettingsFormComponents';
import styles from './page.module.css';

export default function PlaybackSettingsPage() {
  const [videoQuality, setVideoQuality] = useState('auto');
  const [autoPlay, setAutoPlay] = useState(true);
  const [autoNext, setAutoNext] = useState(false);
  const [autoSkip, setAutoSkip] = useState(false);
  const [miniPlayer, setMiniPlayer] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);
  const [pauseHistory, setPauseHistory] = useState(false);
  const [notificationSound, setNotificationSound] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setVideoQuality(data.settings.video_quality || 'auto');
          setAutoPlay(!!data.settings.auto_play);
          setAutoNext(!!data.settings.auto_next);
          setAutoSkip(!!data.settings.auto_skip_intro_outro);
          setMiniPlayer(!!data.settings.mini_player);
          setAmbientMode(!!data.settings.ambient_mode);
          setPauseHistory(!!data.settings.pause_history);
          setNotificationSound(data.settings.notification_sound !== 0);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleUpdateSetting = async (key: string, value: any) => {
    setMessage(null);
    try {
      const body: Record<string, any> = {};
      
      switch (key) {
        case 'videoQuality':
          setVideoQuality(value);
          body.videoQuality = value;
          break;
        case 'autoPlay':
          setAutoPlay(value);
          body.autoPlay = value;
          break;
        case 'autoNext':
          setAutoNext(value);
          body.autoNext = value;
          break;
        case 'autoSkip':
          setAutoSkip(value);
          body.autoSkipIntroOutro = value;
          break;
        case 'miniPlayer':
          setMiniPlayer(value);
          body.miniPlayer = value;
          break;
        case 'ambientMode':
          setAmbientMode(value);
          body.ambientMode = value;
          break;
        case 'pauseHistory':
          setPauseHistory(value);
          body.pauseHistory = value;
          break;
        case 'notificationSound':
          setNotificationSound(value);
          body.notificationSound = value;
          break;
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage('Playback settings saved.');
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading playback settings...</div>;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>Playback Settings</h3>

      {message && <div className={styles.toast}>{message}</div>}

      <div className={styles.list}>
        <SettingsSelectRow
          label="Video Quality Preference"
          description="Default quality of the stream selected on play."
          value={videoQuality}
          options={[
            { label: 'Auto', value: 'auto' },
            { label: '1080p', value: '1080p' },
            { label: '720p', value: '720p' },
            { label: '480p', value: '480p' },
          ]}
          onChange={(val) => handleUpdateSetting('videoQuality', val)}
        />

        <SettingsToggleRow
          label="Auto Play"
          description="Automatically play the video when the watch page is loaded."
          checked={autoPlay}
          onChange={(val) => handleUpdateSetting('autoPlay', val)}
        />

        <SettingsToggleRow
          label="Auto Next"
          description="Automatically play the next episode when the current one ends."
          checked={autoNext}
          onChange={(val) => handleUpdateSetting('autoNext', val)}
        />

        <SettingsToggleRow
          label="Auto Skip Intro / Outro"
          description="Skip OP and ED segments automatically using metadata indexes when available."
          checked={autoSkip}
          onChange={(val) => handleUpdateSetting('autoSkip', val)}
        />

        <SettingsToggleRow
          label="MiniPlayer"
          description="Keep video playing in a picture-in-picture widget when scrolling details."
          checked={miniPlayer}
          onChange={(val) => handleUpdateSetting('miniPlayer', val)}
        />

        <SettingsToggleRow
          label="Ambient Mode"
          description="Cast a glow effect matched to the video colors onto the player background."
          checked={ambientMode}
          onChange={(val) => handleUpdateSetting('ambientMode', val)}
        />

        <SettingsToggleRow
          label="Pause Watch History"
          description="Temporarily stop saving your progress and status changes to your profile history."
          checked={pauseHistory}
          onChange={(val) => handleUpdateSetting('pauseHistory', val)}
        />

        <SettingsToggleRow
          label="Notification Sound"
          description="Play a sound when new episodes are available for anime in your watchlist."
          checked={notificationSound}
          onChange={(val) => handleUpdateSetting('notificationSound', val)}
        />
      </div>
    </div>
  );
}
