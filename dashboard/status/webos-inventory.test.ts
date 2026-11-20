import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareWebosVersions, installedLumiereFromList } from './webos-inventory.ts';

test('webOS versions compare numeric components, not lexicographic strings', () => {
  assert.equal(compareWebosVersions('0.3.100', '0.3.99'), 1);
  assert.equal(compareWebosVersions('0.4.0', '0.3.999'), 1);
  assert.equal(compareWebosVersions('0.3.28', '0.3.28'), 0);
  assert.equal(compareWebosVersions('0.3.2', '0.3.10'), -8);
});

test('installed versions are read from ares --listfull plain-text rows', () => {
  assert.deepEqual(
    installedLumiereFromList('id:com.other.app, version:1.0.0\nid:com.workbenchsoft.lumiere, title:Lumiere, version:0.3.88, type:web'),
    { found: true, version: '0.3.88' },
  );
});

test('ares --listfull JSON can report installed Lumiere', () => {
  assert.deepEqual(
    installedLumiereFromList('Installed apps:\n' + JSON.stringify([
      { id: 'com.other.app', version: '1.1.1' },
      { id: 'com.workbenchsoft.lumiere', version: '0.3.100' },
    ])),
    { found: true, version: '0.3.100' },
  );
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
