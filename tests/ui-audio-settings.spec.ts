// @vitest-environment happy-dom
/** Music and speech controls expose preference/actual state without disclosing later game content. */
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
import { defined } from './m7-helpers';
import { music } from '../src/app/musicSession';

setupM4Tests();
vi.mock('../src/app/audioPlayer', () => ({ prepareMusic: () => Promise.resolve(),
  createMusicPlayer: () => ({ play: vi.fn(), pause: vi.fn(), volume: vi.fn(), remove: vi.fn() }) }));

it('routes Audio back through the root menu and exposes accessible numeric volume and actual playback status', async () => {
  const view = await mountM4('tick-0');
  view.click('menu-open'); view.click('menu-audio');
  expect(view.find('menu-audio-page')?.textContent).not.toMatch(/suspicion|AEGIS|predecessor/i);
  // #156 added manual READ playback; the page must not deny it. Since the speech split it is no
  // longer behind the music switch, so the page must not claim that either.
  expect(view.find('menu-audio-page')?.textContent).not.toMatch(/no spoken transmissions|only while this is on/i);
  expect(view.find('menu-audio-page')?.textContent).toContain('Nothing is read aloud until you press READ');
  // A fresh install starts with music enabled (the voted default), so the switch is on
  // and nothing plays until activation; toggling once turns the soundtrack off.
  expect(view.find('music-toggle')?.getAttribute('aria-checked')).toBe('true');
  view.click('music-toggle');
  expect(view.find('music-toggle')?.getAttribute('aria-checked')).toBe('false');
  expect(view.find('music-status')?.textContent).toContain('off');
  view.click('music-toggle');
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.find('music-toggle')?.getAttribute('aria-checked')).toBe('true');
  expect(view.find('music-status')?.textContent).not.toContain('Playing');
  view.click('music-quieter');
  expect(view.find('music-volume')?.textContent).toBe('Music volume 20%');
  view.click('music-louder');
  expect(view.find('music-volume')?.getAttribute('aria-label')).toBe('Music volume 30 percent');
  view.click('music-resume');
  view.click('menu-back'); expect(view.find('menu-root')).not.toBeNull();
  view.click('menu-help'); expect(view.find('menu-help-page')).not.toBeNull();
  view.close();
});

it('operates speech on the same page, independently of the music controls', async () => {
  const view = await mountM4('tick-0');
  view.click('menu-open'); view.click('menu-audio');
  // A fresh install: speech on at the shared default level, beside the music controls.
  expect(view.find('speech-toggle')?.getAttribute('aria-checked')).toBe('true');
  expect(view.find('speech-volume')?.textContent).toBe('Speech volume 30%');
  view.click('speech-quieter'); view.click('speech-quieter');
  expect(view.find('speech-volume')?.getAttribute('aria-label')).toBe('Speech volume 10 percent');
  expect(music.state.getState()).toMatchObject({ speechVolume: 10, volume: 30, enabled: true });
  view.click('speech-quieter');
  expect(view.find('speech-status')?.textContent).toContain('muted at 0%');
  expect(view.find('speech-quieter')?.hasAttribute('disabled')).toBe(true);
  view.click('speech-quieter');
  expect(music.state.getState().speechVolume).toBe(0);
  view.click('speech-louder');
  expect(view.find('speech-volume')?.textContent).toBe('Speech volume 10%');
  view.click('speech-toggle');
  expect(view.find('speech-toggle')?.getAttribute('aria-checked')).toBe('false');
  expect(view.find('speech-status')?.textContent).toContain('READ is hidden');
  // Each switch moves only its own half.
  expect(view.find('music-toggle')?.getAttribute('aria-checked')).toBe('true');
  view.click('music-toggle'); view.click('music-louder');
  expect(music.state.getState()).toMatchObject({ enabled: false, volume: 40, speechEnabled: false, speechVolume: 10 });
  view.click('speech-toggle');
  expect(music.state.getState()).toMatchObject({ enabled: false, speechEnabled: true });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(JSON.parse(host.localStorage.getItem('daemon-zero.audio.v1') ?? '{}')).toEqual(
    { version: 2, enabled: false, volume: 40, speechEnabled: true, speechVolume: 10 });
  view.close();
});

it('names every control by its visible text and keeps each at least 44px', async () => {
  const view = await mountM4('tick-0');
  view.click('menu-open'); view.click('menu-audio');
  const ids = ['music-toggle', 'music-quieter', 'music-louder', 'speech-toggle', 'speech-quieter', 'speech-louder'];
  for (const id of ids) {
    const control = view.find(id);
    const visible = control?.textContent.trim() ?? '';
    expect(visible, id).not.toBe('');
    // #111: the accessible name begins with what a sighted player reads on the control.
    expect(control?.getAttribute('aria-label')?.startsWith(visible), id).toBe(true);
    const style = host.getComputedStyle(defined(control));
    expect(parseFloat(style.minHeight), id).toBeGreaterThanOrEqual(44);
    expect(parseFloat(style.minWidth), id).toBeGreaterThanOrEqual(44);
  }
  // Truthful labels: each switch says the one thing it gates.
  expect(view.find('music-toggle')?.getAttribute('aria-label')).toBe('[ MUSIC ON ] Instrumental score only');
  expect(view.find('speech-toggle')?.getAttribute('aria-label')).toBe('[ SPEECH ON ] Spoken transmissions only');
  expect(view.find('menu-audio-page')?.textContent).not.toContain('No spoken transmissions');
  view.close();
});

it('preserves preferences across terminal restoration and offers the current later-phase score', async () => {
  const view = await mountM4('phase-2-unlocked');
  act(() => { music.state.setState({ enabled: true, activated: false, loaded: true, volume: 40, storageNotice: 'Storage denied', status: 'Resume required' }); });
  view.click('menu-open'); view.click('menu-audio');
  expect(view.find('music-status')?.textContent).toContain('paused');
  expect(view.find('music-resume')).not.toBeNull();
  expect(view.find('music-error')?.textContent).toContain('Resume required');
  expect(view.find('music-storage-notice')?.textContent).toContain('Storage denied');
  view.click('music-toggle');
  expect(view.find('music-status')?.textContent).toContain('off');
});

it('offers the chrome switch only where the header row can hold it', async () => {
  // 468px of row is the tightest case; the row is the viewport minus 32px of padding.
  const wide = await mountM4('tick-0', { width: 600, height: 900 });
  expect(wide.find('header-music')).not.toBeNull();
  wide.close();
  const phone = await mountM4('tick-0', { width: 414, height: 896 });
  expect(phone.find('header-music')).toBeNull();
  phone.close();
  const tabletPortrait = await mountM4('tick-0', { width: 500, height: 900 });
  expect(tabletPortrait.find('header-music')).toBeNull();
  tabletPortrait.close();
});
