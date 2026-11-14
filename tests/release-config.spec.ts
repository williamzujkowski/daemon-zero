/** Release policy checks: offline runtime, explicit identity and separate APK/AAB profiles. */
import { spawnSync } from 'node:child_process';
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
