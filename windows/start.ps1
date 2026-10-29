# START.cmd in the repo root runs this on a double click. It starts the runner
# tasks and the status page task that aren't running, then opens the page.
param([switch]$TasksOnly)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'boot-task.ps1')

$root = Split-Path $PSScriptRoot -Parent
$port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { '4280' }
$pageTask = 'local-ci dashboard'

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

$tasks = Get-LocalCiTasks
if (-not ($tasks | Where-Object TaskName -eq $pageTask)) {
	Write-Host 'The status page isn''t set up yet, so dashboard\install.ps1 builds it and opens it.'
	& (Join-Path $root 'dashboard\install.ps1')
	exit $LASTEXITCODE
}
if (-not ($tasks | Where-Object TaskName -ne $pageTask)) {
	Write-Host 'This PC has no runner yet. Run runner\install.ps1 to add them.'
}

$refused = Start-StoppedTasks
if ($refused.Count -gt 0 -and -not (Test-IsAdmin)) {
	Write-Host 'Windows refused to start a task, so the script asks for admin rights.'
	Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-TasksOnly'
}

Write-Host "Opening http://localhost:$port"
& (Join-Path $root 'dashboard\open.ps1') -Port $port
exit $LASTEXITCODE
