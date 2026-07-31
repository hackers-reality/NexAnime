import { describe, it, expect, beforeEach } from 'vitest';

// ── Provider Health ────────────────────────────────────────
import { recordSuccess, recordFailure, getHealthScore, getAllHealth, sortByHealth } from '@/lib/provider-health';

describe('Provider Health', () => {
  it('returns neutral score for unknown provider', () => {
    expect(getHealthScore('unknown-adapter')).toBe(50);
  });

  it('increases score after successes', () => {
    recordSuccess('test-a', 100);
    recordSuccess('test-a', 200);
    const score = getHealthScore('test-a');
    expect(score).toBeGreaterThan(50);
  });

  it('decreases score after failures', () => {
    recordFailure('test-b');
    recordFailure('test-b');
    const score = getHealthScore('test-b');
    expect(score).toBeLessThan(50);
  });

  it('sortByHealth orders healthiest first', () => {
    recordSuccess('healthy', 50);
    recordSuccess('healthy', 60);
    recordFailure('unhealthy');
    recordFailure('unhealthy');
    const sorted = sortByHealth(['unhealthy', 'healthy']);
    expect(sorted[0]).toBe('healthy');
  });

  it('getAllHealth returns adapter data', () => {
    recordSuccess('tracker', 100);
    const all = getAllHealth();
    expect(all['tracker']).toBeDefined();
    expect(all['tracker'].successes).toBeGreaterThanOrEqual(1);
    expect(all['tracker'].score).toBeGreaterThan(0);
  });
});
