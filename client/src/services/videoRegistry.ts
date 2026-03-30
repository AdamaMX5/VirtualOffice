/**
 * Module-level registry: participant name → HTMLVideoElement
 * Updated by VideoManager, read by AvatarLayer.
 */

const _videoMap  = new Map<string, HTMLVideoElement>();
const _activeCams = new Set<string>(); // names with active camera track
let _reloadFn: () => void = () => {};

export const videoRegistry = {
  setVideo(name: string, el: HTMLVideoElement): void {
    _videoMap.set(name, el);
  },

  removeVideo(name: string): void {
    _videoMap.delete(name);
    _activeCams.delete(name);
  },

  setActive(name: string, active: boolean): void {
    if (active) _activeCams.add(name);
    else        _activeCams.delete(name);
  },

  /** Returns the HTMLVideoElement when this participant has an active camera, otherwise null. */
  getActive(name: string): HTMLVideoElement | null {
    return _activeCams.has(name) ? (_videoMap.get(name) ?? null) : null;
  },

  hasAny(): boolean {
    return _activeCams.size > 0;
  },
};

export function registerReloadAll(fn: () => void): void {
  _reloadFn = fn;
}

export function reloadAllVideos(): void {
  _reloadFn();
}
