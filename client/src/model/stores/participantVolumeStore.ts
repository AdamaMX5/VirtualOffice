import { create } from 'zustand';

interface ParticipantVolumeState {
  /** identity → gain (0 = stumm, 1 = normal, 2 = 200%) */
  volumes: Record<string, number>;
  setVolume: (identity: string, gain: number) => void;
  getVolume: (identity: string) => number;
}

export const useParticipantVolumeStore = create<ParticipantVolumeState>((set, get) => ({
  volumes: {},

  setVolume: (identity, gain) =>
    set((s) => ({ volumes: { ...s.volumes, [identity]: gain } })),

  getVolume: (identity) => get().volumes[identity] ?? 1,
}));
