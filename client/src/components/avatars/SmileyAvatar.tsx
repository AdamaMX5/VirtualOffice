import React, { useRef, useEffect } from 'react';
import { Group, Circle, Shape, Text } from 'react-konva';
import type Konva from 'konva';
import { P } from '../../model/constants';

interface SmileyAvatarProps {
  x: number;          // Welt-X in Tile-Einheiten
  y: number;          // Welt-Y in Tile-Einheiten
  name: string;
  isPlayer?: boolean;
  isBot?: boolean;
  animate?: boolean;  // true für Remote-User (Konva-Tween)
  videoElement?: HTMLVideoElement | null;
}

const SmileyAvatar = React.memo(({ x, y, name, isPlayer = false, isBot = false, animate = false, videoElement }: SmileyAvatarProps) => {
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

      {videoElement ? (
        /* ── Video-Kreis-Modus (Radius 24, ragt über den Smiley-Ring hinaus) ── */
        <>
          {/* Kreisförmiger Clip + Video mit objectFit:cover */}
          <Group clipFunc={(ctx) => { ctx.arc(0, 0, 24, 0, Math.PI * 2); }}>
            <Shape
              listening={false}
              sceneFunc={(ctx) => {
                const v = videoElement;
                if (!v || v.readyState < 2) return;
                const vw = v.videoWidth;
                const vh = v.videoHeight;
                if (!vw || !vh) return;
                // objectFit: cover – kürzere Seite füllt den Durchmesser
                const s = 48 / Math.min(vw, vh);
                (ctx as any)._context.drawImage(v, -(vw * s) / 2, -(vh * s) / 2, vw * s, vh * s);
              }}
            />
          </Group>
          {/* Rand-Ring über dem Video */}
          <Circle
            radius={24}
            fill="transparent"
            stroke={isPlayer ? '#ca8a04' : isBot ? '#16a34a' : '#2563eb'}
            strokeWidth={2}
          />
        </>
      ) : (
        /* ── Smiley-Modus ── */
        <>
          {/* Gesicht */}
          <Circle
            radius={16}
            fill={isPlayer ? '#facc15' : isBot ? '#4ade80' : '#60a5fa'}
            stroke={isPlayer ? '#ca8a04' : isBot ? '#16a34a' : '#2563eb'}
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
          {/* Bot-Headset */}
          {isBot && (
            <>
              <Shape
                sceneFunc={(ctx, shape) => {
                  ctx.beginPath();
                  ctx.arc(0, -4, 19, Math.PI * 1.1, Math.PI * 1.9);
                  ctx.strokeShape(shape);
                }}
                stroke="#15803d"
                strokeWidth={3}
                lineCap="round"
              />
              <Circle x={-19} y={-4} radius={4} fill="#15803d" />
              <Circle x={19}  y={-4} radius={4} fill="#15803d" />
            </>
          )}
        </>
      )}

      {/* Spieler-Ring (immer sichtbar) */}
      {isPlayer && (
        <Circle radius={21} stroke="#fde68a" strokeWidth={1.5} dash={[4, 3]} opacity={0.7} />
      )}

      {/* Name-Label */}
      <Text
        text={name}
        fontSize={10}
        fill={isPlayer ? '#fef9c3' : isBot ? '#dcfce7' : '#dbeafe'}
        fontStyle={isPlayer || isBot ? 'bold' : 'normal'}
        x={-70} y={21}
        width={140}
        align="center"
      />
    </Group>
  );
});

SmileyAvatar.displayName = 'SmileyAvatar';
export default SmileyAvatar;
