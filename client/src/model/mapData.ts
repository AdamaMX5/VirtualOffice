import type { Room, Wall, MapDocument, MapWall, MapPoint } from './types';

// ── Kanonisches Karten-Dokument (neue Struktur) ───────────────────────────────

export const DEFAULT_MAP: MapDocument = {
  points: {
    p1:  { x: 47, y: 62 }, p2:  { x: 47, y: 40 }, p3:  { x: 35, y: 40 },
    p4:  { x: 35, y: 62 }, p5:  { x: 70, y: 50 }, p6:  { x: 70, y: 62 },
    p7:  { x: 85, y: 62 }, p8:  { x: 70, y: 40 }, p9:  { x: 85, y: 40 },
    p10: { x: 85, y: 45 }, p11: { x: 100, y: 45 }, p12: { x: 100, y: 62 },
    p13: { x: 93, y: 62 }, p14: { x: 93, y: 65 }, p15: { x: 37, y: 65 },
    p16: { x: 60, y: 65 }, p17: { x: 60, y: 75 }, p18: { x: 70, y: 75 },
    p19: { x: 70, y: 65 }, p20: { x: 32, y: 60 }, p21: { x: 37, y: 68 },
    p22: { x: 35, y: 70 }, p23: { x: 32, y: 71 }, p24: { x: 29, y: 71 },
    p25: { x: 26, y: 69 }, p26: { x: 25, y: 67 }, p27: { x: 25, y: 63 },
    p28: { x: 28, y: 60 }, p29: { x: 60, y: 85 }, p30: { x: 37, y: 85 },
    p31: { x: 47, y: 50 },
  },
  walls: [
    { id: 'w1',  from: 'p1',  to: 'p2',  left: 'room_1', right: null,     type: 'wall' },
    { id: 'w2',  from: 'p2',  to: 'p3',  left: 'room_1', right: 'room_2', type: 'wall' },
    { id: 'w3',  from: 'p3',  to: 'p4',  left: 'room_1', right: 'room_2', type: 'wall' },
    { id: 'w4',  from: 'p4',  to: 'p1',  left: 'room_1', right: 'room_5', type: 'wall' },
    { id: 'w5',  from: 'p31', to: 'p5',  left: 'room_2', right: null,     type: 'wall' },
    { id: 'w6',  from: 'p5',  to: 'p6',  left: 'room_2', right: null,     type: 'wall' },
    { id: 'w7',  from: 'p6',  to: 'p1',  left: 'room_2', right: 'room_3', type: 'wall' },
    { id: 'w8',  from: 'p1',  to: 'p31', left: 'room_2', right: null,     type: 'wall' },
    { id: 'w9',  from: 'p7',  to: 'p6',  left: 'room_3', right: 'room_2', type: 'wall' },
    { id: 'w10', from: 'p6',  to: 'p8',  left: 'room_3', right: null,     type: 'wall' },
    { id: 'w11', from: 'p8',  to: 'p9',  left: 'room_3', right: null,     type: 'wall' },
    { id: 'w12', from: 'p9',  to: 'p7',  left: 'room_3', right: null,     type: 'wall' },
    { id: 'w13', from: 'p10', to: 'p11', left: 'room_4', right: null,     type: 'wall' },
    { id: 'w14', from: 'p11', to: 'p12', left: 'room_4', right: null,     type: 'wall' },
    { id: 'w15', from: 'p12', to: 'p7',  left: 'room_4', right: null,     type: 'wall' },
    { id: 'w16', from: 'p7',  to: 'p10', left: 'room_4', right: null,     type: 'wall' },
    { id: 'w17', from: 'p13', to: 'p14', left: 'room_5', right: null,     type: 'wall' },
    { id: 'w18', from: 'p14', to: 'p15', left: 'room_5', right: null,     type: 'wall' },
    { id: 'w19', from: 'p15', to: 'p4',  left: 'room_5', right: 'room_7', type: 'wall' },
    { id: 'w20', from: 'p4',  to: 'p13', left: 'room_5', right: null,     type: 'wall' },
    { id: 'w21', from: 'p16', to: 'p17', left: 'room_6', right: null,     type: 'wall' },
    { id: 'w22', from: 'p17', to: 'p18', left: 'room_6', right: null,     type: 'wall' },
    { id: 'w23', from: 'p18', to: 'p19', left: 'room_6', right: null,     type: 'wall' },
    { id: 'w24', from: 'p19', to: 'p16', left: 'room_6', right: null,     type: 'wall' },
    { id: 'w25', from: 'p20', to: 'p4',  left: 'room_7', right: null,     type: 'wall' },
    { id: 'w26', from: 'p4',  to: 'p15', left: 'room_7', right: 'room_5', type: 'wall' },
    { id: 'w27', from: 'p15', to: 'p21', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w28', from: 'p21', to: 'p22', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w29', from: 'p22', to: 'p23', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w30', from: 'p23', to: 'p24', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w31', from: 'p24', to: 'p25', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w32', from: 'p25', to: 'p26', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w33', from: 'p26', to: 'p27', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w34', from: 'p27', to: 'p28', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w35', from: 'p28', to: 'p20', left: 'room_7', right: null,     type: 'wall' },
    { id: 'w36', from: 'p29', to: 'p30', left: 'room_8', right: null,     type: 'wall' },
    { id: 'w37', from: 'p30', to: 'p15', left: 'room_8', right: null,     type: 'wall' },
    { id: 'w38', from: 'p15', to: 'p16', left: 'room_8', right: 'room_6', type: 'wall' },
    { id: 'w39', from: 'p16', to: 'p29', left: 'room_8', right: null,     type: 'wall' },
  ],
  rooms: [
    { id: 'room_1', label: 'Büro A',        fill: '#3d2a1a', walls: ['w1','w2','w3','w4'] },
    { id: 'room_2', label: 'Eingangshalle', fill: '#585858', walls: ['w5','w6','w7','w8'] },
    { id: 'room_3', label: 'Büro B',        fill: '#2a1a3d', walls: ['w9','w10','w11','w12'] },
    { id: 'room_4', label: 'Serverraum',    fill: '#3d3d1a', walls: ['w13','w14','w15','w16'] },
    { id: 'room_5', label: 'Flur',          fill: '#585858', walls: ['w17','w18','w19','w20'] },
    { id: 'room_6', label: 'Chefbüro',      fill: '#585858', walls: ['w21','w22','w23','w24','w38'] },
    { id: 'room_7', label: 'Kurtis Kreis',  fill: '#3d1a1a', walls: ['w25','w26','w27','w28','w29','w30','w31','w32','w33','w34','w35'] },
    { id: 'room_8', label: 'Meetingraum',   fill: '#1a3d2a', walls: ['w36','w37','w38','w39'] },
  ],
  spawnPoint: { x: 60, y: 55 },
};

