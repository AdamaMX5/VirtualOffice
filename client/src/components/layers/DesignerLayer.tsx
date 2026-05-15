import React, { useEffect, useRef } from 'react';
import { Layer, Line, Circle, Text } from 'react-konva';
import type KonvaType from 'konva';
import { useDesignerStore, snapValue } from '../../model/stores/designerStore';
import { P, MAP } from '../../model/constants';

const GRID_MINOR  = 'rgba(99,179,237,0.07)';
const GRID_MAJOR  = 'rgba(99,179,237,0.20)';
const PATH_COL    = '#60a5fa';
const SPAWN_COL   = '#f59e0b';
const CLOSE_COL   = '#22c55e';
const PREVIEW_COL = 'rgba(96,165,250,0.5)';
const CLOSE_DIST  = 0.8;

interface Props { x: number; y: number; scaleX: number; scaleY: number; }

const DesignerLayer = React.memo(({ x, y, scaleX, scaleY }: Props) => {
  const {
    active, points, hoverPoint, snapMode,
    completedRooms, completedWalls,
  } = useDesignerStore();

  const layerRef = useRef<KonvaType.Layer>(null);

  // Refs so DOM event handlers always see the latest camera values
  const cx = useRef(x);  cx.current = x;
  const cy = useRef(y);  cy.current = y;
  const csx = useRef(scaleX);  csx.current = scaleX;
  const csy = useRef(scaleY);  csy.current = scaleY;

  useEffect(() => {
    if (!active || !layerRef.current) return;
    const stage = layerRef.current.getStage();
    if (!stage) return;
    const el = stage.container();

    let dragging = false; // suppress hover during right-click-drag

    const getSnap = (): [number, number] | null => {
      const pos = stage.getPointerPosition();
      if (!pos) return null;
      const mode = useDesignerStore.getState().snapMode;
      return [
        snapValue((pos.x - cx.current) / (csx.current * P), mode),
        snapValue((pos.y - cy.current) / (csy.current * P), mode),
      ];
    };

    const onMove  = () => { if (!dragging) { const p = getSnap(); useDesignerStore.getState().setHoverPoint(p); } };
    const onLeave = () => useDesignerStore.getState().setHoverPoint(null);
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const p = getSnap();
      if (p) useDesignerStore.getState().addPoint(p);
    };
    const onDown = (e: MouseEvent) => { if (e.button === 2) dragging = true; };
    const onUp   = (e: MouseEvent) => { if (e.button === 2) dragging = false; };

    const onKey = (e: KeyboardEvent) => {
      const s = useDesignerStore.getState();
      if      (e.key === 'Shift')   s.setSnapMode('decimeter');
      else if (e.key === 'Control') s.setSnapMode('centimeter');
      else if (e.key === 'Escape')  s.cancelPath();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control')
        useDesignerStore.getState().setSnapMode('meter');
    };

    el.addEventListener('mousemove',  onMove);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('click',      onClick);
    el.addEventListener('mousedown',  onDown);
    el.addEventListener('mouseup',    onUp);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup',   onKeyUp);

    return () => {
      el.removeEventListener('mousemove',  onMove);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('click',      onClick);
      el.removeEventListener('mousedown',  onDown);
      el.removeEventListener('mouseup',    onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [active]);

  if (!active) return null;

  // Visible tile range for grid (clamped to map bounds)
  const minTX = Math.max(0, Math.floor(-x / (scaleX * P)));
  const maxTX = Math.min(MAP.w, Math.ceil((window.innerWidth  - x) / (scaleX * P)) + 1);
  const minTY = Math.max(0, Math.floor(-y / (scaleY * P)));
  const maxTY = Math.min(MAP.h, Math.ceil((window.innerHeight - y) / (scaleY * P)) + 1);

  const spawn      = points.length > 0 ? points[0] : null;
  const nearSpawn  = !!(spawn && hoverPoint && points.length >= 2 &&
    Math.hypot(hoverPoint[0] - spawn[0], hoverPoint[1] - spawn[1]) < CLOSE_DIST);
  const previewTgt = nearSpawn && spawn ? spawn : hoverPoint;
  const lastPt     = points.length > 0 ? points[points.length - 1] : null;
  const dec        = snapMode === 'centimeter' ? 2 : snapMode === 'decimeter' ? 1 : 0;

  return (
    <Layer ref={layerRef} x={x} y={y} scaleX={scaleX} scaleY={scaleY} listening={false}>

      {/* ── Gitter ── */}
      {Array.from({ length: maxTX - minTX + 1 }, (_, i) => minTX + i).map((tx) => (
        <Line key={`vg${tx}`} listening={false}
          points={[tx * P, minTY * P, tx * P, maxTY * P]}
          stroke={tx % 5 === 0 ? GRID_MAJOR : GRID_MINOR}
          strokeWidth={1 / scaleX}
        />
      ))}
      {Array.from({ length: maxTY - minTY + 1 }, (_, i) => minTY + i).map((ty) => (
        <Line key={`hg${ty}`} listening={false}
          points={[minTX * P, ty * P, maxTX * P, ty * P]}
          stroke={ty % 5 === 0 ? GRID_MAJOR : GRID_MINOR}
          strokeWidth={1 / scaleY}
        />
      ))}

      {/* ── Abgeschlossene Räume ── */}
      {completedRooms.map((room, i) => (
        <Line key={`cr${i}`} listening={false}
          points={room.pts.map(v => v * P)} closed fill={room.fill} stroke="transparent"
        />
      ))}

      {/* ── Abgeschlossene Wände ── */}
      {completedWalls.map((w, i) => (
        <Line key={`cw${i}`} listening={false}
          points={[w.f[0] * P, w.f[1] * P, w.t[0] * P, w.t[1] * P]}
          stroke="#0d0d0d" strokeWidth={6 / scaleX}
        />
      ))}

      {/* ── Aktueller Pfad ── */}
      {points.length >= 2 && (
        <Line listening={false}
          points={points.flatMap(([tx, ty]) => [tx * P, ty * P])}
          stroke={PATH_COL} strokeWidth={3 / scaleX}
        />
      )}

      {/* ── Vorschau-Linie (letzter Punkt → Hover) ── */}
      {lastPt && previewTgt && (
        <Line listening={false}
          points={[lastPt[0] * P, lastPt[1] * P, previewTgt[0] * P, previewTgt[1] * P]}
          stroke={nearSpawn ? CLOSE_COL : PREVIEW_COL}
          strokeWidth={2 / scaleX}
          dash={[8 / scaleX, 4 / scaleX]}
        />
      )}

      {/* ── Gesetzte Punkte ── */}
      {points.map(([tx, ty], i) => (
        <Circle key={`pp${i}`} listening={false}
          x={tx * P} y={ty * P}
          radius={(i === 0 ? 9 : 5) / scaleX}
          fill={i === 0 ? (nearSpawn ? CLOSE_COL : SPAWN_COL) : PATH_COL}
          stroke={i === 0 ? 'rgba(255,255,255,0.4)' : 'transparent'}
          strokeWidth={2 / scaleX}
        />
      ))}

      {/* ── Snap-Indikator (Hover) ── */}
      {hoverPoint && !nearSpawn && (
        <Circle listening={false}
          x={hoverPoint[0] * P} y={hoverPoint[1] * P}
          radius={4 / scaleX}
          fill="rgba(96,165,250,0.35)" stroke={PATH_COL} strokeWidth={1.5 / scaleX}
        />
      )}

      {/* ── Koordinaten-Label ── */}
      {hoverPoint && (
        <Text listening={false}
          x={hoverPoint[0] * P + 10 / scaleX}
          y={hoverPoint[1] * P - 18 / scaleY}
          text={`${hoverPoint[0].toFixed(dec)}m, ${hoverPoint[1].toFixed(dec)}m`}
          fontSize={11 / scaleX} fill={PATH_COL}
        />
      )}

      {/* ── "Raum schließen" Hinweis ── */}
      {nearSpawn && spawn && (
        <Text listening={false}
          x={spawn[0] * P + 10 / scaleX}
          y={spawn[1] * P - 22 / scaleY}
          text="Raum schließen ↵"
          fontSize={11 / scaleX} fill={CLOSE_COL}
        />
      )}

    </Layer>
  );
});

DesignerLayer.displayName = 'DesignerLayer';
export default DesignerLayer;
