import React, { useRef, useEffect } from 'react';
import { Layer } from 'react-konva';
import type KonvaType from 'konva';
import { usePlayerStore } from '../../model/stores/playerStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { videoRegistry } from '../../services/videoRegistry';
import SmileyAvatar from '../avatars/SmileyAvatar';

const AvatarLayer = React.memo(({ x, y, scaleX, scaleY }: {
  x: number; y: number; scaleX: number; scaleY: number;
}) => {
  const { wx, wy, name } = usePlayerStore();
  const remoteUsers  = usePresenceStore((s) => s.remoteUsers);
  // trackVersion als Re-Render-Trigger wenn Video-Tracks sich ändern
  useLiveKitStore((s) => s.trackVersion);

  const layerRef = useRef<KonvaType.Layer>(null);

  // Eigener RAF-Loop: ruft layer.draw() direkt auf, damit Video-Frames
  // jeden Frame neu gezeichnet werden (Konva.Animation batcht zu aggressiv).
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      layerRef.current?.draw();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <Layer ref={layerRef} x={x} y={y} scaleX={scaleX} scaleY={scaleY}>
      {/* Remote-User (mit Tween-Animation) */}
      {Object.values(remoteUsers).map((user) => {
        const isBot   = user.user_id.startsWith('bot_') || user.name.endsWith('_Bot');
        const label   = user.department ? `${user.name} · ${user.department}` : user.name;
        const videoEl = videoRegistry.getActive(user.name);
        return (
          <SmileyAvatar
            key={user.user_id}
            x={user.x}
            y={user.y}
            name={label}
            isPlayer={false}
            isBot={isBot}
            animate={!isBot}
            videoElement={videoEl}
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
        videoElement={videoRegistry.getActive(name)}
      />
    </Layer>
  );
});

AvatarLayer.displayName = 'AvatarLayer';
export default AvatarLayer;
