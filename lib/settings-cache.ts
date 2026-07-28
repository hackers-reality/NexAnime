let cached: Record<string, any> | null = null;
let expiry = 0;
const TTL = 30000; // 30s

export async function getSettings(): Promise<Record<string, any>> {
  if (cached && Date.now() < expiry) return cached;
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    cached = data.settings || {};
    expiry = Date.now() + TTL;
  } catch {
    cached = {};
    expiry = Date.now() + 5000;
  }
  return cached!;
}
