/** Apps whose released APKs accept the WORKBENCH_DEV_KEY deep link.
 * This is not an Android debug signing variant: the developer controls live in
 * each app's settings after a one-time unlock on the selected phone.
 */
const packages: Record<string, string> = {
  'memories-mobile': 'com.workbenchsoft.memories',
  shuttrix: 'com.workbenchsoft.shuttrix',
  tickalot: 'com.workbenchsoft.tickalot',
  spotthecam: 'com.workbenchsoft.spotthecam',
  // Releases before the rename to spotthecam.
  'speed-camera-map': 'com.workbenchsoft.spotthecam',
  keeppad: 'com.workbenchsoft.keeppad',
  servohop: 'com.workbenchsoft.servohop',
  'guitar-upscale': 'com.workbenchsoft.guitarupscale',
};

/** Returns null for releases without a confirmed developer unlock handler. */
export function developerPackageForTag(tag: string): string | null {
  const app = /^(.+)-v\d[\w.]*$/.exec(tag)?.[1];
  return app ? (packages[app] ?? null) : null;
}

/** The resolved activity must belong to the intended package and contain no shell metacharacters. */
export function launchActivity(output: string, packageName: string): string | null {
  return (
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith(packageName + '/') && /^[a-zA-Z0-9._$/]+$/.test(line)) ?? null
  );
}

/** Sent through adb shell stdin, NEVER as a process argument or in an error message. */
export function developerUnlockCommand(activity: string, key: string): string {
  if (!/^com\.workbenchsoft\.[a-z0-9.]+\/[a-zA-Z0-9_.$]+$/.test(activity)) {
    throw new Error('Invalid Android launch activity.');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error('WORKBENCH_DEV_KEY must contain 64 hexadecimal characters.');
  // A quoted URI keeps the ampersand from being interpreted by Android's shell.
  return `am start -W -n ${activity} -a android.intent.action.VIEW -d 'workbenchsoft-dev://unlock?key=${key}&ads=0'\nexit\n`;
}
