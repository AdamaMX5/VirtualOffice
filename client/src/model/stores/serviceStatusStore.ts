import { create } from 'zustand';

interface ServiceStatusState {
  isOpen: boolean;
  open:  () => void;
  close: () => void;
}

export const useServiceStatusStore = create<ServiceStatusState>((set) => ({
  isOpen: false,
  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
