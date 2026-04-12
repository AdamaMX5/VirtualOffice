import React, { useRef, useEffect, useCallback } from 'react';
import { Layer } from 'react-konva';
import type KonvaType from 'konva';
import { usePlayerStore } from '../../model/stores/playerStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { useCameraStore } from '../../model/stores/cameraStore';
import { P } from '../../model/constants';
import SmileyAvatar from '../avatars/SmileyAvatar';

const AvatarLayer = React.memo(({ x, y, scaleX, scaleY, updateFromDrag, paused }: {
  x: number; y: number; scaleX: number; scaleY: number;
  updateFromDrag: (wx: number, wy: number) => void;
  paused?: boolean;
}) => {
  const { wx, wy, name } = usePlayerStore();
  const remoteUsers  = usePresenceStore((s) => s.remoteUsers);
  // trackVersion als Re-Render-Trigger wenn Video-Tracks sich ändern
  useLiveKitStore((s) => s.trackVersion);

  // Konva-Pixel → Tile-Koordinaten → updateFromDrag
  const handleDragMove = useCallback((e: KonvaType.KonvaEventObject<DragEvent>) => {
    updateFromDrag(e.target.x() / P, e.target.y() / P);
  }, [updateFromDrag]);

  const handleDragStart = useCallback(() => {
    useCameraStore.getState().setFollow(false);
  }, []);

  const handleDragEnd = useCallback((e: KonvaType.KonvaEventObject<DragEvent>) => {
    updateFromDrag(e.target.x() / P, e.target.y() / P);
    document.body.style.cursor = 'default';
  }, [updateFromDrag]);

  const layerRef = useRef<KonvaType.Layer>(null);

  // Eigener RAF-Loop: ruft layer.draw() direkt auf, damit Video-Frames
  // jeden Frame neu gezeichnet werden (Konva.Animation batcht zu aggressiv).
  // Pausiert wenn Meeting-Overlay aktiv ist (spart GPU während Video-Dekodierung).
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (!pausedRef.current) layerRef.current?.draw();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <Layer ref={layerRef} x={x} y={y} scaleX={scaleX} scaleY={scaleY}>
      {/* Remote-User (mit Tween-Animation) */}
      {Object.values(remoteUsers).map((user) => {
        const isBot = user.user_id.startsWith('bot_') || user.name.endsWith('_Bot');
        const label = user.department ? `${user.name} · ${user.department}` : user.name;
        return (
          <SmileyAvatar
            key={user.user_id}
            x={user.x}
            y={user.y}
            name={label}
            isPlayer={false}
            isBot={isBot}
            animate={!isBot}
          />
        );
      })}

      {/* Eigener Spieler (ohne Tween — wird direkt per Store aktualisiert) */}
      <SmileyAvatar
        x={wx}
        y={wy}
        name={name}
        isPlayer={true}
        animate={false}
        draggable
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />
    </Layer>
  );
});

AvatarLayer.displayName = 'AvatarLayer';
export default AvatarLayer;
