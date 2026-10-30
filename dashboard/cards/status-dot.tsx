import type { Tone } from '@/status/headline';

export function StatusDot({ tone }: { tone: Tone }) {
  return <span className={`dot ${tone}`} aria-hidden />;
}
