/**
 * The Android permission list in docs/RELEASE.md is held to its sources, so a dependency that
 * starts declaring a permission fails here instead of being found on a device (#186 item 3).
 *
 * What this can see without a native build: the manifest of every library module Expo
 * autolinks and of the app's direct native dependencies (scripts/android-permissions.sh), and
 * the block list in app.json. What it cannot see: manifests inside Maven AARs, which only
 * Gradle resolves. Those are listed by hand below, pinned to the version they were read at,
 * and the pin fails when it moves.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import app from '../app.json';

/**
 * Read from the AARs' own AndroidManifest.xml (Gradle cache, media3 1.9.1 and androidx.core
 * 1.17.0): media3-common declares ACCESS_NETWORK_STATE, media3-exoplayer declares that and
 * WAKE_LOCK, androidx.core declares the app-scoped signature permission for unexported
 * receivers.
 */
const MEDIA3_VERSION = '1.9.1';
/**
 * The highest androidx.core any linked module asks for (expo-system-ui). It is also the
 * highest in the Gradle cache the release build left behind, and that AAR's manifest is the
 * one the permission was read from; no dependency report was run to confirm it is the
 * resolved one. Gradle takes the highest request in the whole graph, AAR-to-AAR ones
 * included, so this pin says "no linked module moved it", not "it cannot have moved".
 */
const ANDROIDX_CORE_VERSION = '1.17.0';
const AAR_PERMISSIONS = ['android.permission.ACCESS_NETWORK_STATE', 'android.permission.WAKE_LOCK',
  '${applicationId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'];

function declaredByLibraries(): string[] {
  const result = spawnSync('bash', ['scripts/android-permissions.sh'], { encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.split('\n').filter((line) => line !== '').map((line) => line.split('\t')[0] ?? '');
}

function documentedSection(): string {
  const text = readFileSync('docs/RELEASE.md', 'utf8');
  const start = text.indexOf('## Android permissions and size');
  expect(start, 'docs/RELEASE.md has the permissions section').toBeGreaterThan(-1);
  return text.slice(start, text.indexOf('\n## ', start + 1));
}

function documented(): string[] {
  return [...documentedSection().matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1] ?? '').sort();
}

it('documents exactly the permissions the release manifest will carry, each with a source', { timeout: 30_000 }, () => {
  const declared = new Set([...declaredByLibraries(), ...AAR_PERMISSIONS]);
  expect([...declared], 'the libraries still declare what the table was written from').toEqual(expect.arrayContaining([
    'android.permission.VIBRATE', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.INTERNET']));
  const blocked = new Set<string>(app.expo.android.blockedPermissions);
  const carried = [...declared].filter((permission) => !blocked.has(permission)).sort();
  expect(documented()).toEqual(carried);
  // The statement PRIVACY.md rests on: declared by a dependency, removed from the build.
  expect(declared.has('android.permission.INTERNET') && blocked.has('android.permission.INTERNET')).toBe(true);
  expect(carried).not.toContain('android.permission.INTERNET');
  expect(app.expo.android.permissions, 'the app asks for nothing itself').toEqual([]);
});

it('fails when a library that brings a hand-read permission changes version', () => {
  const audio = readFileSync('node_modules/expo-audio/android/build.gradle', 'utf8');
  // On a failure here: rebuild, read the merged manifest (docs/RELEASE.md says how), then
  // update AAR_PERMISSIONS, the table and the version together.
  expect(audio.match(/androidxMedia3Version = "([^"]+)"/)?.[1]).toBe(MEDIA3_VERSION);
  expect(audio).toContain('androidx.media3:media3-exoplayer:');
  // androidx.core: every linked module that names it, each at a version read from its own
  // build.gradle. The highest is the pin; a module that starts asking for more moves it.
  const system = readFileSync('node_modules/expo-system-ui/android/build.gradle', 'utf8');
  const requested = [audio.match(/androidx\.core:core-ktx:([0-9.]+)/)?.[1], system.match(/androidx\.core:core:([0-9.]+)/)?.[1]];
  expect(requested).toEqual(['1.15.0', ANDROIDX_CORE_VERSION]);
  expect(documentedSection()).toContain('`androidx.core` ' + ANDROIDX_CORE_VERSION);
});
