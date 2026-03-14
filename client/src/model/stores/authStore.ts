import { create } from 'zustand';
import type { AuthStatus } from '../types';

interface AuthState {
  jwt: string | null;
  email: string;
  authStatus: AuthStatus;
  showModal: boolean;
  // Actions
  setJwt: (token: string, email: string) => void;
  setStatus: (status: AuthStatus) => void;
  openModal: () => void;
  closeModal: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  jwt: null,
  email: '',
  authStatus: 'disconnected',
  showModal: true,

  setJwt: (token, email) => set({ jwt: token, email: email || undefined as unknown as string }),
  setStatus: (authStatus) => set({ authStatus }),
  openModal: () => set({ showModal: true }),
  closeModal: () => set({ showModal: false }),
  clearAuth: () => set({ jwt: null, email: '', authStatus: 'disconnected', showModal: true }),
}));
