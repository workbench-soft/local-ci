# One line from a bare Windows PC to the whole Workbench Soft workspace. Paste it into PowerShell:
#   irm https://raw.githubusercontent.com/workbench-soft/local-ci/main/bootstrap.ps1 | iex
# It installs Git and the GitHub CLI, logs in to GitHub, clones the private workspace repo
# into $env:WBS_ROOT, or C:\WBS when that is unset, and runs its scripts\restore.ps1.
# A rerun is safe: each step looks for its piece first.
$ErrorActionPreference = 'Stop'
$root = if ($env:WBS_ROOT) { $env:WBS_ROOT } else { 'C:\WBS' }

function Write-Step([string]$text) { Write-Host "`n==> $text" }
# winget writes PATH to the registry, while this window holds the old copy.
function Sync-Env {
	$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# A PC on its first sign in holds App Installer, but winget is not yet registered for the account.
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
	Write-Step 'Registering winget'
	Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe
	Sync-Env
}
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
	Start-Process 'ms-windows-store://pdp/?productid=9NBLGGH4NNS1'
	throw 'winget is missing. Press Update on App Installer in the Store window, then paste the line again.'
}

Write-Step 'Git and the GitHub CLI'
foreach ($tool in @(@('git', 'Git.Git'), @('gh', 'GitHub.cli'))) {
	if (Get-Command $tool[0] -ErrorAction SilentlyContinue) { continue }
	winget install --id $tool[1] --exact --source winget --silent --accept-source-agreements --accept-package-agreements
	if ($LASTEXITCODE -ne 0) { throw "winget could not install $($tool[1])" }
	Sync-Env
}
$env:GH_PAGER = 'cat'

# Windows PowerShell turns native stderr into an error, and Stop would throw it.
$loggedIn = try { gh auth status *> $null; $LASTEXITCODE -eq 0 } catch { $false }
if (-not $loggedIn) {
	Write-Step 'GitHub login: the browser opens, paste the code shown here'
	gh auth login --web --git-protocol https --hostname github.com
	if ($LASTEXITCODE -ne 0) { throw 'The GitHub login did not finish. Paste the line again.' }
}
gh auth setup-git

if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) {
	Write-Step "Cloning workspace into $root"
	gh repo clone workbench-soft/workspace $root
	if ($LASTEXITCODE -ne 0) { throw "Could not clone workbench-soft/workspace into $root. Is this GitHub account in the org?" }
}

Write-Step 'Running the restore'
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\restore.ps1')
