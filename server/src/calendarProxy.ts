/**
 * calendarProxy – holt und parst eine iCal/ICS-URL server-seitig (CORS-Bypass).
 * Unterstützt DTSTART mit TZID, All-Day-Events und einfache RRULE (DAILY/WEEKLY).
 */

export interface CalEvent {
  summary: string;
  start: string;    // ISO-String (UTC)
  end: string;      // ISO-String (UTC)
  allDay: boolean;
  location?: string;
}

// ── Datum-Parsing ─────────────────────────────────────────────────────────────

function localIsoToUtc(localIso: string, tzid: string): Date {
  const guess = new Date(localIso + 'Z');
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tzid, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(guess);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '00';
  const inTz = new Date(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:${p('second')}Z`);
  return new Date(guess.getTime() - (inTz.getTime() - new Date(localIso + 'Z').getTime()));
}

function parseIcsDate(raw: string): { date: Date; allDay: boolean } | null {
  if (!raw) return null;
  const colonIdx = raw.lastIndexOf(':');
  const before   = colonIdx >= 0 ? raw.slice(0, colonIdx) : '';
  const dateStr  = (colonIdx >= 0 ? raw.slice(colonIdx + 1) : raw).trim();

  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(dateStr)) {
    return { date: new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T00:00:00`), allDay: true };
  }

  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, utc] = m;

  if (utc) return { date: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`), allDay: false };

  const tzidMatch = before.match(/TZID=([^;:]+)/);
  if (tzidMatch) {
    try {
      return { date: localIsoToUtc(`${y}-${mo}-${d}T${h}:${mi}:${s}`, tzidMatch[1]), allDay: false };
    } catch { /* fallthrough */ }
  }
  return { date: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`), allDay: false };
}

// ── ICS-Text auffalten und Property lesen ─────────────────────────────────────

function unfold(ics: string): string {
  return ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function getProp(block: string, key: string): string {
  const m = block.match(new RegExp(`^${key}(?:;[^:\\r\\n]*)?:(.+)$`, 'mi'));
  return m?.[1]?.trim() ?? '';
}

// ── Einfache RRULE-Expansion (DAILY + WEEKLY) ─────────────────────────────────

const DAY_IDX: Record<string, number> = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

function expandRrule(base: CalEvent, rruleStr: string, windowEnd: Date): CalEvent[] {
  const get = (k: string) => rruleStr.match(new RegExp(`(?:^|;)${k}=([^;]+)`))?.[1] ?? '';
  const freq     = get('FREQ').toUpperCase();
  const interval = parseInt(get('INTERVAL') || '1');
  const until    = get('UNTIL')  ? parseIcsDate(get('UNTIL'))?.date  : undefined;
  const count    = get('COUNT')  ? parseInt(get('COUNT'))             : undefined;
  const byDays   = get('BYDAY')  ? get('BYDAY').split(',').map((d) => d.replace(/[+-\d]/g, '')) : undefined;

  if (!['DAILY','WEEKLY'].includes(freq)) return [];

  const results: CalEvent[] = [];
  const duration = new Date(base.end).getTime() - new Date(base.start).getTime();
  const now = new Date();
  let cur = new Date(base.start);
  let n = 0;
  const maxN = count ?? 500;

  while (cur <= windowEnd && n < maxN && (!until || cur <= until)) {
    const dayOk = !byDays || byDays.some((d) => DAY_IDX[d] === cur.getDay());
    if (dayOk) {
      const end = new Date(cur.getTime() + duration);
      if (end >= now) results.push({ ...base, start: cur.toISOString(), end: end.toISOString() });
    }
    if (freq === 'WEEKLY' && byDays && byDays.length > 1) {
      cur = new Date(cur.getTime() + 86_400_000); // Tag für Tag iterieren
    } else if (freq === 'WEEKLY') {
      cur = new Date(cur.getTime() + interval * 7 * 86_400_000);
    } else {
      cur = new Date(cur.getTime() + interval * 86_400_000);
    }
    n++;
  }
  return results;
}

// ── ICS parsen ────────────────────────────────────────────────────────────────

export function parseIcs(ics: string, now: Date, windowEnd: Date): CalEvent[] {
  const text = unfold(ics);
  const results: CalEvent[] = [];

  for (const raw of text.split(/BEGIN:VEVENT/i).slice(1)) {
    const end  = raw.search(/END:VEVENT/i);
    const body = end >= 0 ? raw.slice(0, end) : raw;

    const summary  = getProp(body, 'SUMMARY');
    if (!summary) continue;

    const rawStart = getProp(body, 'DTSTART');
    const rawEnd   = getProp(body, 'DTEND') || getProp(body, 'DTSTART');
    const rrule    = getProp(body, 'RRULE');
    const location = getProp(body, 'LOCATION') || undefined;

    const startParsed = parseIcsDate(rawStart);
    const endParsed   = parseIcsDate(rawEnd);
    if (!startParsed) continue;

    const base: CalEvent = {
      summary, location,
      start:  startParsed.date.toISOString(),
      end:    (endParsed ?? startParsed).date.toISOString(),
      allDay: startParsed.allDay,
    };

    if (rrule) {
      results.push(...expandRrule(base, rrule, windowEnd));
    } else {
      const evEnd = new Date(base.end);
      if (evEnd >= now && startParsed.date <= windowEnd) results.push(base);
    }
  }

  return results.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

// ── Öffentliche Funktion ──────────────────────────────────────────────────────

export async function fetchCalendarEvents(rawUrl: string, days = 14): Promise<CalEvent[]> {
  const url = rawUrl.replace(/^webcal:\/\//i, 'https://').replace(/^http:\/\//i, 'https://');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VirtualOffice-Calendar/1.0', Accept: 'text/calendar' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Kalender nicht erreichbar (HTTP ${res.status})`);
  const text = await res.text();
  const now  = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  return parseIcs(text, now, until);
}
