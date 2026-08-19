import { useFrame } from '@react-three/fiber';
import { buildHomePlan, writeMagazineHome } from '../experience/homes';
import { sceneApi } from '../experience/sceneApi';
import { getState, useExperience } from '../state/store';
import { Cartridge } from './Cartridge';

/**
 * Every magazine in the library gets one cartridge. Where it stands is decided
 * by its home pose, rewritten each frame: the curated ones follow the crate,
 * the rest sit in their own slot on the shelf.
 */
export function Cartridges() {
  const collections = useExperience((s) => s.collections);

  useFrame(() => {
    const s = getState();
    const plan = buildHomePlan(s);
    for (const collection of s.collections) {
      const handle = sceneApi.cartridges.get(collection.id);
      if (!handle || handle.loose) continue;
      if (s.insertedId === collection.id) continue;
      writeMagazineHome(collection.id, plan, s, handle.home);
    }
  }, -3);

  return (
    <group>
      {collections.map((collection) => (
        <Cartridge key={collection.id} collection={collection} />
      ))}
    </group>
  );
}
