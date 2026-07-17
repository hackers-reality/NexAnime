'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './UpdateBanner.module.css';

interface UpdateInfo {
  updateAvailable: boolean;
  localSha: string;
  remoteSha?: string;
  remoteMessage?: string;
  remoteDate?: string;
  remoteAuthor?: string;
  commitUrl?: string;
  currentVersion?: string;
}

export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      const res = await fetch('/api/update');
      const data = await res.json();
      if (data.updateAvailable) {
        setUpdateInfo(data);
        setDismissed(false);
      } else {
        setUpdateInfo(null);
      }
    } catch {
      // Silently fail - don't spam user with errors
    }
  }, []);

  // Check on mount and every 5 minutes
  useEffect(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();

      if (data.success) {
        setUpdateResult(
          `Update applied! New commit: ${data.newSha?.substring(0, 7) || 'unknown'}. Restart the app to use the new version.`
        );
      } else {
        setUpdateResult(`Update failed: ${data.error}`);
      }
    } catch (error) {
      setUpdateResult(`Update failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!updateInfo?.updateAvailable || dismissed) return null;

  const relativeDate = updateInfo.remoteDate
    ? new Date(updateInfo.remoteDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'unknown';

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>

        <div className={styles.info}>
          <span className={styles.title}>Update Available</span>
          <button className={styles.detailsBtn} onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        </div>

        {showDetails && (
          <div className={styles.details}>
            <p><strong>Message:</strong> {updateInfo.remoteMessage}</p>
            <p><strong>Author:</strong> {updateInfo.remoteAuthor}</p>
            <p><strong>Date:</strong> {relativeDate}</p>
            <p><strong>Version:</strong> {updateInfo.currentVersion}</p>
            {updateInfo.commitUrl && (
              <a href={updateInfo.commitUrl} target="_blank" rel="noopener noreferrer" className={styles.commitLink}>
                View on GitHub →
              </a>
            )}
          </div>
        )}

        {updateResult && (
          <div className={`${styles.result} ${updateResult.includes('failed') ? styles.resultError : styles.resultSuccess}`}>
            {updateResult}
          </div>
        )}

        <div className={styles.actions}>
          {!updateResult && (
            <button
              className={styles.updateBtn}
              onClick={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <span className={styles.spinner} /> Updating...
                </>
              ) : (
                'Update Now'
              )}
            </button>
          )}
          <button className={styles.dismissBtn} onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
