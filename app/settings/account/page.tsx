'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [avatarCharId, setAvatarCharId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('/avatars/default.svg');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setDisplayName(data.profile.display_name || '');
          setPronouns(data.profile.pronouns || '');
          setAboutMe(data.profile.about_me || '');
          setAvatarCharId(data.profile.avatar_char_id);

          // Use cached avatar URL first, only hit AniList as fallback
          if (data.profile.avatar_url) {
            setAvatarUrl(data.profile.avatar_url);
          } else if (data.profile.avatar_char_id) {
            fetch('/api/anilist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'getCharacterById',
                id: data.profile.avatar_char_id,
              })
            })
              .then(res => res.json())
              .then(charData => {
                if (charData.character?.image?.large) {
                  setAvatarUrl(charData.character.image.large);
                }
              })
              .catch(() => {});
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load profile.');
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          pronouns,
          aboutMe,
          avatarCharId,
          avatarUrl,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('Profile updated successfully.');
      } else {
        setError(data.error || 'Failed to save changes.');
      }
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async () => {
    const confirmReset = window.confirm(
      'Are you absolutely sure you want to reset all local data? This will delete your profile, watchlist, watch history, and custom settings. This action is irreversible.'
    );
    if (!confirmReset) return;

    try {
      const res = await fetch('/api/profile', { method: 'DELETE' });
      if (res.ok) {
        toast('Data reset successfully.', 'success');
        window.location.href = '/onboarding';
      } else {
        toast('Failed to reset data.', 'error');
      }
    } catch (err) {
      toast('An error occurred.', 'error');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading profile settings...</div>;
  }

  const generatedUsername = displayName.toLowerCase().replace(/\s+/g, '') || 'user';

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>My Account</h3>
      
      {message && <div className={styles.successMessage}>{message}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.contentWrapper}>
        <div className={styles.leftCol}>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="displayName">Display Name</label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={generatedUsername}
                disabled
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="pronouns">Pronouns</label>
              <input
                type="text"
                id="pronouns"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="aboutMe">About Me</label>
              <textarea
                id="aboutMe"
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                rows={4}
                disabled={saving}
              />
            </div>

            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className={styles.dangerZone}>
            <h4 className={styles.dangerTitle}>Danger Zone</h4>
            <p className={styles.dangerDesc}>
              Wipe all local data stored in the local SQLite database, resetting the application back to its first-run state.
            </p>
            <button onClick={handleResetData} className={styles.resetBtn}>
              Reset Local Data
            </button>
          </div>

          <div className={styles.backupSection}>
            <h4 className={styles.dangerTitle}>Backup & Restore</h4>
            <p className={styles.dangerDesc}>
              Export your watchlist, progress, and settings as a JSON file. Auto-backups run every 5 minutes.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/backup');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `nexanime-backup-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast('Backup downloaded.', 'success');
                  } catch { toast('Backup failed.', 'error'); }
                }}
                className={styles.saveBtn}
              >
                Export Backup
              </button>
              <label className={styles.saveBtn} style={{ cursor: 'pointer', textAlign: 'center' }}>
                Import Backup
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    if (data.format !== 'nexanime-export' || !data.version) { toast('Invalid backup file.', 'error'); return; }
                      if (!window.confirm('This will overwrite all current data. Continue?')) return;
                      const res = await fetch('/api/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: text,
                      });
                      const result = await res.json();
                      if (result.success) {
                        toast(`Restored ${result.restored} records.`, 'success');
                        window.location.reload();
                      } else {
                        toast(result.error || 'Restore failed.', 'error');
                      }
                    } catch { toast('Failed to read backup file.', 'error'); }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.profilePreviewCard}>
            <div className={styles.previewAvatarWrapper}>
              <img src={avatarUrl} alt="Avatar" className={styles.previewAvatar} />
            </div>
            <h4 className={styles.previewName}>{displayName || 'Anonymous User'}</h4>
            <p className={styles.previewMeta}>
              @{generatedUsername} {pronouns ? `• ${pronouns}` : ''}
            </p>
            <a href="/profile" className={styles.gotoProfileBtn}>
              Go to profile
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
