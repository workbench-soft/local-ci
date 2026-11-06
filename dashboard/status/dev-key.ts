/** Only a boolean goes to the client; never send the developer key to the browser. */
export function isDevKeyConfigured(value: string | undefined): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value ?? '');
}
