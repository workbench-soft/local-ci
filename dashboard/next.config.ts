import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// On localhost the X-Powered-By header helps only a scanner.
	poweredByHeader: false,
};

export default nextConfig;
