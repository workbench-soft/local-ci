'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const refreshMs = 15_000;

/** Asks the server for a fresh page every 15 s and says when the shown one was made. */
export function AutoRefresh({ renderedAt }: { renderedAt: string }) {
	const router = useRouter();
	useEffect(() => {
		const timer = setInterval(() => router.refresh(), refreshMs);
		return () => clearInterval(timer);
	}, [router]);
	return (
		// The server and the browser may format the time in different locales, so React keeps the browser's text.
		<span className="muted" suppressHydrationWarning>
			Updated {new Date(renderedAt).toLocaleTimeString()}, refreshes every {refreshMs / 1000} s
		</span>
	);
}
