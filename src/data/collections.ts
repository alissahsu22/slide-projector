import type { Collection, Photo } from '../types/collection';
import { publicUrl } from '../lib/publicUrl';

const SF_SUMMER_PHOTOS: Photo[] = [
  { id: 'sf-summer-01', src: publicUrl('photos/sf-summer/01.webp'), thumbSrc: publicUrl('photos/sf-summer/01.thumb.webp'), order: 0, width: 1920, height: 1440 },
  { id: 'sf-summer-02', src: publicUrl('photos/sf-summer/02.webp'), thumbSrc: publicUrl('photos/sf-summer/02.thumb.webp'), order: 1, width: 1440, height: 1920 },
  { id: 'sf-summer-03', src: publicUrl('photos/sf-summer/03.webp'), thumbSrc: publicUrl('photos/sf-summer/03.thumb.webp'), order: 2, width: 1440, height: 1920 },
  { id: 'sf-summer-04', src: publicUrl('photos/sf-summer/04.webp'), thumbSrc: publicUrl('photos/sf-summer/04.thumb.webp'), order: 3, width: 1440, height: 1920 },
  { id: 'sf-summer-05', src: publicUrl('photos/sf-summer/05.webp'), thumbSrc: publicUrl('photos/sf-summer/05.thumb.webp'), order: 4, width: 1440, height: 1920 },
  { id: 'sf-summer-06', src: publicUrl('photos/sf-summer/06.webp'), thumbSrc: publicUrl('photos/sf-summer/06.thumb.webp'), order: 5, width: 1920, height: 1440 },
  { id: 'sf-summer-07', src: publicUrl('photos/sf-summer/07.webp'), thumbSrc: publicUrl('photos/sf-summer/07.thumb.webp'), order: 6, width: 1440, height: 1920 },
  { id: 'sf-summer-08', src: publicUrl('photos/sf-summer/08.webp'), thumbSrc: publicUrl('photos/sf-summer/08.thumb.webp'), order: 7, width: 1920, height: 1440 },
  { id: 'sf-summer-09', src: publicUrl('photos/sf-summer/09.webp'), thumbSrc: publicUrl('photos/sf-summer/09.thumb.webp'), order: 8, width: 1440, height: 1920 },
  { id: 'sf-summer-10', src: publicUrl('photos/sf-summer/10.webp'), thumbSrc: publicUrl('photos/sf-summer/10.thumb.webp'), order: 9, width: 1920, height: 1440 },
  { id: 'sf-summer-11', src: publicUrl('photos/sf-summer/11.webp'), thumbSrc: publicUrl('photos/sf-summer/11.thumb.webp'), order: 10, width: 1920, height: 1440 },
  { id: 'sf-summer-12', src: publicUrl('photos/sf-summer/12.webp'), thumbSrc: publicUrl('photos/sf-summer/12.thumb.webp'), order: 11, width: 1440, height: 1920 },
  { id: 'sf-summer-13', src: publicUrl('photos/sf-summer/13.webp'), thumbSrc: publicUrl('photos/sf-summer/13.thumb.webp'), order: 12, width: 1920, height: 1440 },
  { id: 'sf-summer-14', src: publicUrl('photos/sf-summer/14.webp'), thumbSrc: publicUrl('photos/sf-summer/14.thumb.webp'), order: 13, width: 1440, height: 1920 },
  { id: 'sf-summer-15', src: publicUrl('photos/sf-summer/15.webp'), thumbSrc: publicUrl('photos/sf-summer/15.thumb.webp'), order: 14, width: 1440, height: 1920 },
  { id: 'sf-summer-16', src: publicUrl('photos/sf-summer/16.webp'), thumbSrc: publicUrl('photos/sf-summer/16.thumb.webp'), order: 15, width: 1920, height: 1440 },
  { id: 'sf-summer-17', src: publicUrl('photos/sf-summer/17.webp'), thumbSrc: publicUrl('photos/sf-summer/17.thumb.webp'), order: 16, width: 1920, height: 1440 },
  { id: 'sf-summer-18', src: publicUrl('photos/sf-summer/18.webp'), thumbSrc: publicUrl('photos/sf-summer/18.thumb.webp'), order: 17, width: 1440, height: 1920 },
  { id: 'sf-summer-19', src: publicUrl('photos/sf-summer/19.webp'), thumbSrc: publicUrl('photos/sf-summer/19.thumb.webp'), order: 18, width: 1206, height: 1608 },
  { id: 'sf-summer-20', src: publicUrl('photos/sf-summer/20.webp'), thumbSrc: publicUrl('photos/sf-summer/20.thumb.webp'), order: 19, width: 1104, height: 1370 },
  { id: 'sf-summer-21', src: publicUrl('photos/sf-summer/21.webp'), thumbSrc: publicUrl('photos/sf-summer/21.thumb.webp'), order: 20, width: 1020, height: 734 },
];

/**
 * Magazines that ship with the site. Add another entry here (and files under
 * `public/photos/`) to put a second real tape in the crate.
 * Keep `id` values stable so remembered slide positions in localStorage still match.
 */
export const BUILTIN_COLLECTIONS: Collection[] = [
  {
    id: 'sf-summer',
    title: 'SF Summer',
    date: 'Summer 2026',
    coverImage: publicUrl('photos/sf-summer/01.webp'),
    currentSlide: 0,
    photos: SF_SUMMER_PHOTOS,
    bodyColor: '#cfd6c8',
    accentColor: '#3f6f88',
    labelTint: '#eef1e6',
  },
];
