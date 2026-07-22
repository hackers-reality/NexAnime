'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

export default function ImportSettingsPage() {
  const [username, setUsername] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleAnilistImport = async (e: React.FormEvent) => {
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
        setMessage(`Successfully imported ${data.entries?.length || 0} watchlist entries from AniList!`);
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

  const handleExportJSON = async () => {
    try {
      const res = await fetch('/api/watchlist');
      const data = await res.json();
      const exportData = {
        exportedAt: new Date().toISOString(),
        source: 'NexAnime',
        version: '0.1.0',
        entries: (data.entries || []).map((e: any) => ({
          anilistId: e.anilistId,
          title: e.anime?.title?.romaji || e.anime?.title?.english || 'Unknown',
          status: e.listStatus,
          score: e.score,
          episodeWatched: e.episodeWatched,
          totalRewatches: e.totalRewatches,
          notes: e.notes,
          startDate: e.startDate,
          endDate: e.endDate,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexanime-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setMessage(`Exported ${exportData.entries.length} entries to JSON file.`);
      toast(`Exported ${exportData.entries.length} entries`, 'success');
    } catch (err) {
      setError('Failed to export watchlist.');
      toast('Failed to export watchlist.', 'error');
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);
    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.entries || !Array.isArray(data.entries)) {
        setError('Invalid file format. Expected NexAnime export file.');
        setImporting(false);
        return;
      }

      let imported = 0;
      for (const entry of data.entries) {
        if (!entry.anilistId) continue;
        try {
          await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anilistId: entry.anilistId,
              listStatus: entry.status || 'planning',
              score: entry.score || null,
              episodeWatched: entry.episodeWatched || 0,
              totalRewatches: entry.totalRewatches || 0,
              notes: entry.notes || null,
              startDate: entry.startDate || null,
              endDate: entry.endDate || null,
              animeTitle: entry.title,
            }),
          });
          imported++;
        } catch {
          // Skip failed entries
        }
      }

      setMessage(`Imported ${imported} entries from JSON file.`);
      toast(`Imported ${imported} entries`, 'success');
    } catch (err) {
      setError('Failed to parse JSON file. Make sure it is a valid NexAnime export.');
      toast('Failed to parse JSON file.', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.container}>
      {/* AniList Import */}
      <h3 className={styles.sectionTitle}>Import from AniList</h3>
      <p className={styles.description}>
        Import your public anime list from AniList directly into your local database. 
        This will add or update entries in your watchlist.
      </p>

      {message && <div className={styles.successMessage}>{message}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <form onSubmit={handleAnilistImport} className={styles.form}>
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
          {importing ? 'Importing...' : 'Import from AniList'}
        </button>
      </form>

      <div className={styles.divider} />

      {/* JSON Export/Import */}
      <h3 className={styles.sectionTitle}>Export / Import JSON</h3>
      <p className={styles.description}>
        Export your watchlist as a JSON backup file, or import a previously exported file.
      </p>

      <div className={styles.buttonRow}>
        <button className={styles.importBtn} onClick={handleExportJSON}>
          Export Watchlist
        </button>
        <button
          className={styles.importBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'Importing...' : 'Import from File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJSON}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
