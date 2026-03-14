import { create } from 'zustand';

interface PlayerState {
  wx: number; // Welt-X in Tile-Einheiten
  wy: number; // Welt-Y in Tile-Einheiten
  name: string;
  // Actions
  setPosition: (wx: number, wy: number) => void;
  setName: (name: string) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  wx: 60.0,
  wy: 45.0,
  name: '...',

  setPosition: (wx, wy) => set({ wx, wy }),
  setName: (name) => set({ name }),
}));
