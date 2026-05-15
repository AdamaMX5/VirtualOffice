import { create } from 'zustand';

interface ContextMenuState {
  isOpen: boolean;
  targetUserId: string;
  targetName: string;
  screenX: number;
  screenY: number;
  open: (userId: string, name: string, sx: number, sy: number) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  targetUserId: '',
  targetName: '',
  screenX: 0,
  screenY: 0,
  open: (targetUserId, targetName, screenX, screenY) =>
    set({ isOpen: true, targetUserId, targetName, screenX, screenY }),
  close: () => set({ isOpen: false }),
}));
