'use client';

import { Fragment, useState } from 'react';
import { formatDuration } from '@/status/durations';
import { formatAge, toneOfRun } from '@/status/headline';
import type { RunFailure, WorkflowRun } from '@/status/org-status';
import { type Place, placeOrder } from '@/status/placement';
import type { Release } from '@/status/releases';
import { Icon, placeIcons, resultOf } from './icons';
import { InstallButton } from './install-button';
import { PurgeAllButton } from './purge-all-button';
import { RunControls } from './run-controls';
import { RunTimings } from './run-timings';

export type RunRow = Omit<WorkflowRun, 'jobs' | 'updatedAt'> & {
	/** From the start of the run to its end, or up to now. Null while it waits in the queue. */
	tookMs: number | null;
	place: Place;
	release: Release | null;
	failure: RunFailure | null;
};

type SortKey = 'place' | 'repo' | 'workflow' | 'branch' | 'started' | 'took';

const rowLimit = 60;

type Filter = { text: string; hint?: string; test: (row: RunRow) => boolean };

const filters: Record<'all' | Exclude<Place, 'done'> | 'failed' | 'passed', Filter> = {
	all: { text: 'All', test: () => true },
	local: { ...placeIcons.local, test: (row: RunRow) => row.place === 'local' },
	waiting: { ...placeIcons.waiting, test: (row: RunRow) => row.place === 'waiting' },
	elsewhere: { ...placeIcons.elsewhere, test: (row: RunRow) => row.place === 'elsewhere' },
	failed: { text: 'Failed', test: (row: RunRow) => toneOfRun(row) === 'bad' },
	passed: { text: 'Passed', test: (row: RunRow) => row.conclusion === 'success' },
};

type FilterKey = keyof typeof filters;

const newestFirst = (a: RunRow, b: RunRow) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

// Each key sorts ascending. Ties go to the newest run.
const compareBy: Record<SortKey, (a: RunRow, b: RunRow) => number> = {
	place: (a, b) => placeOrder[a.place] - placeOrder[b.place],
	repo: (a, b) => a.repo.localeCompare(b.repo),
	workflow: (a, b) => a.workflow.localeCompare(b.workflow),
	branch: (a, b) => a.branch.localeCompare(b.branch),
	started: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
	took: (a, b) => (a.tookMs ?? -1) - (b.tookMs ?? -1),
};

const columns: { key: SortKey; text: string }[] = [
	{ key: 'place', text: 'Where' },
	{ key: 'repo', text: 'Repo' },
	{ key: 'workflow', text: 'Workflow' },
	{ key: 'branch', text: 'Branch' },
	{ key: 'started', text: 'Started' },
	{ key: 'took', text: 'Took' },
];

