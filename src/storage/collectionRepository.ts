import { indexedDbCollectionRepository } from './indexedDbCollectionRepository';
import type { CollectionRepository } from './types';

export type {
  CollectionRecord,
  CollectionRepository,
  StoredCollection,
  StoredPhoto,
} from './types';

/**
 * Active persistence backend. Swap this assignment when Supabase lands —
 * scene components keep consuming hydrated Collection / Photo data.
 */
export const collectionRepository: CollectionRepository =
  indexedDbCollectionRepository;
