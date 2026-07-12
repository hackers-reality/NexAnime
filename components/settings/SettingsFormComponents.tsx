'use client';

import styles from './SettingsFormComponents.module.css';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

export function SettingsToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <div className={styles.label}>{label}</div>
        <div className={styles.description}>{description}</div>
      </div>
      <label className={styles.switch}>
        <input 
          type="checkbox" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
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
}

export function SettingsSelectRow({ label, description, value, options, onChange }: SelectRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <div className={styles.label}>{label}</div>
        <div className={styles.description}>{description}</div>
      </div>
      <select 
        className={styles.select} 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
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
