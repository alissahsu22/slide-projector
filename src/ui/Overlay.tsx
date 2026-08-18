import { getCollection, toggleOrbitInspect, useExperience } from '../state/store';

export function Overlay() {
  const mode = useExperience((s) => s.mode);
  const insertedId = useExperience((s) => s.insertedId);
  const selectedCollectionId = useExperience((s) => s.selectedCollectionId);
  const orbitInspect = useExperience((s) => s.orbitInspect);
  const hoveredId = useExperience((s) => s.hoveredId);
  const crateSelectedId = useExperience((s) => s.crateSelectedId);
  const inCatalog = mode === 'CATALOG' && !insertedId && !selectedCollectionId;

  const hoveredCollection = getCollection(hoveredId);
  const selectedCollection = getCollection(crateSelectedId);
  // Hover takes priority; fall back to pinned selection for the info line.
  const readoutCollection = hoveredCollection ?? selectedCollection;
  const showCatalogHint = inCatalog && !readoutCollection && !orbitInspect;

  return (
    <>
      <button
        type="button"
        className={`orbit-toggle ${orbitInspect ? 'is-on' : ''}`}
        onClick={() => toggleOrbitInspect()}
      >
        {orbitInspect ? 'Exit orbit' : 'Orbit room'}
      </button>
      {orbitInspect && (
        <p className="status">Drag to look around · scroll to zoom · right-drag to pan</p>
      )}
      {showCatalogHint && (
        <p className="hint">Click a magazine to select it · + for a new roll</p>
      )}
      {inCatalog && !orbitInspect && readoutCollection && (
        <div className="magazine-readout">
          <span className="magazine-readout-title">{readoutCollection.title}</span>
          <span className="magazine-readout-meta">
            {readoutCollection.date} · {readoutCollection.photos.length}{' '}
            {readoutCollection.photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>
      )}
      {!orbitInspect && mode === 'INSERTING' && <p className="status">Inserting magazine…</p>}
      {!orbitInspect && mode === 'SWITCHING' && <p className="status">Changing magazines…</p>}
    </>
  );
}
