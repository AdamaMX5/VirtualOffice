import { create } from 'zustand';
import type { Room, Wall } from '../types';

export type SnapMode = 'meter' | 'decimeter' | 'centimeter';

const CLOSE_DIST = 0.8; // Tiles — Nähe zum Startpunkt um Raum zu schließen

interface DesignerState {
  active:         boolean;
  points:         [number, number][];
  hoverPoint:     [number, number] | null;
  snapMode:       SnapMode;
  pendingRoom:    { pts: number[] } | null; // wartet auf Name + Farbe
  completedRooms: Room[];
  completedWalls: Wall[];
  savedId:        string | null;

  toggle:             () => void;
  setHoverPoint:      (p: [number, number] | null) => void;
  setSnapMode:        (m: SnapMode) => void;
  addPoint:           (p: [number, number]) => void;
  cancelPath:         () => void;
  confirmRoom:        (label: string, fill: string) => void;
  discardPendingRoom: () => void;
  deleteRoom:         (index: number) => void;
  clearAll:           () => void;
  setSavedId:         (id: string) => void;
}

function coordsToWalls(coords: [number, number][]): Wall[] {
  return coords.map((f, i) => ({
    f,
    t: coords[(i + 1) % coords.length],
    type: 'wall' as const,
  }));
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  active:         false,
  points:         [],
  hoverPoint:     null,
  snapMode:       'meter',
  pendingRoom:    null,
  completedRooms: [],
  completedWalls: [],
  savedId:        null,

  toggle: () => set((s) => ({ active: !s.active, points: [], hoverPoint: null })),

  setHoverPoint: (p) => set({ hoverPoint: p }),

  setSnapMode: (m) => set({ snapMode: m }),

  addPoint: (p) => {
    const { points } = get();
    // Schließt den Raum wenn >= 3 Punkte und Klick nahe am Startpunkt
    if (points.length >= 2) {
      const [sx, sy] = points[0];
      if (Math.hypot(p[0] - sx, p[1] - sy) < CLOSE_DIST) {
        set({ pendingRoom: { pts: points.flatMap(([x, y]) => [x, y]) }, points: [] });
        return;
      }
    }
    set((s) => ({ points: [...s.points, p] }));
  },

  cancelPath: () => set({ points: [], hoverPoint: null }),

  confirmRoom: (label, fill) => {
    const { pendingRoom } = get();
    if (!pendingRoom) return;
    const coords: [number, number][] = [];
    for (let i = 0; i < pendingRoom.pts.length; i += 2) {
      coords.push([pendingRoom.pts[i], pendingRoom.pts[i + 1]]);
    }
    set((s) => ({
      completedRooms: [...s.completedRooms, { label, fill, pts: pendingRoom.pts }],
      completedWalls: [...s.completedWalls, ...coordsToWalls(coords)],
      pendingRoom: null,
    }));
  },

  discardPendingRoom: () => set({ pendingRoom: null }),

  deleteRoom: (index) => {
    const { completedRooms, completedWalls } = get();
    const room = completedRooms[index];
    if (!room) return;
    const coords: [number, number][] = [];
    for (let i = 0; i < room.pts.length; i += 2) coords.push([room.pts[i], room.pts[i + 1]]);
    const roomWallKeys = new Set(
      coords.map((f, i) => {
        const t = coords[(i + 1) % coords.length];
        return `${f[0]},${f[1]}-${t[0]},${t[1]}`;
      })
    );
    set({
      completedRooms: completedRooms.filter((_, i) => i !== index),
      completedWalls: completedWalls.filter(
        (w) => !roomWallKeys.has(`${w.f[0]},${w.f[1]}-${w.t[0]},${w.t[1]}`)
      ),
    });
  },

  clearAll: () => set({ points: [], completedRooms: [], completedWalls: [], pendingRoom: null }),

  setSavedId: (id) => set({ savedId: id }),
}));

export function snapValue(v: number, mode: SnapMode): number {
  if (mode === 'meter')     return Math.round(v);
  if (mode === 'decimeter') return Math.round(v * 10) / 10;
  return Math.round(v * 100) / 100;
}
