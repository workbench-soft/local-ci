import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// On localhost the X-Powered-By header helps only a scanner.
	poweredByHeader: false,
	// Another site could frame the page and steer a click onto Stop or Install.
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
					{ key: 'Referrer-Policy', value: 'no-referrer' },
				],
			},
		];
	},
};

export default nextConfig;
