# The job started hook of each Windows runner: ACTIONS_RUNNER_HOOK_JOB_STARTED in .env
# points here, through the copy runner/install.ps1 keeps in ~/actions-runner/hooks.
# It runs before the job's first step, so it cleans only this runner's own work folder,
# such as C:\ci\3, and the jobs of the other runners stay untouched.
# A repo folder unused for RUNNER_CLEAN_DAYS days goes, and every repo folder but the
# current one goes when the drive has less than RUNNER_CLEAN_MIN_FREE_GB free.
param([string]$Workspace = $env:RUNNER_WORKSPACE)

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
			# A rename on the same drive is instant, so the job starts at once.
			Rename-Item -LiteralPath $_.FullName -NewName "_trash-$stamp-$($_.Name)"
		}

	$trash = @(Get-ChildItem -LiteralPath $root -Directory -Force -Filter '_trash-*')
	if ($trash.Count) {
		# The runner ends the processes a job leaves behind, unless they lack its tracking id.
		$env:RUNNER_TRACKING_ID = ''
		$targets = ($trash | ForEach-Object { "rd /s /q `"\\?\$($_.FullName)`"" }) -join ' & '
		# Idle priority keeps the delete from slowing the job and the desktop down.
		$p = Start-Process cmd -ArgumentList "/c $targets" -WindowStyle Hidden -PassThru
		$p.PriorityClass = 'Idle'
	}
	Write-Host ('clean-work: {0:N0} GB free on the drive of {1}' -f $freeGb, $root)
} catch {
	# A locked file must not fail the build.
	Write-Host "clean-work: skipped, $($_.Exception.Message)"
}
exit 0
