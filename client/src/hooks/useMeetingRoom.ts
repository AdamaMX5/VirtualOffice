/**
 * Verbindet automatisch mit dem LiveKit "meeting"-Raum,
 * sobald der Spieler den Meetingraum betritt – und trennt
 * die Verbindung wieder, wenn er ihn verlässt.
 *
 * Wenn der Meetingraum gesperrt ist, wird die Verbindung blockiert
 * bis der Spieler explizit eingelassen wurde.
 *
 * Bei Verbindungsfehler wird nach 5 Sekunden erneut versucht,
 * solange der Spieler im Meetingraum bleibt.
 */
import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../model/stores/playerStore';
import { useLiveKitStore } from '../model/stores/liveKitStore';
import { useRoomLockStore } from '../model/stores/roomLockStore';
import { useLiveKit } from './useLiveKit';

export function useMeetingRoom() {
  const currentRoom = usePlayerStore((s) => s.currentRoom);
  const admitted    = useRoomLockStore((s) => s.admitted);
  const { connect, switchRoom, disconnect } = useLiveKit();
  const prevRoomRef  = useRef<string | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetry = () => {
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  };

  // Haupt-Effekt: Betreten / Verlassen des Meetingraums
  useEffect(() => {
    const prev = prevRoomRef.current;
    prevRoomRef.current = currentRoom;

    if (currentRoom === 'Meetingraum') {
      const lockStore = useRoomLockStore.getState();
      if (lockStore.isLocked('Meetingraum') && !lockStore.admitted) {
        return; // locked — player must knock
      }
      if (lockStore.admitted) {
        lockStore.setAdmitted(false);
      }

      const { status, roomName } = useLiveKitStore.getState();
      if (status === 'idle') {
        connect('meeting');
      } else if (status === 'connected' && roomName !== 'meeting') {
        switchRoom('meeting');
      }
      // Fehler-Retry wird im Subscription-Effekt unten gesteuert
    } else if (prev === 'Meetingraum') {
      clearRetry();
      // Immer disconnecten – auch wenn status === 'error' (Room-Objekt stoppen)
      const { status } = useLiveKitStore.getState();
      if (status !== 'idle') {
        disconnect();
      }
    }
  }, [currentRoom, admitted, connect, switchRoom, disconnect]);

  // Retry-Effekt: bei Fehler nach 5s erneut verbinden
  useEffect(() => {
    if (currentRoom !== 'Meetingraum') return;

    let prevStatus = useLiveKitStore.getState().status;

    const unsub = useLiveKitStore.subscribe((state) => {
      if (state.status === 'error' && prevStatus !== 'error') {
        clearRetry();
        retryRef.current = setTimeout(() => {
          retryRef.current = null;
          if (usePlayerStore.getState().currentRoom === 'Meetingraum') {
            const lockStore = useRoomLockStore.getState();
            if (!lockStore.isLocked('Meetingraum') || lockStore.admitted) {
              connect('meeting');
            }
          }
        }, 5000);
      }
      prevStatus = state.status;
    });

    return () => {
      unsub();
      clearRetry();
    };
  }, [currentRoom, connect]);
}
