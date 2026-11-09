import assert from 'node:assert/strict';
import { test } from 'node:test';
import { developerPackageForTag, developerUnlockCommand, launchActivity } from './dev-phone.ts';

test('developer install covers the released apps that support the phone key', () => {
  const cases = {
    'shuttrix-v2026.11.06.3': 'com.workbenchsoft.shuttrix',
    'memories-mobile-v2026.11.02.1': 'com.workbenchsoft.memories',
    'speed-camera-map-v2026.11.05.1': 'com.workbenchsoft.spotthecam',
    'spotthecam-v2026.11.08.1': 'com.workbenchsoft.spotthecam',
    'tickalot-v2026.11.06.1': 'com.workbenchsoft.tickalot',
    'guitar-upscale-v2026.11.05.2': 'com.workbenchsoft.guitarupscale',
    'keeppad-v2026.11.06.1': 'com.workbenchsoft.keeppad',
    'servohop-v2026.11.06.1': 'com.workbenchsoft.servohop',
  };
  for (const [tag, packageName] of Object.entries(cases)) {
    assert.equal(developerPackageForTag(tag), packageName);
  }
});

test('no developer button for unsupported or malformed releases', () => {
  for (const tag of [
    'skyaltar-v1',
    'lumiere-v2',
    'memoire-v1',
    'shuttrix-legacy-v1',
    'shuttrix-main',
    '../shuttrix-v1',
  ]) {
    assert.equal(developerPackageForTag(tag), null);
  }
});

test('launch activity must be scoped to the installed Android package', () => {
  const output = 'priority=0 preferredOrder=0\ncom.workbenchsoft.shuttrix/.MainActivity\n';
  assert.equal(launchActivity(output, 'com.workbenchsoft.shuttrix'), 'com.workbenchsoft.shuttrix/.MainActivity');
  assert.equal(launchActivity(output, 'com.workbenchsoft.keeppad'), null);
  assert.equal(launchActivity('com.workbenchsoft.shuttrix/.MainActivity;rm -rf /', 'com.workbenchsoft.shuttrix'), null);
});

test('unlock sends the key via adb shell stdin and explicitly hides ads', () => {
  const key = 'a'.repeat(64);
  const command = developerUnlockCommand('com.workbenchsoft.shuttrix/.MainActivity', key);
  assert.match(command, /workbenchsoft-dev:\/\/unlock\?key=a{64}&ads=0/);
  assert.match(command, /\nexit\n$/);
  assert.throws(() => developerUnlockCommand('com.example.other/.MainActivity', key), /Invalid Android/);
  assert.throws(
    () => developerUnlockCommand('com.workbenchsoft.shuttrix/.MainActivity', "'; rm -rf /"),
    /64 hexadecimal/,
  );
});
