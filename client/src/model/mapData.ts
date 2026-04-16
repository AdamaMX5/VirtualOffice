import type { Room, Wall } from './types';

// Betretbare Räume: Mittelgrau
const ROOM_FILL = '#585858';

export const ROOMS: Room[] = [
  { label: 'Eingangshalle', fill: ROOM_FILL,   pts: [47,48,73,48,73,62,47,62] },
  { label: 'Flur',          fill: ROOM_FILL,   pts: [47,62,73,62,73,68,47,68] },
  { label: 'Büro A',        fill: ROOM_FILL,   pts: [35,40,47,40,47,62,35,62] },
  { label: 'Büro B',        fill: ROOM_FILL,   pts: [73,40,85,40,85,62,73,62] },
  { label: 'Meetingraum',   fill: ROOM_FILL,   pts: [35,68,85,68,85,80,35,80] },
  { label: 'Serverraum',    fill: '#1a2744',   pts: [88,44,103,44,103,62,88,62] },
];

export const WALLS: Wall[] = [
  { f:[47,48], t:[58,48], type:'wall' },
  { f:[62,48], t:[73,48], type:'wall' },
  { f:[73,48], t:[73,62], type:'wall' },
  { f:[47,48], t:[47,62], type:'wall' },
  { f:[47,62], t:[73,62], type:'shared' },
  { f:[58,48], t:[62,48], type:'door' },
  { f:[73,62], t:[73,68], type:'wall' },
  { f:[73,68], t:[47,68], type:'wall' },
  { f:[47,68], t:[47,62], type:'wall' },
  { f:[35,40], t:[47,40], type:'wall' },
  { f:[47,40], t:[47,48], type:'wall' },
  { f:[35,40], t:[35,62], type:'wall' },
  { f:[35,62], t:[47,62], type:'shared' },
  { f:[39,62], t:[43,62], type:'door' },
  { f:[73,40], t:[85,40], type:'wall' },
  { f:[85,40], t:[85,62], type:'wall' },
  { f:[73,62], t:[85,62], type:'shared' },
  { f:[77,62], t:[81,62], type:'door' },
  { f:[35,68], t:[85,68], type:'shared' },
  { f:[85,68], t:[85,80], type:'wall' },
  { f:[85,80], t:[35,80], type:'wall' },
  { f:[35,80], t:[35,68], type:'wall' },
  { f:[58,68], t:[62,68], type:'door' },
  // Serverraum
  { f:[88,44], t:[103,44], type:'wall' },
  { f:[103,44], t:[103,62], type:'wall' },
  { f:[103,62], t:[88,62],  type:'wall' },
  { f:[88,62],  t:[88,54],  type:'wall' },
  { f:[88,54],  t:[88,50],  type:'door' },
  { f:[88,50],  t:[88,44],  type:'wall' },
];

/** Gibt den Raum-Label zurück, in dem sich Position (wx, wy) befindet, sonst null. */
export function getRoomAtPos(wx: number, wy: number): string | null {
  for (const room of ROOMS) {
    const xs = room.pts.filter((_, i) => i % 2 === 0);
    const ys = room.pts.filter((_, i) => i % 2 !== 0);
    if (wx >= Math.min(...xs) && wx <= Math.max(...xs) &&
        wy >= Math.min(...ys) && wy <= Math.max(...ys)) {
      return room.label;
    }
  }
  return null;
}
