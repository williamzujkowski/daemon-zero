/**
 * Browsers refuse audio until a real user gesture, so a default-on soundtrack would
 * fail into the controller's blocked state on first load. This attaches one-shot
 * listeners that resume playback inside the first genuine input and then unbind
 * themselves; native platforms have no such policy and need nothing.
 */
export interface GestureDocument {
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

/** Returns a function that detaches the listeners early. Idempotent: fires once. */
export function attachMusicGestureResume(resume: () => void, doc: GestureDocument): () => void {
  let armed = true;
  const detach = () => {
    armed = false;
    for (const gesture of GESTURES) doc.removeEventListener(gesture, onGesture);
  };
  const onGesture = () => {
    if (!armed) return;
    detach();
    resume();
  };
  for (const gesture of GESTURES) doc.addEventListener(gesture, onGesture);
  return detach;
}