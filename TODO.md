# TODO

## windows-local-ci

- [ ] Rename the local folder `C:\Programming\WorkbenchSoft\mac-setup` to `local-ci` once no session holds it open.
- [ ] Delete the empty folder `C:\c\Programming\WorkbenchSoft`, which a worktree made at the wrong path left on 2026-10-29.
- [ ] `code --install-extension` can't find `oleg-chibikov.open-in-remote-repo`: publish it to the VS Code Marketplace, or drop it from both installers.

## CI on the local runner

- [ ] keeppad: `ios.yml` stays on GitHub's `macos-latest` and starts by hand, since the Windows PC can't build for iPhone.
- [ ] After each app's PR merges, check its first release and deploy run. Those jobs run only on main, so the PR checks skipped them.
- [ ] 8 app PRs merged on 2026-10-29 without a CI wait, as the user asked. Check the next CI run of each repo on the Windows runner.
- [ ] tickalot's history went back to one commit while its CI PR was open, so the change landed again as tickalot#8.
- [ ] gh is logged in as `workbench-soft-admin` now, and `oleg-chibikov` lost access to the org's private repos.

## multiple-runners

- [ ] keeppad#10, tickalot#13 and spotthecam#12 merged on 2026-10-29 without a CI wait, as the user asked. Check the next main run of keeppad, tickalot and spotthecam.
- [ ] keeppad and tickalot: Dependabot should bump Expo to 58.0.21 once pnpm's 1 day release age passes, after 2026-10-29 15:35 UTC. `expo install --check` only warns until then.
- [ ] Run `git config --global core.longpaths true` on the Windows PC: checkout logs show `git clean` can't remove deep `node_modules` paths.

## rewrite-repo

- [ ] Open `http://localhost:4280` in light and dark mode and check the shifted palette and the cards.
- [ ] On a Mac, run `./install.sh` and `./runner/install.sh` once. They passed shellcheck and shfmt but didn't run.
- [ ] Reset the history to one commit (rewrite-repo step 12), then push `master`. The rewrite commits sit on the local `master` only.

## dashboard-local-runs

- [ ] After the next logon, check that the browser opens `http://localhost:4280` on its own.

## runner-icon

- [ ] In `C:\Programming\WorkbenchSoft\local-ci`, run `git pull`, then `.\dashboard\install.ps1`, so the tab and the Startup shortcut get the new icon.

## run-controls

- [ ] The same `git pull` and `.\dashboard\install.ps1` give `http://localhost:4280` the Stop and Purge buttons (PR #16, merged 2026-10-29).
- [ ] Press Stop and Purge once on a throwaway run. The buttons rendered on live runs, but no GitHub cancel or delete call ran in testing.

## now-runners

- [ ] Pull `master` in `C:\Programming\WorkbenchSoft\local-ci` and run `.\dashboard\install.ps1`, so `http://localhost:4280` serves the runner rows in the Now card (PR #17).

## python-setup

- [ ] `runner/install.ps1` waits for a runner to go idle before it restarts it, and a busy queue keeps it busy. On 29 Oct 2026 runners 2 to 4 waited over an hour, so the agent copied `.path` and `start.cmd` from runner 1. Restart a runner between jobs in place of waiting for idle, or pause its listener first
- [ ] Runners 2 to 4 still run their listeners with the old PATH, since a listener reads `.path` at start. Restart them between jobs, or reboot the PC
