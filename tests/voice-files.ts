/**
 * The committed voice clips, read by literal path (the lint rule against computed file names
 * applies to tests too). A new clip adds its two lines here; tests/score-tags.spec.ts fails
 * until the list matches the two tier folders.
 */
import { readFileSync } from 'node:fs';

export const voiceClipFiles: ReadonlyMap<string, Buffer> = new Map([
  ['assets/audio/voice/clean/ambient_01.mp3', readFileSync('assets/audio/voice/clean/ambient_01.mp3')],
  ['assets/audio/voice/clean/ambient_02.mp3', readFileSync('assets/audio/voice/clean/ambient_02.mp3')],
  ['assets/audio/voice/clean/ambient_03.mp3', readFileSync('assets/audio/voice/clean/ambient_03.mp3')],
  ['assets/audio/voice/clean/ambient_04.mp3', readFileSync('assets/audio/voice/clean/ambient_04.mp3')],
  ['assets/audio/voice/clean/ambient_05.mp3', readFileSync('assets/audio/voice/clean/ambient_05.mp3')],
  ['assets/audio/voice/clean/ambient_06.mp3', readFileSync('assets/audio/voice/clean/ambient_06.mp3')],
  ['assets/audio/voice/clean/ambient_07.mp3', readFileSync('assets/audio/voice/clean/ambient_07.mp3')],
  ['assets/audio/voice/clean/ambient_08.mp3', readFileSync('assets/audio/voice/clean/ambient_08.mp3')],
  ['assets/audio/voice/clean/ambient_09.mp3', readFileSync('assets/audio/voice/clean/ambient_09.mp3')],
  ['assets/audio/voice/clean/ambient_10.mp3', readFileSync('assets/audio/voice/clean/ambient_10.mp3')],
  ['assets/audio/voice/clean/ambient_11.mp3', readFileSync('assets/audio/voice/clean/ambient_11.mp3')],
  ['assets/audio/voice/clean/ambient_12.mp3', readFileSync('assets/audio/voice/clean/ambient_12.mp3')],
  ['assets/audio/voice/clean/record_cryo_lost.mp3', readFileSync('assets/audio/voice/clean/record_cryo_lost.mp3')],
  ['assets/audio/voice/clean/record_cryo_preserved.mp3', readFileSync('assets/audio/voice/clean/record_cryo_preserved.mp3')],
  ['assets/audio/voice/vibration/ambient_01.mp3', readFileSync('assets/audio/voice/vibration/ambient_01.mp3')],
  ['assets/audio/voice/vibration/ambient_02.mp3', readFileSync('assets/audio/voice/vibration/ambient_02.mp3')],
  ['assets/audio/voice/vibration/ambient_03.mp3', readFileSync('assets/audio/voice/vibration/ambient_03.mp3')],
  ['assets/audio/voice/vibration/ambient_04.mp3', readFileSync('assets/audio/voice/vibration/ambient_04.mp3')],
  ['assets/audio/voice/vibration/ambient_05.mp3', readFileSync('assets/audio/voice/vibration/ambient_05.mp3')],
  ['assets/audio/voice/vibration/ambient_06.mp3', readFileSync('assets/audio/voice/vibration/ambient_06.mp3')],
  ['assets/audio/voice/vibration/ambient_07.mp3', readFileSync('assets/audio/voice/vibration/ambient_07.mp3')],
  ['assets/audio/voice/vibration/ambient_08.mp3', readFileSync('assets/audio/voice/vibration/ambient_08.mp3')],
  ['assets/audio/voice/vibration/ambient_09.mp3', readFileSync('assets/audio/voice/vibration/ambient_09.mp3')],
  ['assets/audio/voice/vibration/ambient_10.mp3', readFileSync('assets/audio/voice/vibration/ambient_10.mp3')],
  ['assets/audio/voice/vibration/ambient_11.mp3', readFileSync('assets/audio/voice/vibration/ambient_11.mp3')],
  ['assets/audio/voice/vibration/ambient_12.mp3', readFileSync('assets/audio/voice/vibration/ambient_12.mp3')],
  ['assets/audio/voice/vibration/record_cryo_lost.mp3', readFileSync('assets/audio/voice/vibration/record_cryo_lost.mp3')],
  ['assets/audio/voice/vibration/record_cryo_preserved.mp3', readFileSync('assets/audio/voice/vibration/record_cryo_preserved.mp3')],
]);
