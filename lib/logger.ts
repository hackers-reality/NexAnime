// Lightweight local diagnostics logger — bounded, readable, no sensitive data
// Logs to console with category prefixes. Bounded to prevent log flooding.

interface LogEntry {
  time: string;
  category: string;
  message: string;
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_LOG_ENTRIES = 200;

function log(category: string, message: string) {
  const entry: LogEntry = {
    time: new Date().toISOString().slice(11, 19),
    category,
    message,
  };
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_LOG_ENTRIES) {
    LOG_BUFFER.shift();
  }
  // eslint-disable-next-line no-console
  console.log(`[${category}] ${message}`);
}

export function logDb(message: string) { log('DB', message); }
export function logBackup(message: string) { log('BACKUP', message); }
export function logStream(message: string) { log('STREAM', message); }
export function logMeta(message: string) { log('META', message); }
export function logImport(message: string) { log('IMPORT', message); }
export function logMigration(message: string) { log('MIGRATION', message); }

// Return recent log entries for diagnostics endpoint
export function getRecentLogs(limit = 50): LogEntry[] {
  return LOG_BUFFER.slice(-limit);
}
