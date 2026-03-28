import { AsyncLocalStorage } from 'async_hooks';

export interface LogEntry {
  timestamp: string;
  level: string;
  levelNum: number;
  message: string;
  requestId: string | null;
}

const LEVEL_NUMS: Record<string, number> = {
  DEBUG: 0,
  INFO: 10,
  WARNING: 20,
  ERROR: 30,
  CRITICAL: 40,
};

const MAX_SIZE = 2000;
const buffer: LogEntry[] = [];

export const requestIdStorage = new AsyncLocalStorage<string>();

/** Exposed for tests only */
export function _addEntry(level: string, message: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    levelNum: LEVEL_NUMS[level] ?? 0,
    message,
    requestId: requestIdStorage.getStore() ?? null,
  };
  if (buffer.length >= MAX_SIZE) buffer.shift();
  buffer.push(entry);
}

/** Exposed for tests only */
export function _clearBuffer(): void {
  buffer.length = 0;
}

/** Patches console.* methods to feed the ring buffer. Call once at startup. */
export function installConsoleCapture(): void {
  const orig = {
    log:   console.log.bind(console),
    debug: console.debug.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => {
    _addEntry('INFO', args.map(String).join(' '));
    orig.log(...args);
  };
  console.debug = (...args: unknown[]) => {
    _addEntry('DEBUG', args.map(String).join(' '));
    orig.debug(...args);
  };
  console.warn = (...args: unknown[]) => {
    _addEntry('WARNING', args.map(String).join(' '));
    orig.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    _addEntry('ERROR', args.map(String).join(' '));
    orig.error(...args);
  };
}

export function queryLogs(
  minutes: number,
  minLevelName: string | null,
  limit: number,
  offset: number,
): { logs: LogEntry[]; total: number } {
  const since = Date.now() - minutes * 60 * 1000;
  const minLevel = minLevelName != null ? (LEVEL_NUMS[minLevelName] ?? 0) : 0;

  const filtered = buffer.filter(
    (e) => new Date(e.timestamp).getTime() >= since && e.levelNum >= minLevel,
  );

  return {
    total: filtered.length,
    logs: filtered.slice(offset, offset + limit),
  };
}
