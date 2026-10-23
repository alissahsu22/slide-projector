/**
 * A plain fade to black over the room. Reduced motion swaps the camera's flights
 * for this: cover, cut to the new view, uncover. Nothing on screen moves.
 */
let el: HTMLDivElement | null = null;

function veil(): HTMLDivElement {
  if (el?.isConnected) return el;
  el = document.createElement('div');
  el.className = 'motion-veil';
  el.setAttribute('aria-hidden', 'true');
  (document.querySelector('.app') ?? document.body).appendChild(el);
  return el;
}

function fade(opacity: number, ms: number): Promise<void> {
  const node = veil();
  node.style.transition = `opacity ${ms}ms ease`;
  // Read back so the transition starts from the current value.
  void node.offsetWidth;
  node.style.opacity = String(opacity);
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function coverRoom(ms = 160): Promise<void> {
  return fade(1, ms);
}

export function revealRoom(ms = 220): Promise<void> {
  return fade(0, ms);
}
