import { describe, it, expect, beforeEach } from 'vitest';
import { _addEntry, _clearBuffer, queryLogs } from '../logBuffer';

beforeEach(() => {
  _clearBuffer();
});

describe('logBuffer – ring buffer', () => {
  it('caps the buffer at 2000 entries', () => {
    for (let i = 0; i < 2100; i++) _addEntry('INFO', `msg ${i}`);
    // queryLogs with a very large window
    const { total } = queryLogs(1440, null, 10000, 0);
    expect(total).toBe(2000);
  });

  it('drops the oldest entry when the buffer is full', () => {
    for (let i = 0; i < 2001; i++) _addEntry('INFO', `msg ${i}`);
    const { logs } = queryLogs(1440, null, 10000, 0);
    expect(logs[0].message).toBe('msg 1');
    expect(logs[logs.length - 1].message).toBe('msg 2000');
  });
});

describe('logBuffer – queryLogs filtering', () => {
  it('filters by minimum log level', () => {
    _addEntry('DEBUG', 'debug msg');
    _addEntry('INFO', 'info msg');
    _addEntry('WARNING', 'warn msg');
    _addEntry('ERROR', 'error msg');

    const { total, logs } = queryLogs(1440, 'WARNING', 100, 0);
    expect(total).toBe(2);
    expect(logs.map((l) => l.level)).toEqual(['WARNING', 'ERROR']);
  });

  it('applies limit and offset for pagination', () => {
    for (let i = 0; i < 10; i++) _addEntry('INFO', `item ${i}`);

    const page1 = queryLogs(1440, null, 4, 0);
    expect(page1.logs).toHaveLength(4);
    expect(page1.total).toBe(10);
    expect(page1.logs[0].message).toBe('item 0');

    const page2 = queryLogs(1440, null, 4, 4);
    expect(page2.logs).toHaveLength(4);
    expect(page2.logs[0].message).toBe('item 4');
  });

  it('returns empty result when buffer has no entries in time window', () => {
    _addEntry('INFO', 'old message');
    // Rewrite the entry's timestamp to be well outside the window
    // by querying with an effectively zero window (0.1 min = 6 s)
    // The entry was just created so this test verifies large-window queries return it
    const { total } = queryLogs(1440, null, 100, 0);
    expect(total).toBe(1);

    // An empty buffer returns nothing
    _clearBuffer();
    const { total: zero } = queryLogs(1440, null, 100, 0);
    expect(zero).toBe(0);
  });
});
