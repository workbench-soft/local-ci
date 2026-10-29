# START.cmd in the repo root runs this on a double click. It pulls the default
# branch, rebuilds the status page when its code changed, starts the runner
# tasks and the page task that aren't running, then opens the page.
param([switch]$TasksOnly)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'boot-task.ps1')

$root = Split-Path $PSScriptRoot -Parent
$port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { '4280' }
$pageTask = 'local-ci dashboard'
# dashboard\install.ps1 writes the commit it built here.
$builtFile = Join-Path $root 'dashboard\.built-commit'

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

# A checkout on another branch is someone's work, so only the default branch gets pulled.
function Update-Checkout {
	$branch = git -C $root rev-parse --abbrev-ref HEAD
	$default = try { (git -C $root rev-parse --abbrev-ref origin/HEAD 2>$null) -replace '^origin/', '' } catch { '' }
	if (-not $default) { $default = 'master' }
	if ($branch -ne $default) {
		Write-Host "On branch $branch, so the code stays as it is."
		return
	}
	git -C $root pull --ff-only --quiet origin $default
	if ($LASTEXITCODE -ne 0) {
		Write-Host 'git pull failed, so the page runs the code on disk.'
		return
	}
	Write-Host "Code at   $(git -C $root log -1 --format='%h %s')"
}

# The page is out of date when the latest commit of dashboard/ isn't the one it was built from.
function Test-PageOutdated {
	$latest = git -C $root log -1 --format=%H -- dashboard
	$built = if (Test-Path -LiteralPath $builtFile) { (Get-Content -LiteralPath $builtFile -Raw).Trim() } else { '' }
	return $latest -ne $built
}

if ($TasksOnly) {
	$refused = Start-StoppedTasks
	foreach ($name in $refused) { Write-Host "Failed    $name" }
	exit $refused.Count
}

Update-Checkout

$tasks = Get-LocalCiTasks
$rebuild = -not ($tasks | Where-Object TaskName -eq $pageTask) -or (Test-PageOutdated)
if ($rebuild) {
	Write-Host 'The status page is missing or older than the code, so dashboard\install.ps1 builds it and opens it.'
	& (Join-Path $root 'dashboard\install.ps1')
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (-not ($tasks | Where-Object TaskName -ne $pageTask)) {
	Write-Host 'This PC has no runner yet. Run runner\install.ps1 to add them.'
}

$refused = Start-StoppedTasks
if ($refused.Count -gt 0 -and -not (Test-IsAdmin)) {
	Write-Host 'Windows refused to start a task, so the script asks for admin rights.'
	Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-TasksOnly'
}

# install.ps1 opened the page already.
if ($rebuild) { exit 0 }
Write-Host "Opening http://localhost:$port"
& (Join-Path $root 'dashboard\open.ps1') -Port $port
exit $LASTEXITCODE
