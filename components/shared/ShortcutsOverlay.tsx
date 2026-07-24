'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ShortcutsOverlay.module.css';

const SHORTCUTS = [
  { category: 'Navigation', items: [
    { keys: ['?'], desc: 'Show keyboard shortcuts' },
    { keys: ['/'], desc: 'Focus search' },
    { keys: ['Esc'], desc: 'Close search / modals' },
    { keys: ['g', 'h'], desc: 'Go to Home' },
    { keys: ['g', 'b'], desc: 'Go to Browse' },
    { keys: ['g', 'w'], desc: 'Go to Watchlist' },
    { keys: ['g', 's'], desc: 'Go to Schedule' },
  ]},
  { category: 'Player', items: [
    { keys: ['Space'], desc: 'Play / Pause' },
    { keys: ['K'], desc: 'Play / Pause' },
    { keys: ['→'], desc: 'Seek forward 5s' },
    { keys: ['←'], desc: 'Seek backward 5s' },
    { keys: ['J'], desc: 'Seek backward 10s' },
    { keys: ['L'], desc: 'Seek forward 10s' },
    { keys: ['↑'], desc: 'Volume up' },
    { keys: ['↓'], desc: 'Volume down' },
    { keys: ['M'], desc: 'Mute / Unmute' },
    { keys: ['F'], desc: 'Toggle fullscreen' },
    { keys: ['S'], desc: 'Screenshot' },
    { keys: [','], desc: 'Playback speed down' },
    { keys: ['.'], desc: 'Playback speed up' },
  ]},
  { category: 'Watch Page', items: [
    { keys: ['Shift', '←'], desc: 'Previous episode' },
    { keys: ['Shift', '→'], desc: 'Next episode' },
  ]},
];

export default function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) triggerRef.current = e.target as HTMLElement;
          return !prev;
        });
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      modalRef.current?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className={styles.modal} ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Keyboard Shortcuts</h2>
          <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close shortcuts overlay">
            ✕
          </button>
        </div>
        <div className={styles.grid}>
          {SHORTCUTS.map((section) => (
            <div key={section.category} className={styles.section}>
              <h3 className={styles.sectionTitle}>{section.category}</h3>
              {section.items.map((item, i) => (
                <div key={i} className={styles.shortcut}>
                  <div className={styles.keys}>
                    {item.keys.map((key) => (
                      <kbd key={key} className={styles.key}>{key}</kbd>
                    ))}
                  </div>
                  <span className={styles.desc}>{item.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
