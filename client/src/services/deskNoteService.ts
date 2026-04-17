/**
 * deskNoteService – Notizen auf Schreibtischen speichern/laden.
 * Collection: 'desk_notes'
 * refs: { deskId, authorId }
 * data: { text, x, y, authorName, createdAt }
 */
import { useDeskStore, DeskNote } from '../model/stores/deskStore';
import { listObjects, createObject, patchObject, deleteObject, getJwtUserId, ObjectDoc } from './objectClient';

const COL = 'desk_notes';

function toNote(doc: ObjectDoc): DeskNote {
  const d = doc.data;
  return {
    id:         doc._id,
    deskId:     doc.refs?.deskId     ?? String(d.deskId     ?? ''),
    text:       String(d.text        ?? ''),
    x:          Number(d.x           ?? 0.1),
    y:          Number(d.y           ?? 0.1),
    authorId:   doc.refs?.authorId   ?? String(d.authorId   ?? ''),
    authorName: String(d.authorName  ?? 'Unbekannt'),
    createdAt:  String(d.createdAt   ?? new Date().toISOString()),
  };
}

export async function loadDeskNotes(deskId: string): Promise<void> {
  try {
    const docs = await listObjects(COL, {
      app: 'VirtualOffice',
      'ref[deskId]': deskId,
      limit: '100',
    });
    useDeskStore.getState().setNotes(docs.map(toNote));
  } catch (err) {
    console.error('[desk] Notizen laden:', err);
  }
}

export async function addDeskNote(
  deskId: string,
  text: string,
  x: number,
  y: number,
  authorName: string,
): Promise<void> {
  const authorId = getJwtUserId();
  const data = {
    text,
    x,
    y,
    authorName,
    deskId,
    createdAt: new Date().toISOString(),
  };
  try {
    const doc = await createObject(COL, data, { deskId, authorId });
    useDeskStore.getState().addNote(toNote(doc));
  } catch (err) {
    console.error('[desk] Notiz erstellen:', err);
  }
}

export async function moveDeskNote(id: string, x: number, y: number): Promise<void> {
  useDeskStore.getState().updateNote(id, { x, y });
  try {
    await patchObject(COL, id, { x, y });
  } catch (err) {
    console.error('[desk] Notiz verschieben:', err);
  }
}

export async function deleteDeskNote(id: string): Promise<void> {
  useDeskStore.getState().removeNote(id);
  try {
    await deleteObject(COL, id);
  } catch (err) {
    console.error('[desk] Notiz löschen:', err);
  }
}
