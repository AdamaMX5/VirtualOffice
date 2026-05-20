import { create } from 'zustand';

export interface KnockerEntry {
  userId: string;
  name:   string;
  room:   string;
}

interface RoomLockState {
  lockedRooms: Record<string, string>; // room → lockOwnerUserId
  knockers:    KnockerEntry[];
  admitted:    boolean;

  setRoomLocked:  (room: string, locked: boolean, lockerId?: string) => void;
  addKnocker:     (entry: KnockerEntry) => void;
  removeKnocker:  (userId: string, room: string) => void;
  setAdmitted:    (admitted: boolean) => void;
  isLocked:       (room: string) => boolean;
  getLockOwner:   (room: string) => string | undefined;
}

export const useRoomLockStore = create<RoomLockState>((set, get) => ({
  lockedRooms: {},
  knockers:    [],
  admitted:    false,

  setRoomLocked: (room, locked, lockerId) =>
    set((s) => {
      const next = { ...s.lockedRooms };
      if (locked && lockerId) next[room] = lockerId;
      else delete next[room];
      return { lockedRooms: next };
    }),

  addKnocker: (entry) =>
    set((s) => ({
      knockers: s.knockers.some((k) => k.userId === entry.userId && k.room === entry.room)
        ? s.knockers
        : [...s.knockers, entry],
    })),

  removeKnocker: (userId, room) =>
    set((s) => ({
      knockers: s.knockers.filter((k) => !(k.userId === userId && k.room === room)),
    })),

  setAdmitted: (admitted) => set({ admitted }),
  isLocked:     (room) => room in get().lockedRooms,
  getLockOwner: (room) => get().lockedRooms[room],
}));
