'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const everyMs = 15_000;

export function Refresh({ at }: { at: string }) {
	const router = useRouter();
	useEffect(() => {
		const id = setInterval(() => router.refresh(), everyMs);
		return () => clearInterval(id);
	}, [router]);
	return (
		<span className="muted">
			Updated {new Date(at).toLocaleTimeString()}, refreshes every {everyMs / 1000} s
		</span>
	);
}
