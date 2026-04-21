import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthStatus } from '../types';

interface AuthState {
  jwt: string | null;
  email: string;
  userId: string;
  authStatus: AuthStatus;
  showModal: boolean;
  // Actions
  setJwt: (token: string, email: string, userId?: string) => void;
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
      userId: '',
      authStatus: 'disconnected',
      showModal: false, // wird nach Hydration neu gesetzt wenn kein JWT

      setJwt: (token, email, userId = '') => set({ jwt: token, email, userId, showModal: false }),
      setStatus: (authStatus) => set({ authStatus }),
      openModal: () => set({ showModal: true }),
      closeModal: () => set({ showModal: false }),
      clearAuth: () => set({ jwt: null, email: '', userId: '', authStatus: 'disconnected', showModal: true }),
    }),
    {
      name: 'vo_auth',          // localStorage-Key
      partialize: (s) => ({ jwt: s.jwt, email: s.email, userId: s.userId }),
      onRehydrateStorage: () => (rehydrated) => {
        console.log('[Auth] Hydration abgeschlossen — jwt vorhanden:', !!(rehydrated?.jwt), '| email:', rehydrated?.email);
        // Modal nur öffnen wenn nach Hydration kein JWT vorhanden.
        // setState() aufrufen statt direkte Mutation, damit React-Subscriptions
        // benachrichtigt werden und ein Re-Render stattfindet.
        if (rehydrated && !rehydrated.jwt) {
          rehydrated.openModal();
        }
      },
    },
  ),
);