export function LatestRunsTable({ runs, now }: { runs: RunRow[]; now: number }) {
	const [filter, setFilter] = useState<FilterKey>('all');
	const [search, setSearch] = useState('');
	const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'place', descending: false });

	const words = search.toLowerCase().split(/\s+/).filter(Boolean);
	const matches = (row: RunRow) => {
		const text = `${row.repo} ${row.workflow} ${row.title} ${row.branch} ${row.event} ${row.release?.tag ?? ''}`.toLowerCase();
		return words.every((word) => text.includes(word));
	};
	const direction = sort.descending ? -1 : 1;
	const shown = runs
		.filter((row) => filters[filter].test(row) && matches(row))
		.toSorted((a, b) => direction * compareBy[sort.key](a, b) || newestFirst(a, b));
	const rows = shown.slice(0, rowLimit);

	const sortBy = (key: SortKey) =>
		// Dates read best newest first and times longest first, so the first click sorts that way.
		setSort((current) =>
			current.key === key ? { key, descending: !current.descending } : { key, descending: key === 'started' || key === 'took' },
		);

	return (
		<section className="card wide">
			<h2>Latest runs</h2>
			<p className="muted small">An unfinished run says where it builds: on this PC, in the GitHub queue or on another runner. A finished run shows only its result.</p>
			<div className="toolbar">
				<div className="chips" role="group" aria-label="Filter runs">
					{(Object.keys(filters) as FilterKey[]).map((key) => (
						<button
							key={key}
							type="button"
							className="chip"
							title={filters[key].hint}
							aria-pressed={filter === key}
							onClick={() => setFilter(key)}
						>
							{filters[key].text}
							<span className="count">{runs.filter(filters[key].test).length}</span>
						</button>
					))}
				</div>
				<input type="search" aria-label="Search runs" placeholder="Search repo, workflow, branch" value={search} onChange={(event) => setSearch(event.target.value)} />
				<PurgeAllButton runs={shown} />
			</div>
			<div className="table-scroll">
				<table>
					<thead>
						<tr>
							{columns.map(({ key, text }) => (
								<th key={key} aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined}>
									<button type="button" className="sort" onClick={() => sortBy(key)}>
										{text}
										<span className="arrow">{sort.key === key ? (sort.descending ? '▼' : '▲') : ''}</span>
									</button>
								</th>
							))}
							<th>Release</th>
							<th>
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((run) => (
							<RunRowItem key={run.id} run={run} now={now} />
						))}
					</tbody>
				</table>
			</div>
			{shown.length > rowLimit && (
				<p className="muted small">
					{rowLimit} of {shown.length} runs shown. Narrow the filter to see the rest.
				</p>
			)}
			{!shown.length && <p className="muted small">No run matches.</p>}
		</section>
	);
}

function RunRowItem({ run, now }: { run: RunRow; now: number }) {
	const result = resultOf(run.status, run.conclusion);
	const place = run.place === 'done' ? null : placeIcons[run.place];
	const [open, setOpen] = useState(false);
	const active = run.status !== 'completed';
	return (
		<Fragment>
		<tr className={run.place === 'local' ? 'local-row' : undefined}>
			<td className="nowrap">
				<span className={`result ${toneOfRun(run)}`}>
					<Icon name={result.icon} />
					{result.text}
				</span>
				{run.failure && (
					<a className="failed-step small" href={run.failure.url} target="_blank" rel="noreferrer" title="Open the log of the failed job">
						{run.failure.step ? `${run.failure.job}: ${run.failure.step}` : run.failure.job}
					</a>
				)}
				{place && (
					<div className={`place ${run.place}`} title={place.hint}>
						<Icon name={place.icon} />
						{place.text}
					</div>
				)}
			</td>
			<td>{run.repo}</td>
			<td>
				<a href={run.url} target="_blank" rel="noreferrer">
					{run.workflow}
				</a>
				<div className="muted small">{run.title}</div>
			</td>
			<td>
				<a href={run.branchUrl} target="_blank" rel="noreferrer">
					{run.branch}
				</a>
				<div className="muted small">
					{run.event}
					{run.pullRequests.map((pr) => (
						<a key={pr.number} className="pr-link" href={pr.url} target="_blank" rel="noreferrer">
							PR #{pr.number}
						</a>
					))}
				</div>
			</td>
			<td className="nowrap">{formatAge(run.createdAt, now)}</td>
			<td>
				<button type="button" className="took" aria-expanded={open} onClick={() => setOpen(!open)} title="Show the time of each job and step">
					<span className="arrow">{open ? '▼' : '▶'}</span>
					{run.tookMs === null ? 'in queue' : formatDuration(run.tookMs)}
				</button>
			</td>
			<td>
				{run.release && (
					<>
						<a className="release-link" href={run.release.url} target="_blank" rel="noreferrer">
							<Icon name="package" />
							{run.release.name}
						</a>
						{run.release.apk && <InstallButton tag={run.release.tag} name={run.release.name} />}
					</>
				)}
			</td>
			<td>
				<RunControls repo={run.repo} runId={run.id} active={active} label={`the ${run.repo} / ${run.workflow} run`} />
			</td>
		</tr>
		{open && (
			<tr className="timings-row">
				<td colSpan={columns.length + 2}>
					<RunTimings repo={run.repo} runId={run.id} active={active} now={now} />
				</td>
			</tr>
		)}
		</Fragment>
	);
}
