# TODO

## windows-local-ci

- [ ] `code --install-extension` can't find `oleg-chibikov.open-in-remote-repo`: publish it to the VS Code Marketplace, or drop it from both installers.

## CI on the local runner

- [ ] keeppad: `ios.yml` stays on GitHub's `macos-latest` and starts by hand, since the Windows PC can't build for iPhone.
- [ ] After each app's PR merges, check its first release and deploy run. Those jobs run only on main, so the PR checks skipped them.

## rewrite-repo

- [ ] Open `http://localhost:4280` in light and dark mode and check the shifted palette and the cards.
- [ ] On a Mac, run `./install.sh` and `./runner/install.sh` once. They passed shellcheck and shfmt but didn't run.
- [ ] Reset the history to one commit (rewrite-repo step 12), then push `main`. The rewrite commits sit on the local `main` only.

## dashboard-local-runs

- [ ] After the next logon, check that the browser opens `http://localhost:4280` on its own.

## run-controls

- [ ] Press Stop and Purge once on a throwaway run. The buttons rendered on live runs, but no GitHub cancel or delete call ran in testing.

## python-setup

- [ ] `runner/install.ps1` waits for a runner to go idle before it restarts it, and a busy queue keeps it busy. On 29 Oct 2025 runners 2 to 4 waited over an hour, so the agent copied `.path` and `start.cmd` from runner 1. Restart a runner between jobs in place of waiting for idle, or pause its listener first

## release-install

- [ ] Press Install once on a real release. `workbench-soft.github.io` had 0 releases on 2025-10-29, since the latest Release runs failed, so only the error path ran in testing.

## purge-all

- [ ] Press Purge all once with a filter that matches a few throwaway runs. Only the confirm was tested, no real purge ran.

## runner-speed

- [ ] On the Mac, run `git pull`, then `./runner/install.sh`. The Mac part was linted but not run.

## app-audit

Audit of 2026-11-11:

- [ ] After the update task installs the next release, read `%USERPROFILE%\.local-ci\update.log`: a `runner\install.ps1` run while jobs use mise should log "Kept C:\ci\_mise\bin\mise.exe" and go on, where it exited with 1 on 2026-11-10 21:12. Tested with a stub exe only.
- [ ] Decide if Release on CI shows for apps with no release yet, such as local-ci, workspace and agent-skills. On local-ci it starts this repo's own Release, which the update task then installs as admin. The 2026-11-11 spec entry asks for the button, so the audit kept it.
- [ ] Look at `C:\ci\_mise\installs`: 10 tools that only the PC's own mise config lists, such as gcloud, codex and the MCP servers, showed up there at 2026-11-10 22:13. Something with `MISE_DATA_DIR` set read the PC's config, and the job logs of that time can tell what.
- Left: `release-workflow.ts:93` takes `release.yml` over `deploy.yml` for property-trends-web when no run is found (the rule the spec chose).
- Left: the 100 run cap in `release-workflow.ts:58` matched 1 of 54 releases to a PR Checks run (no harm, a narrower filter picks worse).
- Left: `runner/gh` reruns a whole command whose first request went out: `--paginate` prints pages again, and `release create` makes a second draft when the upload host fails. `gh secret set X < file` retries with empty stdin (each needs a CI run to prove a change).
- Left: jobs may read `_mise\config.toml` while `runner/install.ps1` copies it (a guess, unseen).
- Left: `runner/mise-ci.toml` keeps actionlint, pnpm and rust at `latest` (a runner pin change, no failure seen).
- Left: `release-workflow.ts` makes an extra call per app where `latestReleases` knows the workflow, skips the ETag cache and waits on an expired cache (about 16 calls an hour, effort M).
- Left: Release on CI says "No release workflow found" when GitHub fails, `release-actions.ts:289` (rare, and the server action has no test harness).

- [ ] Watch the first sweep cancels in `dashboard\dashboard.log` after the install: each line now gives a time and a reason. A new PR's first run should keep building.
- [ ] Press Install on a real release: it should show on the Release run only. `workbench-soft.github.io` had 0 releases when tested.
- [ ] On the Mac, run the status page once: the Runners card names `runner/install.sh`. Only Windows ran here.
- [ ] After that run, check that `~/actions-runner/install.log` shows "Filling the action cache" end within a couple of minutes. The scan alone took 203 s before.
- [ ] The next time you change the count on the Runners card, check that the note under Apply reads `runner\install.ps1`. The audit didn't press Apply, since it starts the admin task on the live runners.
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
- Left: the boot task gives up after 3 restarts, the APK sits in memory, `start.cmd` is rewritten during the idle wait (low value, `## python-setup` covers the wait).

Audit of 2026-11-10:

