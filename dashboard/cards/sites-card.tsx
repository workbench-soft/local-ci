'use client';
import { useState } from 'react';
import { formatAge } from '@/status/headline';
import { dispatchVisibilityMs } from '@/status/release-dispatch-guard';
import { dispatchSiteDeploy } from '@/status/site-actions';
import type { WorkflowStats } from '@/status/run-stats';
import { Icon, type IconName } from './icons';
import { StatsLine } from './trends/stats-line';

/** The newest run of a site's deploy workflow among the runs the page reads. */
export type SiteRun = { status: string; conclusion: string | null; url: string; createdAt: string };
export type SiteRow = {
  id: string;
  repo: string;
  workflow: number;
  name: string;
  manual: boolean;
  file: string;
  run: SiteRun | null;
  stats?: WorkflowStats | null;
};

type Answer = { busy?: boolean; requestedAt?: number; message?: string; error?: string };

function chipOf(run: SiteRun): { icon: IconName; text: string; tone: string } {
  if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending')
    return { icon: 'queued', text: 'Queued', tone: 'warn' };
  if (run.status !== 'completed') return { icon: 'running', text: 'Deploying', tone: 'busy' };
  if (run.conclusion === 'success') return { icon: 'success', text: 'Deployed', tone: 'ok' };
  if (run.conclusion === 'cancelled') return { icon: 'cancelled', text: 'Stopped', tone: 'muted' };
  return { icon: 'failure', text: 'Failed', tone: 'bad' };
}

const rowOf: Record<string, string | undefined> = { ok: 'row-ok', bad: 'row-bad', muted: 'row-muted' };

/** Each org repo with a site, its last deploy, and a button that deploys main again on CI. */
export function SitesCard({ sites, now }: { sites: SiteRow[]; now: number }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const deploy = async (site: SiteRow) => {
    setAnswers((current) => ({ ...current, [site.id]: { busy: true } }));
    const answer = await dispatchSiteDeploy(site.repo, site.workflow).catch((error: Error) => ({
      ok: false as const,
      error: error.message,
    }));
    setAnswers((current) => ({
      ...current,
      [site.id]: answer.ok ? { message: 'Deploy queued on CI.', requestedAt: Date.now() } : { error: answer.error },
    }));
  };
  return (
    <section className="card wide">
      <h2>Sites</h2>
      <p className="muted small">
        Every detected website deployment, including sites deployed automatically and multiple sites from one repo.
        Deploy site is available for workflows that support manual runs.
      </p>
      {sites.length === 0 && <p className="muted small">No site workflows were found. Check GitHub access if sites are missing.</p>}
      <ul className="releases sites">
        {sites.map((site) => {
          const { id, repo, name, manual, file, run, stats } = site;
          const chip = run && chipOf(run);
          const running = !!run && run.status !== 'completed';
          const answer = answers[id] ?? {};
          // GitHub lists a dispatched run some seconds later, so the button waits that long.
          const justQueued = answer.requestedAt !== undefined && now - answer.requestedAt < dispatchVisibilityMs;
          return (
            <li key={id} className={chip ? rowOf[chip.tone] : undefined}>
              <div className="release-head">
                <strong>{repo}</strong>
                <span className="muted small">{name}</span>
                {run && chip ? (
                  <a
                    className={`state ${chip.tone}${chip.tone === 'ok' ? ' solid' : ''}`}
                    href={run.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name={chip.icon} />
                    {chip.text}
                  </a>
                ) : (
                  <span className="state muted">No recent deploy</span>
                )}
                {run && <span className="muted small nowrap">{formatAge(run.createdAt, now)}</span>}
                <span className="muted small">{file}</span>
              </div>
              <StatsLine stats={stats} what="deploys" />
              <div className="release-actions">
                {manual ? (
                  <button
                    type="button"
                    className="action"
                    disabled={answer.busy || running || justQueued}
                    title={running ? 'Wait for the current deploy to finish' : undefined}
                    aria-label={`${answer.busy ? 'Queueing' : 'Deploy site'}: ${repo} / ${name}`}
                    onClick={() => deploy(site)}
                  >
                    {answer.busy ? 'Queueing' : 'Deploy site'}
                  </button>
                ) : (
                  <span className="muted small">Automatic deployment only</span>
                )}
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
