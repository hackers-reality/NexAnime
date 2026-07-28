'use client';

import { useId } from 'react';
import styles from './SettingsFormComponents.module.css';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  const id = useId();
  return (
    <div className={styles.row} style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <div className={styles.info}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        <div className={styles.description}>{description}</div>
      </div>
      <label className={styles.switch} htmlFor={id}>
        <input 
          id={id}
          type="checkbox" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className={styles.slider}></span>
      </label>
    </div>
  );
}

interface SelectRowProps {
  label: string;
  description: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function SettingsSelectRow({ label, description, value, options, onChange, disabled }: SelectRowProps) {
  const id = useId();
  return (
    <div className={styles.row} style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <div className={styles.info}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        <div className={styles.description}>{description}</div>
      </div>
      <select 
        id={id}
        className={styles.select} 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