- [ ] Add branch protection or a ruleset to `main` of `workbench-soft/local-ci`. The update task pulls the newest `v*` tag every 5 minutes and runs the installers as admin, so a leaked write token runs code as admin on the PC.
- [ ] Read `%USERPROFILE%\actions-runner\update.log`: it shows 112 merges stopped on 2026-11-02 by a leftover `MERGE_AUTOSTASH` ref, 65 failed page installs and 4 failed runner installs, the last on 2026-11-10 11:02. The page shows none of them.
- [ ] Delete `%TEMP%\local-ci-apk` once: 4 old APKs, 393 MB. New installs clean up after themselves.
- [ ] Run `CLEAN-CI.cmd` once when the queue is empty and check that the runners start again. The new `try` and `finally` were parsed and tested by text only.
- [ ] After the next Checks rerun that passes, check that its release keeps building. The fix was tested against a fake GitHub only.
- [ ] Decide on `C:\ci\_pnpm-store`: it has no clean rule in `runner\clean-work.ps1` and no reason in `specs\ci-runner.md`, and with copies it only grows.
- [ ] Decide on a cap for the cancellation history: 550 runs make 961 KB of HTML on each 15 s refresh, and `cancel-reasons.jsonl` has no size cap.
- [ ] Decide what an agent may press in `fix-stuck-ci`: step 3 says to use "LocalCI Stop" without saying where it is, and the description says the skill restarts the runners while the table says to ask.
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
- Left: 6 commits carry a personal author email (history stays, `## rewrite-repo` holds the reset).

## Org releases

- [ ] Copy the Memories desktop signing key and password from `~/.config/memories` to the password manager. Reinstall the Memories desktop app once with the install command (key rotated 2026-10-30, memories#42).
- [ ] Delete the old Open Charge Map key of ServoHop. It sits in another Open Charge Map account than the one used on 2026-10-30.
- [ ] Store the Queensland fuel token in servohop when its email arrives: `gh secret set QLD_FUEL_TOKEN -R workbench-soft/servohop`.

## purge-all-every-run

- [ ] Press Purge all once and check the rows gray at once and older runs keep going until none match. No live purge ran in testing.

## releases-tab

- [ ] Open `http://localhost:4280/?tab=releases` once the update task installs the release after PR #74 (merged 2026-10-31). If the tab is missing, double click `START.cmd`.

## runner-watchdog

- [ ] `runner\cache-actions.ps1` reads all 1474 `Worker_*.log` files (419 MB) of the runners on each install, which held an install at "Filling the action cache" for over an hour on 2026-11-01 at 100% CPU. Read only the newest logs, or prune `_diag`.

## Week review 2026-11

- [ ] The status page shows English only, while the org rule asks for 9 languages. Pick an i18n library through the `stack` skill and move the strings of `dashboard/cards/` into catalogs, or record in a spec why this local tool stays English.

## ci-failures-2026-11-10

- [ ] Free about 100 GB on C: (it fell to 11 GB on 2026-11-10 and jobs failed with ENOSPC). In PowerShell: `Remove-Item -Recurse -Force "$env:USERPROFILE\actions-runner\workbench-soft*\_work"; uv cache clean; mise x -- pip cache purge`. The `_work` folders are from before the work root moved to `C:\ci`, about 30 GB
- [ ] Decide on fewer runners or more RAM: 8 jobs at once plus local builds and the emulator on 31 GB RAM grew `pagefile.sys` to 82 GB, which filled the disk. `RUNNER_COUNT=6` and `.\runner\install.ps1` lower it
- [ ] Turn off Surfshark on this PC, or add `C:\ci`, `%USERPROFILE%\actions-runner` and `gh.exe` to its split tunnelling (Bypasser). Its connects and drops on 2026-11-08 to 2026-11-10 lined up with TLS handshake timeouts in CI jobs
- [ ] Set `retention-days` on `actions/upload-artifact` in farnear and suno-download: both hit "Artifact storage quota has been hit" on 2026-11-08 and 2026-11-09
- [ ] Look at the Dependabot `update_files` failures in app-updater, keeppad, skyaltar, suno-download, tickalot, tripforge, alina-photo, aspirationstyle and chrome-site-sources
- [ ] Give the merge workflows of aspirationstyle and tickalot a `workflow_dispatch` trigger, their merge job fails without it

## scroll-lists

- [ ] Remove the merged worktree `%WBS_ROOT%\local-ci-scroll-lists` and its local branch `scroll-lists` (PR #134 merged). Auto mode denied the move: run `git -C %WBS_ROOT%\local-ci worktree remove --force %WBS_ROOT%\local-ci-scroll-lists; git -C %WBS_ROOT%\local-ci branch -D scroll-lists`.
