# The job started hook of each Windows runner: ACTIONS_RUNNER_HOOK_JOB_STARTED in .env
# Keep in step with runner/install.ps1: AGENTS.md lists what to change here, and
# dashboard/status/clean-sync.test.ts checks the shared settings.
# points here, through the copy runner/install.ps1 keeps in ~/actions-runner/hooks.
# It runs before the job's first step, so it cleans only this runner's own work folder,
# such as C:\ci\3, and the jobs of the other runners stay untouched.
# A repo folder unused for RUNNER_CLEAN_DAYS days goes, and every repo folder but the
# current one goes when the drive has less than RUNNER_CLEAN_MIN_FREE_GB free.
param([string]$Workspace = $env:RUNNER_WORKSPACE, [string]$DeleteTrash)

# The second run, started below: deletes the trash of one runner, one run at a time per runner.
if ($DeleteTrash) {
	$mutex = [Threading.Mutex]::new($false, "Global\WorkbenchSoftTrash-$(Split-Path -Leaf $DeleteTrash)")
	try { if (-not $mutex.WaitOne(0)) { exit 0 } } catch [Threading.AbandonedMutexException] { }
	# A folder moved to the trash while this runs gets deleted on the next pass.
	while ($trash = @(Get-ChildItem -LiteralPath $DeleteTrash -Directory -Force -Filter '_trash-*')) {
		$trash | ForEach-Object { cmd /c "rd /s /q `"\\?\$($_.FullName)`"" 2>$null }
		# A folder that a locked file keeps waits for the next job's start.
		if (@(Get-ChildItem -LiteralPath $DeleteTrash -Directory -Force -Filter '_trash-*').Count -ge $trash.Count) { break }
	}
	$mutex.ReleaseMutex()
	exit 0
}

try {
	if (-not $Workspace) { throw 'RUNNER_WORKSPACE is not set' }
	$root = Split-Path -Parent $Workspace
	$days = if ($env:RUNNER_CLEAN_DAYS) { [int]$env:RUNNER_CLEAN_DAYS } else { 3 }
	$minFreeGb = if ($env:RUNNER_CLEAN_MIN_FREE_GB) { [int]$env:RUNNER_CLEAN_MIN_FREE_GB } else { 60 }
	$keep = @('_actions', '_temp', '_tool', '_PipelineMapping', (Split-Path -Leaf $Workspace))

	# A checkout leaves the top folder's time as it was, so the hook marks the last use itself.
	New-Item -ItemType Directory -Force -Path $Workspace | Out-Null
	(Get-Item -LiteralPath $Workspace).LastWriteTime = Get-Date

	$freeGb = [IO.DriveInfo]::new($root).AvailableFreeSpace / 1GB
	$cutoff = (Get-Date).AddDays(-$days)
	$stamp = Get-Date -Format 'yyyyMMddHHmmss'
	Get-ChildItem -LiteralPath $root -Directory -Force |
		Where-Object { $keep -notcontains $_.Name -and $_.Name -notlike '_trash-*' } |
		Where-Object { $freeGb -lt $minFreeGb -or $_.LastWriteTime -lt $cutoff } |
		ForEach-Object {
			Write-Host "clean-work: removing $($_.Name), last used $($_.LastWriteTime)"
			# A rename on the same drive is instant, so the job starts at once. A folder a process still
			# holds stays for the next job, with one plain line in place of a red error in the job log.
			try {
				Rename-Item -LiteralPath $_.FullName -NewName "_trash-$stamp-$($_.Name)" -ErrorAction Stop
			} catch {
				Write-Host "clean-work: $($_.Exception.Message) It stays until a later job."
			}
		}

	if (Get-ChildItem -LiteralPath $root -Directory -Force -Filter '_trash-*') {
		# The runner ends the processes a job leaves behind, unless they lack its tracking id.
		$env:RUNNER_TRACKING_ID = ''
		# One delete per runner: a new one each job piled up 530 starved deletes at idle priority.
		$p = Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-DeleteTrash', "`"$root`"" -WindowStyle Hidden -PassThru
		# Below normal ends between builds, and still yields to them.
		$p.PriorityClass = 'BelowNormal'
	}
	Write-Host ('clean-work: {0:N0} GB free on the drive of {1}' -f $freeGb, $root)

	# An npm tool that a full disk cut short keeps its folder with no node_modules, and mise counts it
	# installed: lumiere-player failed on "No executable found for configured tool: oxfmt" until a
	# forced reinstall. Such a folder older than 15 minutes goes, so this job installs the tool again.
	if ($env:MISE_DATA_DIR) {
		Get-ChildItem -Path (Join-Path $env:MISE_DATA_DIR 'installs\npm-*\*') -Directory -ErrorAction SilentlyContinue |
			Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $_.CreationTime -lt (Get-Date).AddMinutes(-15) -and -not (Test-Path -LiteralPath (Join-Path $_.FullName 'node_modules')) } |
			ForEach-Object {
				Write-Host "clean-work: $($_.FullName) has no node_modules, removing it so mise installs it again"
				Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
			}
	}
} catch {
	# A locked file must not fail the build.
	Write-Host "clean-work: skipped, $($_.Exception.Message)"
}
exit 0
