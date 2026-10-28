# Builds the CI status page and starts it at boot on http://127.0.0.1:4280.
# Safe to run again: it stops the running page, rebuilds and restarts it.
# Run it from the checkout the task should serve, not from a worktree.
$ErrorActionPreference = 'Stop'

# A task that starts at boot without a password needs admin to register.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
	Write-Host 'Asking Windows for admin rights in a new window'
	$p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
	exit $p.ExitCode
}

$dir = $PSScriptRoot
$port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { '4280' }
$taskName = 'local-ci dashboard'
$env:GH_PAGER = 'cat'

function Say([string]$text) { Write-Host "`n==> $text" }

$mise = (Get-Command mise -CommandType Application -ErrorAction Stop).Source

Say 'Stopping the running page'
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
# Stopping the task leaves the node it started running.
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Say 'Installing packages and building'
Push-Location $dir
try {
	& $mise x -- pnpm install --frozen-lockfile
	if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
	& $mise x -- pnpm build
	if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
} finally { Pop-Location }

# The boot task runs without a password, so it can't read the gh login in the
# Windows credential store. The page reads the token from .env.local instead.
Say 'Writing the GitHub token to .env.local'
$token = try { gh auth token 2>$null } catch { $null }
$envFile = Join-Path $dir '.env.local'
if ($token) {
	Set-Content -LiteralPath $envFile -Encoding ascii -Value "GITHUB_TOKEN=$token"
	$user = "$env:USERDOMAIN\$env:USERNAME"
	icacls $envFile /inheritance:r /grant:r "${user}:F" | Out-Null
} else {
	Write-Host 'gh has no login, so the page shows only this PC. Run gh auth login, then this script again.'
}

$start = Join-Path $dir 'start.cmd'
Set-Content -LiteralPath $start -Encoding ascii -Value "@echo off`r`ncd /d `"%~dp0`"`r`n`"$mise`" x -- pnpm exec next start -H 127.0.0.1 -p $port >> dashboard.log 2>&1"

Say 'Starting the page at boot'
$user = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute $start -WorkingDirectory $dir
$triggers = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn -User $user))
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Format-Table TaskName, State
Write-Host "Open http://localhost:$port"
