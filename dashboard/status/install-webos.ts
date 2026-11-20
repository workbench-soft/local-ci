'use server';

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { workspaceRoot } from './local-build-target.ts';

const exec = promisify(execFile);
const running = { current: false };

export type WebosInstallResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Install the latest published webOS release on every paired LG TV from the LocalCI host PC. */
export async function installLumiereWebosOnAllTvs(): Promise<WebosInstallResult> {
  if (running.current) return { ok: false, error: 'LG TV installation is already running on this PC.' };
  running.current = true;
  try {
    const webos = join(workspaceRoot(), 'lumiere-player', 'webos');
    const script = join(webos, 'scripts', 'install-all-tvs.ts');
    try {
      await access(script);
    } catch {
      return {
        ok: false,
        error: 'Lumiere source is missing on this PC. Clone or update workbench-soft/lumiere-player beside local-ci.',
      };
    }

    try {
      await access(join(webos, 'node_modules', '@webos-tools', 'cli', 'bin', 'ares-install.js'));
    } catch {
      // Dependencies are installed by the normal Lumiere Windows setup; the dashboard must not
      // attempt an interactive toolchain install during a browser request.
      return {
        ok: false,
        error: 'webOS CLI is not installed. Double-click INSTALL-LUMIERE-WEBOS-ALL-TVS.cmd once from the Lumiere repository to set up the PC.',
      };
    }

    // Fixed script and cwd; no browser-provided command, IP address or shell arguments.
    // New TVs must be paired interactively on the PC once. Never prompt for a Developer Mode key
    // in a server action or collect that passphrase in the browser.
    const { stdout, stderr } = await exec(process.execPath, [script], {
      cwd: webos,
      windowsHide: true,
      timeout: 10 * 60_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, LUMIERE_NONINTERACTIVE: '1' },
    });
    const summary = stdout.match(/Finished: (\d+) TV\(s\) updated, (\d+) failed\./);
    const updated = summary ? Number(summary[1]) : 0;
    const failed = summary ? Number(summary[2]) : 0;
    if (!updated) {
      return {
        ok: false,
        error: (stderr + '\n' + stdout).trim().slice(-1500) ||
          'No LG TV was updated. Check Developer Mode and pairing on each TV.',
      };
    }
    return {
      ok: true,
      message: failed
        ? `Lumiere installed on ${updated} LG TV(s), but ${failed} failed. Check the PC log or rerun the double-click installer to pair the remaining TVs.`
        : `Lumiere installed and opened on ${updated} LG TV(s).`,
    };
  } catch (error) {
    const problem = error as Error & { stdout?: string; stderr?: string };
    const details = [problem.stderr, problem.stdout].filter(Boolean).join('\n').trim();
    return {
      ok: false,
      error: details.slice(-1500) || problem.message || 'Could not install Lumiere on LG TVs.',
    };
  } finally {
    running.current = false;
  }
}
