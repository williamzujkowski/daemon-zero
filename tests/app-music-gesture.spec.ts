// @vitest-environment node
/**
 * The first-gesture resume must survive a gesture that cannot start anything. Preferences
 * load asynchronously, so an early tap makes resume() a no-op; disarming there would leave
 * a default-on install silent with no second chance.
 */
import { describe, expect, it, vi } from 'vitest';
import { attachMusicGestureResume } from '../src/app/musicGesture';

function fakeDocument() {
  const handlers = new Map<string, Set<() => void>>();
  const bucket = (type: string) => {
    const existing = handlers.get(type);
    if (existing) return existing;
    const created = new Set<() => void>();
    handlers.set(type, created);
    return created;
  };
  return {
    addEventListener: (type: string, handler: () => void) => { bucket(type).add(handler); },
    removeEventListener: (type: string, handler: () => void) => { bucket(type).delete(handler); },
    fire: (type: string) => { for (const handler of [...bucket(type)]) handler(); },
    attached: () => [...handlers.values()].reduce((total, set) => total + set.size, 0),
  };
}

describe('music gesture resume', () => {
  it('keeps the listeners after a gesture that could not start anything', () => {
    const doc = fakeDocument();
    let loaded = false;
    const resume = vi.fn(() => { if (!loaded) return; });
    const detach = attachMusicGestureResume(resume, doc);
    expect(doc.attached()).toBe(3);
    doc.fire('pointerdown');
    expect(resume).toHaveBeenCalledOnce();
    // The no-op gesture must not disarm the listener: the next input still resumes.
    expect(doc.attached()).toBe(3);
    loaded = true;
    doc.fire('keydown');
    expect(resume).toHaveBeenCalledTimes(2);
    detach();
    doc.fire('touchstart');
    expect(resume).toHaveBeenCalledTimes(2);
    expect(doc.attached()).toBe(0);
  });

  it('listens on all three gestures and detaching twice is harmless', () => {
    const doc = fakeDocument();
    const resume = vi.fn();
    const detach = attachMusicGestureResume(resume, doc);
    for (const gesture of ['pointerdown', 'keydown', 'touchstart']) doc.fire(gesture);
    expect(resume).toHaveBeenCalledTimes(3);
    detach(); detach();
    expect(doc.attached()).toBe(0);
  });
});