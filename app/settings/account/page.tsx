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

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>My Account</h3>
      
      {message && <div className={styles.successMessage}>{message}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

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
  );
}
