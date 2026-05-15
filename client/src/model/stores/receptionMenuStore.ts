import { create } from 'zustand';

interface ReceptionMenuState {
  isOpen:  boolean;
  screenX: number;
  screenY: number;
  open:    (sx: number, sy: number) => void;
  close:   () => void;
}

export const useReceptionMenuStore = create<ReceptionMenuState>((set) => ({
  isOpen:  false,
  screenX: 0,
  screenY: 0,
  open:  (sx, sy) => set({ isOpen: true, screenX: sx, screenY: sy }),
  close: ()       => set({ isOpen: false }),
}));
