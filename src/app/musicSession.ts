/** Shared presentation-only soundtrack session; game save replacement never owns it. */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { getPlatform } from './platform';
import { gameStore } from './session';
import { MusicController } from './musicController';

const platform = getPlatform();
export const music = new MusicController(gameStore, platform.lifecycle, platform.storage);
export function useMusicRuntime(): void { useEffect(() => music.start(), []); }
export function useMusic() { return useStore(music.state); }
