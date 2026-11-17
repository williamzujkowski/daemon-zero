/** Release policy checks: offline runtime, explicit identity and separate APK/AAB profiles. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import app from '../app.json';
import pkg from '../package.json';
import eas from '../eas.json';

it('keeps native release runtime offline and disables automatic cloud save backup', () => {
  expect(app.expo.updates.enabled).toBe(false);
  expect(app.expo.android.allowBackup).toBe(false);
  expect(app.expo.android.permissions).toEqual([]);
  for (const permission of ['INTERNET', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']) {
    expect(app.expo.android.blockedPermissions).toContain(`android.permission.${permission}`);
  }
});

it('assigns matching native identities and explicit release versions', () => {
  expect(app.expo.version).toBe(pkg.version);
  expect(app.expo.android.package).toBe('com.daemonzero.app');
  expect(app.expo.ios.bundleIdentifier).toBe(app.expo.android.package);
  expect(app.expo.android.versionCode).toBeGreaterThan(0);
  expect(Number(app.expo.ios.buildNumber)).toBeGreaterThan(0);
  expect(app.expo.plugins).toContainEqual(['expo-splash-screen', {
    backgroundColor: '#030704', image: './assets/splash-icon.png', imageWidth: 160,
  }]);
});

it('separates installable preview APKs from store bundles without embedded credentials', () => {
  expect(eas.build.preview.android.buildType).toBe('apk');
  expect(eas.build.preview.distribution).toBe('internal');
  expect(eas.build.production.android.buildType).toBe('app-bundle');
  expect(eas.build.production.distribution).toBe('store');
  expect(JSON.stringify(eas)).not.toMatch(/password|keystorePath|keyAlias/);
});

it('refuses a local release build without signing credentials before prebuild', () => {
  const result = spawnSync('bash', ['scripts/build-android-release.sh'], {
    encoding: 'utf8', env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', ANDROID_HOME: '/unused-sdk' },
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('DAEMON_ANDROID_KEYSTORE');
});

it('keeps soundtrack capture and background service capabilities explicitly disabled', () => {
  expect(app.expo.plugins).toContainEqual(['expo-audio', {
    microphonePermission: false, recordAudioAndroid: false,
    enableBackgroundPlayback: false, enableBackgroundRecording: false,
  }]);
});

/** Makefile recipe lines grouped by the target they belong to. */
function recipes(makefile: string): Map<string, string[]> {
  const byTarget = new Map<string, string[]>();
  let target = '';
  for (const line of makefile.split('\n')) {
    const header = /^([a-z0-9-]+):/.exec(line);
    if (header?.[1]) { target = header[1]; byTarget.set(target, []); }
    else if (line.startsWith('\t') && target) byTarget.get(target)?.push(line);
  }
  return byTarget;
}

// T6 (#205): the preview content channel is web-only and local/CI-only, so nothing that builds a
// release or the Pages artifact may set it. metro.config.js also refuses a native preview bundle.
it('keeps every native and release build path on production content', () => {
  for (const [name, profile] of Object.entries(eas.build)) {
    expect(Object.keys(profile.env), name).not.toContain('DAEMON_CONTENT_CHANNEL');
  }
  expect(JSON.stringify(eas)).not.toContain('DAEMON_CONTENT_CHANNEL');
  const releaseFiles = {
    'scripts/build-android-release.sh': readFileSync('scripts/build-android-release.sh', 'utf8'),
    'app.json': readFileSync('app.json', 'utf8'),
    'app.config.ts': readFileSync('app.config.ts', 'utf8'),
    'package.json': readFileSync('package.json', 'utf8'),
    '.github/workflows/ci.yml': readFileSync('.github/workflows/ci.yml', 'utf8'),
  };
  for (const [file, text] of Object.entries(releaseFiles)) expect(text, file).not.toContain('DAEMON_CONTENT_CHANNEL');
  const makefile = recipes(readFileSync('Makefile', 'utf8'));
  const setters = [...makefile].filter(([, lines]) => lines.some((line) => /DAEMON_CONTENT_CHANNEL=/.test(line))).map(([target]) => target);
  expect(setters).toEqual(['build-preview']);
  // The web exports clear it, so a preview variable left in a shell cannot reach dist/ or Pages.
  for (const target of ['build-web', 'build-pages']) {
    expect(makefile.get(target)?.join('\n'), target).toContain('-u DAEMON_CONTENT_CHANNEL');
  }
  expect(makefile.get('build-preview')?.join('\n')).toMatch(/--output-dir \$\(PREVIEW_DIR\)/);
  expect(readFileSync('Makefile', 'utf8')).toMatch(/^PREVIEW_DIR := dist-preview$/m);
});
