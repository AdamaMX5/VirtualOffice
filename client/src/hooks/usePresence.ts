import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { usePresenceStore } from '../model/stores/presenceStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { WS_PATH } from '../model/constants';
import type { WsInbound, WsOutbound } from '../model/types';

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

    setWsStatus('connecting');
    setStatus('connecting');

    const token = jwtRef.current;
    const wsUrl = token
      ? `${WS_PATH}?token=${token}`
      : WS_PATH;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
      setWsStatus('connected');

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
      }
    };

    ws.onclose = () => {
      if (intentional.current) return;
      setWsStatus('reconnecting');
      resetUsers();
      const delay = reconnectDelay.current;
      setReconnectDelay(delay);
      setStatus(`disconnected` as const);
      reconnectTimer.current = setTimeout(() => connect(), delay);
      reconnectDelay.current = Math.min(delay * 2, MAX_DELAY);
    };

    ws.onerror = () => console.warn('[WS] Verbindungsfehler');
  }, [setStatus, setWsStatus, applySnapshot, addOrUpdateUser, moveUser, removeUser, resetUsers, setReconnectDelay]);

  // Verbindung aufbauen / neu aufbauen wenn jwt oder name sich ändert
  useEffect(() => {
    // Nur verbinden wenn der User einen Namen hat
    if (!name || name === '...') return;

    // Alte Verbindung schließen
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      intentional.current = true;
      socketRef.current.close();
      intentional.current = false;
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
