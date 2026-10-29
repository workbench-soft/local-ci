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

## rewrite-repo

- [ ] Run `.\dashboard\install.ps1` from `C:\Programming\WorkbenchSoft\local-ci`, so the boot task serves the rewritten page. The rewrite ran only typecheck and unit tests, with no `next build`.
- [ ] Open `http://localhost:4280` in light and dark mode and check the shifted palette and the cards.
- [ ] On a Mac, run `./install.sh` and `./runner/install.sh` once. They passed shellcheck and shfmt but didn't run.
- [ ] Reset the history to one commit (rewrite-repo step 12), then push `master`. The rewrite commits sit on the local `master` only.
