'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
              .catch(err => console.error('Failed to load profile avatar preview:', err));
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
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
      console.error(err);
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
        alert('Local data reset successfully.');
        window.location.href = '/onboarding';
      } else {
        alert('Failed to reset data.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
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
