import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** One force cancel of a run, with the words that say why. */
export type CancelEntry = { repo: string; runId: number; words: string; at: string };

// The sweep and the server actions land in this one process, so one queue keeps their lines whole.
const store: { queue: Promise<void> } = ((globalThis as Record<symbol, { queue: Promise<void> } | undefined>)[
  Symbol.for('local-ci.cancel-log')
] ??= { queue: Promise.resolve() });

// The file keeps a bounded history, so it can't grow without end.
const keepLines = 200;

/** The JSONL file the reasons go to. CANCEL_REASONS_FILE in .env.local picks another one. */
function cancelFile(): string {
  return process.env.CANCEL_REASONS_FILE || join(process.cwd(), 'cancel-reasons.jsonl');
}

/** Writes the reason of one force cancel, after the cancel went through. */
export function recordCancel(repo: string, runId: number, words: string): Promise<void> {
  const entry: CancelEntry = { repo, runId, words, at: new Date().toISOString() };
  store.queue = store.queue.then(() => append(entry));
  return store.queue;
}

async function append(entry: CancelEntry): Promise<void> {
  const file = cancelFile();
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');
  // Past the kept lines the oldest go, so the file stays small and the newest reasons stay.
  const lines = (await readFile(/*turbopackIgnore: true*/ file, 'utf8')).split('\n').filter(Boolean);
  if (lines.length > keepLines + 20) await writeFile(file, `${lines.slice(-keepLines).join('\n')}\n`, 'utf8');
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
