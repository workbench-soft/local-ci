import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** One force cancel of a run, with the words that say why. */
export type CancelCause = {
  kind: 'superseded' | 'checks-failed' | 'manual';
  runId?: number;
  url?: string;
  sha?: string;
  branch?: string;
  pullRequests?: { number: number; url: string }[];
};
export type CancelEntry = {
  repo: string;
  runId: number;
  words: string;
  at: string;
  cause?: CancelCause;
  outcome?: 'requested' | 'accepted' | 'failed';
};

// The sweep and the server actions land in this one process, so one queue keeps their lines whole.
const store: { queue: Promise<void> } = ((globalThis as Record<symbol, { queue: Promise<void> } | undefined>)[
  Symbol.for('local-ci.cancel-log')
] ??= { queue: Promise.resolve() });

/** The JSONL file the reasons go to. CANCEL_REASONS_FILE in .env.local picks another one. */
function cancelFile(): string {
  return process.env.CANCEL_REASONS_FILE || join(process.cwd(), 'cancel-reasons.jsonl');
}

/** A failed write rejects its caller but lets later requests try again. */
export function recordCancel(
  repo: string,
  runId: number,
  words: string,
  detail: Pick<CancelEntry, 'cause' | 'outcome'> = {},
): Promise<void> {
  const entry: CancelEntry = { repo, runId, words, at: new Date().toISOString(), ...detail };
  store.queue = store.queue.catch(() => {}).then(() => append(entry));
  return store.queue;
}

/** Save the cause before asking GitHub, so a crash cannot leave an unexplained stop. */
export async function loggedCancellation(
  repo: string,
  runId: number,
  words: string,
  cause: CancelCause,
  cancel: () => Promise<unknown>,
): Promise<void> {
  await recordCancel(repo, runId, words, { cause, outcome: 'requested' });
  try {
    await cancel();
  } catch (error) {
    await recordCancel(repo, runId, words, { cause, outcome: 'failed' });
    throw error;
  }
  await recordCancel(repo, runId, words, { cause, outcome: 'accepted' });
}

async function append(entry: CancelEntry): Promise<void> {
  const file = cancelFile();
  await mkdir(dirname(file), { recursive: true });
  // A crash can leave a partial last line; the next record needs its own line.
  await appendFile(file, `\n${JSON.stringify(entry)}\n`, { encoding: 'utf8', flush: true });
}

/** The latest reason of each cancelled run, by run id. A missing file gives an empty map. */
export async function readCancels(): Promise<Map<number, CancelEntry>> {
  let text: string;
  try {
    text = await readFile(/*turbopackIgnore: true*/ cancelFile(), 'utf8');
  } catch {
    return new Map();
  }
  const cancels = new Map<number, CancelEntry>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as CancelEntry;
      if (typeof entry.runId === 'number' && typeof entry.words === 'string') cancels.set(entry.runId, entry);
    } catch {
      // A line cut short by a crash goes, the rest still read.
    }
  }
  return cancels;
}
