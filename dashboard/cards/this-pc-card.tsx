import { formatAge } from '@/status/headline';
import type { PcRunner, ThisPcStatus } from '@/status/this-pc';
import { StatusDot } from './status-dot';

export function ThisPcCard({ pc, now }: { pc: ThisPcStatus; now: number }) {
	if (!pc.supported) {
		return (
			<section className="card">
				<h2>This PC</h2>
				<p className="muted">The checks read Windows tools, so they are skipped here.</p>
			</section>
		);
	}
	return (
		<section className="card">
			<h2>This PC</h2>
			{pc.runners.length ? (
				<ul className="runners">
					{pc.runners.map((runner) => (
						<RunnerItem key={runner.folder} runner={runner} now={now} />
					))}
				</ul>
			) : (
				<p className="error">No runner is installed. Run runner\install.ps1.</p>
			)}
		</section>
	);
}

function RunnerItem({ runner, now }: { runner: PcRunner; now: number }) {
	const state = !runner.listener ? 'stopped' : runner.worker ? 'running a job' : 'idle';
	return (
		<li>
			<StatusDot tone={!runner.listener ? 'bad' : runner.worker ? 'busy' : 'ok'} />
			<strong>{runner.name ?? runner.folder}</strong> {state}
			<div className="muted">
				Boot task {runner.task ?? 'missing'}, last job {runner.lastJobAt ? formatAge(runner.lastJobAt, now) : 'none yet'}
			</div>
		</li>
	);
}
