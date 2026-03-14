import React, { useRef, useEffect } from 'react';
import { Group, Circle, Shape, Text } from 'react-konva';
import type Konva from 'konva';
import { P } from '../../model/constants';

interface SmileyAvatarProps {
  x: number;          // Welt-X in Tile-Einheiten
  y: number;          // Welt-Y in Tile-Einheiten
  name: string;
  isPlayer?: boolean;
  animate?: boolean;  // true für Remote-User (Konva-Tween)
}

const SmileyAvatar = React.memo(({ x, y, name, isPlayer = false, animate = false }: SmileyAvatarProps) => {
  const groupRef = useRef<Konva.Group>(null);

  // Smooth-Interpolation für Remote-User per Konva-Tween
  useEffect(() => {
    if (!animate || !groupRef.current) return;
    groupRef.current.to({ x: x * P, y: y * P, duration: 0.1 });
  }, [x, y, animate]);

  const posX = animate ? undefined : x * P; // animate-Modus: Position via Tween
  const posY = animate ? undefined : y * P;

  return (
    <Group ref={groupRef} x={posX} y={posY}>
      {/* Schatten */}
      <Circle radius={16} fill="rgba(0,0,0,0.18)" x={-2} y={4} />

      {/* Gesicht */}
      <Circle
        radius={16}
        fill={isPlayer ? '#facc15' : '#60a5fa'}
        stroke={isPlayer ? '#ca8a04' : '#2563eb'}
        strokeWidth={2}
      />

      {/* Augen */}
      <Circle x={-5} y={-5} radius={2.5} fill="#1e293b" />
      <Circle x={5}  y={-5} radius={2.5} fill="#1e293b" />

      {/* Lächeln */}
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(-6, 3);
          ctx.quadraticCurveTo(0, 10, 6, 3);
          ctx.strokeShape(shape);
        }}
        stroke="#1e293b"
        strokeWidth={2.5}
        lineCap="round"
      />

      {/* Spieler-Ring */}
      {isPlayer && (
        <Circle radius={21} stroke="#fde68a" strokeWidth={1.5} dash={[4, 3]} opacity={0.7} />
      )}

      {/* Name-Label */}
      <Text
        text={name}
        fontSize={10}
        fill={isPlayer ? '#fef9c3' : '#dbeafe'}
        fontStyle={isPlayer ? 'bold' : 'normal'}
        x={-70} y={21}
        width={140}
        align="center"
      />
    </Group>
  );
});

SmileyAvatar.displayName = 'SmileyAvatar';
export default SmileyAvatar;
