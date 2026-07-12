'use client';

import { useState, useEffect } from 'react';
import type { ListStatus } from '@/types';
import styles from './WatchlistEditorModal.module.css';

interface WatchlistEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  animeId: number;
  animeTitle: string;
  posterUrl: string | null;
  onSaveSuccess?: () => void;
}

export default function WatchlistEditorModal({
  isOpen,
  onClose,
  animeId,
  animeTitle,
  posterUrl,
  onSaveSuccess,
}: WatchlistEditorModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [status, setStatus] = useState<ListStatus>('planning');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [score, setScore] = useState<number | ''>('');
  const [episodeWatched, setEpisodeWatched] = useState<number>(0);
  const [totalRewatches, setTotalRewatches] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Fetch existing watchlist entry on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchExisting = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/watchlist?anilistId=${animeId}`);
        const data = await res.json();
        
        if (data.entry) {
          const e = data.entry;
          setStatus(e.listStatus || 'planning');
          setStartDate(e.startDate || '');
          setEndDate(e.endDate || '');
          setScore(e.score !== null ? e.score : '');
          setEpisodeWatched(e.episodeWatched || 0);
          setTotalRewatches(e.totalRewatches || 0);
          setNotes(e.notes || '');
        } else {
          // Reset to default
          setStatus('planning');
          setStartDate('');
          setEndDate('');
          setScore('');
          setEpisodeWatched(0);
          setTotalRewatches(0);
          setNotes('');
        }
      } catch (err) {
        console.error('Failed to fetch watchlist status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExisting();
  }, [isOpen, animeId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anilistId: animeId,
          animeTitle,
          listStatus: status,
          startDate: startDate || null,
          endDate: endDate || null,
          score: score !== '' ? Number(score) : null,
          episodeWatched: Number(episodeWatched),
          totalRewatches: Number(totalRewatches),
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save changes');
      }

      onSaveSuccess?.();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleScoreChange = (val: string) => {
    if (val === '') {
      setScore('');
      return;
    }
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setScore(num);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Left Side Poster */}
        <div className={styles.posterSide}>
          {posterUrl ? (
            <img src={posterUrl} alt="" className={styles.posterImage} />
          ) : (
            <div className={styles.posterPlaceholder} />
          )}
        </div>

        {/* Right Side Form */}
        <div className={styles.formSide}>
          <div className={styles.header}>
            <span className={styles.label} style={{ color: 'var(--primary)' }}>
              Watchlist Editor
            </span>
            <h3 className={styles.title}>{animeTitle}</h3>
          </div>

          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>Loading watchlist details...</p>
            </div>
          ) : (
            <>
              {/* Form Grid */}
              <div className={styles.grid}>
                {/* Status Selector */}
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ListStatus)}
                  >
                    <option value="planning">Plan to Watch</option>
                    <option value="watching">Watching</option>
                    <option value="on_hold">On Hold</option>
                    <option value="dropped">Dropped</option>
                    <option value="finished">Completed</option>
                    <option value="rewatching">Rewatching</option>
                  </select>
                </div>

                {/* Score */}
                <div className={styles.field}>
                  <label className={styles.label}>Score (0-100)</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="0"
                    max="100"
                    placeholder="None"
                    value={score}
                    onChange={(e) => handleScoreChange(e.target.value)}
                  />
                </div>

                {/* Start Date */}
                <div className={styles.field}>
                  <label className={styles.label}>Start Date</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div className={styles.field}>
                  <label className={styles.label}>End Date</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Episode Progress */}
                <div className={styles.field}>
                  <label className={styles.label}>Episodes Watched</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="0"
                    value={episodeWatched}
                    onChange={(e) => setEpisodeWatched(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                {/* Rewatches */}
                <div className={styles.field}>
                  <label className={styles.label}>Total Rewatches</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="0"
                    value={totalRewatches}
                    onChange={(e) => setTotalRewatches(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className={styles.field}>
                <label className={styles.label}>Notes</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Add your thoughts or personal tracking notes here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className={styles.footer}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={saving}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
