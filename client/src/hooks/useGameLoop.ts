import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../model/stores/playerStore';
import { useCameraStore } from '../model/stores/cameraStore';
import { MAP, WALK, SPRINT, SEND_INTERVAL } from '../model/constants';
import { useKeyboard } from './useKeyboard';

interface GameLoopOptions {
  /** Callback zum Senden der aktuellen Position per WebSocket */
  sendMove: (x: number, y: number) => void;
  stageWidth: number;
  stageHeight: number;
}

export function useGameLoop({ sendMove, stageWidth, stageHeight }: GameLoopOptions) {
  const keys = useKeyboard();
  const setPosition = usePlayerStore((s) => s.setPosition);
  const { setOffset, setFollow } = useCameraStore();

  // Stabile Refs für rAF-Closure (kein Stale-Closure-Problem)
  const posRef      = useRef({ wx: 60.0, wy: 45.0 });
  const scaleRef    = useRef(1.5);
  const offsetRef   = useRef({ x: 0, y: 0 });
  const followRef   = useRef(true);
  const lastSentRef = useRef({ x: -999, y: -999 });
  const lastSendRef = useRef(0);

  const stageW = useRef(stageWidth);
  const stageH = useRef(stageHeight);
  stageW.current = stageWidth;
  stageH.current = stageHeight;

  // F-Taste: Follow-Toggle
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

  // Sync scale von außen (Zoom-Events)
  const syncScale  = (s: number) => { scaleRef.current = s; };
  const syncOffset = (o: { x: number; y: number }) => { offsetRef.current = o; };
  const syncFollow = (f: boolean) => { followRef.current = f; };

  useEffect(() => {
    let lastT = performance.now();
    let rafId: number;

    const loop = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      const k = keys.current;
      if (!k) { rafId = requestAnimationFrame(loop); return; }

      const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
      const spd = (sprint ? SPRINT : WALK) * dt;

      let dx = 0, dy = 0;
      if (k.has('KeyW')) dy -= 1;
      if (k.has('KeyS')) dy += 1;
      if (k.has('KeyA')) dx -= 1;
      if (k.has('KeyD')) dx += 1;

      if (dx !== 0 || dy !== 0) {
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
        const newWx = Math.max(0, Math.min(MAP.w, posRef.current.wx + dx * spd));
        const newWy = Math.max(0, Math.min(MAP.h, posRef.current.wy + dy * spd));
        posRef.current = { wx: newWx, wy: newWy };
        setPosition(newWx, newWy);

        if (followRef.current) {
          const newOffset = {
            x: stageW.current / 2 - newWx * 32 * scaleRef.current,
            y: stageH.current / 2 - newWy * 32 * scaleRef.current,
          };
          offsetRef.current = newOffset;
          setOffset(newOffset);
        }

        // Throttled WS-Send
        const now2 = performance.now();
        const ddx = Math.abs(newWx - lastSentRef.current.x);
        const ddy = Math.abs(newWy - lastSentRef.current.y);
        if (now2 - lastSendRef.current >= SEND_INTERVAL && (ddx >= 0.01 || ddy >= 0.01)) {
          sendMove(newWx, newWy);
          lastSentRef.current = { x: newWx, y: newWy };
          lastSendRef.current = now2;
        }
      }

      // Kamera-Pfeiltasten
      const CAM = 5;
      if (k.has('ArrowUp'))    { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, y: offsetRef.current.y + CAM }; setOffset({ ...offsetRef.current }); }
      if (k.has('ArrowDown'))  { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, y: offsetRef.current.y - CAM }; setOffset({ ...offsetRef.current }); }
      if (k.has('ArrowLeft'))  { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, x: offsetRef.current.x + CAM }; setOffset({ ...offsetRef.current }); }
      if (k.has('ArrowRight')) { followRef.current = false; setFollow(false); offsetRef.current = { ...offsetRef.current, x: offsetRef.current.x - CAM }; setOffset({ ...offsetRef.current }); }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMove]);

  return { syncScale, syncOffset, syncFollow };
}
