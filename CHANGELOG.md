# Changelog

## Unreleased

- The status page puts the jobs that build on this PC first and lists the jobs
  that wait on GitHub for a runner. The runs table gets icons, filter chips, a
  search box and sorting. The page opens in the browser after the install
  build and at each logon.

- The runner scripts install `RUNNER_COUNT` runners per machine, 4 on Windows
  and 1 on a Mac, so the PC builds several jobs at once. The status page shows
  a row per runner.
