export const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  RELEASING: { dot: 'var(--accent-airing)', label: 'Airing' },
  FINISHED: { dot: 'var(--accent-finished)', label: 'Finished' },
  NOT_YET_RELEASED: { dot: 'var(--primary)', label: 'Upcoming' },
  CANCELLED: { dot: 'var(--accent-cancelled)', label: 'Cancelled' },
  HIATUS: { dot: 'var(--accent-hiatus)', label: 'Hiatus' },
};
