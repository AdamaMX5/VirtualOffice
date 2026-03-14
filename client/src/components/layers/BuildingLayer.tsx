import React, { useMemo } from 'react';
import { Layer, Line, Text, Arc, Shape } from 'react-konva';
import { P } from '../../model/constants';
import { ROOMS, WALLS } from '../../model/mapData';

const BuildingLayer = React.memo(({ x, y, scaleX, scaleY }: {
  x: number; y: number; scaleX: number; scaleY: number;
}) => {
  const roomShapes = useMemo(() =>
    ROOMS.map((room) => {
      const xs = room.pts.filter((_, i) => i % 2 === 0);
      const ys = room.pts.filter((_, i) => i % 2 === 1);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2 * P - 40;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2 * P - 6;
      return { room, cx, cy };
    }), []);

  const wallShapes = useMemo(() =>
    WALLS.map((wall, i) => {
      const x1 = wall.f[0] * P, y1 = wall.f[1] * P;
      const x2 = wall.t[0] * P, y2 = wall.t[1] * P;
      return { wall, x1, y1, x2, y2, key: i };
    }), []);

  return (
    <Layer x={x} y={y} scaleX={scaleX} scaleY={scaleY}>
      {/* Raumflächen */}
      {roomShapes.map(({ room, cx, cy }) => (
        <React.Fragment key={room.label}>
          <Line
            points={room.pts.map(v => v * P)}
            closed
            fill={room.fill}
            stroke="transparent"
          />
          <Text
            x={cx} y={cy}
            width={80}
            text={room.label}
            fontSize={11}
            fill="rgba(0,0,0,0.4)"
            align="center"
          />
        </React.Fragment>
      ))}

      {/* Wände, Shared-Wände, Türen */}
      {wallShapes.map(({ wall, x1, y1, x2, y2, key }) => {
        if (wall.type === 'door') {
          const len = Math.hypot(x2 - x1, y2 - y1);
          return (
            <React.Fragment key={key}>
              <Line points={[x1, y1, x2, y2]} stroke="#8B6914" strokeWidth={3} dash={[5, 3]} />
              <Arc
                x={x1} y={y1}
                innerRadius={0}
                outerRadius={len}
                angle={90}
                rotation={y1 === y2 ? -90 : 0}
                fill="rgba(139,105,20,0.1)"
              />
            </React.Fragment>
          );
        }
        if (wall.type === 'shared') {
          return (
            <Shape
              key={key}
              sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeShape(shape);
              }}
              stroke="rgba(74,55,40,0.3)"
              strokeWidth={1.5}
              lineCap="round"
            />
          );
        }
        return (
          <Line key={key} points={[x1, y1, x2, y2]} stroke="#4a3728" strokeWidth={3} lineCap="round" />
        );
      })}
    </Layer>
  );
});

BuildingLayer.displayName = 'BuildingLayer';
export default BuildingLayer;
