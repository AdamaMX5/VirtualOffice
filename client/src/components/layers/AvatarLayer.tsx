import React, { useRef, useEffect, useCallback } from 'react';
import { Layer } from 'react-konva';
import type KonvaType from 'konva';
import { usePlayerStore } from '../../model/stores/playerStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { useCameraStore } from '../../model/stores/cameraStore';
import { useServiceStatusStore } from '../../model/stores/serviceStatusStore';
import { P } from '../../model/constants';
import SmileyAvatar from '../avatars/SmileyAvatar';
import ChatBubble from '../avatars/ChatBubble';

const AvatarLayer = React.memo(({ x, y, scaleX, scaleY, updateFromDrag, paused }: {
  x: number; y: number; scaleX: number; scaleY: number;
  updateFromDrag: (wx: number, wy: number) => void;
  paused?: boolean;
}) => {
  const { wx, wy, name } = usePlayerStore();
  const remoteUsers  = usePresenceStore((s) => s.remoteUsers);
  const chatBubbles  = usePresenceStore((s) => s.chatBubbles);
  const openServiceStatus = useServiceStatusStore((s) => s.open);
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
        const label = (!isBot && user.department) ? `${user.name} · ${user.department}` : user.name;
        return (
          <SmileyAvatar
            key={user.user_id}
            x={user.x}
            y={user.y}
            name={label}
            isPlayer={false}
            isBot={isBot}
            animate={!isBot}
            onClick={user.user_id === 'bot_admin' ? openServiceStatus : undefined}
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

      {/* Sprechblasen zuletzt → immer über allen Avataren */}
      {Object.values(remoteUsers).map((user) =>
        chatBubbles[user.user_id]
          ? <ChatBubble key={`bubble-${user.user_id}`} x={user.x} y={user.y} text={chatBubbles[user.user_id]!} />
          : null
      )}
      {chatBubbles['__self__'] && (
        <ChatBubble x={wx} y={wy} text={chatBubbles['__self__']!} />
      )}
    </Layer>
  );
});

AvatarLayer.displayName = 'AvatarLayer';
export default AvatarLayer;
