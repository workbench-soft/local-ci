import { formatAge } from '@/status/headline';
import { runnerTaskName, type ThisPcStatus } from '@/status/this-pc';
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
			<h2>This PC{pc.name ? `: ${pc.name}` : ''}</h2>
			<dl>
				<dt>Boot task</dt>
				<dd>
					<StatusDot tone={pc.task === 'Running' ? 'ok' : 'bad'} />
					{pc.task ?? 'missing'} <span className="muted">({runnerTaskName})</span>
				</dd>
				<dt>Listener</dt>
				<dd>
					<StatusDot tone={pc.listener ? 'ok' : 'bad'} />
					{pc.listener ? 'running' : 'stopped'}
				</dd>
				<dt>Job</dt>
				<dd>
					<StatusDot tone={pc.worker ? 'busy' : 'ok'} />
					{pc.worker ? 'running now' : 'idle'}
				</dd>
				<dt>Last job</dt>
				<dd>{pc.lastJobAt ? formatAge(pc.lastJobAt, now) : 'none yet'}</dd>
			</dl>
		</section>
	);
}
