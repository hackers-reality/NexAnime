import { describe, it, expect } from 'vitest';
import { getRecentLogs, logStream, logBackup, logDb, logImport, logMigration } from '@/lib/logger';

describe('Logger', () => {
  it('logs and retrieves entries', () => {
    const before = getRecentLogs(100).length;
    logStream('test stream message');
    const after = getRecentLogs(100);
    expect(after.length).toBeGreaterThanOrEqual(before + 1);
    expect(after.some(l => l.message === 'test stream message')).toBe(true);
  });

  it('categorizes logs correctly', () => {
    logBackup('backup test');
    const logs = getRecentLogs(100);
    const backupLog = logs.find(l => l.message === 'backup test');
    expect(backupLog?.category).toBe('BACKUP');
  });

  it('respects log limit', () => {
    for (let i = 0; i < 10; i++) logDb(`db test ${i}`);
    const limited = getRecentLogs(3);
    expect(limited.length).toBe(3);
  });

  it('all category functions work', () => {
    expect(() => logDb('test')).not.toThrow();
    expect(() => logImport('test')).not.toThrow();
    expect(() => logMigration('test')).not.toThrow();
  });
});
