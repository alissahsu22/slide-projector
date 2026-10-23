export type Credit = {
  title: string;
  author: string;
  source: string;
};

/**
 * Third-party models in the room, as recorded in each source GLB's
 * `asset.extras` (models-src/). All are CC BY 4.0; the shipped copies in
 * public/models are compressed with resized textures, which the licence asks
 * us to say. Add a model here when it joins the room.
 */
export const MODEL_CREDITS: Credit[] = [
  {
    title: 'Book Shelf',
    author: 'Darren McNerney 3D',
    source: 'https://sketchfab.com/3d-models/book-shelf-eb8f9728cd9347f4b67adaaf4db1abca',
  },
  {
    title: 'Grey Carpet',
    author: 'mrfunnysheep',
    source: 'https://sketchfab.com/3d-models/grey-carpet-640126c0558f4e77924c44c79936655d',
  },
  {
    title: 'Curtains',
    author: 'VisuTech',
    source: 'https://sketchfab.com/3d-models/curtains-a17ace804737479981f4d96350b0fb37',
  },
  {
    title: 'Old Door',
    author: 'Game Ready Art',
    source: 'https://sketchfab.com/3d-models/old-door-f2f77bd326c9486eaee65b87e84e9be9',
  },
  {
    title: 'Plush Unicorn',
    author: 'C.U.V',
    source: 'https://sketchfab.com/3d-models/plush-unicorn-fd6f044ab8164a7e947f69fbe58435ee',
  },
];

export const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/';
