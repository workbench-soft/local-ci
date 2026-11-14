'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, startTransition, use, useOptimistic, type ReactNode } from 'react';

export type Tab = 'releases' | 'status' | 'trends';
export type TabLink = { tab: Tab; href: string; label: ReactNode };

// The tab the page shows: the clicked one until the server's page for it comes.
const Shown = createContext<{ tab: Tab; open: (tab: Tab, href: string) => void } | null>(null);

/** Holds the clicked tab, so the links and the body switch on the click and not 5 s later. */
export function TabSwitch({ tab, children }: { tab: Tab; children: ReactNode }) {
  const router = useRouter();
  const [shown, setShown] = useOptimistic(tab);
  const open = (next: Tab, href: string) =>
    startTransition(() => {
      setShown(next);
      router.push(href);
    });
  return <Shown value={{ tab: shown, open }}>{children}</Shown>;
}

export function TabLinks({ links }: { links: TabLink[] }) {
  const { tab, open } = use(Shown)!;
  return (
    <nav className="tabs" aria-label="Pages">
      {links.map((link) => (
        <Link
          key={link.tab}
          href={link.href}
          aria-current={link.tab === tab ? 'page' : undefined}
          // A plain click only: Ctrl and middle clicks open a browser tab as before.
          onNavigate={(event) => {
            event.preventDefault();
            if (link.tab !== tab) open(link.tab, link.href);
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

// Wide cards in the shape of each tab, so the page doesn't jump when the real one comes.
const shapes: Record<Tab, string[]> = {
  releases: ['wide tall', 'wide', 'wide'],
  status: ['wide', '', '', 'wide tall'],
  trends: ['wide', 'wide tall', 'wide tall', 'wide'],
};

/** The server's tab, or gray cards in its shape while the clicked tab loads. */
export function TabBody({ tab, children }: { tab: Tab; children: ReactNode }) {
  const shown = use(Shown)!.tab;
  if (shown === tab) return children;
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {shapes[shown].map((shape, index) => (
        <section key={index} className={`card skeleton ${shape}`}>
          <span />
          <span />
          <span />
        </section>
      ))}
    </div>
  );
}
