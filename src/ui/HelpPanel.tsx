import { useEffect, useRef } from 'react';
import { pauseAutoplay, resumeAutoplay } from '../experience/controller';
import { replayGuide } from '../state/guide';
import { setHelpOpen, useHelpOpen } from './aboutState';
import { useWebGLFailed } from './sceneStatus';
import { useCoarsePointer } from './useCoarsePointer';
import { useDialogFocus } from './useDialogFocus';

type Control = {
  action: string;
  keys: string[];
  /** Only the mouse or touch moves you can't see on screen. */
  note?: string;
};

type ControlGroup = {
  title: string;
  rows: Control[];
};

/**
 * Every row here is wired up. Add a key to this list only once it works. Notes
 * name the gestures of the pointer in hand: taps on touch, clicks otherwise.
 */
function roomGroups(coarse: boolean): ControlGroup[] {
  const press = coarse ? 'tap' : 'click';
  return [
    {
      title: 'In the room',
      rows: [
        { action: 'Choose a tape', keys: ['←', '→'], note: `or ${press} it` },
        {
          action: 'Play it',
          keys: ['Enter'],
          note: coarse ? 'or tap Play' : 'or click Play, or double-click the tape',
        },
        { action: 'Shelve a tape', keys: ['←', '→', 'Enter'], note: `or drag or ${press} it, with the shelf open` },
        {
          action: 'Look around',
          keys: [],
          note: coarse
            ? 'tap View room, then drag to turn, pinch to zoom, two-finger drag to pan'
            : 'click View room, then drag to turn, scroll to zoom, right-drag to pan',
        },
        { action: 'Leave the view', keys: ['Esc'], note: `or ${press} Exit view` },
      ],
    },
    {
      title: 'Playing a tape',
      rows: [
        { action: 'Pause', keys: ['Space'] },
        { action: 'Previous / next', keys: ['←', '→'] },
        { action: 'Start over', keys: ['R'] },
        { action: 'Back to the room', keys: ['Esc'] },
      ],
    },
  ];
}

/** The flat browser shown when the 3D room can't start. */
const FALLBACK_GROUPS: ControlGroup[] = [
  {
    title: 'Tapes',
    rows: [{ action: 'Previous / next memory', keys: ['←', '→'] }],
  },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="help-keys">
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`}>{key}</kbd>
      ))}
    </span>
  );
}

export function HelpPanel() {
  const open = useHelpOpen();
  const webglFailed = useWebGLFailed();
  const panelRef = useRef<HTMLDivElement>(null);
  const coarse = useCoarsePointer();
  useDialogFocus(open, panelRef);

  useEffect(() => {
    if (!open) return;
    pauseAutoplay();
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setHelpOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      resumeAutoplay();
    };
  }, [open]);

  if (!open) return null;

  const groups = webglFailed ? FALLBACK_GROUPS : roomGroups(coarse);

  return (
    <div
      className="about-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setHelpOpen(false);
      }}
    >
      <div
        ref={panelRef}
        className="about-panel help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div className="about-bar">
          <h2 className="about-title" id="help-title">
            How to explore
          </h2>
          <button
            type="button"
            className="album-prompt"
            data-autofocus
            onClick={() => setHelpOpen(false)}
          >
            <span className="album-key is-wide">Esc</span>
            Back
          </button>
        </div>
        <div className="about-body album-page">
          <p>
            {webglFailed
              ? 'Pick a tape from the list and step through its memories.'
              : 'Pick a tape from the crate and play it. Its memories fill the wall, one by one.'}
          </p>
          {groups.map((group) => (
            <table key={group.title} className="help-controls">
              <caption>{group.title}</caption>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.action}>
                    <th scope="row">{row.action}</th>
                    <td>
                      {row.keys.length > 0 && <Keys keys={row.keys} />}
                      {row.note && <span className="help-note">{row.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          {!webglFailed && (
            <button
              type="button"
              className="album-prompt help-replay"
              onClick={() => {
                replayGuide();
                setHelpOpen(false);
              }}
            >
              Show the hints again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
