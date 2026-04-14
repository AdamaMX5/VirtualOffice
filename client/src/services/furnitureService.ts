/**
 * furnitureService – plain async Funktionen (kein React-Hook).
 * Alle Funktionen lesen/schreiben den furnitureStore direkt über getState().
 */
import { useFurnitureStore, CatalogItem, PlacedItem } from '../model/stores/furnitureStore';
import {
  listObjects, createObject, patchObject, deleteObject, uploadMedia,
  getJwtUserId, ObjectDoc,
} from './objectClient';

const CATALOG_COL = 'furniture_catalog';
const PLACED_COL  = 'office_furniture';

// Normalisiert alte type-Werte und freie Strings auf kanonische Gruppen
const GROUP_MAP: Record<string, string> = {
  desk:           'Arbeitsplätze',
  Schreibtisch:   'Arbeitsplätze',
  Arbeitsplatz:   'Arbeitsplätze',
  todo_board:     'Boards',
  'Todo-Board':   'Boards',
  Board:          'Boards',
  chair:          'Sitzgelegenheiten',
  Sessel:         'Sitzgelegenheiten',
  Stuhl:          'Sitzgelegenheiten',
  decoration:     'Dekoration',
  Dekoration:     'Dekoration',
};

// ── Mapper ────────────────────────────────────────────────────────────────────

function toCatalogItem(doc: ObjectDoc): CatalogItem {
  const d = doc.data;
  const rawGroup = String(d.group ?? d.type ?? 'Sonstiges');
  return {
    id:            doc._id,
    name:          String(d.name          ?? ''),
    type:          String(d.type          ?? rawGroup),
    imageUrl:      String(d.imageUrl      ?? ''),
    defaultWidth:  Number(d.defaultWidth  ?? 2),
    defaultHeight: Number(d.defaultHeight ?? 2),
    group:         GROUP_MAP[rawGroup] ?? rawGroup,
  };
}

function toPlacedItem(doc: ObjectDoc): PlacedItem {
  const d = doc.data;
  return {
    id:            doc._id,
    x:             Number(d.x             ?? 0),
    y:             Number(d.y             ?? 0),
    width:         Number(d.width         ?? 2),
    height:        Number(d.height        ?? 2),
    rotation:      Number(d.rotation      ?? 0),
    type:          String(d.type          ?? 'decoration'),
    imageUrl:      String(d.imageUrl      ?? ''),
    catalogItemId: String(d.catalogItemId ?? ''),
    roomId:        d.roomId ? String(d.roomId) : undefined,
    ownerId:       doc.refs?.ownerId ?? String(d.ownerId ?? ''),
  };
}

// ── Laden ─────────────────────────────────────────────────────────────────────

export async function loadCatalog(): Promise<void> {
  try {
    const docs = await listObjects(CATALOG_COL, { app: 'VirtualOffice', limit: '200' });
    useFurnitureStore.getState().setCatalogItems(docs.map(toCatalogItem));
  } catch (err) {
    console.error('[furniture] Katalog laden:', err);
  }
}

export async function loadPlacedItems(roomId?: string): Promise<void> {
  try {
    const params: Record<string, string> = { app: 'VirtualOffice', limit: '500' };
    if (roomId) params['ref[roomId]'] = roomId;
    const docs = await listObjects(PLACED_COL, params);
    useFurnitureStore.getState().setPlacedItems(docs.map(toPlacedItem));
  } catch (err) {
    console.error('[furniture] Möbel laden:', err);
  }
}

// ── Platzieren / Bearbeiten / Löschen ─────────────────────────────────────────

/** Legt ein neues Möbelstück auf der Karte ab (x/y = Mittelpunkt in Tiles). */
export async function placeItem(
  catalogItem: CatalogItem,
  x: number,
  y: number,
  roomId?: string,
): Promise<void> {
  const ownerId = getJwtUserId();
  const data: Record<string, unknown> = {
    x, y,
    width:         catalogItem.defaultWidth,
    height:        catalogItem.defaultHeight,
    rotation:      0,
    type:          catalogItem.type,
    imageUrl:      catalogItem.imageUrl,
    catalogItemId: catalogItem.id,
    roomId:        roomId ?? null,
  };
  const refs: Record<string, string> = { ownerId };
  if (roomId) refs.roomId = roomId;

  try {
    const doc = await createObject(PLACED_COL, data, refs);
    useFurnitureStore.getState().addPlacedItem(toPlacedItem(doc));
  } catch (err) {
    console.error('[furniture] Platzieren fehlgeschlagen:', err);
  }
}

/** Optimistic: Store sofort aktualisieren, dann persistieren. */
export async function moveItem(id: string, x: number, y: number): Promise<void> {
  useFurnitureStore.getState().updatePlacedItem(id, { x, y });
  try {
    await patchObject(PLACED_COL, id, { x, y });
  } catch (err) {
    console.error('[furniture] Verschieben fehlgeschlagen:', err);
  }
}

export async function resizeItem(id: string, width: number, height: number): Promise<void> {
  useFurnitureStore.getState().updatePlacedItem(id, { width, height });
  try {
    await patchObject(PLACED_COL, id, { width, height });
  } catch (err) {
    console.error('[furniture] Skalieren fehlgeschlagen:', err);
  }
}

export async function rotateItem(id: string, rotation: number): Promise<void> {
  useFurnitureStore.getState().updatePlacedItem(id, { rotation });
  try {
    await patchObject(PLACED_COL, id, { rotation });
  } catch (err) {
    console.error('[furniture] Drehen fehlgeschlagen:', err);
  }
}

export async function deleteItem(id: string): Promise<void> {
  useFurnitureStore.getState().removePlacedItem(id);
  try {
    await deleteObject(PLACED_COL, id);
  } catch (err) {
    console.error('[furniture] Löschen fehlgeschlagen:', err);
  }
}

// ── Katalog-Upload ────────────────────────────────────────────────────────────

export async function uploadCatalogItem(
  file: File,
  name: string,
  type: string,
  group: string,
  defaultWidth: number,
  defaultHeight: number,
): Promise<void> {
  const { url } = await uploadMedia(file, 'VirtualOffice', 'furniture', name);
  const ownerId = getJwtUserId();
  const data = { name, type, group, imageUrl: url, defaultWidth, defaultHeight };
  const doc = await createObject(CATALOG_COL, data, { uploadedBy: ownerId });
  useFurnitureStore.getState().addCatalogItem(toCatalogItem(doc));
}

export async function updateCatalogItem(
  id: string,
  fields: { name?: string; group?: string; defaultWidth?: number; defaultHeight?: number },
): Promise<void> {
  const doc = await patchObject(CATALOG_COL, id, fields);
  useFurnitureStore.getState().updateCatalogItem(id, toCatalogItem(doc));
}

export async function deleteCatalogItem(id: string): Promise<void> {
  useFurnitureStore.getState().removeCatalogItem(id);
  try {
    await deleteObject(CATALOG_COL, id);
  } catch (err) {
    console.error('[furniture] Katalog-Eintrag löschen:', err);
  }
}
