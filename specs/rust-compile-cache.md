# One Rust compile cache for every worktree

## 2026-11-02: sccache wraps rustc on each machine

### Why

5 to 10 agents work in their own worktrees on one PC. Each new worktree
starts with an empty `target` folder, so cargo compiles every crate again.
`media-organizer` keeps 5 GB in `target`, `langflip` 1.9 GB.

### Changes

- **Setup** `install.ps1` and `install.sh` install
  [sccache](https://github.com/mozilla/sccache) through `mise use -g`. They
  set `RUSTC_WRAPPER=sccache` and a 20 GB cache in the global mise env.
- **Where it applies** each command that runs through mise: `mise run`,
  `mise x`, and the CI runner, which runs as the same user.
- **Defender** `windows\defender-exclusions.ps1` adds the sccache folder,
  as it does for the Cargo caches.

### Result

Two fresh copies of `property-trends` built one after the other. The second
got 136 of 151 crates from the cache, and its build went from 107 s to 63 s.

### Limits

- **Workspace crates** cargo builds them incrementally, and sccache skips
  those. The dependencies get cached, and they take most of the build.
- **Cloud runners** Oracle and Blacksmith start from an empty disk, so they
  gain only within one job.

### Rejected

- **A `RUSTC_WRAPPER` line in each repo** it breaks cargo on a machine
  without sccache, and it needs a PR in each Rust repo.
- **The aqua backend** `mise use -g sccache` picks it, and mise lost the
  folder inside the archive that holds `sccache.exe`. `github:mozilla/sccache`
  puts the exe in the install root.
- **One shared `CARGO_TARGET_DIR`** parallel builds in different worktrees
  block on its lock.
