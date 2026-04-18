import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { usePresenceStore } from '../model/stores/presenceStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useMessageStore } from '../model/stores/messageStore';
import { getUnreadCount } from '../services/messageClient';
import { WS_PATH } from '../model/constants';
import type { WsInbound, WsOutbound } from '../model/types';

// ── Modul-Level Send-Singleton (wie getRoom() in useLiveKit) ──────────────────
let _wsSend: ((msg: WsOutbound) => void) | null = null;

/** Sendet eine Nachricht über den Presence-WebSocket von überall im Code. */
export function presenceSend(msg: WsOutbound): void {
  _wsSend?.(msg);
}

const MAX_DELAY = 10_000;

export function usePresence() {
  const { jwt, authStatus } = useAuthStore();
  const { setStatus } = useAuthStore();
  const { applySnapshot, addOrUpdateUser, moveUser, removeUser, setWsStatus, setReconnectDelay, resetUsers } = usePresenceStore();
  const name = usePlayerStore((s) => s.name);

  const socketRef       = useRef<WebSocket | null>(null);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay  = useRef(1000);
  const intentional     = useRef(false);
  const nameRef         = useRef(name);
  const jwtRef          = useRef(jwt);

  nameRef.current = name;
  jwtRef.current  = jwt;

  const connect = useCallback(() => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }

    intentional.current = false;    // new connection is not closed correctly
    setWsStatus('connecting');
    setStatus('connecting');

    const token = jwtRef.current;
    const wsUrl = token
      ? `${WS_PATH}?token=${token}`
      : WS_PATH;

    console.log('[WS] connect() aufgerufen → url:', wsUrl, '| name:', nameRef.current, '| jwt vorhanden:', !!token);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
      setWsStatus('connected');
      console.log('[WS] onopen — verbunden mit', wsUrl);

      if (!token) {
        // Gast: Namen senden
        ws.send(JSON.stringify({ type: 'set_name', name: nameRef.current }));
        setStatus('connected_guest');
      } else {
        setStatus('connected_auth');
      }
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as WsInbound;
      console.log('[WS in]', data.type, data.type === 'snapshot'
        ? `(${data.users.length} users: ${data.users.map(u => u.user_id).join(', ')})`
        : 'user_id' in data ? data.user_id : '');
      switch (data.type) {
        case 'snapshot':
          applySnapshot(data.users);
          break;
        case 'user_joined':
          addOrUpdateUser({
            user_id:    data.user_id,
            name:       data.name,
            department: data.department,
            x:          data.x,
            y:          data.y,
          });
          break;
        case 'user_moved':
          moveUser(data.user_id, data.x, data.y);
          break;
        case 'user_left':
          removeUser(data.user_id);
          break;
        case 'new_message':
          // Sofort Unread-Count neu laden (kein Polling-Delay)
          getUnreadCount()
            .then((n) => useMessageStore.getState().setUnreadTotal(n))
            .catch(() => {});
          break;
        case 'chat': {
          const { setChatBubble, clearChatBubble } = usePresenceStore.getState();
          setChatBubble(data.userId, data.text);
          setTimeout(() => clearChatBubble(data.userId), 5000);
          break;
        }
      }
    };

    ws.onclose = (ev) => {
      console.log('[WS] closed — code:', ev.code, 'reason:', ev.reason, 'intentional:', intentional.current);
      // Ignorieren wenn dieser Socket bereits durch einen neueren ersetzt wurde
      if (socketRef.current !== ws) return;
      if (intentional.current) return;
      setWsStatus('reconnecting');
      resetUsers();
      const delay = reconnectDelay.current;
      setReconnectDelay(delay);
      setStatus(`disconnected` as const);
      reconnectTimer.current = setTimeout(() => connect(), delay);
      reconnectDelay.current = Math.min(delay * 2, MAX_DELAY);
    };

    ws.onerror = (ev) => console.warn('[WS] onerror — readyState:', ws.readyState, ev);
  }, [setStatus, setWsStatus, applySnapshot, addOrUpdateUser, moveUser, removeUser, resetUsers, setReconnectDelay]);

  // Verbindung aufbauen / neu aufbauen wenn jwt oder name sich ändert
  useEffect(() => {
    console.log('[WS] useEffect ausgelöst — name:', JSON.stringify(name), '| jwt vorhanden:', !!jwt);
    // Gäste ohne Namen blockieren; Auth-User verbinden immer (Name kommt vom JWT)
    if (!jwt && (!name || name === '...')) {
      console.log('[WS] Verbindung blockiert — Gast ohne Namen');
      return;
    }

    // Alte Verbindung schließen — socketRef wird gleich überschrieben,
    // onclose ignoriert den alten Socket wegen socketRef.current !== ws
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
    }

    connect();

    return () => {
      intentional.current = true;
      socketRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt, name]);

  /** Sendet eine Nachricht, falls die Verbindung offen ist */
  const send = useCallback((msg: WsOutbound) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Singleton registrieren
  _wsSend = send;

  const sendMove = useCallback((x: number, y: number) => {
    send({ type: 'move', x, y });
  }, [send]);

  const sendRefreshToken = useCallback((token: string) => {
    send({ type: 'refresh_token', token });
  }, [send]);

  // Ignoriere authStatus Warnung — wird nur für den Status-Badge benutzt
  void authStatus;

  return { sendMove, sendRefreshToken };
}
