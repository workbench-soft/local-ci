# TODO

## windows-local-ci

- [ ] Rename the local folder `C:\Programming\WorkbenchSoft\mac-setup` to `local-ci` once no session has it open.
- [ ] Delete the empty folder `C:\c\Programming\WorkbenchSoft`, left by a worktree made at the wrong path on 2026-10-29.
- [ ] On the Mac, point the clone at the new address: `git remote set-url origin https://github.com/workbench-soft/local-ci.git`.
- [ ] Teach the `move-repo` skill in agent-skills about the `local` label: `runs-on: [self-hosted, local]`, plus Git Bash and `.path` on the Windows runner.
- [ ] Publish `oleg-chibikov.open-in-remote-repo` to the VS Code Marketplace, or drop it from both installers: `code --install-extension` can't find it.

## CI on the local runner

- [ ] media-organizer: the macOS disk images still need the Mac. With the Mac off, a release stays a pre-release until the Mac picks up its jobs.
- [ ] keeppad: `ios.yml` stays on GitHub's `macos-latest`, started by hand, since the Windows PC can't build for iPhone.
- [ ] After each app's PR merges, check its first release and deploy run: those jobs run only on main, so the PR checks didn't cover them.
- [ ] The 8 app PRs merged on 2026-10-29 without waiting for CI, at the user's request. Check the next CI run of each repo on the Windows runner.
- [ ] tickalot's history was reset to one commit while its CI PR was open, so the change landed again as tickalot#8.
- [ ] gh is logged in as `workbench-soft-admin` now. `oleg-chibikov` lost access to the org's private repos.
