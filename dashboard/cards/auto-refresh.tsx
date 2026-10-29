'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const refreshMs = 15_000;
// Three missed refreshes mean the server or the network is down.
const staleAfterMs = 3 * refreshMs;

/** Asks the server for a fresh page every 15 s while the tab shows, and says when the shown one was made. */
export function AutoRefresh({ renderedAt }: { renderedAt: string }) {
	const router = useRouter();
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		// A hidden tab skips its refreshes, and catches up once it shows again.
		const refresh = () => {
			if (!document.hidden) router.refresh();
		};
		const timer = setInterval(refresh, refreshMs);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refresh);
		};
	}, [router]);
	useEffect(() => {
		setNow(Date.now());
		const clock = setInterval(() => setNow(Date.now()), 5_000);
		return () => clearInterval(clock);
	}, []);
	const time = new Date(renderedAt).toLocaleTimeString();
	if (now !== null && now - Date.parse(renderedAt) > staleAfterMs) {
		return (
			<span className="error" role="alert">
				Not updated since {time}. Check that the local-ci dashboard task runs.
			</span>
		);
	}
	return (
		// The server and the browser may format the time in different locales, so React keeps the browser's text.
		<span className="muted" suppressHydrationWarning>
			Updated {time}, refreshes every {refreshMs / 1000} s
		</span>
	);
}
