import { create } from 'zustand';

export interface DeskNote {
  id: string;
  deskId: string;
  text: string;
  x: number;        // 0–1 relativ zur Tischfläche (links)
  y: number;        // 0–1 relativ zur Tischfläche (oben)
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface DeskState {
  openDeskId: string | null;
  openDeskOwnerId: string;
  openDeskOwnerName: string;
  notes: DeskNote[];
  readingNote: DeskNote | null;

  openDesk: (deskId: string, ownerId: string, ownerName: string) => void;
  closeDesk: () => void;
  setNotes: (notes: DeskNote[]) => void;
  addNote: (note: DeskNote) => void;
  updateNote: (id: string, patch: Partial<DeskNote>) => void;
  removeNote: (id: string) => void;
  setReadingNote: (note: DeskNote | null) => void;
}

export const useDeskStore = create<DeskState>((set) => ({
  openDeskId: null,
  openDeskOwnerId: '',
  openDeskOwnerName: '',
  notes: [],
  readingNote: null,

  openDesk: (deskId, ownerId, ownerName) =>
    set({ openDeskId: deskId, openDeskOwnerId: ownerId, openDeskOwnerName: ownerName, notes: [], readingNote: null }),
  closeDesk: () =>
    set({ openDeskId: null, openDeskOwnerId: '', openDeskOwnerName: '', notes: [], readingNote: null }),

  setNotes:   (notes)      => set({ notes }),
  addNote:    (note)       => set((s) => ({ notes: [...s.notes, note] })),
  updateNote: (id, patch)  => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
  removeNote: (id)         => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
  setReadingNote: (note)   => set({ readingNote: note }),
}));
