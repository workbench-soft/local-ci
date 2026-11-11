'use client';
import { useState } from 'react';
import { formatAge } from '@/status/headline';
import { dispatchVisibilityMs } from '@/status/release-dispatch-guard';
import { dispatchSiteDeploy } from '@/status/site-actions';
import { Icon, type IconName } from './icons';

/** The newest run of a site's deploy workflow among the runs the page reads. */
export type SiteRun = { status: string; conclusion: string | null; url: string; createdAt: string };
export type SiteRow = { repo: string; file: string; run: SiteRun | null };

type Answer = { busy?: boolean; requestedAt?: number; message?: string; error?: string };

function chipOf(run: SiteRun): { icon: IconName; text: string; tone: string } {
  if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending')
    return { icon: 'queued', text: 'Queued', tone: 'warn' };
  if (run.status !== 'completed') return { icon: 'running', text: 'Deploying', tone: 'busy' };
  if (run.conclusion === 'success') return { icon: 'success', text: 'Deployed', tone: 'ok' };
  if (run.conclusion === 'cancelled') return { icon: 'cancelled', text: 'Cancelled', tone: 'bad' };
  return { icon: 'failure', text: 'Failed', tone: 'bad' };
}

/** Each org repo with a site, its last deploy, and a button that deploys main again on CI. */
export function SitesCard({ sites, now }: { sites: SiteRow[]; now: number }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const deploy = async (repo: string) => {
    setAnswers((current) => ({ ...current, [repo]: { busy: true } }));
    const answer = await dispatchSiteDeploy(repo).catch((error: Error) => ({
      ok: false as const,
      error: error.message,
    }));
    setAnswers((current) => ({
      ...current,
      [repo]: answer.ok ? { message: 'Deploy queued on CI.', requestedAt: Date.now() } : { error: answer.error },
    }));
  };
  return (
    <section className="card wide">
      <h2>Sites</h2>
      <p className="muted small">
        Each repo with a site. Deploy site starts its deploy workflow on main, on the org runners.
      </p>
      {sites.length === 0 && <p className="muted small">No repo deploys a site from a workflow.</p>}
      <ul className="releases sites">
        {sites.map(({ repo, file, run }) => {
          const chip = run && chipOf(run);
          const running = !!run && run.status !== 'completed';
          const answer = answers[repo] ?? {};
          // GitHub lists a dispatched run some seconds later, so the button waits that long.
          const justQueued = answer.requestedAt !== undefined && now - answer.requestedAt < dispatchVisibilityMs;
          return (
            <li key={repo}>
              <div className="release-head">
                <strong>{repo}</strong>
                {run && chip ? (
                  <a className={`state ${chip.tone}`} href={run.url} target="_blank" rel="noreferrer">
                    <Icon name={chip.icon} />
                    {chip.text}
                  </a>
                ) : (
                  <span className="state muted">No recent deploy</span>
                )}
                {run && <span className="muted small nowrap">{formatAge(run.createdAt, now)}</span>}
                <span className="muted small">{file}</span>
              </div>
              <div className="release-actions">
                <button
                  type="button"
                  className="action"
                  disabled={answer.busy || running || justQueued}
                  title={running ? 'Wait for the current deploy to finish' : undefined}
                  aria-label={`${answer.busy ? 'Queueing' : 'Deploy site'}: ${repo}`}
                  onClick={() => deploy(repo)}
                >
                  {answer.busy ? 'Queueing' : 'Deploy site'}
                </button>
                {answer.message && (
                  <span className="install-ok small" role="status">
                    {answer.message}
                  </span>
                )}
                {answer.error && (
                  <pre className="install-error" role="alert">
                    {answer.error}
                  </pre>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
