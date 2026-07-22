"use client";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string } | { label: string; onClick: () => void };
}

export default function EmptyState({ icon = "📺", title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <span className={styles.icon}>{icon}</span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && "href" in action ? (
        <a href={action.href} className={styles.actionBtn}>{action.label}</a>
      ) : action && "onClick" in action ? (
        <button className={styles.actionBtn} onClick={action.onClick}>{action.label}</button>
      ) : null}
    </div>
  );
}
