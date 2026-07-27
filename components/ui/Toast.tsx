"use client";
import { createContext, useCallback, useContext, useRef, useState, useEffect } from "react";
import styles from "./Toast.module.css";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
  exiting?: boolean;
}

const ToastCtx = createContext<{
  toast: (message: string, type?: Toast["type"]) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const MAX_TOASTS = 5;
const DURATION = 4000;
const EXIT_DURATION = 200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const paused = useRef<Set<number>>(new Set());

  const removeToast = useCallback((id: number) => {
    timers.current.delete(id);
    paused.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => removeToast(id), EXIT_DURATION);
  }, [removeToast]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++counter.current;

    setToasts((prev) => {
      const updated = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...updated, { id, message, type }];
    });

    const timer = setTimeout(() => {
      dismiss(id);
    }, DURATION);
    timers.current.set(id, timer);
  }, [dismiss]);

  const pauseTimer = useCallback((id: number) => {
    paused.current.add(id);
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
  }, []);

  const resumeTimer = useCallback((id: number) => {
    if (!paused.current.has(id)) return;
    paused.current.delete(id);
    const timer = setTimeout(() => dismiss(id), DURATION);
    timers.current.set(id, timer);
  }, [dismiss]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className={styles.container} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${styles[t.type]} ${t.exiting ? styles.exiting : ""}`}
            onClick={() => dismiss(t.id)}
            onMouseEnter={() => pauseTimer(t.id)}
            onMouseLeave={() => resumeTimer(t.id)}
            role="alert"
          >
            <span className={styles.icon}>
              {t.type === "error" ? "✕" : t.type === "success" ? "✓" : "ℹ"}
            </span>
            <span className={styles.message}>{t.message}</span>
            <button
              className={styles.closeBtn}
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
