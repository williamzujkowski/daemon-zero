// @vitest-environment node
/**
 * The first-gesture resume must survive a gesture that cannot start anything. Preferences
 * load asynchronously, so an early tap makes resume() a no-op; disarming there would leave
 * a default-on install silent with no second chance. Native touches feed the same listeners
 * (#249), so the native source is held to the same contract.
 */
import { describe, expect, it, vi } from 'vitest';
import { armMusicGestureResume, attachMusicGestureResume, createTouchGestures } from '../src/app/musicGesture';

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

/** The controller surface the arm reads: an activation flag it subscribes to, and resume(). */
function fakeController(enabled = true) {
  let state = { activated: false };
  const listeners = new Set<(next: { activated: boolean }) => void>();
  const set = (activated: boolean) => { state = { activated }; for (const listener of [...listeners]) listener(state); };
  const resume = vi.fn(() => { if (enabled) set(true); });
  return {
    controller: { state: { getState: () => state, subscribe: (listener: (next: { activated: boolean }) => void) => {
      listeners.add(listener); return () => { listeners.delete(listener); }; } }, resume },
    resume, set, listeners,
  };
}

describe('arming the resume until activation', () => {
  it('resumes on the first gesture and then never again, so a later pause is answered only by RESUME MUSIC', () => {
    const doc = fakeDocument(), fake = fakeController();
    const teardown = armMusicGestureResume(fake.controller, doc);
    expect(doc.attached()).toBe(3);
    doc.fire('pointerdown');
    expect(fake.resume).toHaveBeenCalledOnce();
    expect(doc.attached(), 'activation detaches every listener').toBe(0);
    // A media key's session pause clears `activated`; the next tap must not undo it.
    fake.set(false);
    doc.fire('touchstart');
    expect(fake.resume).toHaveBeenCalledOnce();
    teardown();
    expect(fake.listeners.size).toBe(0);
  });

  it('stays armed through gestures that could not start anything (music off, or not loaded yet)', () => {
    const doc = fakeDocument(), fake = fakeController(false);
    const teardown = armMusicGestureResume(fake.controller, doc);
    doc.fire('touchstart'); doc.fire('touchstart');
    expect(fake.resume).toHaveBeenCalledTimes(2);
    expect(fake.controller.state.getState().activated).toBe(false);
    expect(doc.attached()).toBe(3);
    teardown();
    expect(doc.attached()).toBe(0);
    expect(fake.listeners.size).toBe(0);
  });

  it('attaches nothing that can fire when the controller is already active', () => {
    const doc = fakeDocument(), fake = fakeController();
    fake.set(true);
    const teardown = armMusicGestureResume(fake.controller, doc);
    expect(doc.attached()).toBe(0);
    doc.fire('pointerdown');
    expect(fake.resume).not.toHaveBeenCalled();
    teardown();
  });
});

describe('native touch gestures', () => {
  it('reports a touch start to the resume and never claims the touch', () => {
    const touches = createTouchGestures(), fake = fakeController();
    expect(touches.touch(), 'a touch with nothing armed is still left to the pressed control').toBe(false);
    const teardown = armMusicGestureResume(fake.controller, touches);
    expect(touches.touch()).toBe(false);
    expect(fake.resume).toHaveBeenCalledOnce();
    expect(touches.touch()).toBe(false);
    expect(fake.resume, 'detached on activation, like the web listeners').toHaveBeenCalledOnce();
    teardown();
  });

  it('keeps only touch starts, so the shared listener code needs no native branch', () => {
    const touches = createTouchGestures(), handler = vi.fn();
    touches.addEventListener('keydown', handler);
    touches.addEventListener('pointerdown', handler);
    touches.touch();
    expect(handler).not.toHaveBeenCalled();
    touches.addEventListener('touchstart', handler);
    touches.removeEventListener('keydown', handler);
    touches.touch();
    expect(handler).toHaveBeenCalledOnce();
    touches.removeEventListener('touchstart', handler);
    touches.touch();
    expect(handler).toHaveBeenCalledOnce();
  });
});