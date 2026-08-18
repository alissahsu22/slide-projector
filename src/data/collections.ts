import type { Collection, Photo } from '../types/collection';
import { placeholderPhotos } from '../lib/placeholderPhotos';

function photos(
  folder: string,
  count: number,
  portraits: number[] = [],
): Photo[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    const portrait = portraits.includes(i);
    return {
      id: `${folder}-${n}`,
      src: `/photos/${folder}/${n}.jpg`,
      order: i,
      width: portrait ? 900 : 1600,
      height: portrait ? 1400 : 1067,
    };
  });
}

/**
 * Solid-color stand-ins in /public/photos — swap `src` for real photographs.
 * Keep `id` stable so localStorage progress still maps correctly.
 */
export const MOCK_COLLECTIONS: Collection[] = [
  {
    id: 'thailand',
    title: 'Thailand',
    date: 'June 2026',
    coverImage: '/photos/thailand/01.jpg',
    currentSlide: 0,
    photos: photos('thailand', 8, [2]),
    bodyColor: '#e4d2b4',
    accentColor: '#c45a32',
    labelTint: '#f4ead4',
  },
  {
    id: 'sf',
    title: 'SF Summer',
    date: 'July 2026',
    coverImage: '/photos/sf/01.jpg',
    currentSlide: 0,
    photos: photos('sf', 8, [4]),
    bodyColor: '#cfd6c8',
    accentColor: '#3f6f88',
    labelTint: '#eef1e6',
  },
  {
    id: 'nyc',
    title: 'New York',
    date: 'Fall 2025',
    coverImage: '/photos/nyc/01.jpg',
    currentSlide: 0,
    photos: photos('nyc', 8, [2]),
    bodyColor: '#d7b7a2',
    accentColor: '#6b2f2a',
    labelTint: '#f0e2d0',
  },
  {
    id: 'japan',
    title: 'Japan',
    date: 'April 2026',
    currentSlide: 0,
    photos: placeholderPhotos('japan', 'Japan', 8, [1, 5]),
    bodyColor: '#d8d0c4',
    accentColor: '#8a2a28',
    labelTint: '#f2ece0',
  },
  {
    id: 'berlin',
    title: 'Berlin',
    date: 'Mar 2024',
    currentSlide: 0,
    photos: placeholderPhotos('berlin', 'Berlin', 8, [3]),
    bodyColor: '#c8c4bc',
    accentColor: '#3a3a40',
    labelTint: '#ece8e0',
  },
  {
    id: 'lisbon',
    title: 'Lisbon',
    date: 'May 2025',
    currentSlide: 0,
    photos: placeholderPhotos('lisbon', 'Lisbon', 8, [2]),
    bodyColor: '#e0c8a8',
    accentColor: '#c47838',
    labelTint: '#f4ead8',
  },
  {
    id: 'morocco',
    title: 'Morocco',
    date: 'Oct 2025',
    currentSlide: 0,
    photos: placeholderPhotos('morocco', 'Morocco', 8, [4]),
    bodyColor: '#dcc4a0',
    accentColor: '#b44a28',
    labelTint: '#f0e4d0',
  },
  {
    id: 'iceland',
    title: 'Iceland',
    date: 'Jan 2026',
    currentSlide: 0,
    photos: placeholderPhotos('iceland', 'Iceland', 8, [0, 6]),
    bodyColor: '#c8d0d4',
    accentColor: '#3a6a88',
    labelTint: '#e8eef0',
  },
  {
    id: 'kyoto',
    title: 'Kyoto',
    date: 'Nov 2024',
    currentSlide: 0,
    photos: placeholderPhotos('kyoto', 'Kyoto', 8, [2, 5]),
    bodyColor: '#d4c8b8',
    accentColor: '#6a3a28',
    labelTint: '#f0e8dc',
  },
  {
    id: 'paris',
    title: 'Paris',
    date: 'June 2024',
    currentSlide: 0,
    photos: placeholderPhotos('paris', 'Paris', 8, [3]),
    bodyColor: '#d0c8bc',
    accentColor: '#4a5a78',
    labelTint: '#ece6dc',
  },
  {
    id: 'osaka',
    title: 'Osaka',
    date: 'Aug 2025',
    currentSlide: 0,
    photos: placeholderPhotos('osaka', 'Osaka', 8),
    bodyColor: '#d8c8b0',
    accentColor: '#b83828',
    labelTint: '#f2e8d8',
  },
];
