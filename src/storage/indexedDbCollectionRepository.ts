import type {
  CollectionRecord,
  CollectionRepository,
  StoredCollection,
  StoredPhoto,
} from './types';

const DB_NAME = 'upstairs';
const DB_VERSION = 1;
const COLLECTIONS = 'collections';
const PHOTOS = 'photos';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser'));
      opening = null;
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(COLLECTIONS)) {
        db.createObjectStore(COLLECTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PHOTOS)) {
        const photos = db.createObjectStore(PHOTOS, { keyPath: 'id' });
        photos.createIndex('collectionId', 'collectionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new Error('Could not open IndexedDB'));
    };
  });
  return opening;
}

function assemble(
  collection: StoredCollection,
  photos: StoredPhoto[],
): CollectionRecord {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const ordered = collection.photoIds
    .map((id) => byId.get(id))
    .filter((photo): photo is StoredPhoto => Boolean(photo))
    .sort((a, b) => a.order - b.order);
  return { collection, photos: ordered };
}

export const indexedDbCollectionRepository: CollectionRepository = {
  async list(): Promise<CollectionRecord[]> {
    const db = await openDb();
    const tx = db.transaction([COLLECTIONS, PHOTOS], 'readonly');
    const collectionsP = requestToPromise(
      tx.objectStore(COLLECTIONS).getAll() as IDBRequest<StoredCollection[]>,
    );
    const photosP = requestToPromise(
      tx.objectStore(PHOTOS).getAll() as IDBRequest<StoredPhoto[]>,
    );
    const [collections, photos] = await Promise.all([collectionsP, photosP]);

    const grouped = new Map<string, StoredPhoto[]>();
    for (const photo of photos) {
      const list = grouped.get(photo.collectionId) ?? [];
      list.push(photo);
      grouped.set(photo.collectionId, list);
    }

    return collections
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((collection) => assemble(collection, grouped.get(collection.id) ?? []));
  },

  async get(id: string): Promise<CollectionRecord | null> {
    const db = await openDb();
    const tx = db.transaction([COLLECTIONS, PHOTOS], 'readonly');
    const collectionP = requestToPromise(
      tx.objectStore(COLLECTIONS).get(id) as IDBRequest<StoredCollection | undefined>,
    );
    const photosP = requestToPromise(
      tx.objectStore(PHOTOS).index('collectionId').getAll(id) as IDBRequest<StoredPhoto[]>,
    );
    const [collection, photos] = await Promise.all([collectionP, photosP]);
    if (!collection) return null;
    return assemble(collection, photos);
  },

  async save(record: CollectionRecord): Promise<void> {
    const db = await openDb();
    const readTx = db.transaction(PHOTOS, 'readonly');
    const existing = await requestToPromise(
      readTx.objectStore(PHOTOS).index('collectionId').getAllKeys(record.collection.id) as IDBRequest<IDBValidKey[]>,
    );

    const tx = db.transaction([COLLECTIONS, PHOTOS], 'readwrite');
    const photoStore = tx.objectStore(PHOTOS);
    const keep = new Set(record.photos.map((photo) => photo.id));
    for (const key of existing) {
      if (!keep.has(String(key))) photoStore.delete(key);
    }
    tx.objectStore(COLLECTIONS).put(record.collection);
    for (const photo of record.photos) {
      photoStore.put(photo);
    }
    await transactionDone(tx);
  },

  async updateCurrentSlide(id: string, currentSlide: number): Promise<void> {
    const db = await openDb();
    const readTx = db.transaction(COLLECTIONS, 'readonly');
    const collection = await requestToPromise(
      readTx.objectStore(COLLECTIONS).get(id) as IDBRequest<StoredCollection | undefined>,
    );
    if (!collection) return;
    const tx = db.transaction(COLLECTIONS, 'readwrite');
    tx.objectStore(COLLECTIONS).put({ ...collection, currentSlide });
    await transactionDone(tx);
  },

  async remove(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([COLLECTIONS, PHOTOS], 'readwrite');
    const photoStore = tx.objectStore(PHOTOS);
    const keys = await requestToPromise(
      photoStore.index('collectionId').getAllKeys(id) as IDBRequest<IDBValidKey[]>,
    );
    for (const key of keys) {
      photoStore.delete(key);
    }
    tx.objectStore(COLLECTIONS).delete(id);
    await transactionDone(tx);
  },

  async deletePhotos(photoIds: string[]): Promise<void> {
    if (!photoIds.length) return;
    const db = await openDb();
    const tx = db.transaction(PHOTOS, 'readwrite');
    const store = tx.objectStore(PHOTOS);
    for (const id of photoIds) {
      store.delete(id);
    }
    await transactionDone(tx);
  },
};
