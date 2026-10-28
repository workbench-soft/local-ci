import { githubStatus, type GitHubStatus, type Run } from '@/lib/github';
import { localStatus, runnerTask, type LocalStatus } from '@/lib/local';
import { org } from '@/lib/org';
import { Refresh } from './refresh';

export const dynamic = 'force-dynamic';

const shownRuns = 40;
const active = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

type Tone = 'ok' | 'busy' | 'warn' | 'bad';

function ago(iso: string, now: number): string {
	const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
	if (s < 60) return `${s} s ago`;
	if (s < 3600) return `${Math.round(s / 60)} min ago`;
	if (s < 86400) return `${Math.round(s / 3600)} h ago`;
	return `${Math.round(s / 86400)} d ago`;
}

function runTone(run: Run): Tone {
	if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') return 'warn';
	if (active.has(run.status)) return 'busy';
	if (run.conclusion === 'success' || run.conclusion === 'skipped') return 'ok';
	if (run.conclusion === 'cancelled' || run.conclusion === 'neutral') return 'warn';
	return 'bad';
}

function verdict(local: LocalStatus, gh: GitHubStatus): { tone: Tone; text: string } {
	if (local.supported && !local.listener) return { tone: 'bad', text: 'The runner on this PC is down' };
	if (!gh.ok) return { tone: 'warn', text: 'GitHub is out of reach' };
	const online = gh.runners?.filter((r) => r.status === 'online');
	if (online && online.length === 0) return { tone: 'bad', text: 'No runner is online' };
	const busy = gh.runs.filter((r) => r.status === 'in_progress').length;
	const queued = gh.runs.filter((r) => active.has(r.status)).length - busy;
	const wait = queued ? `${queued} in the queue` : '';
	if (busy) return { tone: 'busy', text: `Building ${busy} run${busy > 1 ? 's' : ''}${wait ? `, ${wait}` : ''}` };
	if (queued) return { tone: 'warn', text: `No run builds, ${wait}` };
	return { tone: 'ok', text: 'CI is up and idle' };
}

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
