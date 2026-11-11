/**
 * Verifies platform lifecycle wiring, synchronous web storage and native AsyncStorage.
 * Native services are mocked; real on-device behavior is verified separately.
 */
import { AppState, Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { createNativeLifecycle, createNativeStorage, createWebLifecycle, createWebStorage, getPlatform } from '../src/app/platform';
import { memoryStorage } from './app-helpers';

const native = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: native }));

function events() {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    addEventListener(event: string, listener: () => void) { listeners.set(event, listener); },
    removeEventListener(event: string, listener: () => void) {
      if (listeners.get(event) === listener) listeners.delete(event);
    },
    fire(event: string) { listeners.get(event)?.(); },
  };
}

describe('platform adapters', () => {
  it('handles visibility, pagehide and pageshow and removes every listener', () => {
    const host = { ...events(), document: { ...events(), visibilityState: 'visible' }, localStorage: memoryStorage() };
    const lifecycle = createWebLifecycle(host);
    expect(lifecycle.current()).toBe(true);
    const changed = vi.fn();
    const stop = lifecycle.subscribe(changed);
    host.document.visibilityState = 'hidden';
    host.document.fire('visibilitychange');
    expect(lifecycle.current()).toBe(false);
    host.fire('pagehide');
    host.document.visibilityState = 'visible';
    host.fire('pageshow');
    expect(changed.mock.calls).toEqual([[false], [false], [true]]);
    stop();
    expect(host.listeners.size + host.document.listeners.size).toBe(0);
  });

  it('forwards native active/inactive/background events and removes its subscription', () => {
    let emit: (state: string) => void = () => undefined;
    const remove = vi.fn();
    const source = {
      currentState: 'active',
      addEventListener: vi.fn((_event: 'change', listener: (state: string) => void) => { emit = listener; return { remove }; }),
    };
    const lifecycle = createNativeLifecycle(source);
    expect(lifecycle.current()).toBe(true);
    const changed = vi.fn();
    const stop = lifecycle.subscribe(changed);
    emit('inactive');
    emit('background');
    emit('active');
    source.currentState = 'background';
    expect(lifecycle.current()).toBe(false);
    expect(changed.mock.calls).toEqual([[false], [false], [true]]);
    stop();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('uses native AsyncStorage without adding a persistence middleware', async () => {
    native.getItem.mockResolvedValue('native save');
    native.setItem.mockResolvedValue(undefined);
    const adapter = createNativeStorage();
    expect(await adapter.getItem('slot')).toBe('native save');
    await adapter.setItem('slot', 'new save');
    expect(native.getItem).toHaveBeenCalledWith('slot');
    expect(native.setItem).toHaveBeenCalledWith('slot', 'new save');
  });

  it('writes synchronously through the browser adapter and propagates denied access', () => {
    const host = { localStorage: memoryStorage() };
    const adapter = createWebStorage(host);
    void adapter.setItem('slot', 'web save');
    expect(adapter.getItem('slot')).toBe('web save');
    const denied = createWebStorage({ get localStorage(): never { throw new Error('blocked'); } });
    expect(() => denied.getItem('slot')).toThrow('blocked');
  });

  it('selects the native platform when the OS is Android', () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    const subscribe = vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: vi.fn() });
    try {
      const platform = getPlatform();
      platform.lifecycle.subscribe(() => undefined)();
      expect(subscribe).toHaveBeenCalled();
    } finally { Platform.OS = original; subscribe.mockRestore(); }
  });
});
