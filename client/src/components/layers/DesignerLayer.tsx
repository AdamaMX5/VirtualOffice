import React, { useEffect, useRef } from 'react';
import { Layer, Line, Circle, Text } from 'react-konva';
import type KonvaType from 'konva';
import { useDesignerStore, snapValue } from '../../model/stores/designerStore';
import { P, MAP } from '../../model/constants';

const GRID_MINOR  = 'rgba(99,179,237,0.07)';
const GRID_MAJOR  = 'rgba(99,179,237,0.20)';
const PATH_COL    = '#60a5fa';
const DOOR_COL    = '#ef4444';
const SPAWN_COL   = '#22c55e';
const CLOSE_COL   = '#22c55e';
const PREVIEW_COL = 'rgba(96,165,250,0.5)';
const CLOSE_DIST  = 0.8;
const HOVER_HIT   = 0.7; // tiles — hit radius for existing points

const eq = (a: number, b: number) => Math.abs(a - b) < 0.001;

interface Props { x: number; y: number; scaleX: number; scaleY: number; }

function getUniqueWallPoints(state: ReturnType<typeof useDesignerStore.getState>): [number, number][] {
  const seen = new Set<string>();
  const result: [number, number][] = [];
  const add = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (!seen.has(k)) { seen.add(k); result.push([x, y]); }
  };
  for (const room of state.completedRooms) {
    for (let i = 0; i < room.pts.length; i += 2) add(room.pts[i], room.pts[i + 1]);
  }
  for (const w of state.completedWalls) {
    add(w.f[0], w.f[1]);
    add(w.t[0], w.t[1]);
  }
  return result;
}

function findNearest(tx: number, ty: number, pts: [number, number][]): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = HOVER_HIT;
  for (const [px, py] of pts) {
    const d = Math.hypot(tx - px, ty - py);
    if (d < bestD) { bestD = d; best = [px, py]; }
  }
  return best;
}