// ── Polygon-Rekonstruktion (DFS mit Backtracking) ─────────────────────────────

function findCycle(
  start: string, cur: string,
  adj: Map<string, string[]>,
  visited: Set<string>,
  path: string[],
  maxLen: number,
): string[] | null {
  if (path.length > 0 && cur === start) return path;
  if (path.length >= maxLen) return null;
  if (cur !== start && visited.has(cur)) return null;
  visited.add(cur);
  for (const next of (adj.get(cur) ?? [])) {
    const res = findCycle(start, next, adj, new Set(visited), [...path, cur], maxLen);
    if (res) return res;
  }
  return null;
}

function buildPolygon(
  roomId: string,
  wallIds: string[],
  allWalls: MapWall[],
  points: Record<string, MapPoint>,
): number[] {
  const wallObjs = wallIds.map(id => allWalls.find(w => w.id === id)).filter(Boolean) as MapWall[];
  const edges: [string, string][] = wallObjs.map(w =>
    w.left === roomId ? [w.from, w.to] : [w.to, w.from],
  );
  if (edges.length === 0) return [];

  const adj = new Map<string, string[]>();
  for (const [f, t] of edges) {
    if (!adj.has(f)) adj.set(f, []);
    adj.get(f)!.push(t);
  }

  for (const [startPt] of edges) {
    const res = findCycle(startPt, startPt, adj, new Set<string>(), [], edges.length);
    if (res && res.length >= 3) {
      return res.flatMap(ptId => [points[ptId].x, points[ptId].y]);
    }
  }
  return [];
}

// ── parseMapDocument: MapDocument → interne Room[]/Wall[] ────────────────────

export function parseMapDocument(doc: MapDocument): {
  rooms: Room[];
  walls: Wall[];
  spawnPoint: [number, number];
} {
  const { points, walls: mWalls, rooms: mRooms, spawnPoint: sp } = doc;

  const rooms: Room[] = mRooms.map(mr => ({
    label: mr.label,
    fill:  mr.fill,
    pts:   buildPolygon(mr.id, mr.walls, mWalls, points),
  }));

  // Wände deduplizieren (gleiche Kante kann in mehreren Räumen referenziert sein)
  const seen = new Set<string>();
  const walls: Wall[] = [];
  for (const mw of mWalls) {
    const fp = points[mw.from], tp = points[mw.to];
    if (!fp || !tp) continue;
    const key = [mw.from, mw.to].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    walls.push({
      f: [fp.x, fp.y],
      t: [tp.x, tp.y],
      type: (mw.left !== null && mw.right !== null) ? 'shared' : 'wall',
    });
  }

  return {
    rooms,
    walls,
    spawnPoint: sp ? [sp.x, sp.y] : [60, 55],
  };
}

