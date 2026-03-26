import React from 'react';
import { Layer } from 'react-konva';
import { usePlayerStore } from '../../model/stores/playerStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import SmileyAvatar from '../avatars/SmileyAvatar';

const AvatarLayer = React.memo(({ x, y, scaleX, scaleY }: {
  x: number; y: number; scaleX: number; scaleY: number;
}) => {
  const { wx, wy, name } = usePlayerStore();
  const remoteUsers = usePresenceStore((s) => s.remoteUsers);

  return (
    <Layer x={x} y={y} scaleX={scaleX} scaleY={scaleY}>
      {/* Remote-User (mit Tween-Animation) */}
      {Object.values(remoteUsers).map((user) => {
        const isBot = user.user_id.startsWith('bot_') || user.name === 'Empfang';
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
      />
    </Layer>
  );
});

AvatarLayer.displayName = 'AvatarLayer';
export default AvatarLayer;
