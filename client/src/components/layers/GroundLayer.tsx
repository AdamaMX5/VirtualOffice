import React, { useMemo } from 'react';
import { Layer, Rect, Line } from 'react-konva';
import { P, MAP } from '../../model/constants';

// Deterministischer PRNG (Mulberry32) für konsistente Grashalme (kein HMR-Flackern)
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGrassLines() {
  const rand = mulberry32(42);
  const lines: { points: number[]; stroke: string; opacity: number }[] = [];
  for (let i = 0; i < 700; i++) {
    const gx = rand() * MAP.w * P;
    const gy = rand() * MAP.h * P;
    lines.push({
      points: [gx, gy, gx + (rand() - 0.5) * 3, gy - 3 - rand() * 5],
      stroke: rand() > 0.5 ? '#5a9460' : '#3d6b41',
      opacity: 0.55,
    });
  }
  return lines;
}

const grassLines = buildGrassLines(); // einmalig beim Modulstart berechnen

const GroundLayer = React.memo(({ x, y, scaleX, scaleY }: {
  x: number; y: number; scaleX: number; scaleY: number;
}) => {
  const lines = useMemo(() => grassLines, []);

  return (
    <Layer x={x} y={y} scaleX={scaleX} scaleY={scaleY}>
      {/* Grüner Boden */}
      <Rect x={0} y={0} width={MAP.w * P} height={MAP.h * P} fill="#4a7c4e" />

      {/* Parkplatz / Bereich */}
      <Rect x={58 * P} y={42 * P} width={4 * P} height={6 * P} fill="#b0a898" cornerRadius={2} />

      {/* Grashalme */}
      {lines.map((l, i) => (
        <Line key={i} points={l.points} stroke={l.stroke} strokeWidth={1} opacity={l.opacity} />
      ))}
    </Layer>
  );
});

GroundLayer.displayName = 'GroundLayer';
export default GroundLayer;
