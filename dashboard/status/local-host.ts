// A site can point its own name at 127.0.0.1 (DNS rebinding). Its requests then carry that name as Host.
const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

/** True when the Host header names this PC, with or without a port. */
export function isLocalHost(host: string | null): boolean {
	return !!host && localHost.test(host);
}
