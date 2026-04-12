import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { usePresenceStore } from '../model/stores/presenceStore';
import { useMessageStore } from '../model/stores/messageStore';
import { presenceSend } from './usePresence';
import {
  getUnreadCount, getInbox, getConversation,
  sendMessage as apiSendMessage, markAllRead,
} from '../services/messageClient';

const POLL_INTERVAL_MS = 30_000;

export function useMessaging() {
  const jwt    = useAuthStore((s) => s.jwt);
  const isAuth = jwt !== null;
  const store      = useMessageStore();

  // ── 30s Polling des Unread-Count ─────────────────────────────────────────
  useEffect(() => {
    if (!isAuth) return;

    const fetchCount = () =>
      getUnreadCount()
        .then((n) => store.setUnreadTotal(n))
        .catch(() => {});

    fetchCount(); // sofort beim Einloggen
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuth]);

  // ── Inbox laden wenn Panel geöffnet wird ─────────────────────────────────
  const loadInbox = useCallback(async () => {
    if (!isAuth) return;
    try {
      const msgs = await getInbox();
      store.setInboxMessages(msgs);
    } catch (err) {
      console.error('[messaging] Inbox laden:', err);
    }
  }, [isAuth]);

  // ── Konversation öffnen ───────────────────────────────────────────────────
  const openConversation = useCallback(async (userId: string) => {
    store.setActiveUserId(userId);
    store.setActiveMessages([]);
    try {
      const msgs = await getConversation(userId);
      store.setActiveMessages(msgs);
      // Alle Nachrichten dieses Senders als gelesen markieren
      await markAllRead(userId).catch(() => {});
      // Unread-Count aktualisieren
      const n = await getUnreadCount().catch(() => store.unreadTotal);
      store.setUnreadTotal(n);
    } catch (err) {
      console.error('[messaging] Konversation laden:', err);
    }
  }, []);

  // ── Nachricht senden ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async (recipientId: string, body: string): Promise<boolean> => {
    try {
      const msg = await apiSendMessage(recipientId, body);
      // Optimistisch zur aktiven Konversation hinzufügen
      if (store.activeUserId === recipientId) {
        store.addActiveMessage(msg);
      }
      // Empfänger über PresenceService benachrichtigen, wenn er online ist
      const onlineUsers = usePresenceStore.getState().remoteUsers;
      if (onlineUsers[recipientId]) {
        presenceSend({ type: 'notify_user', targetUserId: recipientId });
      }
      return true;
    } catch (err) {
      console.error('[messaging] Senden fehlgeschlagen:', err);
      return false;
    }
  }, [store.activeUserId]);

  return { loadInbox, openConversation, sendMessage };
}
