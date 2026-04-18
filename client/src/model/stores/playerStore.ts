import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  wx: number; // Welt-X in Tile-Einheiten
  wy: number; // Welt-Y in Tile-Einheiten
  name: string;
  currentRoom: string | null; // Raum-Label in dem sich der Spieler befindet
  // Actions
  setPosition: (wx: number, wy: number) => void;
  setName: (name: string) => void;
  setCurrentRoom: (room: string | null) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      wx: 60.0,
      wy: 45.0,
      name: '...',
      currentRoom: null,

      setPosition: (wx, wy) => set({ wx, wy }),
      setName: (name) => set({ name }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
    }),
    {
      name: 'vo_player',
      partialize: (s) => ({ name: s.name }), // nur Name persistieren
    },
  ),
);
