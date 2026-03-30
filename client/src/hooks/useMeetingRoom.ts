/**
 * Verbindet automatisch mit dem LiveKit "meeting"-Raum,
 * sobald der Spieler den Meetingraum betritt.
 */
import { useEffect } from 'react';
import { usePlayerStore } from '../model/stores/playerStore';
import { useLiveKitStore } from '../model/stores/liveKitStore';
import { useLiveKit } from './useLiveKit';

export function useMeetingRoom() {
  const currentRoom = usePlayerStore((s) => s.currentRoom);
  const { connect, switchRoom } = useLiveKit();

  useEffect(() => {
    if (currentRoom !== 'Meetingraum') return;

    const { status, roomName } = useLiveKitStore.getState();
    if (status === 'idle' || status === 'error') {
      connect('meeting');
    } else if (status === 'connected' && roomName !== 'meeting') {
      switchRoom('meeting');
    }
  }, [currentRoom, connect, switchRoom]);
}
