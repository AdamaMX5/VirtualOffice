import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../model/stores/playerStore';
import { useCameraStore } from '../model/stores/cameraStore';
import { usePresenceStore } from '../model/stores/presenceStore';
import { useFollowStore } from '../model/stores/followStore';
import { MAP, WALK, SPRINT, SEND_INTERVAL, P } from '../model/constants';
import { getRoomAtPos } from '../model/stores/mapStore';
import { useKeyboard } from './useKeyboard';

// Module-level follow target (like presenceSend — settable from outside)
let _followUserId: string | null = null;

export function setFollowTarget(userId: string | null, name?: string) {
  _followUserId = userId;
  if (userId && name) useFollowStore.getState().startFollowing(userId, name);
  else if (!userId)   useFollowStore.getState().stopFollowing();
}

interface GameLoopOptions {
  /** Callback to send the current position via WebSocket */
  sendMove: (x: number, y: number) => void;
  stageWidth: number;
  stageHeight: number;
  /** When true, WASD and arrow keys are ignored (e.g. while the meeting view is open) */
  paused?: boolean;
}

export function useGameLoop({ sendMove, stageWidth, stageHeight, paused }: GameLoopOptions): {
  updateFromDrag: (wx: number, wy: number) => void;
} {
  const keys = useKeyboard();
  const setPosition    = usePlayerStore((s) => s.setPosition);
  const setCurrentRoom = usePlayerStore((s) => s.setCurrentRoom);
  const { setOffset, setFollow } = useCameraStore();

  // Stable refs for rAF closure (no stale-closure issue)
  const posRef      = useRef({ wx: 60.0, wy: 45.0 });
  const roomRef     = useRef<string | null>(null);
  const scaleRef    = useRef(1.5);
  const offsetRef   = useRef({ x: 0, y: 0 });
  const followRef   = useRef(true);
  const lastSentRef = useRef({ x: -999, y: -999 });
  const lastSendRef = useRef(0);

  const stageW = useRef(stageWidth);
  const stageH = useRef(stageHeight);
  stageW.current = stageWidth;
  stageH.current = stageHeight;

  // F key: toggle camera follow
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') {
        followRef.current = !followRef.current;
        setFollow(followRef.current);
        if (followRef.current) {
          const { wx, wy } = posRef.current;
          const newOffset = {
            x: stageW.current / 2 - wx * 32 * scaleRef.current,
            y: stageH.current / 2 - wy * 32 * scaleRef.current,
          };
          offsetRef.current = newOffset;
          setOffset(newOffset);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setFollow, setOffset]);

  // Center camera on player's start position on first mount
  useEffect(() => {
    const offset = {
      x: stageW.current / 2 - posRef.current.wx * P * scaleRef.current,
      y: stageH.current / 2 - posRef.current.wy * P * scaleRef.current,
    };
    offsetRef.current = offset;
    setOffset(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync scale/offset/follow from the store automatically (prevents stale closure on zoom)
  useEffect(() => {
    return useCameraStore.subscribe((state) => {
      scaleRef.current  = state.scale;
      offsetRef.current = state.offset;
      followRef.current = state.follow;
    });
  }, []);

  useEffect(() => {
    let lastT = performance.now();
    let rafId: number;

    const loop = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      const k = keys.current;
      if (!k || paused) { rafId = requestAnimationFrame(loop); return; }

      const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
      const spd = (sprint ? SPRINT : WALK) * dt;

      let dx = 0, dy = 0;
      if (k.has('KeyW') || k.has('ArrowUp'))    dy -= 1;
      if (k.has('KeyS') || k.has('ArrowDown'))  dy += 1;
      if (k.has('KeyA') || k.has('ArrowLeft'))  dx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;

      // Any movement key breaks follow mode
      if ((dx !== 0 || dy !== 0) && _followUserId) {
        _followUserId = null;
        useFollowStore.getState().stopFollowing();
      }

      if (dx !== 0 || dy !== 0) {
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
        const newWx = Math.max(0, Math.min(MAP.w, posRef.current.wx + dx * spd));
        const newWy = Math.max(0, Math.min(MAP.h, posRef.current.wy + dy * spd));
        posRef.current = { wx: newWx, wy: newWy };
        setPosition(newWx, newWy);

        // Room detection: only write to store on room change
        const newRoom = getRoomAtPos(newWx, newWy);
        if (newRoom !== roomRef.current) {
          roomRef.current = newRoom;
          setCurrentRoom(newRoom);
        }

        if (followRef.current) {
          const newOffset = {
            x: stageW.current / 2 - newWx * 32 * scaleRef.current,
            y: stageH.current / 2 - newWy * 32 * scaleRef.current,
          };
          offsetRef.current = newOffset;
          setOffset(newOffset);
        }

        // Throttled WebSocket send
        const now2 = performance.now();
        const ddx = Math.abs(newWx - lastSentRef.current.x);
        const ddy = Math.abs(newWy - lastSentRef.current.y);
        if (now2 - lastSendRef.current >= SEND_INTERVAL && (ddx >= 0.01 || ddy >= 0.01)) {
          sendMove(newWx, newWy);
          lastSentRef.current = { x: newWx, y: newWy };
          lastSendRef.current = now2;
        }
      } else if (_followUserId) {
        // ── Follow mode ───────────────────────────────────────────
        const target = usePresenceStore.getState().remoteUsers[_followUserId];
        if (!target) {
          _followUserId = null;
          useFollowStore.getState().stopFollowing();
        } else {
          const FOLLOW_DIST = 2.5; // distance in tiles
          const tdx = target.x - posRef.current.wx;
          const tdy = target.y - posRef.current.wy;
          const dist = Math.sqrt(tdx * tdx + tdy * tdy);
          if (dist > FOLLOW_DIST + 0.15) {
            const moveSpd = Math.min(spd, dist - FOLLOW_DIST);
            const ratio   = moveSpd / dist;
            const newWx   = Math.max(0, Math.min(MAP.w, posRef.current.wx + tdx * ratio));
            const newWy   = Math.max(0, Math.min(MAP.h, posRef.current.wy + tdy * ratio));
            posRef.current = { wx: newWx, wy: newWy };
            setPosition(newWx, newWy);

            const newRoom = getRoomAtPos(newWx, newWy);
            if (newRoom !== roomRef.current) { roomRef.current = newRoom; setCurrentRoom(newRoom); }

            // Always keep the camera focused on own avatar while following
            const newOffset = {
              x: stageW.current / 2 - newWx * 32 * scaleRef.current,
              y: stageH.current / 2 - newWy * 32 * scaleRef.current,
            };
            offsetRef.current = newOffset;
            setOffset(newOffset);

            const now3 = performance.now();
            const ddx2 = Math.abs(newWx - lastSentRef.current.x);
            const ddy2 = Math.abs(newWy - lastSentRef.current.y);
            if (now3 - lastSendRef.current >= SEND_INTERVAL && (ddx2 >= 0.01 || ddy2 >= 0.01)) {
              sendMove(newWx, newWy);
              lastSentRef.current = { x: newWx, y: newWy };
              lastSendRef.current = now3;
            }
          }
        }
      }

      // Numpad camera pan: 8=up, 2=down, 4=left, 6=right (works with and without Num Lock)
      const CAM = 5;
      if (k.has('Numpad8')) { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, y: offsetRef.current.y + CAM }; setOffset({ ...offsetRef.current }); }
      if (k.has('Numpad2')) { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, y: offsetRef.current.y - CAM }; setOffset({ ...offsetRef.current }); }
      if (k.has('Numpad4')) { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, x: offsetRef.current.x + CAM }; setOffset({ ...offsetRef.current }); }
      if (k.has('Numpad6')) { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, x: offsetRef.current.x - CAM }; setOffset({ ...offsetRef.current }); }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMove]);

  // ── Drag-to-Move: callable from outside (e.g. AvatarLayer) ───────────────
  const updateFromDrag = useCallback((wx: number, wy: number) => {
    const newWx = Math.max(0, Math.min(MAP.w, wx));
    const newWy = Math.max(0, Math.min(MAP.h, wy));
    posRef.current = { wx: newWx, wy: newWy };
    setPosition(newWx, newWy);

    const newRoom = getRoomAtPos(newWx, newWy);
    if (newRoom !== roomRef.current) {
      roomRef.current = newRoom;
      setCurrentRoom(newRoom);
    }

    if (followRef.current) {
      const newOffset = {
        x: stageW.current / 2 - newWx * 32 * scaleRef.current,
        y: stageH.current / 2 - newWy * 32 * scaleRef.current,
      };
      offsetRef.current = newOffset;
      setOffset(newOffset);
    }

    const now2 = performance.now();
    const ddx  = Math.abs(newWx - lastSentRef.current.x);
    const ddy  = Math.abs(newWy - lastSentRef.current.y);
    if (now2 - lastSendRef.current >= SEND_INTERVAL && (ddx >= 0.01 || ddy >= 0.01)) {
      sendMove(newWx, newWy);
      lastSentRef.current = { x: newWx, y: newWy };
      lastSendRef.current = now2;
    }
  }, [sendMove, setPosition, setCurrentRoom, setOffset]);

  return { updateFromDrag };
}

