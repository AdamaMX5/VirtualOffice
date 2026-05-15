export interface CalEvent {
  summary: string;
  start: string;    // ISO-String
  end: string;      // ISO-String
  allDay: boolean;
  location?: string;
}

export async function fetchEvents(calendarUrl: string, days = 14): Promise<CalEvent[]> {
  const res = await fetch(`/api/calendar/events?url=${encodeURIComponent(calendarUrl)}&days=${days}`);
  const data = await res.json() as { events?: CalEvent[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Kalender-Fehler');
  return data.events ?? [];
}

export function isCurrentlyBusy(events: CalEvent[]): boolean {
  const now = Date.now();
  return events.some((e) => new Date(e.start).getTime() <= now && now < new Date(e.end).getTime());
}

export function formatEventTime(event: CalEvent): string {
  if (event.allDay) return 'Ganztägig';
  const start = new Date(event.start);
  const end   = new Date(event.end);
  const now   = new Date();

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;

  const isToday    = start.toDateString() === now.toDateString();
  const isTomorrow = start.toDateString() === new Date(now.getTime() + 86_400_000).toDateString();
  const isCurrent  = start <= now && now < end;

  if (isCurrent)   return `Läuft · ${timeStr}`;
  if (isToday)     return `Heute · ${timeStr}`;
  if (isTomorrow)  return `Morgen · ${timeStr}`;

  const day = start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${timeStr}`;
}

export function groupByDay(events: CalEvent[]): { label: string; events: CalEvent[] }[] {
  const groups: Map<string, CalEvent[]> = new Map();
  const now = new Date();

  for (const ev of events) {
    const d    = new Date(ev.start);
    const key  = d.toDateString();
    const isToday    = key === now.toDateString();
    const isTomorrow = key === new Date(now.getTime() + 86_400_000).toDateString();
    const label = isToday
      ? `Heute, ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
      : isTomorrow
        ? `Morgen, ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
        : d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }

  return [...groups.entries()].map(([, evs]) => {
    const d = new Date(evs[0].start);
    const key  = d.toDateString();
    const isToday    = key === now.toDateString();
    const isTomorrow = key === new Date(now.getTime() + 86_400_000).toDateString();
    const label = isToday
      ? `Heute, ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
      : isTomorrow
        ? `Morgen, ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
        : d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    return { label, events: evs };
  });
}
