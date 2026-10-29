import { githubStatus, type GitHubStatus, type Run } from '@/status/org-status';
import { localStatus, runnerTask, type LocalStatus } from '@/status/this-pc';
import { org } from '@/status/settings';
import { active, ago, runTone, verdict, type Tone } from '@/status/headline';
import { Refresh } from '@/cards/auto-refresh';

export const dynamic = 'force-dynamic';

const shownRuns = 40;

function Dot({ tone }: { tone: Tone }) {
	return <span className={`dot ${tone}`} aria-hidden />;
}

function LocalCard({ local, now }: { local: LocalStatus; now: number }) {
	if (!local.supported) {
		return (
			<section className="card">
				<h2>This PC</h2>
				<p className="muted">The checks read Windows tools, so they are skipped here.</p>
			</section>
		);
	}
	return (
		<section className="card">
			<h2>This PC{local.name ? `: ${local.name}` : ''}</h2>
			<dl>
				<dt>Boot task</dt>
				<dd>
					<Dot tone={local.task === 'Running' ? 'ok' : 'bad'} />
					{local.task ?? 'missing'} <span className="muted">({runnerTask})</span>
				</dd>
				<dt>Listener</dt>
				<dd>
					<Dot tone={local.listener ? 'ok' : 'bad'} />
					{local.listener ? 'running' : 'stopped'}
				</dd>
				<dt>Job</dt>
				<dd>
					<Dot tone={local.worker ? 'busy' : 'ok'} />
					{local.worker ? 'running now' : 'idle'}
				</dd>
				<dt>Last job</dt>
				<dd>{local.lastJobAt ? ago(local.lastJobAt, now) : 'none yet'}</dd>
			</dl>
		</section>
	);
}

function RunnersCard({ gh }: { gh: GitHubStatus }) {
	return (
		<section className="card">
			<h2>Runners of {org}</h2>
			{!gh.ok ? (
				<p className="error">{gh.error}</p>
			) : gh.runners === null ? (
				<p className="error">{gh.runnersError}. Listing runners needs a token with admin:org.</p>
			) : gh.runners.length === 0 ? (
				<p className="muted">The org has no runners.</p>
			) : (
				<ul className="runners">
					{gh.runners.map((r) => (
						<li key={r.id}>
							<Dot tone={r.status === 'offline' ? 'bad' : r.busy ? 'busy' : 'ok'} />
							<strong>{r.name}</strong> {r.status === 'offline' ? 'offline' : r.busy ? 'busy' : 'idle'}
							<div className="labels">
								{r.labels.map((l) => (
									<span key={l} className="label">
										{l}
									</span>
								))}
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function RunsTable({ runs, now }: { runs: Run[]; now: number }) {
	const sorted = [...runs]
		.sort((a, b) => Number(active.has(b.status)) - Number(active.has(a.status)) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
		.slice(0, shownRuns);
	return (
		<section className="card wide">
			<h2>Latest runs</h2>
			<table>
				<thead>
					<tr>
						<th>Result</th>
						<th>Repo</th>
						<th>Workflow</th>
						<th>Branch</th>
						<th>Started</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((r) => (
						<tr key={r.id}>
							<td>
								<Dot tone={runTone(r)} />
								{r.status === 'completed' ? r.conclusion : r.status.replace('_', ' ')}
							</td>
							<td>{r.repo}</td>
							<td>
								<a href={r.url} target="_blank" rel="noreferrer">
									{r.workflow}
								</a>
								<div className="muted small">{r.title}</div>
							</td>
							<td>
								{r.branch}
								<div className="muted small">{r.event}</div>
							</td>
							<td className="nowrap">{ago(r.createdAt, now)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

export default async function Page() {
	const [local, gh] = await Promise.all([localStatus(), githubStatus()]);
	const now = Date.now();
	const v = verdict(local, gh);
	return (
		<main>
			<header>
				<h1>
					<Dot tone={v.tone} />
					{v.text}
				</h1>
				<Refresh at={new Date(now).toISOString()} />
			</header>
			<div className="grid">
				<LocalCard local={local} now={now} />
				<RunnersCard gh={gh} />
				{gh.ok && <RunsTable runs={gh.runs} now={now} />}
			</div>
		</main>
	);
}
