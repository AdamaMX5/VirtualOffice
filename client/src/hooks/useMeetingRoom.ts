/**
 * Verbindet automatisch mit dem LiveKit "meeting"-Raum,
 * sobald der Spieler den Meetingraum betritt – und trennt
 * die Verbindung wieder, wenn er ihn verlässt.
 */
import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../model/stores/playerStore';
import { useLiveKitStore } from '../model/stores/liveKitStore';
import { useLiveKit } from './useLiveKit';

export function useMeetingRoom() {
  const currentRoom = usePlayerStore((s) => s.currentRoom);
  const { connect, switchRoom, disconnect } = useLiveKit();
  const prevRoomRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevRoomRef.current;
    prevRoomRef.current = currentRoom;

    if (currentRoom === 'Meetingraum') {
      // Betreten
      const { status, roomName } = useLiveKitStore.getState();
      if (status === 'idle' || status === 'error') {
        connect('meeting');
      } else if (status === 'connected' && roomName !== 'meeting') {
        switchRoom('meeting');
      }
    } else if (prev === 'Meetingraum') {
      // Verlassen → Call beenden
      const { status } = useLiveKitStore.getState();
      if (status === 'connected' || status === 'connecting') {
        disconnect();
      }
    }
  }, [currentRoom, connect, switchRoom, disconnect]);
}
