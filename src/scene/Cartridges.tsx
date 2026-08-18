import { useLayoutEffect } from 'react';
import { crateSlotWorld } from '../experience/layout';
import { sceneApi } from '../experience/sceneApi';
import { getState, useExperience } from '../state/store';
import { Cartridge } from './Cartridge';

export function Cartridges() {
  const collections = useExperience((s) => s.collections);
  const count = collections.length + 1;

  useLayoutEffect(() => {
    collections.forEach((collection, index) => {
      const handle = sceneApi.cartridges.get(collection.id);
      if (!handle || handle.loose) return;
      if (getState().insertedId === collection.id) return;
      const home = crateSlotWorld(index, count);
      handle.home.x = home.x;
      handle.home.y = home.y;
      handle.home.z = home.z;
      handle.home.rx = home.rx;
      handle.home.ry = home.ry;
      handle.home.rz = home.rz;
    });
  }, [collections, count]);

  return (
    <group>
      {collections.map((collection, index) => (
        <Cartridge
          key={collection.id}
          collection={collection}
          index={index}
          count={count}
        />
      ))}
    </group>
  );
}
