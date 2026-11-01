# TODO

## windows-local-ci

- [ ] `code --install-extension` can't find `oleg-chibikov.open-in-remote-repo`: publish it to the VS Code Marketplace, or drop it from both installers.

## CI on the local runner

- [ ] keeppad: `ios.yml` stays on GitHub's `macos-latest` and starts by hand, since the Windows PC can't build for iPhone.
- [ ] After each app's PR merges, check its first release and deploy run. Those jobs run only on main, so the PR checks skipped them.
- [ ] 8 app PRs merged on 2025-10-29 without a CI wait, as the user asked. Check the next CI run of each repo on the Windows runner.
- [ ] tickalot's history went back to one commit while its CI PR was open, so the change landed again as tickalot#8.
- [ ] gh is logged in as `workbench-soft-admin` now, and `oleg-chibikov` lost access to the org's private repos.

## multiple-runners

- [ ] keeppad#10, tickalot#13 and spotthecam#12 merged on 2025-10-29 without a CI wait, as the user asked. Check the next main run of keeppad, tickalot and spotthecam.
- [ ] keeppad and tickalot: Dependabot should bump Expo to 58.0.21 once pnpm's 1 day release age passes, after 2025-10-29 15:35 UTC. `expo install --check` only warns until then.
- [ ] Run `git config --global core.longpaths true` on the Windows PC: checkout logs show `git clean` can't remove deep `node_modules` paths.

## rewrite-repo

- [ ] Open `http://localhost:4280` in light and dark mode and check the shifted palette and the cards.
- [ ] On a Mac, run `./install.sh` and `./runner/install.sh` once. They passed shellcheck and shfmt but didn't run.
- [ ] Reset the history to one commit (rewrite-repo step 12), then push `main`. The rewrite commits sit on the local `main` only.

## dashboard-local-runs

- [ ] After the next logon, check that the browser opens `http://localhost:4280` on its own.

## runner-icon

- [ ] In `C:\Programming\WorkbenchSoft\local-ci`, run `git pull`, then `.\dashboard\install.ps1`, so the tab and the Startup shortcut get the new icon.

## run-controls

- [ ] The same `git pull` and `.\dashboard\install.ps1` give `http://localhost:4280` the Stop and Purge buttons (PR #16, merged 2025-10-29).
- [ ] Press Stop and Purge once on a throwaway run. The buttons rendered on live runs, but no GitHub cancel or delete call ran in testing.

## now-runners

- [ ] Pull `main` in `C:\Programming\WorkbenchSoft\local-ci` and run `.\dashboard\install.ps1`, so `http://localhost:4280` serves the runner rows in the Now card (PR #17).

## python-setup

- [ ] `runner/install.ps1` waits for a runner to go idle before it restarts it, and a busy queue keeps it busy. On 29 Oct 2025 runners 2 to 4 waited over an hour, so the agent copied `.path` and `start.cmd` from runner 1. Restart a runner between jobs in place of waiting for idle, or pause its listener first
- [ ] Runners 2 to 4 still run their listeners with the old PATH, since a listener reads `.path` at start. Restart them between jobs, or reboot the PC

## release-install

- [ ] Pull `main` in `C:\Programming\WorkbenchSoft\local-ci` and run `.\dashboard\install.ps1`, so `http://localhost:4280` gets the Release column, Install, the failed step and the PR links (PR #21).
- [ ] Press Install once on a real release. `workbench-soft.github.io` had 0 releases on 2025-10-29, since the latest Release runs failed, so only the error path ran in testing.

## purge-all

- [ ] In `C:\Programming\WorkbenchSoft\local-ci`, run `git pull`, then `.\dashboard\install.ps1`, so `http://localhost:4280` gets Purge all (PR #27, merged 2026-10-29).
- [ ] Press Purge all once with a filter that matches a few throwaway runs. Only the confirm was tested, no real purge ran.

## runner-speed

- [ ] In `C:\Programming\WorkbenchSoft\local-ci`, run `git pull`, then `.\runner\install.ps1`, so the 4 runners share `~/actions-runner/_tool` and get the Defender exclusions (PR #29 and #30, merged 2026-10-29).
- [ ] On the Mac, run `git pull`, then `./runner/install.sh`. The Mac part was linted but not run.

## app-audit

- [ ] In `C:\Programming\WorkbenchSoft\local-ci`, run `git pull`, then `.\dashboard\install.ps1` as admin, so `http://localhost:4280` gets the audit fixes (branch `audit-2026-10-29`).
- [ ] Watch the first sweep cancels in `dashboard\dashboard.log` after the install: each line now gives a time and a reason. A new PR's first run should keep building.
- [ ] Press Install on a real release: it should show on the Release run only. `workbench-soft.github.io` had 0 releases when tested.
- [ ] On the Mac, run the status page once: the Runners card names `runner/install.sh`. Only Windows ran here.
- [ ] Commit or stash the TODO.md edits in `C:\Programming\WorkbenchSoft\local-ci` (sections `Org releases` and `purge-all-every-run`), then `git pull` and run `.\runner\install.ps1` as admin, so the faster action cache and downloads reach the runners (branch `audit-2026-10-30`). `git pull --ff-only` stops while TODO.md has local edits.
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

## Org releases

- [ ] Copy the Memories desktop signing key and password from `~/.config/memories` to the password manager. Reinstall the Memories desktop app once with the install command (key rotated 2026-10-30, memories#42).
- [ ] Delete the old Open Charge Map key of ServoHop. It sits in another Open Charge Map account than the one used on 2026-10-30.
- [ ] Store the Queensland fuel token in servohop when its email arrives: `gh secret set QLD_FUEL_TOKEN -R workbench-soft/servohop`.

- [ ] Runner jobs fail with "The self-hosted runner lost communication with the server" before their first step: 8 broker drops on the Windows PC between 09:31 and 12:15 UTC on 2026-10-30. Check whether the VPN on this PC reconnects, then rerun the failed jobs.

## purge-all-every-run

- [ ] In `C:\Programming\WorkbenchSoft\local-ci`, run `git pull`, then `.\dashboard\install.ps1`, so `http://localhost:4280` gets the new Purge all (PR #43, merged 2026-10-30).
- [ ] Press Purge all once and check the rows gray at once and older runs keep going until none match. No live purge ran in testing.

## releases-tab

- [ ] Open `http://localhost:4280/?tab=releases` once the update task installs the release after PR #74 (merged 2026-10-31). If the tab is missing, double click `START.cmd`.

## runner-watchdog

- [ ] `runnerche-actions.ps1` reads all 1474 `Worker_*.log` files (419 MB) of the runners on each install, which held an install at "Filling the action cache" for over an hour on 2026-11-01 at 100% CPU. Read only the newest logs, or prune `_diag`.
