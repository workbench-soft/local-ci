# Builds the CI status page and starts it at boot on http://127.0.0.1:4280.
# Running it again stops the page, rebuilds it and starts it again. Run it from
# the checkout the task should serve, not from a worktree.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\windows\boot-task.ps1')

if (-not (Test-IsAdmin)) { exit (Start-AsAdmin $PSCommandPath) }

$appDir = $PSScriptRoot
$port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { '4280' }
$taskName = 'local-ci dashboard'
$env:GH_PAGER = 'cat'

function Write-Step([string]$text) { Write-Host "`n==> $text" }

# The boot task has no password, so it can't read the gh login in the Windows
# credential store. The page reads the token from .env.local instead.
function Write-TokenFile {
	$token = try { gh auth token 2>$null } catch { $null }
	if (-not $token) {
		Write-Host 'gh has no login, so the page shows only this PC. Run gh auth login, then this script again.'
		return
	}
	$envFile = Join-Path $appDir '.env.local'
	Set-Content -LiteralPath $envFile -Encoding ascii -Value "GITHUB_TOKEN=$token"
	icacls $envFile /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):F" | Out-Null
}

$mise = (Get-Command mise -CommandType Application -ErrorAction Stop).Source

Write-Step 'Stopping the running page'
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
# Stopping the task leaves the node it started still listening.
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Step 'Installing packages and building'
Push-Location $appDir
try {
	& $mise x -- pnpm install --frozen-lockfile
	if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
	& $mise x -- pnpm build
	if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
} finally { Pop-Location }

Write-Step 'Writing the GitHub token to .env.local'
Write-TokenFile

$startScript = Join-Path $appDir 'start.cmd'
Set-Content -LiteralPath $startScript -Encoding ascii -Value "@echo off`r`ncd /d `"%~dp0`"`r`n`"$mise`" x -- pnpm exec next start -H 127.0.0.1 -p $port >> dashboard.log 2>&1"

Write-Step 'Starting the page at boot'
Register-BootTask $taskName $startScript $appDir

# The boot task runs without a desktop, so a Startup shortcut opens the page at each logon.
Write-Step 'Opening the page at logon'
$openScript = Join-Path $appDir 'open.ps1'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'local-ci dashboard.lnk'))
$shortcut.TargetPath = (Get-Command powershell -CommandType Application).Source
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$openScript`" -Port $port"
$shortcut.WorkingDirectory = $appDir
$shortcut.WindowStyle = 7
$shortcut.IconLocation = (Join-Path $appDir 'icon.ico')
$shortcut.Save()

Write-Step "Opening http://localhost:$port"
& $openScript -Port $port
