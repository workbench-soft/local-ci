import type { NextConfig } from 'next';

// The Workbench launcher shows this page in its CI tab. A dev launcher runs on a free port.
const launcher = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:*' : 'http://127.0.0.1:47821';

const nextConfig: NextConfig = {
	// On localhost the X-Powered-By header helps only a scanner.
	poweredByHeader: false,
	// Another site could frame the page and steer a click onto Stop or Install, so only the launcher may.
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{ key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${launcher}` },
					{ key: 'Referrer-Policy', value: 'no-referrer' },
				],
			},
		];
	},
};

export default nextConfig;
