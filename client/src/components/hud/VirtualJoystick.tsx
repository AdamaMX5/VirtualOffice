import React, { useRef, useState, useCallback } from 'react';

const OUTER_R = 50; // radius of outer ring
const INNER_R = 22; // radius of knob

const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

function dispatch(code: string, type: 'keydown' | 'keyup') {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
}

const VirtualJoystick: React.FC = () => {
  const [knob, setKnob]  = useState({ x: 0, y: 0 });
  const activeRef  = useRef(new Set<string>());
  const tidRef     = useRef<number | null>(null);
  const centerRef  = useRef({ x: 0, y: 0 });
  const ringRef    = useRef<HTMLDivElement>(null);

  const releaseAll = useCallback(() => {
    activeRef.current.forEach((c) => dispatch(c, 'keyup'));
    activeRef.current.clear();
    setKnob({ x: 0, y: 0 });
  }, []);

  const applyDir = useCallback((rawDx: number, rawDy: number) => {
    const mag  = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const maxR = OUTER_R - INNER_R - 2;
    const clampedMag = Math.min(mag, maxR);
    const kx = mag > 0 ? (rawDx / mag) * clampedMag : 0;
    const ky = mag > 0 ? (rawDy / mag) * clampedMag : 0;
    setKnob({ x: kx, y: ky });

    const dead = OUTER_R * 0.2;
    const wanted = new Set<string>();
    if (mag > dead) {
      if (rawDy < -dead * 0.4) wanted.add('KeyW');
      if (rawDy >  dead * 0.4) wanted.add('KeyS');
      if (rawDx < -dead * 0.4) wanted.add('KeyA');
      if (rawDx >  dead * 0.4) wanted.add('KeyD');
      if (mag > OUTER_R * 0.75) wanted.add('ShiftLeft');
    }

    wanted.forEach((c) => {
      if (!activeRef.current.has(c)) { dispatch(c, 'keydown'); activeRef.current.add(c); }
    });
    activeRef.current.forEach((c) => {
      if (!wanted.has(c)) { dispatch(c, 'keyup'); activeRef.current.delete(c); }
    });
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (tidRef.current !== null) return;
    const t = e.changedTouches[0];
    tidRef.current = t.identifier;
    const rect = ringRef.current!.getBoundingClientRect();
    centerRef.current = { x: rect.left + OUTER_R, y: rect.top + OUTER_R };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = Array.from(e.touches).find((x) => x.identifier === tidRef.current);
    if (!t) return;
    applyDir(t.clientX - centerRef.current.x, t.clientY - centerRef.current.y);
  }, [applyDir]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!Array.from(e.changedTouches).find((x) => x.identifier === tidRef.current)) return;
    tidRef.current = null;
    releaseAll();
  }, [releaseAll]);

  if (!isTouchDevice) return null;

  return (
    <div
      ref={ringRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        position: 'fixed',
        bottom: 28,
        left: 28,
        width:  OUTER_R * 2,
        height: OUTER_R * 2,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.07)',
        border: '2px solid rgba(255,255,255,0.22)',
        zIndex: 300,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Cardinal direction hints */}
      {(['▲','▼','◀','▶'] as const).map((arrow, i) => {
        const positions = [
          { top: 4,  left: '50%', transform: 'translateX(-50%)' },
          { bottom: 4, left: '50%', transform: 'translateX(-50%)' },
          { left: 4, top: '50%', transform: 'translateY(-50%)' },
          { right: 4, top: '50%', transform: 'translateY(-50%)' },
        ];
        return (
          <div key={i} style={{
            position: 'absolute',
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            pointerEvents: 'none',
            lineHeight: 1,
            ...positions[i],
          }}>
            {arrow}
          </div>
        );
      })}
      {/* Knob */}
      <div style={{
        position: 'absolute',
        width:  INNER_R * 2,
        height: INNER_R * 2,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.28)',
        border: '2px solid rgba(255,255,255,0.5)',
        top:  OUTER_R - INNER_R + knob.y,
        left: OUTER_R - INNER_R + knob.x,
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }} />
    </div>
  );
};

export default VirtualJoystick;