// ── toMapDocument: interne Room[]/Wall[] → MapDocument ───────────────────────

export function toMapDocument(
  rooms: Room[],
  walls: Wall[],
  spawnPoint: [number, number],
): MapDocument {
  const ptKey = (x: number, y: number) => `${x}_${y}`;
  const ptIdMap = new Map<string, string>();
  let pn = 1;

  const ensurePt = (x: number, y: number) => {
    if (!ptIdMap.has(ptKey(x, y))) ptIdMap.set(ptKey(x, y), `p${pn++}`);
  };

  rooms.forEach(r => { for (let i = 0; i < r.pts.length; i += 2) ensurePt(r.pts[i], r.pts[i+1]); });
  walls.forEach(w => { ensurePt(w.f[0], w.f[1]); ensurePt(w.t[0], w.t[1]); });

  const pid = (x: number, y: number) => ptIdMap.get(ptKey(x, y))!;

  const pointsOut: Record<string, MapPoint> = {};
  ptIdMap.forEach((id, k) => {
    const [sx, sy] = k.split('_');
    pointsOut[id] = { x: Number(sx), y: Number(sy) };
  });

  const roomIds = rooms.map((_, i) => `room_${i + 1}`);

  // Gerichtete Polygon-Kanten je Raum: f→t bedeutet "Raum ist links"
  type DirEdge = { fx: number; fy: number; tx: number; ty: number; roomId: string };
  const dirEdges: DirEdge[] = [];
  rooms.forEach((room, i) => {
    const rid = roomIds[i];
    const n = room.pts.length / 2;
    for (let j = 0; j < n; j++) {
      const fi = j * 2, ti = ((j + 1) % n) * 2;
      dirEdges.push({ fx: room.pts[fi], fy: room.pts[fi+1], tx: room.pts[ti], ty: room.pts[ti+1], roomId: rid });
    }
  });

  // Wände bauen
  const mapWalls: MapWall[] = [];
  const seenWall = new Set<string>();
  let wn = 1;

  walls.forEach(w => {
    const fk = ptKey(w.f[0], w.f[1]), tk = ptKey(w.t[0], w.t[1]);
    const canonical = [fk, tk].sort().join('|');
    if (seenWall.has(canonical)) return;
    seenWall.add(canonical);

    const leftRoom  = dirEdges.find(e => e.fx === w.f[0] && e.fy === w.f[1] && e.tx === w.t[0] && e.ty === w.t[1])?.roomId ?? null;
    const rightRoom = dirEdges.find(e => e.fx === w.t[0] && e.fy === w.t[1] && e.tx === w.f[0] && e.ty === w.f[1])?.roomId ?? null;

    mapWalls.push({ id: `w${wn++}`, from: pid(w.f[0], w.f[1]), to: pid(w.t[0], w.t[1]), left: leftRoom, right: rightRoom, type: 'wall' });
  });

  // Räume bauen
  const mapRooms = rooms.map((room, i) => {
    const rid = roomIds[i];
    const wallIds: string[] = [];
    const n = room.pts.length / 2;
    for (let j = 0; j < n; j++) {
      const fi = j * 2, ti = ((j + 1) % n) * 2;
      const fx = room.pts[fi], fy = room.pts[fi+1], tx = room.pts[ti], ty = room.pts[ti+1];
      const mw = mapWalls.find(w => {
        const fp = pointsOut[w.from], tp = pointsOut[w.to];
        return (fp.x === fx && fp.y === fy && tp.x === tx && tp.y === ty) ||
               (fp.x === tx && fp.y === ty && tp.x === fx && tp.y === fy);
      });
      if (mw && !wallIds.includes(mw.id)) wallIds.push(mw.id);
    }
    return { id: rid, label: room.label, fill: room.fill, walls: wallIds };
  });

  return { points: pointsOut, walls: mapWalls, rooms: mapRooms, spawnPoint: { x: spawnPoint[0], y: spawnPoint[1] } };
}

// ── Abgeleitete Exports (Rückwärtskompatibilität) ─────────────────────────────

const _parsed = parseMapDocument(DEFAULT_MAP);
export const ROOMS: Room[]             = _parsed.rooms;
export const WALLS: Wall[]             = _parsed.walls;
export const DEFAULT_SPAWN: [number, number] = _parsed.spawnPoint;

/** Raum-Label für Position (wx, wy) — Bounding-Box-Näherung. */
export function getRoomAtPos(wx: number, wy: number): string | null {
  for (const room of ROOMS) {
    const xs = room.pts.filter((_, i) => i % 2 === 0);
    const ys = room.pts.filter((_, i) => i % 2 !== 0);
    if (wx >= Math.min(...xs) && wx <= Math.max(...xs) &&
        wy >= Math.min(...ys) && wy <= Math.max(...ys)) {
      return room.label;
    }
  }
  return null;
}
