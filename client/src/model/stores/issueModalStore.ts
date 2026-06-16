import { create } from 'zustand';

interface IssueModalState {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
}

export const useIssueModalStore = create<IssueModalState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
}));
