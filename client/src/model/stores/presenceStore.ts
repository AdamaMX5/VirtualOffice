import { create } from 'zustand';
import type { RemoteUser, RemoteUsersMap } from '../types';

type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface PresenceState {
  remoteUsers: RemoteUsersMap;
  wsStatus: WsStatus;
  reconnectDelay: number; // ms
  // Actions
  applySnapshot: (users: RemoteUser[]) => void;
  addOrUpdateUser: (user: RemoteUser) => void;
  moveUser: (user_id: string, x: number, y: number) => void;
  removeUser: (user_id: string) => void;
  setWsStatus: (status: WsStatus) => void;
  setReconnectDelay: (delay: number) => void;
  resetUsers: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  remoteUsers: {},
  wsStatus: 'disconnected',
  reconnectDelay: 1000,

  applySnapshot: (users) =>
    set({
      remoteUsers: Object.fromEntries(users.map((u) => [u.user_id, u])),
    }),

  addOrUpdateUser: (user) =>
    set((state) => ({
      remoteUsers: { ...state.remoteUsers, [user.user_id]: user },
    })),

  moveUser: (user_id, x, y) =>
    set((state) => {
      const existing = state.remoteUsers[user_id];
      if (!existing) return state;
      return {
        remoteUsers: {
          ...state.remoteUsers,
          [user_id]: { ...existing, x, y },
        },
      };
    }),

  removeUser: (user_id) =>
    set((state) => {
      const next = { ...state.remoteUsers };
      delete next[user_id];
      return { remoteUsers: next };
    }),

  setWsStatus: (wsStatus) => set({ wsStatus }),
  setReconnectDelay: (reconnectDelay) => set({ reconnectDelay }),
  resetUsers: () => set({ remoteUsers: {} }),
}));
