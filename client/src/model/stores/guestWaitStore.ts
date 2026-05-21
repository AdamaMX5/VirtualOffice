import { create } from 'zustand';

interface TooEarlyInfo {
  guestName:       string;
  inviterName:     string;
  appointmentTime: number; // Unix-ms
}

interface GuestWaitState {
  tooEarlyInfo: TooEarlyInfo | null;
  setTooEarlyInfo: (info: TooEarlyInfo | null) => void;
}

export const useGuestWaitStore = create<GuestWaitState>((set) => ({
  tooEarlyInfo: null,
  setTooEarlyInfo: (info) => set({ tooEarlyInfo: info }),
}));
