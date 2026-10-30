/** What the count field of the Runners card starts from. */
export type RunnerCountInfo = {
  /** The count runner/install.ps1 last used or the page last asked for, null before the first run. */
  saved: number | null;
  cpus: number;
  memoryGb: number;
  recommended: number;
};

// A build of the org's apps keeps about 4 logical processors and 4 GB busy. Windows and the person's apps keep 8 GB.
const cpusPerRunner = 4;
const gbPerRunner = 4;
const reservedGb = 8;
export const maxRunners = 32;

/** 1 runner per 4 logical processors and per 4 GB of memory past the reserve, and at least 1. */
export function recommendRunners(cpus: number, memoryGb: number): number {
  const byCpu = Math.floor(cpus / cpusPerRunner);
  const byMemory = Math.floor((memoryGb - reservedGb) / gbPerRunner);
  return Math.min(maxRunners, Math.max(1, Math.min(byCpu, byMemory)));
}

export function parseCount(text: string): number | null {
  const count = Number(text.trim());
  return Number.isInteger(count) && count >= 1 ? count : null;
}
