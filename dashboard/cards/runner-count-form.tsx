'use client';

import { useState, useTransition } from 'react';
import { maxRunners, type RunnerCountInfo } from '@/status/runner-count';
import { applyRunnerCount } from '@/status/runner-count-action';

/** Sets how many runners this PC keeps, next to the count its processors and memory suit. */
export function RunnerCountForm({
  installed,
  info: { saved, cpus, memoryGb, recommended },
}: {
  installed: number;
  info: RunnerCountInfo;
}) {
  const [value, setValue] = useState(String(saved ?? installed));
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ text: string; failed: boolean } | null>(null);
  const count = Number(value);
  const valid = Number.isInteger(count) && count >= 1 && count <= maxRunners;

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setNote(null);
    startTransition(async () => {
      const result = await applyRunnerCount(count);
      setNote(
        result.ok
          ? {
              text: `runner\\install.ps1 runs in a window on the desktop. A runner on a job leaves once the job ends.`,
              failed: false,
            }
          : { text: result.error, failed: true },
      );
    });
  };

  return (
    <form className="runner-count" onSubmit={apply}>
      <label>
        Runners on this PC{' '}
        <input
          type="number"
          min={1}
          max={maxRunners}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="action"
        disabled={pending || !valid || (count === installed && (saved ?? installed) === installed)}
      >
        {pending ? 'Applying' : 'Apply'}
      </button>
      <span className="muted small">
        {cpus} logical processors and {memoryGb} GB of memory suit {recommended}{' '}
        {recommended === 1 ? 'runner' : 'runners'}.
      </span>
      {count !== recommended && (
        <button type="button" className="action" onClick={() => setValue(String(recommended))}>
          Use {recommended}
        </button>
      )}
      {note && (
        <span className={note.failed ? 'action-error small' : 'muted small'} role={note.failed ? 'alert' : 'status'}>
          {note.text}
        </span>
      )}
    </form>
  );
}
