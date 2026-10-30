import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
import './releases.css';

export const metadata: Metadata = {
  title: 'Local CI',
  description: 'The self-hosted runner and the latest workflow runs of the org',
};

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
