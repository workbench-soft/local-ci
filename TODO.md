# TODO

## windows-local-ci

- [ ] Run `.\install.ps1` on the Windows PC; the script was parse-checked only, not run end to end.
- [ ] Register the Windows PC as a runner with `.\runner\install.ps1` and check it shows Idle at https://github.com/organizations/workbench-soft/settings/actions/runners.
- [ ] Rename the local folder `C:\Programming\WorkbenchSoft\mac-setup` to `local-ci` once no session has it open.
- [ ] On the Mac, point the clone at the new address: `git remote set-url origin https://github.com/workbench-soft/local-ci.git`.
- [ ] Teach the `move-repo` skill in agent-skills about the Windows runner and `runs-on: [self-hosted, Windows]`.
