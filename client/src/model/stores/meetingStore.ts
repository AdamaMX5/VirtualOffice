import { create } from 'zustand';

interface MeetingState {
  bgUrl: string | null;
  bgObjectId: string | null;
  setBgUrl: (url: string | null) => void;
  setBgObjectId: (id: string | null) => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  bgUrl: null,
  bgObjectId: null,
  setBgUrl: (bgUrl) => set({ bgUrl }),
  setBgObjectId: (bgObjectId) => set({ bgObjectId }),
}));