const DesignerLayer = React.memo(({ x, y, scaleX, scaleY }: Props) => {
  const {
    active, points, hoverPoint, hoveredExistingPt, snapMode, designerMode,
    completedRooms, completedWalls, spawnPoint,
  } = useDesignerStore();

  const layerRef    = useRef<KonvaType.Layer>(null);
  const cx          = useRef(x);       cx.current = x;
  const cy          = useRef(y);       cy.current = y;
  const csx         = useRef(scaleX);  csx.current = scaleX;
  const csy         = useRef(scaleY);  csy.current = scaleY;
  const spawnDragRef = useRef(false);
  const pointDragRef = useRef<{ current: [number, number] } | null>(null);

  useEffect(() => {
    if (!active || !layerRef.current) return;
    const stage = layerRef.current.getStage();
    if (!stage) return;
    const el = stage.container();

    let rightDrag = false;
    let suppressNextClick = false;
    let hasDraggedPoint   = false;

    const getSnap = (): [number, number] | null => {
      const pos = stage.getPointerPosition();
      if (!pos) return null;
      const mode = useDesignerStore.getState().snapMode;
      return [
        snapValue((pos.x - cx.current) / (csx.current * P), mode),
        snapValue((pos.y - cy.current) / (csy.current * P), mode),
      ];
    };

    const onMove = () => {
      if (rightDrag) return;
      const snap  = getSnap();
      const store = useDesignerStore.getState();

      if (spawnDragRef.current) {
        if (snap) store.setSpawnPoint(snap);
        return;
      }

      if (pointDragRef.current) {
        if (snap) {
          const [ox, oy] = pointDragRef.current.current;
          const [nx, ny] = snap;
          if (!eq(ox, nx) || !eq(oy, ny)) {
            store.movePoint(ox, oy, nx, ny);
            pointDragRef.current.current = [nx, ny];
            hasDraggedPoint = true;
          }
        }
        return;
      }

      store.setHoverPoint(snap);

      if (snap && store.points.length === 0) {
        const sp = store.spawnPoint;
        if (Math.hypot(snap[0] - sp[0], snap[1] - sp[1]) < HOVER_HIT) {
          store.setHoveredExistingPt(sp);
        } else {
          store.setHoveredExistingPt(findNearest(snap[0], snap[1], getUniqueWallPoints(store)));
        }
      } else {
        store.setHoveredExistingPt(null);
      }
    };

    const onLeave = () => {
      useDesignerStore.getState().setHoverPoint(null);
      useDesignerStore.getState().setHoveredExistingPt(null);
    };

    const onDown = (e: MouseEvent) => {
      if (e.button === 2) { rightDrag = true; return; }
      if (e.button !== 0) return;
      const snap  = getSnap();
      if (!snap) return;
      const store = useDesignerStore.getState();

      if (store.points.length === 0 && store.designerMode === 'draw') {
        const sp = store.spawnPoint;
        if (Math.hypot(snap[0] - sp[0], snap[1] - sp[1]) < HOVER_HIT) {
          spawnDragRef.current = true;
          suppressNextClick = true;
          return;
        }
        const nearby = findNearest(snap[0], snap[1], getUniqueWallPoints(store));
        if (nearby) {
          pointDragRef.current = { current: nearby };
          suppressNextClick = true;
          hasDraggedPoint   = false;
          return;
        }
      }
    };

    const onUp = (e: MouseEvent) => {
      if (e.button === 2) { rightDrag = false; return; }
      if (e.button !== 0) return;
      spawnDragRef.current = false;
      // If user clicked an existing point without dragging → let onClick fire to start a new wall
      if (pointDragRef.current && !hasDraggedPoint) suppressNextClick = false;
      pointDragRef.current = null;
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (suppressNextClick) { suppressNextClick = false; return; }
      const p = getSnap();
      if (p) useDesignerStore.getState().addPoint(p);
    };

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
    el.addEventListener('mousedown',  onDown);
    el.addEventListener('mouseup',    onUp);
    el.addEventListener('click',      onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup',   onKeyUp);

    return () => {
      el.removeEventListener('mousemove',  onMove);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mousedown',  onDown);
      el.removeEventListener('mouseup',    onUp);
      el.removeEventListener('click',      onClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [active]);

  if (!active) return null;

  // Visible tile range for grid
  const minTX = Math.max(0, Math.floor(-x / (scaleX * P)));
  const maxTX = Math.min(MAP.w, Math.ceil((window.innerWidth  - x) / (scaleX * P)) + 1);
  const minTY = Math.max(0, Math.floor(-y / (scaleY * P)));
  const maxTY = Math.min(MAP.h, Math.ceil((window.innerHeight - y) / (scaleY * P)) + 1);

  const isDoor     = designerMode === 'door';
  const spawnPt    = points.length > 0 ? points[0] : null;
  const nearSpawn  = !isDoor && !!(spawnPt && hoverPoint && points.length >= 2 &&
    Math.hypot(hoverPoint[0] - spawnPt[0], hoverPoint[1] - spawnPt[1]) < CLOSE_DIST);
  const previewTgt = nearSpawn && spawnPt ? spawnPt : hoverPoint;
  const lastPt     = points.length > 0 ? points[points.length - 1] : null;
  const dec        = snapMode === 'centimeter' ? 2 : snapMode === 'decimeter' ? 1 : 0;

  // Unique existing points for hover/drag circles
  const existingPtList: [number, number][] = [];
  {
    const seen = new Set<string>();
    const add = (px: number, py: number) => {
      const k = `${px},${py}`;
      if (!seen.has(k)) { seen.add(k); existingPtList.push([px, py]); }
    };
    for (const room of completedRooms) {
      for (let i = 0; i < room.pts.length; i += 2) add(room.pts[i], room.pts[i + 1]);
    }
    for (const w of completedWalls) { add(w.f[0], w.f[1]); add(w.t[0], w.t[1]); }
  }

  const isHoveredPt = (px: number, py: number) =>
    hoveredExistingPt !== null &&
    eq(hoveredExistingPt[0], px) && eq(hoveredExistingPt[1], py);

  const isSpawnHovered =
    hoveredExistingPt !== null &&
    eq(hoveredExistingPt[0], spawnPoint[0]) && eq(hoveredExistingPt[1], spawnPoint[1]);

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

      {/* ── Abgeschlossene Räume (Fläche) ── */}
      {completedRooms.map((room, i) => (
        <Line key={`cr${i}`} listening={false}
          points={room.pts.map((v) => v * P)} closed fill={room.fill} stroke="transparent"
        />
      ))}

      {/* ── Raumnamen zentriert ── */}
      {completedRooms.map((room, i) => {
        const n = room.pts.length / 2;
        let lx = 0, ly = 0;
        for (let j = 0; j < room.pts.length; j += 2) { lx += room.pts[j]; ly += room.pts[j + 1]; }
        lx /= n; ly /= n;
        return (
          <Text key={`rl${i}`} listening={false}
            x={lx * P} y={ly * P}
            width={200 / scaleX} offsetX={100 / scaleX} offsetY={7 / scaleY}
            text={room.label}
            fontSize={14 / scaleX} fontStyle="bold"
            fill="rgba(255,255,255,0.85)"
            align="center"
          />
        );
      })}

      {/* ── Abgeschlossene Wände (farbkodiert nach Typ) ── */}
      {completedWalls.map((w, i) => (
        <Line key={`cw${i}`} listening={false}
          points={[w.f[0] * P, w.f[1] * P, w.t[0] * P, w.t[1] * P]}
          stroke={w.type === 'door' ? DOOR_COL : w.type === 'shared' ? '#94a3b8' : '#0d0d0d'}
          strokeWidth={(w.type === 'door' ? 4 : 6) / scaleX}
          dash={w.type === 'door' ? [8 / scaleX, 4 / scaleX] : undefined}
        />
      ))}

      {/* ── Existierende Eckpunkte (hover-/draggable) ── */}
      {existingPtList.map(([px, py], i) => {
        const hov = isHoveredPt(px, py);
        return (
          <Circle key={`ep${i}`} listening={false}
            x={px * P} y={py * P}
            radius={(hov ? 9 : 4) / scaleX}
            fill={hov ? 'rgba(245,158,11,0.5)' : 'rgba(148,163,184,0.3)'}
            stroke={hov ? '#f59e0b' : 'rgba(148,163,184,0.4)'}
            strokeWidth={(hov ? 2 : 1) / scaleX}
          />
        );
      })}

      {/* ── Spawn-Punkt ── */}
      <Circle listening={false}
        x={spawnPoint[0] * P} y={spawnPoint[1] * P}
        radius={(isSpawnHovered ? 12 : 9) / scaleX}
        fill={isSpawnHovered ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.25)'}
        stroke={SPAWN_COL}
        strokeWidth={(isSpawnHovered ? 2.5 : 2) / scaleX}
      />
      <Text listening={false}
        x={spawnPoint[0] * P} y={spawnPoint[1] * P - 18 / scaleY}
        width={60 / scaleX} offsetX={30 / scaleX}
        text="SPAWN" fontSize={8 / scaleX} fontStyle="bold"
        fill={SPAWN_COL} align="center"
      />

      {/* ── Aktueller Pfad (Zeichenmodus) ── */}
      {!isDoor && points.length >= 2 && (
        <Line listening={false}
          points={points.flatMap(([tx, ty]) => [tx * P, ty * P])}
          stroke={PATH_COL} strokeWidth={3 / scaleX}
        />
      )}

      {/* ── Aktueller Tür-Pfad (Tür-Modus) ── */}
      {isDoor && points.length >= 2 && (
        <Line listening={false}
          points={points.flatMap(([tx, ty]) => [tx * P, ty * P])}
          stroke={DOOR_COL} strokeWidth={3 / scaleX}
        />
      )}

      {/* ── Vorschau-Linie (letzter Punkt → Hover) ── */}
      {lastPt && previewTgt && (
        <Line listening={false}
          points={[lastPt[0] * P, lastPt[1] * P, previewTgt[0] * P, previewTgt[1] * P]}
          stroke={isDoor ? DOOR_COL : (nearSpawn ? CLOSE_COL : PREVIEW_COL)}
          strokeWidth={2 / scaleX}
          dash={[8 / scaleX, 4 / scaleX]}
        />
      )}

      {/* ── Gesetzte Punkte (aktiver Pfad) ── */}
      {points.map(([tx, ty], i) => (
        <Circle key={`pp${i}`} listening={false}
          x={tx * P} y={ty * P}
          radius={(i === 0 ? 9 : 5) / scaleX}
          fill={isDoor ? DOOR_COL : (i === 0 ? (nearSpawn ? CLOSE_COL : '#f59e0b') : PATH_COL)}
          stroke={i === 0 ? 'rgba(255,255,255,0.4)' : 'transparent'}
          strokeWidth={2 / scaleX}
        />
      ))}

      {/* ── Snap-Indikator (Hover) ── */}
      {hoverPoint && !nearSpawn && !isHoveredPt(hoverPoint[0], hoverPoint[1]) && (
        <Circle listening={false}
          x={hoverPoint[0] * P} y={hoverPoint[1] * P}
          radius={4 / scaleX}
          fill={isDoor ? 'rgba(239,68,68,0.35)' : 'rgba(96,165,250,0.35)'}
          stroke={isDoor ? DOOR_COL : PATH_COL}
          strokeWidth={1.5 / scaleX}
        />
      )}

      {/* ── Koordinaten-Label ── */}
      {hoverPoint && (
        <Text listening={false}
          x={hoverPoint[0] * P + 10 / scaleX}
          y={hoverPoint[1] * P - 18 / scaleY}
          text={`${hoverPoint[0].toFixed(dec)}m, ${hoverPoint[1].toFixed(dec)}m`}
          fontSize={11 / scaleX} fill={isDoor ? DOOR_COL : PATH_COL}
        />
      )}

      {/* ── "Raum schließen" Hinweis ── */}
      {nearSpawn && spawnPt && (
        <Text listening={false}
          x={spawnPt[0] * P + 10 / scaleX}
          y={spawnPt[1] * P - 22 / scaleY}
          text="Raum schließen ↵"
          fontSize={11 / scaleX} fill={CLOSE_COL}
        />
      )}

    </Layer>
  );
});

DesignerLayer.displayName = 'DesignerLayer';
export default DesignerLayer;
