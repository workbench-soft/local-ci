# TODO

## Tests on the live page

Each one deletes runs or installs an app, so it waits for the person.

- [ ] Purge: on `http://localhost:4280/?tab=status`, press Stop, then Purge, on a throwaway run. Then press Purge all with a filter that matches a few throwaway runs. The rows should gray at once, and older runs should keep going until none match.
- [ ] Install: once `workbench-soft.github.io` or another app has a release, press Install on it on the Releases tab. It should show on that Release run only.
- [ ] After the next logon, check that the browser opens `http://localhost:4280` on its own.
- [ ] After the next Checks rerun that passes, check that its release keeps building. The fix was tested against a fake GitHub only.

## Mac

- [ ] On the Mac, in Terminal:
  1. `cd` into the local-ci clone and run `git pull`.
  2. Run `./install.sh`, then `./runner/install.sh`.
  3. Check that `~/actions-runner/install.log` shows "Filling the action cache" end within a few minutes.
  4. Open the status page and check that the Runners card names `runner/install.sh`.

## Decisions

- [ ] Branch rules on `main` of `workbench-soft/local-ci`: it has none. The update task pulls the newest `v*` tag every 5 minutes and runs the installers as admin, so a leaked write token runs code as admin. A rule that asks for a PR also stops the direct pushes agents make. Pick one: require PRs, block force pushes only, or keep it open.
- [ ] Reset the history to one commit (rewrite-repo step 12)? The rewrite is on `origin/main` already, and 6 commits carry a personal author email. Say yes and an agent runs the `reset-history` skill.
- [ ] Should Release on CI show for apps with no release yet, such as local-ci, workspace and agent-skills? On local-ci it starts this repo's own Release, which the update task then installs as admin.
- [ ] Cap the cancellation history? The Releases tab HTML is 1.7 MB on each 15 s refresh, and `cancel-reasons.jsonl` has no size cap. Say a number of rows, such as the last 100.
- [ ] Fewer runners or more RAM: 8 jobs at once plus local builds and the emulator on 31 GB RAM grew `pagefile.sys` to 82 GB. For 6 runners, set the count to 6 on the Runners card.
- [ ] `runner/install.ps1` waits for a runner to go idle before a restart, and a busy queue keeps it busy (runners 2 to 4 waited over an hour on 29 Oct). A restart between jobs needs a test on the live runners with the queue empty. Say when the queue may stop for it.

## Clean the PC

- [ ] Free disk on C: (62 GB free on 2026-11-13). The 4 old `_work` folders in `%USERPROFILE%\actions-runner` date from before the move to `C:\ci`. Auto mode denies a folder delete, so in PowerShell:

  ```powershell
  Remove-Item -Recurse -Force "$env:USERPROFILE\actions-runner\workbench-soft*\_work"; Remove-Item -Recurse -Force "$env:TEMP\local-ci-apk"; mise x -- uv cache clean
  ```

  The second part drops 4 old APKs (393 MB). The agent's session sees a copy of `%TEMP%`, so it can't delete them for real.
- [ ] Run `CLEAN-CI.cmd` once when the queue is empty, and check that the runners start again.
- [ ] Turn off Surfshark on this PC, or add `C:\ci`, `%USERPROFILE%\actions-runner` and `gh.exe` to its split tunnelling (Bypasser). Its drops on 2026-11-08 to 2026-11-10 lined up with TLS timeouts in CI jobs.

## Accounts

- [ ] Dependabot fails in app-updater and aspirationstyle with "Dependabot doesn't have access to" `workbench-soft/ci` (latest runs 2026-11-10 and 2026-11-11):
  1. Open `https://github.com/organizations/workbench-soft/settings/security_analysis`.
  2. Under "Grant Dependabot access to private repositories", add `workbench-soft/ci`.
