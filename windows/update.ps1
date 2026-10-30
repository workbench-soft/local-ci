# Installs the newest release of this checkout. It moves the default branch to
# the newest release tag, then runs dashboard\install.ps1 when the page code
# changed and runner\install.ps1 when the runner code changed. The task
# "local-ci update" runs it every 5 minutes and at logon, and Release starts it
# after each release. -Register adds that task.
param([switch]$Register)
# Windows PowerShell turns git's stderr into an error under Stop, so each step checks the exit code instead.
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'boot-task.ps1')

$root = Split-Path $PSScriptRoot -Parent
$taskName = 'local-ci update'
$stateDir = Join-Path $HOME '.local-ci'
$logFile = Join-Path $stateDir 'update.log'
# runner\install.ps1 leaves no mark of its own, so this file holds the commit it last installed.
$runnerFile = Join-Path $stateDir 'runner-commit'
$pageTask = 'local-ci dashboard'
$env:GH_PAGER = 'cat'

# Interactive keeps the git login in the Windows credential store in reach, so
# the task runs only while the person is logged in. conhost --headless hides the window.
function Register-UpdateTask {
	if (-not (Test-IsAdmin)) { exit (Start-AsAdmin $PSCommandPath @('-Register')) }
	$user = "$env:USERDOMAIN\$env:USERNAME"
	$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -WorkingDirectory $root
	$triggers = @((New-ScheduledTaskTrigger -AtLogOn -User $user), (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)))
	$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
	$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 4) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
	Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
	Write-Host "The task `"$taskName`" installs each new release every 5 minutes and at logon."
}

function Write-Log([string]$text) {
	New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
	Add-Content -LiteralPath $logFile -Encoding utf8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $text"
}

# A checkout on another branch is someone's work, so only the default branch moves.
# Returns $false when the checkout can't reach the newest release.
function Update-Checkout {
	$branch = git -C $root rev-parse --abbrev-ref HEAD
	$default = (git -C $root rev-parse --abbrev-ref origin/HEAD 2>$null) -replace '^origin/', ''
	if (-not $default) { $default = 'main' }
	if ($branch -ne $default) { return $false }
	git -C $root fetch --quiet --tags origin 2>$null
	if ($LASTEXITCODE -ne 0) { Write-Log 'git fetch failed'; return $false }
	# Release tags read v2026.10.31.2, so a version sort puts the newest first.
	$tag = git -C $root tag --list 'v*' --sort=-v:refname | Select-Object -First 1
	if (-not $tag) { return $true }
	git -C $root merge-base --is-ancestor $tag HEAD
	if ($LASTEXITCODE -eq 0) { return $true }
	$output = git -C $root merge --ff-only --quiet $tag 2>&1
	if ($LASTEXITCODE -ne 0) { Write-Log "git merge $tag stopped: $output"; return $false }
	Write-Log "Checkout moved to $tag"
	return $true
}

function Get-LastCommit([string[]]$paths) { git -C $root log -1 --format=%H -- @paths }

function Read-Mark([string]$path) {
	if (Test-Path -LiteralPath $path) { (Get-Content -LiteralPath $path -Raw).Trim() } else { '' }
}

# A child process keeps an installer's exit and trap from ending this script.
function Invoke-Installer([string]$script, [string[]]$scriptArgs = @()) {
	Write-Log "Running $script"
	$output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root $script) @scriptArgs 2>&1
	$code = $LASTEXITCODE
	$output | Out-String | Add-Content -LiteralPath $logFile -Encoding utf8
	Write-Log "$script exited with $code"
	return $code -eq 0
}

if ($Register) { Register-UpdateTask; exit 0 }

if (-not (Update-Checkout)) { exit 0 }

$tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Select-Object -ExpandProperty TaskName)

$pageCommit = Get-LastCommit @('dashboard')
if ($tasks -contains $pageTask -and $pageCommit -ne (Read-Mark (Join-Path $root 'dashboard\.built-commit'))) {
	[void](Invoke-Installer 'dashboard\install.ps1' @('-Unattended'))
}

$runnerCommit = Get-LastCommit @('runner', 'windows/boot-task.ps1', 'windows/defender-exclusions.ps1')
if (($tasks -like 'GitHub Actions runner (*') -and $runnerCommit -ne (Read-Mark $runnerFile)) {
	if (Invoke-Installer 'runner\install.ps1') { Set-Content -LiteralPath $runnerFile -Encoding ascii -Value $runnerCommit }
}
