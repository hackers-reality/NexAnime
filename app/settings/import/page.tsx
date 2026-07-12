'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function ImportSettingsPage() {
  const [username, setUsername] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setImporting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/anilist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'importUserList',
          username: username.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        setMessage(`Successfully imported ${data.entries?.length || 0} watchlist entries!`);
      } else {
        setError(data.error || 'Failed to import user list.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>Import List</h3>
      <p className={styles.description}>
        Import your public anime list from AniList directly into your local database. 
        This will add or update entries in your watchlist.
      </p>

      {message && <div className={styles.successMessage}>{message}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <form onSubmit={handleImport} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="username">AniList Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Alucard"
            required
            disabled={importing}
          />
        </div>

        <button type="submit" className={styles.importBtn} disabled={importing}>
          {importing ? 'Importing...' : 'Start Import'}
        </button>
      </form>
    </div>
  );
}
