# Python on every machine

## What it does for the person

`python` and `python3` start the same current Python on the Mac, on the Windows
PC and in each runner job. A script written on one machine runs on the others.

## User flows

1. The person runs `install.sh` or `install.ps1`.
2. mise installs Python 3.15 globally.
3. On Windows, `~\.local\bin` gets `python3` and `python3.cmd`, both of which
   run mise's `python`.
4. `runner\install.ps1` puts that folder ahead of the Store stubs in each
   runner's PATH.

## How it works: modules, files, data

- **`install.sh`** `mise use -g python@3.15`. mise's Python on the Mac has
  `python3` of its own.
- **`install.ps1`** the same `mise use`, then the 2 forwarders in
  `~\.local\bin`. It moves WindowsApps to the end of the user PATH, so the
  forwarders and the mise shims come first.
- **`runner/install.ps1`** `Get-ToolDirs` adds `~\.local\bin` and the mise
  shims after Git, so a job finds them before WindowsApps.

## Limits

- **Store stubs** WindowsApps keeps its `python.exe` and `python3.exe`. They
  lose only because they come later in PATH.
- **Version** 3.15 takes each patch release. The next minor version is a
  change to this spec.

## Changes

### 2026-10-29 python3 works on Windows, Python 3.15 everywhere

- **Why** the Keeppad release failed on the Windows runner. `fetch-models.sh`
  calls `python3`, which reached the Windows Store stub and exited 49. The
  person also wants the newest Python.
- **Changes** `install.sh`, `install.ps1` and `runner/install.ps1`, as above.
- **Steps** this spec, then the scripts, then the README.
- **Docs** README, `docs/features.md`.
