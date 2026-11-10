'use client';

import { useEffect, useState } from 'react';
import { formatDuration, type JobTiming, type StepTiming } from '@/status/durations';
import { toneOfRun } from '@/status/headline';
import { runTimings } from '@/status/run-actions';
import { resultOf } from './icons';

/** The jobs and steps of a run, each with its time and a bar in scale with the longest step. */
export function RunTimings({
  repo,
  runId,
  active,
  now,
}: {
  repo: string;
  runId: number;
  active: boolean;
  now: number;
}) {
  const [jobs, setJobs] = useState<JobTiming[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // An unfinished run reads again on each page refresh, since its steps move on.
  const refreshKey = active ? now : 0;
  useEffect(() => {
    let current = true;
    runTimings(repo, runId).then((result) => {
      if (!current) return;
      if (result.ok) {
        setJobs(result.jobs);
        setError(null);
      } else setError(result.error);
    });
    return () => {
      current = false;
    };
  }, [repo, runId, refreshKey]);

  if (error) return <p className="error small">{error}</p>;
  if (!jobs) return <p className="muted small">Reading the steps</p>;
  if (!jobs.length) return <p className="muted small">GitHub lists no jobs for this run.</p>;
  const longest = Math.max(1, ...jobs.flatMap((job) => job.steps.map((step) => step.ms ?? 0)));
  return (
    <div className="timings">
      {jobs.map((job) => (
        <div key={job.url} className="timing-job">
          <div className="timing-head">
            <a href={job.url} target="_blank" rel="noreferrer">
              {job.name}
            </a>
            <TimeText item={job} />
          </div>
          <ol className="timing-steps">
            {job.steps.map((step, index) => (
              <li key={`${index}-${step.name}`}>
                <span className="timing-name">
                  {step.name}
                  {/* The bar tells a failed step by its color alone, so a screen reader gets the word. */}
                  <span className="sr-only">, {resultOf(step.status, step.conclusion).text}</span>
                </span>
                <span className="timing-bar">
                  <span className={toneOfRun(step)} style={{ width: `${((step.ms ?? 0) / longest) * 100}%` }} />
                </span>
                <TimeText item={step} />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function TimeText({ item }: { item: StepTiming }) {
  if (item.conclusion === 'skipped') return <span className="timing-time muted">skipped</span>;
  return <span className="timing-time muted">{item.ms === null ? 'waits' : formatDuration(item.ms)}</span>;
}
