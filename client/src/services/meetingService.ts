import { listObjects, createObject, patchObject, uploadMedia } from './objectClient';
import { useMeetingStore } from '../model/stores/meetingStore';

const COLLECTION = 'meeting_rooms';
const ROOM_REF   = 'meeting';

/** Lädt den aktuellen Meetingraum-Hintergrund vom ObjectService und schreibt ihn in den Store. */
export async function loadMeetingBg(): Promise<void> {
  try {
    const docs = await listObjects(COLLECTION, { 'ref[room]': ROOM_REF, limit: '1' });
    const doc = docs[0];
    if (!doc) return;
    const { setBgUrl, setBgObjectId } = useMeetingStore.getState();
    setBgObjectId(doc._id);
    const url = (doc.data.backgroundUrl as string | null) ?? null;
    setBgUrl(url);
  } catch (err) {
    console.warn('[Meeting] loadMeetingBg Fehler:', err);
  }
}

/**
 * Lädt ein Bild zum MediaService hoch, speichert die URL im ObjectService
 * und gibt die URL zurück (für den WS-Broadcast).
 */
export async function uploadAndSaveMeetingBg(file: File): Promise<string> {
  const { url } = await uploadMedia(file, 'VirtualOffice', 'meeting_backgrounds');

  const { bgObjectId, setBgUrl, setBgObjectId } = useMeetingStore.getState();
  let objectId = bgObjectId;

  if (objectId) {
    await patchObject(COLLECTION, objectId, { backgroundUrl: url });
  } else {
    const doc = await createObject(COLLECTION, { backgroundUrl: url }, { room: ROOM_REF });
    objectId = doc._id;
    setBgObjectId(objectId);
  }

  setBgUrl(url);
  return url;
}

/** Entfernt den Hintergrund (setzt null im ObjectService und Store). */
export async function clearMeetingBg(): Promise<void> {
  const { bgObjectId, setBgUrl } = useMeetingStore.getState();
  setBgUrl(null);
  if (bgObjectId) {
    await patchObject(COLLECTION, bgObjectId, { backgroundUrl: null }).catch(() => {});
  }
}
