import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareWebosVersions,
  installedLumiereFromList,
  shouldDiscoverWebosTvs,
} from './webos-inventory.ts';

test('webOS versions compare numeric components, not lexicographic strings', () => {
  assert.equal(compareWebosVersions('0.3.100', '0.3.99'), 1);
  assert.equal(compareWebosVersions('0.4.0', '0.3.999'), 1);
  assert.equal(compareWebosVersions('0.3.28', '0.3.28'), 0);
  assert.equal(compareWebosVersions('0.3.2', '0.3.10'), -8);
});

test('installed versions are read from ares --listfull plain-text rows', () => {
  assert.deepEqual(
    installedLumiereFromList(
      'id:com.other.app, version:1.0.0\nid:com.workbenchsoft.lumiere, title:Lumiere, version:0.3.88, type:web',
    ),
    { found: true, version: '0.3.88' },
  );
});

test('ares --listfull JSON can report installed Lumiere', () => {
  const rows = [
    { id: 'com.other.app', version: '1.1.1' },
    { id: 'com.workbenchsoft.lumiere', version: '0.3.100' },
  ];
  const output = 'Installed apps:\n' + JSON.stringify(rows);
  assert.deepEqual(installedLumiereFromList(output), { found: true, version: '0.3.100' });
});

test('other apps do not imply Lumiere is installed', () => {
  assert.deepEqual(installedLumiereFromList('id:com.other.app, version:1.0.0'), {
    found: false,
    version: null,
  });
});

test('an installed app with unknown version is not called current', () => {
  assert.deepEqual(installedLumiereFromList('id:com.workbenchsoft.lumiere, title:Lumiere'), {
    found: true,
    version: null,
  });
});

test('multiline webOS CLI records report the installed version', () => {
  assert.deepEqual(
    installedLumiereFromList('id: com.workbenchsoft.lumiere\n  title: Lumiere\n  version: 0.3.101\nid: com.other.app\n  version: 2.0.0'),
    { found: true, version: '0.3.101' },
  );
});

test('nested webOS CLI JSON records report the installed version', () => {
  assert.deepEqual(
    installedLumiereFromList(JSON.stringify({ apps: [{ appId: 'com.workbenchsoft.lumiere', appVersion: '0.3.102' }] })),
    { found: true, version: '0.3.102' },
  );
});

test('saved LG TV profiles avoid SSDP during periodic status polls', () => {
  assert.equal(shouldDiscoverWebosTvs(2, false), false);
  assert.equal(shouldDiscoverWebosTvs(1, false), false);
  assert.equal(shouldDiscoverWebosTvs(0, false), true);
});

test('manual Find new TVs rescans even when profiles are cached', () => {
  assert.equal(shouldDiscoverWebosTvs(2, true), true);
});
