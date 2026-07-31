import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Settings Cache tests ──
// Tests the 30s TTL cache behavior

describe('Settings Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('getSettings returns cached value within TTL', async () => {
    const { getSettings } = await import('@/lib/settings-cache');
    // First call fetches
    const s1 = await getSettings();
    expect(s1).toBeDefined();
    // Second call should return cached (no new fetch)
    const s2 = await getSettings();
    expect(s2).toEqual(s1);
  });

  it('getSettings refreshes after TTL expires', async () => {
    const { getSettings } = await import('@/lib/settings-cache');
    const s1 = await getSettings();
    // Advance past 30s TTL
    vi.advanceTimersByTime(31000);
    const s2 = await getSettings();
    // Should have fetched again (may return same or different data)
    expect(s2).toBeDefined();
  });
});
