import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { workspaceRoot } from './local-build-target.ts';

const exec = promisify(execFile);
const appId = 'com.workbenchsoft.lumiere';
const publicRepo = 'workbench-soft/workbench-soft.github.io';
const releasePrefix = 'lumiere-webos-v';

export type WebosRelease = { version: string; fileName: string; url: string };
export type TvState = 'current' | 'outdated' | 'ahead' | 'missing' | 'unknown-version' | 'unavailable' | 'unpaired';
export type WebosTv = {
  name: string;
  ip: string;
  installedVersion: string | null;
  state: TvState;
};
export type WebosInventory = {
  checkedAt: string;
  release: WebosRelease | null;
  releaseError: string | null;
  error: string | null;
  tvs: WebosTv[];
};

type Profile = {
  name: string;
  deviceinfo?: { ip?: string; host?: string; user?: string; username?: string };
};

type ApiRelease = {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
};

/** Newest *published and installable* webOS IPK, never an Android APK or unfinished CI build. */
export async function latestPublishedWebosRelease(): Promise<WebosRelease> {
  const response = await fetch('https://api.github.com/repos/' + publicRepo + '/releases?per_page=100', {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LocalCI-Lumiere-webOS' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('GitHub Releases returned HTTP ' + response.status);
  const releases: unknown = await response.json();
  if (!Array.isArray(releases)) throw new Error('Unexpected GitHub Releases response');
  const candidates = (releases as ApiRelease[])
    .filter((item) => !item.draft && !item.prerelease && item.tag_name.startsWith(releasePrefix))
    .map((item) => ({ item, version: item.tag_name.slice(releasePrefix.length) }))
    .filter((entry) => /^\d+\.\d+\.\d+$/.test(entry.version))
    .toSorted((a, b) => compareWebosVersions(b.version, a.version));
  for (const { item, version } of candidates) {
    const fileName = 'LumierePlayer-' + version + '-webos.ipk';
    const asset = item.assets.find((part) => part.name === fileName);
    if (asset && new URL(asset.browser_download_url).hostname === 'github.com') {
      return { version, fileName, url: item.html_url };
    }
  }
  throw new Error('No published Lumiere webOS .ipk is available. Run the webOS Release workflow first.');
}

export function compareWebosVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

/** ares-install --listfull can return JSON or a row of key:value pairs. */
export function installedLumiereFromList(output: string): { found: boolean; version: string | null } {
  const first = output.indexOf('[');
  const last = output.lastIndexOf(']');
  if (first >= 0 && last > first) {
    try {
      const apps: unknown = JSON.parse(output.slice(first, last + 1));
      if (Array.isArray(apps)) {
        const found = apps.find(
          (item): item is { id: string; version?: string } =>
            typeof item === 'object' && item !== null && (item as { id?: unknown }).id === appId,
        );
        return { found: !!found, version: found && typeof found.version === 'string' ? found.version : null };
      }
    } catch {
      // Older webOS CLI versions print plain-text key:value rows instead.
    }
  }
  const row = output
    .split(/\r?\n/)
    .find((line) => /(?:^|[,{\s])id\s*:\s*["']?com\.workbenchsoft\.lumiere(?:["',\s}]|$)/i.test(line));
  if (row) {
    const match = /\bversion\s*:\s*["']?(\d+\.\d+\.\d+)/i.exec(row);
    return { found: true, version: match?.[1] ?? null };
  }
  return { found: false, version: null };
}

function privateIpv4(value: string): boolean {
  const numbers = value.split('.').map(Number);
  if (numbers.length !== 4 || numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return (
    numbers[0] === 10 ||
    (numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31) ||
    (numbers[0] === 192 && numbers[1] === 168)
  );
}

function webosRoot(): string {
  return join(workspaceRoot(), 'lumiere-player', 'webos');
}

async function runNode(root: string, args: string[], timeout: number): Promise<string> {
  const { stdout } = await exec(process.execPath, args, {
    cwd: root,
    windowsHide: true,
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

async function cli(root: string, command: string, args: string[], timeout = 12_000): Promise<string> {
  return runNode(root, [join('node_modules', '@webos-tools', 'cli', 'bin', command + '.js'), ...args], timeout);
}

async function profiles(root: string): Promise<Profile[]> {
  const response = await cli(root, 'ares-setup-device', ['--listfull']);
  const start = response.indexOf('[');
  const end = response.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('Could not read paired TV profiles');
  const parsed: unknown = JSON.parse(response.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Unexpected webOS TV profile list');
  return (parsed as Profile[]).filter((item) => {
    const ip = item.deviceinfo?.ip ?? item.deviceinfo?.host ?? '';
    return (item.deviceinfo?.user ?? item.deviceinfo?.username) === 'prisoner' && privateIpv4(ip);
  });
}

async function discover(root: string): Promise<string[]> {
  // Reuse Lumiere's validated LG-only SSDP discovery instead of probing arbitrary LAN hosts.
  const source =
    'import { discoverLgTvs } from "./scripts/discover-lg.ts"; console.log(JSON.stringify(await discoverLgTvs()));';
  const response = await runNode(root, ['--input-type=module', '--eval', source], 15_000);
  const parsed: unknown = JSON.parse(response.trim());
  if (!Array.isArray(parsed)) throw new Error('Unexpected LG TV discovery response');
  return parsed.filter((ip): ip is string => typeof ip === 'string' && privateIpv4(ip));
}

function classify(version: string | null, found: boolean, latest: WebosRelease | null): TvState {
  if (!found) return 'missing';
  if (!version || !/^\d+\.\d+\.\d+$/.test(version) || !latest) return 'unknown-version';
  const comparison = compareWebosVersions(version, latest.version);
  return comparison === 0 ? 'current' : comparison < 0 ? 'outdated' : 'ahead';
}

/** The scan is intentionally read-only: no new profile, key or installation is created. */
export async function readLumiereWebosInventory(): Promise<WebosInventory> {
  const result: WebosInventory = {
    checkedAt: new Date().toISOString(),
    release: null,
    releaseError: null,
    error: null,
    tvs: [],
  };
  const releasePromise = latestPublishedWebosRelease()
    .then((release) => {
      result.release = release;
    })
    .catch((error: unknown) => {
      result.releaseError = String(error instanceof Error ? error.message : error);
    });
  const root = webosRoot();
  try {
    await access(join(root, 'scripts', 'discover-lg.ts'));
    await access(join(root, 'node_modules', '@webos-tools', 'cli', 'bin', 'ares-install.js'));
  } catch {
    result.error =
      'Lumiere checkout or webOS CLI is missing on this PC. Run INSTALL-LUMIERE-WEBOS-ALL-TVS.cmd to set up.';
    await releasePromise;
    return result;
  }

  const [known, found] = await Promise.allSettled([profiles(root), discover(root)]);
  await releasePromise;
  if (known.status === 'rejected' && found.status === 'rejected') {
    result.error =
      'Cannot read paired TVs or discover LG TVs on the LAN. Check Local CI host networking and webOS CLI.';
    return result;
  }
  if (known.status === 'rejected') result.error = 'Cannot read paired webOS TV profiles; showing discovered TVs only.';
  if (found.status === 'rejected') result.error = 'LG TV discovery is unavailable; showing registered TVs only.';

  const targets = new Map<string, string | null>();
  if (known.status === 'fulfilled') {
    for (const profile of known.value) {
      const ip = profile.deviceinfo?.ip ?? profile.deviceinfo?.host ?? '';
      if (!targets.has(ip)) targets.set(ip, profile.name);
    }
  }
  if (found.status === 'fulfilled') {
    for (const ip of found.value) if (!targets.has(ip)) targets.set(ip, null);
  }

  result.tvs = await Promise.all(
    [...targets].map(async ([ip, alias]): Promise<WebosTv> => {
      if (!alias) return { ip, name: 'LG TV (' + ip + ')', installedVersion: null, state: 'unpaired' };
      try {
        const output = await cli(root, 'ares-install', ['--device', alias, '--listfull'], 12_000);
        const installed = installedLumiereFromList(output);
        return {
          ip,
          name: alias,
          installedVersion: installed.version,
          state: classify(installed.version, installed.found, result.release),
        };
      } catch {
        return { ip, name: alias, installedVersion: null, state: 'unavailable' };
      }
    }),
  );
  result.tvs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  result.checkedAt = new Date().toISOString();
  return result;
}
