/**
 * Browsers refuse audio until a real user gesture, so a default-on soundtrack would
 * fail into the controller's blocked state on first load.
 *
 * The listeners deliberately do NOT disarm themselves: preferences load asynchronously,
 * and a gesture arriving before that load makes `resume()` a no-op — detaching then
 * would lose the only chance to start playback, which is exactly the failure this
 * module exists to prevent. The caller detaches once the controller reports activation.
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