- [ ] Copy the Memories desktop signing key and password from `%USERPROFILE%\.config\memories` to the password manager. Reinstall the Memories desktop app once with the install command (key rotated 2026-10-30, memories#42).
- [ ] Delete the old Open Charge Map key of ServoHop. It sits in another Open Charge Map account than the one used on 2026-10-30.

## app-audit

Findings the audits of 2026-11-10 and 2026-11-11 left, no task yet:

- Left: `release-workflow.ts:93` takes `release.yml` over `deploy.yml` for property-trends-web when no run is found (the rule the spec chose).
- Left: the 100 run cap in `release-workflow.ts:58` matched 1 of 54 releases to a PR Checks run (no harm, a narrower filter picks worse).
- Left: `runner/gh` reruns a whole command whose first request went out: `--paginate` prints pages again, and `release create` makes a second draft when the upload host fails. `gh secret set X < file` retries with empty stdin (each needs a CI run to prove a change).
- Left: jobs may read `_mise\config.toml` while `runner/install.ps1` copies it (a guess, unseen).
- Left: `runner/mise-ci.toml` keeps actionlint, pnpm and rust at `latest` (a runner pin change, no failure seen).
- Left: `release-workflow.ts` makes an extra call per app where `latestReleases` knows the workflow, skips the ETag cache and waits on an expired cache (about 16 calls an hour, effort M).
- Left: Release on CI says "No release workflow found" when GitHub fails, `release-actions.ts:289` (rare, and the server action has no test harness).
- Left: prune `_diag` logs in each runner folder: 952 Worker logs, 278 MB on 2026-10-30, with no cap (deleting logs is a person's call, and the runner's own retention wasn't checked).
- Left: TypeScript 7 and @types/node 26 (major bumps, node stays at 22).
- Left: run the runners under their own Windows account, so jobs can't read the admin token in `dashboard\.env.local` (effort L, needs a new account and paths for mise, Gradle and the Android SDK).
- Left: a fine-grained token for the page in place of the `gh` login (needs a new PAT made by a person).
- Left: restart the old page task when an `install.ps1` build fails (needs an admin run to test).
- Left: a warning headline when some repos fail to load (a new headline state).
- Left: Purge all on the All filter after one generic confirm (product call).
- Left: one module for run states and a split of `org-status.ts` (refactor, effort M).
- Left: npm globals in a mise `npm:` backend and a node pin (installer change, and a `mise.toml` needs `mise trust` on each machine).
- Left: shared tool cache race on a first download (a guess, unseen).
- Left: runner labels set once, installer lists kept twice, `RUNNER_ORG` missing from the page, no paging past 100 repos (effort M, or no effect at 16 repos).
- Left: the boot task gives up after 3 restarts, the APK sits in memory, `start.cmd` is rewritten during the idle wait (low value, `## Decisions` covers the wait).
- Left: small text under 4.5:1: the errored tab count 3.81, the pressed chip count 3.40, the Blacksmith pill 4.23, the Oracle pill 3.73, the search placeholder 4.30 (a colour change is a look change, the fix sat in commit `713075f` of the dropped lens branch).
- Left: `claude/MEMORY.md` names the review skill with a Windows path only (the file is the person's global memory, so the wording is theirs).
- Left: visible copy slips: `.\\dashboard\\install.ps1` with doubled backslashes in `dev-key-notice.tsx:41`, "Tick apps above" over tick boxes that sit below in `releases-card.tsx:116`, a raw ISO time in `cancellation-history.tsx:27` (changes visible words).
- Left: the router cancels a run stuck on Blacksmith without a logged reason, `cloud-router.ts:177` (needs a new `kind` in `cancel-reasons.jsonl`).
- Left: a purged run answers 404 on each router tick and blocks later reruns, `cloud-router.ts:181` (latent, 0 Blacksmith cancels in 5 days, the router has no test harness).
- Left: an accepted cancel hides later cancels of the same run id, `cancel-log.ts:85` (a person's rerun may be meant to build).
- Left: `.built-commit` is written before the token file and the boot task in `dashboard/install.ps1:61`, and the page stays down for the whole build (needs an admin run to test).
- Left: `Remove-Runner` deletes the runner folder before its work folder, `runner/install.ps1:219` (a change under `runner/` reruns the installer on the live PC).
- Left: a local build passes `GITHUB_TOKEN` to the app's build script, `local-build-runner.ts:160` (a guess that no build needs it).
- Left: the CSP holds `frame-ancestors` only, while release notes render as HTML (a `script-src` policy needs nonces, effort M to L).
- Left: `.env.local.new` gets the token before its ACL lock, `gh auth token` has no timeout, `install.sh` pipes curl into a shell for Homebrew (single user PC, dev only, no upstream checksum).
- Left: GitHub JSON is cast without a check at about 20 sites, and `cloud-usage.json` is cast to its type (a schema library over 10 files, effort L).
- Left: `noUncheckedIndexedAccess` finds 74 errors and `exactOptionalPropertyTypes` 22 (too big for one pass).
- Left: a cold load fires about 150 GitHub calls at once at 25 repos (a guess, the page retries on the next load).
- Left: pnpm 12.16.1 to 12.18.0 (no measured gain, changes the tool on the live PC).
- Left: the `speed-camera-map` alias sits in 3 tables, `error instanceof Error` is copied 16 times, the time left line is built twice (moves of code, or a change of visible words).
- Left: artifacts are kept only for `in_progress` and `queued` runs (unseen in about 2,900 runs).
- Left: 6 commits carry a personal author email (history stays, `## Decisions` holds the reset).
- Left: 10 tools of the PC's own mise config sit in `C:\ci\_mise\installs` from 2026-11-10 22:13, from a job that read `%USERPROFILE%\.config\mise\config.toml` as a local config before commit `792e980` reached the PC (disk only).
