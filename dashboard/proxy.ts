import { type NextRequest, NextResponse } from 'next/server';
import { isLocalHost } from './status/local-host.ts';

// Next checks that Origin matches Host before a server action runs. A rebound name passes that check, so Host itself must be this PC.
export function proxy(request: NextRequest) {
	if (!isLocalHost(request.headers.get('host'))) return new NextResponse('This page answers on localhost only.', { status: 421 });
	return NextResponse.next();
}
