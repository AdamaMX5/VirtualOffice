import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  wx: number; // Welt-X in Tile-Einheiten
  wy: number; // Welt-Y in Tile-Einheiten
  name: string;
  department: string;
  title: string;
  currentRoom: string | null; // Raum-Label in dem sich der Spieler befindet
  // Actions
  setPosition: (wx: number, wy: number) => void;
  setName: (name: string) => void;
  setDepartment: (department: string) => void;
  setTitle: (title: string) => void;
  setCurrentRoom: (room: string | null) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      wx: 60.0,
      wy: 45.0,
      name: '...',
      department: '',
      title: '',
      currentRoom: null,

      setPosition: (wx, wy) => set({ wx, wy }),
      setName: (name) => set({ name }),
      setDepartment: (department) => set({ department }),
      setTitle: (title) => set({ title }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
    }),
    {
      name: 'vo_player',
      partialize: (s) => ({ name: s.name, department: s.department, title: s.title }),
      onRehydrateStorage: () => (rehydrated) => {
        console.log('[Player] Hydration abgeschlossen — name:', JSON.stringify(rehydrated?.name));
      },
    },
  ),
);
