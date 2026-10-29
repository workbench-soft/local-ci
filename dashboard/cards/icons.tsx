import type { Place } from '@/status/placement';

export type IconName = 'success' | 'failure' | 'cancelled' | 'running' | 'queued' | 'local' | 'cloud' | 'server';

// Feather-style 24 px strokes, so every icon takes the text color of its tone.
const paths: Record<IconName, string[]> = {
	success: ['M20 6 9 17l-5-5'],
	failure: ['M18 6 6 18', 'M6 6l12 12'],
	cancelled: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18', 'M5.6 5.6l12.8 12.8'],
	running: ['M21 12a9 9 0 1 1-6.2-8.6'],
	queued: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18', 'M12 7v5l3 2'],
	local: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
	cloud: ['M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.3 12.5 3.5 3.5 0 0 0 6.5 19z'],
	server: ['M3 3h18v7H3z', 'M3 14h18v7H3z', 'M7 6.5h.01', 'M7 17.5h.01'],
};

export function Icon({ name, label, className = '' }: { name: IconName; label?: string; className?: string }) {
	return (
		<svg
			className={`icon ${name} ${className}`}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			{label && <title>{label}</title>}
			{paths[name].map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	);
}

export const placeIcons: Record<Exclude<Place, 'done'>, { icon: IconName; text: string }> = {
	local: { icon: 'local', text: 'On this PC' },
	waiting: { icon: 'cloud', text: 'Waiting on GitHub' },
	elsewhere: { icon: 'server', text: 'On another runner' },
};

/** The icon and the words for the result of a run. */
export function resultOf(status: string, conclusion: string | null): { icon: IconName; text: string } {
	if (status === 'in_progress') return { icon: 'running', text: 'running' };
	if (status !== 'completed') return { icon: 'queued', text: status.replace('_', ' ') };
	if (conclusion === 'success') return { icon: 'success', text: 'success' };
	if (conclusion === 'cancelled' || conclusion === 'skipped' || conclusion === 'neutral') return { icon: 'cancelled', text: conclusion };
	return { icon: 'failure', text: conclusion ?? 'failed' };
}
