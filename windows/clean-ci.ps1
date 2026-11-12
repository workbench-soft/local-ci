# Empties every runner's work folder at once, for when the disk runs full.
# -OnlyWhenIdle is used by the periodic updater; it must never stop an active build.
param([switch]$OnlyWhenIdle)
# Keep in step with runner/install.ps1: AGENTS.md lists what to change here, and
# dashboard/status/clean-sync.test.ts checks the shared settings.
# CLEAN-CI.cmd at the repo root starts it. runner/clean-work.ps1 does the same
# job a bit at a time before each job, so a run here is the exception.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'boot-task.ps1')
# Only an admin can stop the runner listeners, which run above normal priority.
if (-not (Test-IsAdmin)) {
	if ($OnlyWhenIdle) { exit (Start-AsAdmin $PSCommandPath @('-OnlyWhenIdle')) }
	exit (Start-AsAdmin $PSCommandPath)
}

$workRoot = if ($env:RUNNER_WORK_ROOT) { $env:RUNNER_WORK_ROOT } else { Join-Path $env:SystemDrive 'ci' }
$org = if ($env:RUNNER_ORG) { $env:RUNNER_ORG } else { 'workbench-soft' }
$tasks = @(Get-ScheduledTask | Where-Object TaskName -like "GitHub Actions runner ($org*)")
$free = { '{0:N0} GB free' -f ((Get-PSDrive $workRoot.Substring(0, 1)).Free / 1GB) }
Write-Host "$workRoot, $(& $free)"

# Manual cleanup waits for jobs. Automatic cleanup never ends a running job.
if ($OnlyWhenIdle) {
	if (Get-Process Runner.Worker -ErrorAction SilentlyContinue) {
		Write-Host 'CI workers are active; cleanup deferred.'
		exit 0
	}
} else {
	$deadline = (Get-Date).AddMinutes(10)
	while ((Get-Process Runner.Worker -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
		Write-Host 'Waiting for the CI jobs to end'
		Start-Sleep -Seconds 10
	}
}
$tasks | Stop-ScheduledTask -ErrorAction SilentlyContinue
if (-not $OnlyWhenIdle) { Get-Process Runner.Worker -ErrorAction SilentlyContinue | Stop-Process -Force }
Get-Process Runner.Listener -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

# A move on the same drive is instant, so the runners start again with empty folders in seconds.
$trash = "$workRoot-trash-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $trash | Out-Null
try {
	# _mise holds the jobs' tools from runner/install.ps1. Without it 8 jobs would download them at once.
	Get-ChildItem -LiteralPath $workRoot -Directory -Force | Where-Object Name -ne '_mise' | ForEach-Object {
		$folder = $_.FullName
		# Windows refuses to move a folder while a process holds a file in it, such as the trash delete
		# of runner/clean-work.ps1. That folder stays, and the rest still move.
		try {
			Move-Item -LiteralPath $folder -Destination (Join-Path $trash $_.Name)
			New-Item -ItemType Directory -Force -Path $folder | Out-Null
		} catch {
			Write-Host "Skipping $folder, a process holds it: $($_.Exception.Message)"
		}
	}
} finally {
	# The runners are stopped by now, so they start again even when a step above fails.
	$tasks | Start-ScheduledTask
}
Write-Host 'The runners run again'

# The delete runs at idle priority, 4 folders at a time, so the PC stays responsive.
# It takes this run's folders and any a closed window left behind.
$folders = @(Get-ChildItem -Path "$workRoot-trash-*" -Directory | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Directory -Force })
$jobs = New-Object System.Collections.ArrayList
foreach ($folder in $folders) {
	while (@($jobs | Where-Object { -not $_.HasExited }).Count -ge 4) { Start-Sleep -Seconds 5 }
	Write-Host "Deleting $($folder.FullName)"
	$p = Start-Process cmd -ArgumentList "/c rd /s /q `"\\?\$($folder.FullName)`"" -WindowStyle Hidden -PassThru
	$p.PriorityClass = 'Idle'
	[void]$jobs.Add($p)
}
$jobs | Wait-Process
Get-ChildItem -Path "$workRoot-trash-*" -Directory | Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force) } | Remove-Item
Write-Host "Done, $(& $free)"
