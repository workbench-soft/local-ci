'use client';

import { useState, useTransition } from 'react';
import { purgeRunById, stopRun } from '@/status/run-actions';
import { Icon } from './icons';

/** Stop and Purge for one run. A finished run gets Purge only. */
export function RunControls({ repo, runId, active, label }: { repo: string; runId: number; active: boolean; label: string }) {
	const [pending, startTransition] = useTransition();
	const [busy, setBusy] = useState<'stop' | 'purge' | null>(null);
	const [error, setError] = useState<string | null>(null);

	const run = (kind: 'stop' | 'purge') => {
		if (kind === 'purge' && !window.confirm(`Purge ${label}? GitHub stops the run and deletes it with its logs and artifacts.`)) return;
		setBusy(kind);
		setError(null);
		startTransition(async () => {
			const result = await (kind === 'stop' ? stopRun(repo, runId) : purgeRunById(repo, runId));
			if (!result.ok) setError(result.error);
			setBusy(null);
		});
	};

	return (
		<div className="run-controls">
			{active && (
				<button type="button" className="action" disabled={pending} onClick={() => run('stop')} title="Cancel the run on GitHub">
					<Icon name="stop" />
					{busy === 'stop' ? 'Stopping' : 'Stop'}
				</button>
			)}
			<button type="button" className="action danger" disabled={pending} onClick={() => run('purge')} title="Force cancel the run, then delete it with its logs and artifacts">
				<Icon name="trash" />
				{busy === 'purge' ? 'Purging' : 'Purge'}
			</button>
			{error && (
				<span className="action-error small" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
