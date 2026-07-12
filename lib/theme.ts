// NexAnime — Theme tokens (exported for use in components/JS)
// CSS custom properties are defined in app/globals.css
// This file mirrors them for programmatic access

export const theme = {
  colors: {
    bgBase: '#0a0a0f',
    bgSurface: '#141420',
    bgSurfaceHover: '#1c1c2c',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    accentAiring: '#22c55e',
    accentHiatus: '#eab308',
    textPrimary: '#f5f5f7',
    textSecondary: '#a1a1aa',
    border: '#27272f',
  },

  fonts: {
    sans: "'Inter', 'Space Grotesk', system-ui, -apple-system, sans-serif",
    heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  },

  radii: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },

  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '400ms ease',
  },
} as const;
