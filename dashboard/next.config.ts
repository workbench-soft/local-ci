import type { NextConfig } from 'next';

const config: NextConfig = {
	// The page sits on localhost, so the header only tells a scanner what runs.
	poweredByHeader: false,
};

export default config;
