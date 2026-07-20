'use client';

import { useState } from 'react';
import styles from './ServerPicker.module.css';

interface Server {
  adapterId: string;
  streamUrl: string;
  sourceName?: string;
}

interface ServerPickerProps {
  servers: Server[];
  activeServerId: string | null;
  onSelectServer: (serverId: string) => void;
}

function formatName(id?: string): string {
  if (!id) return 'Loading...';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export default function ServerPicker({ servers, activeServerId, onSelectServer }: ServerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeServer = servers.find(s => s.adapterId === activeServerId) || servers[0];

  return (
    <div className={styles.pickerWrapper}>
      <button 
        className={styles.pickerButton} 
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.label}>Server:</span>
        <span className={styles.activeName}>{activeServer?.sourceName || formatName(activeServer?.adapterId) || 'Loading...'}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <ul className={styles.dropdown} role="listbox">
          {servers.length === 0 ? (
            <li className={styles.emptyItem}>No servers available</li>
          ) : (
            servers.map((server) => (
              <li key={server.adapterId} role="option" aria-selected={server.adapterId === activeServerId}>
                <button
                  className={`${styles.serverOption} ${server.adapterId === activeServerId ? styles.selected : ''}`}
                  onClick={() => {
                    onSelectServer(server.adapterId);
                    setIsOpen(false);
                  }}
                >
                  {server.sourceName || formatName(server.adapterId)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
