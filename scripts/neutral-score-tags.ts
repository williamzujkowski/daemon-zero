/**
 * `pnpm exec tsx scripts/neutral-score-tags.ts <phase> < supplied.mp3 > tagged.mp3`
 *
 * Writes a copy of a supplied score whose only container tags are the ones the app itself
 * publishes for that phase (`scoreMetadata`), so the Android media session cannot show a
 * track name or an account label (#193), plus one comment frame disclosing that the music is
 * AI-generated, which the session does not display (`AI_DISCLOSURE`). Metadata only: the
 * audio is not decoded or re-encoded, and nothing is written unless every byte from the first
 * MPEG frame to the end of the file is the same as in the input. The report goes to stderr.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { scoreMetadata } from '../src/app/scoreSession';
import { AI_DISCLOSURE, readTags, tagProblems, withNeutralTags } from './score-tags';

const [phaseText] = process.argv.slice(2);
if (phaseText === undefined || !/^\d+$/.test(phaseText) || process.stdin.isTTY || process.stdout.isTTY) {
  console.error('usage: tsx scripts/neutral-score-tags.ts <phase> < supplied.mp3 > tagged.mp3');
  process.exit(2);
}

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const tags = scoreMetadata(Number(phaseText));
const before = readFileSync(0);
const after = withNeutralTags(before, tags);
const audioBefore = before.subarray(readTags(before).audioOffset);
const audioAfter = after.subarray(readTags(after).audioOffset);
const problems = tagProblems(after, tags);
if (!audioBefore.equals(audioAfter) || problems.length > 0) {
  console.error('[FAIL] nothing written: ' + (problems.join('; ') || 'the audio bytes differ'));
  process.exit(1);
}
process.stdout.write(after);
console.error('removed  ' + (readTags(before).frames.map((frame) => frame.id).join(' ') || '(no frames)'));
console.error('written  TIT2="' + tags.title + '" TPE1="' + tags.artist + '" TALB="' + tags.album + '" COMM(eng,"")="' + AI_DISCLOSURE + '"');
console.error('audio    ' + String(audioAfter.length) + ' bytes, sha256 ' + sha256(audioAfter) + ' (identical in both files)');
console.error('before   ' + String(before.length) + ' bytes, sha256 ' + sha256(before));
console.error('after    ' + String(after.length) + ' bytes, sha256 ' + sha256(after));
