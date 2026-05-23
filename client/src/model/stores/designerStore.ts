import { create } from 'zustand';
import type { Room, Wall } from '../types';
import { ROOMS as DEFAULT_ROOMS, WALLS as DEFAULT_WALLS } from '../mapData';
import { useMapStore } from './mapStore';

export type SnapMode     = 'meter' | 'decimeter' | 'centimeter';
export type DesignerMode = 'draw' | 'door';

const CLOSE_DIST = 0.8;

const eq = (a: number, b: number) => Math.abs(a - b) < 0.001;

interface DesignerState {
  active:            boolean;
  designerMode:      DesignerMode;
  points:            [number, number][];
  hoverPoint:        [number, number] | null;
  hoveredExistingPt: [number, number] | null;
  snapMode:          SnapMode;
  pendingRoom:       { pts: number[] } | null;
  completedRooms:    Room[];
  completedWalls:    Wall[];
  spawnPoint:        [number, number];
  savedId:           string | null;

  toggle:               () => void;
  setDesignerMode:      (m: DesignerMode) => void;
  setHoverPoint:        (p: [number, number] | null) => void;
  setHoveredExistingPt: (p: [number, number] | null) => void;
  setSnapMode:          (m: SnapMode) => void;
  addPoint:             (p: [number, number]) => void;
  cancelPath:           () => void;
  confirmRoom:          (label: string, fill: string) => void;
  discardPendingRoom:   () => void;
  deleteRoom:           (index: number) => void;
  renameRoom:           (index: number, label: string, fill: string) => void;
  clearAll:             () => void;
  setSavedId:           (id: string) => void;
  setSpawnPoint:        (p: [number, number]) => void;
  movePoint:            (ox: number, oy: number, nx: number, ny: number) => void;
  addDoor:              (f: [number, number], t: [number, number]) => void;
  loadDefault:          () => void;
  loadFromMap:          () => void;
  importData:           (rooms: Room[], walls: Wall[], spawnPoint?: [number, number]) => void;
}

function coordsToWalls(coords: [number, number][]): Wall[] {
  return coords.map((f, i) => ({
    f,
    t: coords[(i + 1) % coords.length],
    type: 'wall' as const,
  }));
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  active:            false,
  designerMode:      'draw',
  points:            [],
  hoverPoint:        null,
  hoveredExistingPt: null,
  snapMode:          'meter',
  pendingRoom:       null,
  completedRooms:    [],
  completedWalls:    [],
  spawnPoint:        [60, 55],
  savedId:           null,

  toggle: () => set((s) => ({ active: !s.active, points: [], hoverPoint: null, hoveredExistingPt: null })),

  setDesignerMode: (m) => set({ designerMode: m, points: [] }),

  setHoverPoint: (p) => set({ hoverPoint: p }),

  setHoveredExistingPt: (p) => set({ hoveredExistingPt: p }),

  setSnapMode: (m) => set({ snapMode: m }),

  addPoint: (p) => {
    const { points, designerMode } = get();

    if (designerMode === 'door') {
      if (points.length === 0) {
        set({ points: [p] });
      } else {
        get().addDoor(points[0], p);
        set({ points: [] });
      }
      return;
    }

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

  renameRoom: (index, label, fill) =>
    set((s) => ({
      completedRooms: s.completedRooms.map((r, i) =>
        i === index ? { ...r, label, fill } : r
      ),
    })),

  clearAll: () => set({ points: [], completedRooms: [], completedWalls: [], pendingRoom: null }),

  setSavedId: (id) => set({ savedId: id }),

  setSpawnPoint: (p) => set({ spawnPoint: p }),

  movePoint: (ox, oy, nx, ny) => set((s) => ({
    completedRooms: s.completedRooms.map((room) => {
      const newPts = [...room.pts];
      let changed = false;
      for (let i = 0; i < newPts.length; i += 2) {
        if (eq(newPts[i], ox) && eq(newPts[i + 1], oy)) {
          newPts[i] = nx; newPts[i + 1] = ny; changed = true;
        }
      }
      return changed ? { ...room, pts: newPts } : room;
    }),
    completedWalls: s.completedWalls.map((w) => ({
      ...w,
      f: eq(w.f[0], ox) && eq(w.f[1], oy) ? [nx, ny] as [number, number] : w.f,
      t: eq(w.t[0], ox) && eq(w.t[1], oy) ? [nx, ny] as [number, number] : w.t,
    })),
  })),

  addDoor: (f, t) => set((s) => ({
    completedWalls: [...s.completedWalls, { f, t, type: 'door' as const }],
  })),

  loadDefault: () => set({
    completedRooms: DEFAULT_ROOMS.map((r) => ({ ...r, pts: [...r.pts] })),
    completedWalls: DEFAULT_WALLS.map((w) => ({ ...w })),
    spawnPoint:     [60, 55],
    points:         [],
    pendingRoom:    null,
  }),

  loadFromMap: () => {
    const { rooms, walls, spawnPoint } = useMapStore.getState();
    if (rooms.length > 0) {
      set({
        completedRooms: rooms.map((r) => ({ ...r, pts: [...r.pts] })),
        completedWalls: walls.map((w) => ({ ...w })),
        spawnPoint,
        points:         [],
        pendingRoom:    null,
      });
    }
  },

  importData: (rooms, walls, spawnPoint) =>
    set((s) => ({
      completedRooms: rooms.map((r) => ({ ...r, pts: [...r.pts] })),
      completedWalls: walls.map((w) => ({ ...w })),
      spawnPoint:     spawnPoint ?? s.spawnPoint,
      points:         [],
      pendingRoom:    null,
    })),
}));

export function snapValue(v: number, mode: SnapMode): number {
  if (mode === 'meter')     return Math.round(v);
  if (mode === 'decimeter') return Math.round(v * 10) / 10;
  return Math.round(v * 100) / 100;
}
