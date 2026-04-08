import { create } from 'zustand';

export type LiveKitStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface LiveKitState {
  status: LiveKitStatus;
  roomName: string | null;
  micEnabled: boolean;
  camEnabled: boolean;
  speakerEnabled: boolean;
  /** Participant identity strings – changes trigger VideoGrid re-renders */
  participantIds: string[];
  /** Increments when tracks change within existing participants */
  trackVersion: number;
  error: string | null;
  errorUrl: string | null;
  errorStack: string | null;
  // Actions
  setStatus: (status: LiveKitStatus) => void;
  setRoomName: (name: string | null) => void;
  setMicEnabled: (v: boolean) => void;
  setCamEnabled: (v: boolean) => void;
  setSpeakerEnabled: (v: boolean) => void;
  setParticipantIds: (ids: string[]) => void;
  bumpTrackVersion: () => void;
  setError: (error: string | null, url?: string | null, stack?: string | null) => void;
  reset: () => void;
}

export const useLiveKitStore = create<LiveKitState>((set) => ({
  status: 'idle',
  roomName: null,
  micEnabled: false,
  camEnabled: false,
  speakerEnabled: true,
  participantIds: [],
  trackVersion: 0,
  error: null,
  errorUrl: null,
  errorStack: null,

  setStatus: (status) => set({ status }),
  setRoomName: (roomName) => set({ roomName }),
  setMicEnabled: (micEnabled) => set({ micEnabled }),
  setCamEnabled: (camEnabled) => set({ camEnabled }),
  setSpeakerEnabled: (speakerEnabled) => set({ speakerEnabled }),
  setParticipantIds: (participantIds) => set({ participantIds }),
  bumpTrackVersion: () => set((s) => ({ trackVersion: s.trackVersion + 1 })),
  setError: (error, url = null, stack = null) => set({ error, errorUrl: url, errorStack: stack }),
  reset: () => set({
    status: 'idle',
    roomName: null,
    micEnabled: false,
    camEnabled: false,
    participantIds: [],
    trackVersion: 0,
    error: null,
    errorUrl: null,
    errorStack: null,
  }),
}));
