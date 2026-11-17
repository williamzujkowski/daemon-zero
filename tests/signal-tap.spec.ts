/** The signal tap's test-only reference route serves committed assets and nothing else. */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { referenceFile } from './e2e/signalTap';

const ASSETS = path.resolve(__dirname, '../assets');
const at = (rest: string) => 'http://127.0.0.1:4173/__reference/' + rest;

describe('reference route', () => {
  it('maps a request to the committed file under assets/', () => {
    expect(referenceFile(at('audio/music/phase-0/the-guest.mp3'))).toBe(path.join(ASSETS, 'audio/music/phase-0/the-guest.mp3'));
    expect(referenceFile('http://127.0.0.1:4173/daemon-zero/__reference/audio/voice/vibration/ambient_01.mp3'))
      .toBe(path.join(ASSETS, 'audio/voice/vibration/ambient_01.mp3'));
  });

  it.each([
    ['an encoded parent segment', '..%2F..%2Fpackage.json'],
    ['an encoded parent segment inside the path', 'audio%2F..%2F..%2F..%2Fetc%2Fpasswd'],
    ['an encoded absolute path', '%2Fetc%2Fpasswd'],
    ['a sibling directory that shares the prefix', '..%2Fassets-private%2Fkey'],
    ['assets/ itself', ''],
    ['a malformed escape', 'audio%E0%A4%A'],
  ])('refuses %s', (_label, rest) => {
    expect(referenceFile(at(rest))).toBeNull();
  });

  it('refuses a request that is not for the reference route at all', () => {
    expect(referenceFile('http://127.0.0.1:4173/assets/audio/music/phase-0/the-guest.mp3')).toBeNull();
  });
});
