import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  );
}

/** Keeps Tab inside a dialog and restores focus to whatever opened it. */
export function useDialogFocus(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    if (!root) return;
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const preferred = root.querySelector<HTMLElement>('[data-autofocus]');
    const items = focusable(root);
    (preferred ?? items[0])?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !root) return;
      const list = focusable(root);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, rootRef]);
}
