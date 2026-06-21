/**
 * Automatically connects to the LiveKit "meeting" room when the player enters
 * the meeting room area, and disconnects when they leave.
 *
 * When the meeting room is locked, the connection is blocked until the player
 * has been explicitly admitted by the room owner.
 *
 * On connection error, a retry is attempted after 5 seconds as long as the
 * player remains in the meeting room.
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

  // Main effect: entering / leaving the meeting room.
  // NO `admitted` in deps — setAdmitted() must not be called here, otherwise
  // the React #185 loop occurs (dep changes inside its own effect).
  useEffect(() => {
    const prev = prevRoomRef.current;
    prevRoomRef.current = currentRoom;

    if (currentRoom === 'Meetingraum') {
      const lockStore = useRoomLockStore.getState();
      if (lockStore.isLocked('Meetingraum') && !lockStore.admitted) {
        return; // locked — player must knock
      }

      const { status, roomName } = useLiveKitStore.getState();
      if (status === 'idle') {
        connect('meeting');
      } else if (status === 'connected' && roomName !== 'meeting') {
        switchRoom('meeting');
      }
      // Error retry is managed by the subscription effect below
    } else if (prev === 'Meetingraum') {
      clearRetry();
      // Always disconnect — even when status === 'error' (stop the Room object)
      const { status } = useLiveKitStore.getState();
      if (status !== 'idle') {
        disconnect();
      }
    }
  }, [currentRoom, connect, switchRoom, disconnect]);

  // Admission effect: fires when the player is let in by the room owner.
  // Consumes the admitted flag and then connects — kept separate from the main
  // effect so that setAdmitted(false) is NOT inside an effect that has admitted
  // as a dependency.
  useEffect(() => {
    if (!admitted || currentRoom !== 'Meetingraum') return;
    useRoomLockStore.getState().setAdmitted(false); // consume the flag
    const { status, roomName } = useLiveKitStore.getState();
    if (status === 'idle') {
      connect('meeting');
    } else if (status === 'connected' && roomName !== 'meeting') {
      switchRoom('meeting');
    }
  }, [admitted, currentRoom, connect, switchRoom]);

  // Retry effect: reconnect after 5s on error
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
