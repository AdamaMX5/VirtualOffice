import { create } from 'zustand';

export interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface MessageState {
  unreadTotal: number;
  /** Inbox-Nachrichten (empfangen) – Basis für die Konversationsliste */
  inboxMessages: Message[];
  /** Aktuell geöffnete Konversation (userId des Gegenübers) */
  activeUserId: string | null;
  /** Nachrichten der aktiven Konversation (beide Richtungen) */
  activeMessages: Message[];
  panelOpen: boolean;

  setUnreadTotal: (n: number) => void;
  setInboxMessages: (msgs: Message[]) => void;
  setActiveUserId: (id: string | null) => void;
  setActiveMessages: (msgs: Message[]) => void;
  addActiveMessage: (msg: Message) => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  unreadTotal:    0,
  inboxMessages:  [],
  activeUserId:   null,
  activeMessages: [],
  panelOpen:      false,

  setUnreadTotal:    (n)    => set({ unreadTotal: n }),
  setInboxMessages:  (msgs) => set({ inboxMessages: msgs }),
  setActiveUserId:   (id)   => set({ activeUserId: id }),
  setActiveMessages: (msgs) => set({ activeMessages: msgs }),
  addActiveMessage:  (msg)  => set((s) => ({ activeMessages: [...s.activeMessages, msg] })),
  openPanel:  () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false, activeUserId: null }),
  togglePanel: () => set((s) => ({
    panelOpen:    !s.panelOpen,
    activeUserId: s.panelOpen ? null : s.activeUserId,
  })),
}));
