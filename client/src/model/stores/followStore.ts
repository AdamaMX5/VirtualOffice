import { create } from 'zustand';

interface FollowState {
  followTarget: { userId: string; name: string } | null;
  incomingCall: { fromUserId: string; fromName: string } | null;
  startFollowing: (userId: string, name: string) => void;
  stopFollowing: () => void;
  setIncomingCall: (call: { fromUserId: string; fromName: string } | null) => void;
}

export const useFollowStore = create<FollowState>((set) => ({
  followTarget: null,
  incomingCall: null,
  startFollowing: (userId, name) => set({ followTarget: { userId, name } }),
  stopFollowing:  () => set({ followTarget: null }),
  setIncomingCall: (call) => set({ incomingCall: call }),
}));
