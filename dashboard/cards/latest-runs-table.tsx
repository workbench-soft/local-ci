import { activeStatuses, formatAge, toneOfRun } from '@/status/headline';
import type { WorkflowRun } from '@/status/org-status';
import { StatusDot } from './status-dot';

const rowLimit = 40;

// Unfinished runs go on top, then the newest first.
function newestActiveFirst(a: WorkflowRun, b: WorkflowRun): number {
	const byActive = Number(activeStatuses.has(b.status)) - Number(activeStatuses.has(a.status));
	return byActive || Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export function LatestRunsTable({ runs, now }: { runs: WorkflowRun[]; now: number }) {
	const rows = runs.toSorted(newestActiveFirst).slice(0, rowLimit);
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
					{rows.map((run) => (
						<tr key={run.id}>
							<td>
								<StatusDot tone={toneOfRun(run)} />
								{run.status === 'completed' ? run.conclusion : run.status.replace('_', ' ')}
							</td>
							<td>{run.repo}</td>
							<td>
								<a href={run.url} target="_blank" rel="noreferrer">
									{run.workflow}
								</a>
								<div className="muted small">{run.title}</div>
							</td>
							<td>
								{run.branch}
								<div className="muted small">{run.event}</div>
							</td>
							<td className="nowrap">{formatAge(run.createdAt, now)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
