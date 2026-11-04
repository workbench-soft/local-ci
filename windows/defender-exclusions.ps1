# Adds the folders that builds write to the Defender exclusions. Defender scans
# each file a build writes, and pnpm install and cargo write tens of thousands.
# These folders hold only the org's own code, its packages and its tools.
# A path joins the list here, so each PC gets the same exclusions. A rerun is safe.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'boot-task.ps1')

if ($env:RUNNER_DEFENDER_EXCLUSIONS -eq 'off') { Write-Host 'RUNNER_DEFENDER_EXCLUSIONS=off, skipping'; return }
if (-not (Test-IsAdmin)) { exit (Start-AsAdmin $PSCommandPath) }

$workRoot = if ($env:RUNNER_WORK_ROOT) { $env:RUNNER_WORK_ROOT } else { Join-Path $env:SystemDrive 'ci' }
# WBS_ROOT names the workspace root. Without it, the root is the folder that holds this clone.
$devDir = if ($env:WBS_ROOT) { $env:WBS_ROOT } elseif ($env:DEV_DIR) { $env:DEV_DIR } else { Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
$paths = @(
	# The runners, their tool cache and the checkouts of their jobs.
	(Join-Path $HOME 'actions-runner'),
	$workRoot,
	# The repos you build by hand.
	$devDir,
	# Package and tool caches.
	(Join-Path $HOME '.gradle'),
	(Join-Path $HOME '.cargo'),
	(Join-Path $HOME '.rustup'),
	(Join-Path $env:LOCALAPPDATA 'pnpm'),
	(Join-Path $env:LOCALAPPDATA 'npm-cache'),
	(Join-Path $env:LOCALAPPDATA 'mise'),
	(Join-Path $env:LOCALAPPDATA 'Mozilla\sccache'),
	# The media-organizer release builds Rust here, outside the checkout.
	(Join-Path $env:LOCALAPPDATA 'media-organizer')
)

# Another antivirus switches Defender off, and Add-MpPreference then fails.
try {
	Add-MpPreference -ExclusionPath $paths
	$paths | ForEach-Object { Write-Host "Excluded  $_" }
} catch {
	Write-Host "Defender refused the exclusions: $($_.Exception.Message)"
}
