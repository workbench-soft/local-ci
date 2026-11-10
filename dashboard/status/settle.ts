/** A server action rejects when the page server is down or restarts for an install. The button then shows the reason. */
export function settled<T>(call: Promise<T>): Promise<T | { ok: false; error: string }> {
  return call.catch((error: unknown) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  }));
}
