/**
 * A default-on soundtrack starts inside the player's first real input, on every platform.
 * Browsers refuse audio until a user gesture; native has no such rule, but a nexus option vote
 * (`native-first-gesture-resume`, docs/SOUNDTRACK.md) chose the same first tap there, so
 * nothing sounds before the player has touched the game.
 *
 * The listeners deliberately do NOT disarm themselves: preferences load asynchronously,
 * and a gesture arriving before that load makes `resume()` a no-op — detaching then
 * would lose the only chance to start playback, which is exactly the failure this
 * module exists to prevent. They detach once the controller reports activation.
 */
export interface GestureDocument {
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

/** Returns a function that detaches the listeners. Safe to call more than once. */
export function attachMusicGestureResume(resume: () => void, doc: GestureDocument): () => void {
  let attached = true;
  const onGesture = () => { if (attached) resume(); };
  const detach = () => {
    if (!attached) return;
    attached = false;
    for (const gesture of GESTURES) doc.removeEventListener(gesture, onGesture);
  };
  for (const gesture of GESTURES) doc.addEventListener(gesture, onGesture);
  return detach;
}

/** The slice of `MusicController` the resume needs. */
export interface ResumableMusic {
  state: { getState(): { activated: boolean }; subscribe(listener: (state: { activated: boolean }) => void): () => void };
  resume(): void;
}

/**
 * Listen on `doc` until the controller first reports activation, and return the teardown.
 * Detaching on activation, not on the first gesture, is what keeps a later pause meaning
 * pause: once the score has started, a tap never restarts it, so a media key's session pause
 * or a playback failure is answered only by `[ RESUME MUSIC ]`.
 */
export function armMusicGestureResume(controller: ResumableMusic, doc: GestureDocument): () => void {
  const detach = attachMusicGestureResume(() => { controller.resume(); }, doc);
  if (controller.state.getState().activated) detach();
  const unsubscribe = controller.state.subscribe((state) => { if (state.activated) detach(); });
  return () => { unsubscribe(); detach(); };
}

/** A gesture source fed by a React Native view instead of a DOM document. */
export interface TouchGestures extends GestureDocument {
  /** Shaped as a capture-phase responder probe: reports a touch start and never claims it. */
  readonly touch: () => boolean;
}

/**
 * Native has no document to listen on, so the root view feeds this through
 * `onStartShouldSetResponderCapture`, which React Native asks of every ancestor of a touch
 * before any child, and the answer `false` leaves the touch to whatever was pressed.
 */
export function createTouchGestures(): TouchGestures {
  const handlers = new Set<() => void>();
  return {
    addEventListener: (type, handler) => { if (type === 'touchstart') handlers.add(handler); },
    removeEventListener: (type, handler) => { if (type === 'touchstart') handlers.delete(handler); },
    touch: () => {
      for (const handler of [...handlers]) handler();
      return false;
    },
  };
}
