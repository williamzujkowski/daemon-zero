/**
 * Adapts native AppState/AsyncStorage and browser visibility/localStorage.
 * Browser globals are described narrowly so shared native code needs no DOM lib.
 */
import { AppState, Platform } from 'react-native';
import type { KeyValueStorage } from './storage';

export interface Lifecycle {
  current(): boolean;
  subscribe(listener: (active: boolean) => void): () => void;
}

interface Events {
  addEventListener(event: string, listener: () => void): void;
  removeEventListener(event: string, listener: () => void): void;
}

export interface BrowserHost extends Events {
  document: Events & { visibilityState: string };
  localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}

interface NativeActivity {
  currentState: string | null | undefined;
  addEventListener(event: 'change', listener: (state: string) => void): { remove(): void };
}

export function createWebLifecycle(host: BrowserHost): Lifecycle {
  return {
    current: () => host.document.visibilityState !== 'hidden',
    subscribe(listener) {
      const changed = () => { listener(host.document.visibilityState !== 'hidden'); };
      const hidden = () => { listener(false); };
      host.document.addEventListener('visibilitychange', changed);
      host.addEventListener('pagehide', hidden);
      host.addEventListener('pageshow', changed);
      return () => {
        host.document.removeEventListener('visibilitychange', changed);
        host.removeEventListener('pagehide', hidden);
        host.removeEventListener('pageshow', changed);
      };
    },
  };
}

export function createNativeLifecycle(source: NativeActivity): Lifecycle {
  return {
    current: () => source.currentState === 'active',
    subscribe(listener) {
      const subscription = source.addEventListener('change', (state) => { listener(state === 'active'); });
      return () => { subscription.remove(); };
    },
  };
}

export function createWebStorage(host: Pick<BrowserHost, 'localStorage'>): KeyValueStorage {
  return {
    getItem: (key) => host.localStorage.getItem(key),
    setItem: (key, value) => { host.localStorage.setItem(key, value); },
  };
}

export function createNativeStorage(): KeyValueStorage {
  return {
    async getItem(key) {
      const { default: storage } = await import('@react-native-async-storage/async-storage');
      return storage.getItem(key);
    },
    async setItem(key, value) {
      const { default: storage } = await import('@react-native-async-storage/async-storage');
      await storage.setItem(key, value);
    },
  };
}

export function getPlatform() {
  if (Platform.OS !== 'web') return { lifecycle: createNativeLifecycle(AppState), storage: createNativeStorage() };
  const host = globalThis as unknown as BrowserHost;
  return { lifecycle: createWebLifecycle(host), storage: createWebStorage(host) };
}
