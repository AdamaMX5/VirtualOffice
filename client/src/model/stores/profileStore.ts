import { create } from 'zustand';

interface ProfileState {
  isOpen: boolean;
  avatarUrl: string | null;
  open: () => void;
  close: () => void;
  setAvatarUrl: (url: string | null) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  isOpen: false,
  avatarUrl: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setAvatarUrl: (avatarUrl) => set({ avatarUrl }),
}));
