// @vitest-environment happy-dom
/** Music controls expose preference/actual state without disclosing later game content. */
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { mountM4, setupM4Tests } from './ui-m4-helpers';
import { music } from '../src/app/musicSession';

setupM4Tests();
vi.mock('../src/app/audioPlayer', () => ({ prepareMusic: () => Promise.resolve(),
  createMusicPlayer: () => ({ play: vi.fn(), pause: vi.fn(), volume: vi.fn(), remove: vi.fn() }) }));

it('routes Audio back through the root menu and exposes accessible numeric volume and actual playback status', async () => {
  const view = await mountM4('tick-0');
  view.click('menu-open'); view.click('menu-audio');
  expect(view.find('menu-audio-page')?.textContent).not.toMatch(/suspicion|AEGIS|predecessor/i);
  expect(view.find('music-status')?.textContent).toContain('off');
  view.click('music-toggle');
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.find('music-toggle')?.getAttribute('aria-checked')).toBe('true');
  expect(view.find('music-status')?.textContent).not.toContain('Playing');
  view.click('music-quieter');
  expect(view.find('music-volume')?.textContent).toContain('20%');
  view.click('music-louder');
  expect(view.find('music-volume')?.getAttribute('aria-label')).toBe('Music volume 30 percent');
  view.click('music-resume');
  view.click('menu-back'); expect(view.find('menu-root')).not.toBeNull();
  view.click('menu-help'); expect(view.find('menu-help-page')).not.toBeNull();
  view.close();
});

it('preserves preferences across terminal restoration and explains missing later-phase tracks', async () => {
  const view = await mountM4('phase-2-unlocked');
  act(() => { music.state.setState({ enabled: true, activated: false, loaded: true, volume: 40, storageNotice: 'Storage denied', status: 'Resume required' }); });
  view.click('menu-open'); view.click('menu-audio');
  expect(view.find('music-status')?.textContent).toContain('No music track');
  expect(view.find('music-resume')).toBeNull();
  expect(view.find('music-error')?.textContent).toContain('Resume required');
  expect(view.find('music-storage-notice')?.textContent).toContain('Storage denied');
  view.click('music-toggle');
  expect(view.find('music-status')?.textContent).toContain('off');
});
