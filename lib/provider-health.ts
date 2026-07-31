// Lightweight provider health tracking — all local, no external calls
// Tracks success/failure streaks and resolution latency per provider

interface ProviderHealth {
  successes: number;
  failures: number;
  totalAttempts: number;
  recentSuccesses: number; // last 10
  recentFailures: number; // last 10
  avgLatencyMs: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastResults: boolean[]; // circular buffer of last 10 results
}

const health: Record<string, ProviderHealth> = {};

function getHealth(adapterId: string): ProviderHealth {
  if (!health[adapterId]) {
    health[adapterId] = {
      successes: 0,
      failures: 0,
      totalAttempts: 0,
      recentSuccesses: 0,
      recentFailures: 0,
      avgLatencyMs: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastResults: [],
    };
  }
  return health[adapterId];
}

export function recordSuccess(adapterId: string, latencyMs: number) {
  const h = getHealth(adapterId);
  h.successes++;
  h.totalAttempts++;
  h.lastSuccessAt = Date.now();
  h.avgLatencyMs = h.avgLatencyMs === 0
    ? latencyMs
    : (h.avgLatencyMs * 0.8 + latencyMs * 0.2); // exponential moving average
  h.lastResults.push(true);
  if (h.lastResults.length > 10) h.lastResults.shift();
  h.recentSuccesses = h.lastResults.filter(Boolean).length;
  h.recentFailures = h.lastResults.length - h.recentSuccesses;
}

export function recordFailure(adapterId: string) {
  const h = getHealth(adapterId);
  h.failures++;
  h.totalAttempts++;
  h.lastFailureAt = Date.now();
  h.lastResults.push(false);
  if (h.lastResults.length > 10) h.lastResults.shift();
  h.recentSuccesses = h.lastResults.filter(Boolean).length;
  h.recentFailures = h.lastResults.length - h.recentSuccesses;
}

// Compute a score for sorting providers (higher = healthier)
// Uses recent streak + overall success rate + latency penalty
export function getHealthScore(adapterId: string): number {
  const h = getHealth(adapterId);
  if (h.totalAttempts === 0) return 50; // unknown = neutral

  const recentSuccessRate = h.lastResults.length > 0
    ? h.recentSuccesses / h.lastResults.length
    : 0.5;
  const overallSuccessRate = h.successes / h.totalAttempts;

  // Recent results weighted 70%, overall 30%
  const successScore = recentSuccessRate * 70 + overallSuccessRate * 30;

  // Latency penalty: 0ms = +20, 5000ms = -20
  const latencyPenalty = 20 - (h.avgLatencyMs / 250);

  return successScore + latencyPenalty;
}

// Sort adapter IDs by health score (healthiest first)
export function sortByHealth(adapterIds: string[]): string[] {
  return [...adapterIds].sort((a, b) => getHealthScore(b) - getHealthScore(a));
}

// Get all health data for diagnostics
export function getAllHealth(): Record<string, ProviderHealth & { score: number }> {
  const result: Record<string, ProviderHealth & { score: number }> = {};
  for (const [id, h] of Object.entries(health)) {
    result[id] = { ...h, score: getHealthScore(id) };
  }
  return result;
}
