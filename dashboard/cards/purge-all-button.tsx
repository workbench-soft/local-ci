'use client';

import { useState, useTransition } from 'react';
import { purgeAllRuns } from '@/status/run-actions';
import { Icon } from './icons';

/** Purges every run the table's filter and search match, after a confirm. */
export function PurgeAllButton({ runs }: { runs: { repo: string; id: number }[] }) {
	const [pending, startTransition] = useTransition();
	const [note, setNote] = useState<{ text: string; failed: boolean } | null>(null);

	const purgeAll = () => {
		const count = runs.length === 1 ? '1 run' : `${runs.length} runs`;
		if (!window.confirm(`Purge ${count} that the filter and search match? GitHub stops each run and deletes it with its logs and artifacts.`)) return;
		setNote(null);
		startTransition(async () => {
			const result = await purgeAllRuns(runs.map((run) => ({ repo: run.repo, runId: run.id })));
			setNote(
				result.failed || result.error
					? { text: `Purged ${result.purged}, ${result.failed} failed. ${result.error ?? ''}`.trim(), failed: true }
					: { text: `Purged ${result.purged}.`, failed: false },
			);
		});
	};

	return (
		<div className="run-controls">
			<button
				type="button"
				className="action danger"
				disabled={pending || !runs.length}
				onClick={purgeAll}
				title="Force cancel every run the filter and search match, then delete them with their logs and artifacts"
			>
				<Icon name="trash" />
				{pending ? 'Purging' : `Purge all (${runs.length})`}
			</button>
			{note && (
				<span className={note.failed ? 'action-error small' : 'muted small'} role={note.failed ? 'alert' : 'status'}>
					{note.text}
				</span>
			)}
		</div>
	);
}
