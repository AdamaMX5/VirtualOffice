import { create } from 'zustand';
import type { Room, Wall } from '../types';
import { ROOMS as DEFAULT_ROOMS, WALLS as DEFAULT_WALLS } from '../mapData';

interface MapState {
  rooms:  Room[];
  walls:  Wall[];
  loaded: boolean;

  setMap:         (rooms: Room[], walls: Wall[]) => void;
  resetToDefault: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  rooms:  DEFAULT_ROOMS,
  walls:  DEFAULT_WALLS,
  loaded: false,

  setMap: (rooms, walls) => set({ rooms, walls, loaded: true }),
  resetToDefault: () => set({ rooms: DEFAULT_ROOMS, walls: DEFAULT_WALLS, loaded: true }),
}));

/** Raum-Erkennung für den Game-Loop — liest immer die aktuelle Map. */
export function getRoomAtPos(wx: number, wy: number): string | null {
  for (const room of useMapStore.getState().rooms) {
    const xs = room.pts.filter((_, i) => i % 2 === 0);
    const ys = room.pts.filter((_, i) => i % 2 !== 0);
    if (wx >= Math.min(...xs) && wx <= Math.max(...xs) &&
        wy >= Math.min(...ys) && wy <= Math.max(...ys)) {
      return room.label;
    }
  }
  return null;
}
