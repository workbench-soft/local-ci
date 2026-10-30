# START.cmd in the repo root runs this on a double click. It waits for any
# install that is running, then windows\update.ps1 moves the checkout to the
# newest release and installs what changed. It adds the "local-ci update" task
# when it is missing, starts the runner tasks and the page task that aren't
# running, then opens the page.
param([switch]$TasksOnly)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'boot-task.ps1')

$root = Split-Path $PSScriptRoot -Parent
$port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { '4280' }
$pageTask = 'local-ci dashboard'
$updateTask = 'local-ci update'
$updateScript = Join-Path $PSScriptRoot 'update.ps1'

function Get-LocalCiTasks {
	@(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like 'GitHub Actions runner (*' -or $_.TaskName -eq $pageTask })
}

# Returns the names Windows refused to start.
function Start-StoppedTasks {
	$refused = @()
	foreach ($task in Get-LocalCiTasks) {
		if ($task.State -eq 'Running') { Write-Host "Running   $($task.TaskName)"; continue }
		try {
			Start-ScheduledTask -TaskName $task.TaskName
			Write-Host "Started   $($task.TaskName)"
		} catch {
			$refused += $task.TaskName
		}
	}
	return $refused
}

if ($TasksOnly) {
	$refused = Start-StoppedTasks
	foreach ($name in $refused) { Write-Host "Failed    $name" }
	exit $refused.Count
}

# The lock keeps the update task from installing while this window pulls, builds and starts the tasks.
$lock = Enter-InstallLock -Wait
try {
	& $updateScript -FromStart
	if ($LASTEXITCODE -ne 0) { Write-Host 'An install failed, so the page may run older code. ~/.local-ci/update.log has the output.' }

	if (-not (Get-ScheduledTask -TaskName $updateTask -ErrorAction SilentlyContinue)) {
		Write-Host "Adding the task `"$updateTask`", which installs each new release by itself."
		& $updateScript -Register
	}
	if (-not (Get-LocalCiTasks | Where-Object TaskName -ne $pageTask)) {
		Write-Host 'This PC has no runner yet. Run runner\install.ps1 to add them.'
	}

	$refused = Start-StoppedTasks
	if ($refused.Count -gt 0 -and -not (Test-IsAdmin)) {
		Write-Host 'Windows refused to start a task, so the script asks for admin rights.'
		Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-TasksOnly'
	}
} finally {
	$lock.Dispose()
}

Write-Host "Opening http://localhost:$port"
& (Join-Path $root 'dashboard\open.ps1') -Port $port
exit $LASTEXITCODE
