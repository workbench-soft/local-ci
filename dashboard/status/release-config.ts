/** The release workflow and local APK build for each published Android app. */
export type ReleaseTarget = {
  app: string;
  repo: string;
  workflow: string;
  build?: { script: string; apk: string; gradleDir: string };
};

const targets: ReleaseTarget[] = [
  {
    app: 'memories-mobile',
    repo: 'memories',
    workflow: 'release.yml',
    build: {
      script: 'apps/mobile/scripts/build-apk.sh',
      apk: 'apps/mobile/dist/memories.apk',
      gradleDir: 'apps/mobile',
    },
  },
  {
    app: 'shuttrix',
    repo: 'memories',
    workflow: 'shuttrix-release.yml',
    build: {
      script: 'apps/shuttrix/scripts/build-apk.sh',
      apk: 'apps/shuttrix/dist/shuttrix.apk',
      gradleDir: 'apps/shuttrix',
    },
  },
  {
    app: 'tickalot',
    repo: 'tickalot',
    workflow: 'release.yml',
    build: { script: 'scripts/build-apk.sh', apk: 'dist/tickalot.apk', gradleDir: '.' },
  },
  { app: 'lumiere', repo: 'lumiere-player', workflow: 'release.yml' },
  {
    app: 'skyaltar',
    repo: 'skyaltar',
    workflow: 'release.yml',
    build: { script: 'scripts/build-apk.sh', apk: 'dist/skyaltar.apk', gradleDir: '.' },
  },
  {
    app: 'memoire',
    repo: 'memoire',
    workflow: 'release.yml',
    build: { script: 'scripts/build-apk.sh', apk: 'dist/memoire.apk', gradleDir: '.' },
  },
  {
    app: 'shuttrix-legacy',
    repo: 'shuttrix-legacy',
    workflow: 'release.yml',
    build: { script: 'scripts/build-apk.sh', apk: 'dist/shuttrix.apk', gradleDir: '.' },
  },
  {
    app: 'spotthecam',
    repo: 'spotthecam',
    workflow: 'deploy.yml',
    build: { script: 'scripts/build-apk.sh', apk: 'dist/speed-cameras.apk', gradleDir: '.' },
  },
  { app: 'media-organizer', repo: 'media-organizer', workflow: 'release.yml' },
];

export function releaseTargetFor(app: string): ReleaseTarget | null {
  return targets.find((target) => target.app === app) ?? null;
}

export function releaseTargets(): ReleaseTarget[] {
  return targets;
}
