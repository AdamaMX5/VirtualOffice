import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      jwt: null,
      email: '',
      authStatus: 'disconnected',
      showModal: false, // wird nach Hydration neu gesetzt wenn kein JWT

      setJwt: (token, email) => set({ jwt: token, email, showModal: false }),
      setStatus: (authStatus) => set({ authStatus }),
      openModal: () => set({ showModal: true }),
      closeModal: () => set({ showModal: false }),
      clearAuth: () => set({ jwt: null, email: '', authStatus: 'disconnected', showModal: true }),
    }),
    {
      name: 'vo_auth',          // localStorage-Key
      partialize: (s) => ({ jwt: s.jwt, email: s.email }), // nur JWT + Email persistieren
      onRehydrateStorage: () => (state) => {
        // Modal nur öffnen wenn nach Hydration kein JWT vorhanden
        if (state && !state.jwt) state.showModal = true;
      },
    },
  ),
);
