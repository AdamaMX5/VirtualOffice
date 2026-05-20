import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../model/stores/authStore';
import { usePresenceStore } from '../model/stores/presenceStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useMessageStore } from '../model/stores/messageStore';
import { useMeetingStore } from '../model/stores/meetingStore';
import { useFollowStore } from '../model/stores/followStore';
import { useRoomLockStore } from '../model/stores/roomLockStore';
import { getUnreadCount } from '../services/messageClient';
import { dispatchProxEvent } from './useProximityCall';
import { WS_PATH } from '../model/constants';
import type { WsInbound, WsOutbound } from '../model/types';

function speakText(text: string) {
  try {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'de-DE';
    window.speechSynthesis.speak(utt);
  } catch { /* Browser ohne SpeechSynthesis */ }
}

function playRingSound() {
  try {
    const ctx = new AudioContext();
    const ring = (t: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880,  t);
      osc.frequency.setValueAtTime(1100, t + 0.12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
      gain.gain.linearRampToValueAtTime(0, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.28);
    };
    ring(ctx.currentTime);
    ring(ctx.currentTime + 0.38);
    ring(ctx.currentTime + 0.76);
  } catch { /* ignore — Browser blockt AudioContext vor User-Interaction */ }
}

function playChimeSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1047, t);       // C6
    osc.frequency.setValueAtTime(1319, t + 0.15); // E6
    osc.frequency.setValueAtTime(1568, t + 0.30); // G6
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
    gain.gain.linearRampToValueAtTime(0, t + 0.65);
    osc.start(t);
    osc.stop(t + 0.65);
  } catch { /* ignore */ }
}

// ── Modul-Level Send-Singleton (wie getRoom() in useLiveKit) ──────────────────
let _wsSend: ((msg: WsOutbound) => void) | null = null;

/** Sendet eine Nachricht über den Presence-WebSocket von überall im Code. */
export function presenceSend(msg: WsOutbound): void {
  if (_wsSend) {
    _wsSend(msg);
    if(msg.type == "proximity_enter"){
      console.info("Proxi Call sended: "+ msg);
    }
  } else {
    console.warn('[ProxCall] presenceSend fehlgeschlagen — _wsSend nicht gesetzt (keine WS-Verbindung?)', msg.type);
  }
}

const MAX_DELAY = 10_000;

// Einladungs-Token aus URL-Parametern (einmalig beim Laden ausgelesen)
const _inviteToken = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('invite')
  : null;

export function usePresence() {
  const { jwt, authStatus, email } = useAuthStore();
  const { setStatus } = useAuthStore();
  const { applySnapshot, addOrUpdateUser, moveUser, removeUser, setWsStatus, setReconnectDelay, resetUsers } = usePresenceStore();
  const name   = usePlayerStore((s) => s.name);
  const userId = useAuthStore((s) => s.userId);

  const socketRef       = useRef<WebSocket | null>(null);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay  = useRef(1000);
  const intentional     = useRef(false);
  const nameRef         = useRef(name);
  const jwtRef          = useRef(jwt);
  const userIdRef       = useRef(userId);
  const emailRef        = useRef(email);

  nameRef.current   = name;
  jwtRef.current    = jwt;
  userIdRef.current = userId;
  emailRef.current  = email;

  const connect = useCallback(() => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }

    intentional.current = false;
    setWsStatus('connecting');
    setStatus('connecting');

    const token  = jwtRef.current;
    const uid    = userIdRef.current;
    const invite = _inviteToken ? `&invite=${encodeURIComponent(_inviteToken)}` : '';
    const wsUrl  = token
      ? `${WS_PATH}?token=${token}${uid ? `&userId=${encodeURIComponent(uid)}` : ''}${invite}`
      : _inviteToken
      ? `${WS_PATH}?invite=${encodeURIComponent(_inviteToken)}`
      : WS_PATH;

    console.log('[WS] connect() aufgerufen → url:', wsUrl, '| name:', nameRef.current, '| jwt vorhanden:', !!token);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
      setWsStatus('connected');
      console.log('[WS] onopen — verbunden mit', wsUrl);

      if (!token) {
        ws.send(JSON.stringify({ type: 'set_name', name: nameRef.current }));
        setStatus('connected_guest');
      } else {
        const displayName = (nameRef.current && nameRef.current !== '...')
          ? nameRef.current
          : emailRef.current;
        ws.send(JSON.stringify({ type: 'set_name', name: displayName }));
        setStatus('connected_auth');
      }
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as WsInbound;
      if (data.type !== 'user_moved') {
        console.log('[WS in]', data.type, data.type === 'snapshot'
          ? `(${data.users.length} users: ${data.users.map(u => u.user_id).join(', ')})`
          : 'user_id' in data ? data.user_id : '');
      }
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
        case 'notify_user': {
          const myId = useAuthStore.getState().userId;
          if (data.targetUserId !== myId) break;
          if (data.callType === 'call') {
            playRingSound();
            const callerName = usePresenceStore.getState().remoteUsers[data.senderId]?.name ?? 'Jemand';
            useFollowStore.getState().setIncomingCall({ fromUserId: data.senderId, fromName: callerName });
            setTimeout(() => useFollowStore.getState().setIncomingCall(null), 8000);
          } else if (data.callType === 'appointment') {
            playChimeSound();
          } else if (data.callType === 'guest_joined') {
            const guestName = data.guestName;
            speakText(guestName ? `${guestName} ist beigetreten` : 'Ein Gast ist beigetreten');
          }
          break;
        }
        case 'chat': {
          const { setChatBubble, clearChatBubble } = usePresenceStore.getState();
          setChatBubble(data.userId, data.text);
          setTimeout(() => clearChatBubble(data.userId), 5000);
          break;
        }
        case 'proximity_call':
        case 'proximity_ended':
        case 'proximity_switch':
          console.log('[WS] proximity event empfangen:', data.type, data);
          dispatchProxEvent(data as unknown as Record<string, unknown>);
          break;
        case 'meeting_bg':
          useMeetingStore.getState().setBgUrl((data as { backgroundUrl: string | null }).backgroundUrl);
          break;
        case 'room_lock_update':
          useRoomLockStore.getState().setRoomLocked(data.room, data.locked, data.lockerId);
          break;
        case 'room_knock_request':
          useRoomLockStore.getState().addKnocker({ userId: data.userId, name: data.name, room: data.room });
          playChimeSound();
          break;
        case 'room_admitted':
          useRoomLockStore.getState().setAdmitted(true);
          break;
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
    const state = socketRef.current?.readyState;
    if (state !== WebSocket.OPEN) {
      console.warn('[WS] send BLOCKIERT — readyState:', state, 'msg:', (msg as unknown as Record<string, unknown>).type);
      return;
    }
    socketRef.current!.send(JSON.stringify(msg));
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
