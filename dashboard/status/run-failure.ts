import { stripVTControlCharacters } from 'node:util';

/** Why a job failed or stopped, read from its GitHub annotations and its log. */
export type ReasonKind =
  | 'error' // a step failed
  | 'shutdown' // the runner got a shutdown signal: the PC turned off or restarted
  | 'lost-runner' // GitHub lost contact with the runner: the PC turned off, slept or lost its network
  | 'timeout'
  | 'disk-full'
  | 'replaced' // GitHub cancelled it through concurrency for a newer run
  | 'forced' // a force cancel, by Local CI or by a person
  | 'cancelled-by' // a person pressed Cancel on GitHub
  | 'unknown';

export type JobReason = {
  kind: ReasonKind;
  job: string;
  jobUrl: string;
  step: string | null;
  runner: string | null;
  /** The error line, or GitHub's own words for a stop. */
  message: string | null;
  /** The last log lines of the failed step, up to the error. */
  excerpt: string | null;
  /** Who cancelled the run, from "canceled by @name". */
  actor: string | null;
};

// The annotation every failed step gets, which says no more than the exit code.
const generic = /^(Process completed with exit code \d+\.?|The operation was canceled\.?)$/;

/** The kind of stop the annotations of one job tell, and the line that says it. */
export function classify(messages: string[]): Pick<JobReason, 'kind' | 'message' | 'actor'> {
  const find = (pattern: RegExp) => messages.find((message) => pattern.test(message));
  const actorOf = (message: string) => /canceled (?:forcefully )?by @([\w-]+)/.exec(message)?.[1] ?? null;
  const rules: [RegExp, ReasonKind][] = [
    [/received a shutdown signal/i, 'shutdown'],
    [/lost communication with the server/i, 'lost-runner'],
    [/exceeded the maximum execution time/i, 'timeout'],
    [/not enough space on the disk|No space left on device|disk (was|is) full/i, 'disk-full'],
    [/higher priority waiting request/i, 'replaced'],
    [/canceled forcefully by/i, 'forced'],
    [/canceled by @/i, 'cancelled-by'],
  ];
  for (const [pattern, kind] of rules) {
    const message = find(pattern);
    if (message) return { kind, message: firstLine(message), actor: actorOf(message) };
  }
  const real = messages.filter((message) => !generic.test(message.trim()));
  if (real.length) return { kind: 'error', message: real.slice(0, 3).map(firstLine).join('\n'), actor: null };
  return { kind: messages.length ? 'error' : 'unknown', message: messages[0] ?? null, actor: null };
}

const firstLine = (text: string) => text.trim().split('\n')[0];
// A log line opens with its time, and the first line with a byte order mark.
const stamp = /^\p{Cf}?\d{4}-\d\d-\d\dT[\d:.]+Z ?/u;
// Lines that name an error in the output of Node, Rust, Gradle, pnpm, mise and shell tools.
const errorLine =
  /(^|\s)(\w*(Error|Exception)\b:?|error(\[\w+\])?:|ERROR\b|FAILED\b|FAIL\b|fatal:|panicked at|ERR!|What went wrong:)/;

/** The lines of the failed step up to its first error, at most `max`, and the error line among them. */
export function logExcerpt(log: string, max = 40): { excerpt: string; message: string | null } | null {
  const lines = log.split(/\r?\n/).map((line) => stripVTControlCharacters(line.replace(stamp, '')));
  const end = lines.findIndex((line) => line.startsWith('##[error]'));
  if (end < 0) return null;
  // The step starts at its "##[group]Run" header, and its env block ends at the next endgroup.
  let start = lines.findLastIndex((line, i) => i < end && line.startsWith('##[group]Run '));
  const header = lines.findIndex((line, i) => i > start && line.startsWith('##[endgroup]'));
  if (header >= 0 && header < end) start = header;
  const body = lines.slice(start + 1, end).filter((line) => !line.startsWith('##['));
  while (body.length && !body[0].trim()) body.shift();
  while (body.length && !body.at(-1)!.trim()) body.pop();
  const shown = body.slice(-max);
  const message = shown.find((line) => errorLine.test(line))?.trim() ?? null;
  return { excerpt: shown.join('\n'), message };
}
