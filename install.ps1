# Sets up Windows with everything README.md lists. Running it again is safe,
# since each step looks for its piece first. install.sh is the Mac version.
$ErrorActionPreference = 'Stop'

# WBS_ROOT names the workspace root. Without it, the root is the folder that holds this clone.
$devDir = if ($env:WBS_ROOT) { $env:WBS_ROOT } elseif ($env:DEV_DIR) { $env:DEV_DIR } else { Split-Path $PSScriptRoot -Parent }
$env:GH_PAGER = 'cat'

$wingetPackages = @(
	'Git.Git', 'GitHub.cli', 'jdx.mise', 'junegunn.fzf', 'jqlang.jq',
	'koalaman.shellcheck', 'mvdan.shfmt', 'FiloSottile.mkcert',
	'Microsoft.VisualStudioCode', 'Docker.DockerDesktop', 'Anthropic.Claude', 'Google.PlatformTools'
)
$vscodeExtensions = @(
	'anthropic.claude-code',
	'dbaeumer.vscode-eslint',
	'esbenp.prettier-vscode',
	'formulahendry.auto-rename-tag',
	'huizhou.githd',
	'nrwl.angular-console',
	'oleg-chibikov.open-in-remote-repo',
	'orta.vscode-jest'
)

function Write-Step([string]$text) { Write-Host "`n==> $text" }

# Without a console (piped, CI) every question gets a no.
function Confirm-Choice([string]$question) {
	if ([Console]::IsInputRedirected) { return $false }
	return (Read-Host "$question [y/N]") -match '^(y|yes)$'
}

# winget writes PATH to the registry, while this session holds the old copy.
function Sync-SessionPath {
	$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Add-LineOnce([string]$file, [string]$line) {
	New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
	$text = if (Test-Path -LiteralPath $file) { Get-Content -Raw -LiteralPath $file } else { '' }
	if ($text -notlike "*$line*") { Add-Content -LiteralPath $file -Value $line }
}

function Add-ToUserPath([string]$dir) {
	$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
	if (($userPath -split ';') -notcontains $dir) {
		[Environment]::SetEnvironmentVariable('Path', "$dir;$userPath", 'User')
	}
}

function Copy-IfMissing([string]$from, [string]$to, [string]$step) {
	if (Test-Path -LiteralPath $to) { return }
	Write-Step $step
	New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
	Copy-Item $from $to
}

# --- winget ------------------------------------------------------------------
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
	throw 'winget is missing. Install App Installer from the Microsoft Store and run this again.'
}

Write-Step 'Installing tools with winget'
foreach ($id in $wingetPackages) {
	# winget list trims long ids to the console width, so each id gets its own query.
	winget list --id $id --exact --accept-source-agreements | Out-Null
	if ($LASTEXITCODE -eq 0) { continue }
	Write-Host "  $id"
	winget install --id $id --exact --source winget --silent --accept-source-agreements --accept-package-agreements
}
Sync-SessionPath

# --- PATH and the PowerShell profile -----------------------------------------
Write-Step 'Updating PATH and the PowerShell profile'
$localBin = Join-Path $HOME '.local\bin'
New-Item -ItemType Directory -Force -Path $localBin | Out-Null
Add-ToUserPath $localBin
# mise activate needs PowerShell 7, so Windows PowerShell 5.1 gets the shims.
Add-ToUserPath (Join-Path $env:LOCALAPPDATA 'mise\shims')
# WindowsApps holds Store stubs named python and python3, so it goes last.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User') -split ';' | Where-Object { $_ }
$storeDirs = @($userPath | Where-Object { $_ -like '*\Microsoft\WindowsApps' })
[Environment]::SetEnvironmentVariable('Path', ((@($userPath | Where-Object { $storeDirs -notcontains $_ }) + $storeDirs) -join ';'), 'User')
Sync-SessionPath
$documents = [Environment]::GetFolderPath('MyDocuments')
Add-LineOnce "$documents\PowerShell\profile.ps1" '(&mise activate pwsh) | Out-String | Invoke-Expression'

# --- Node toolchain ----------------------------------------------------------
Write-Step 'Installing node, pnpm, yarn and python through mise'
mise use -g node@22 pnpm@latest yarn@1 python@3.15
if ($LASTEXITCODE -ne 0) { throw 'mise use failed' }

# Each worktree starts with an empty target folder. sccache lets it reuse the
# crates another worktree already compiled.
Write-Step 'Installing sccache through mise'
mise use -g github:mozilla/sccache@0.19
if ($LASTEXITCODE -ne 0) { throw 'mise use failed' }
mise set -g RUSTC_WRAPPER=sccache SCCACHE_CACHE_SIZE=20G
if ($LASTEXITCODE -ne 0) { throw 'mise set failed' }

# mise's Windows Python has no python3, so that name reaches the Store stub in
# WindowsApps, which exits 49. These forwarders sit ahead of it in PATH.
Set-Content -LiteralPath (Join-Path $localBin 'python3') -Encoding ascii -NoNewline -Value "#!/bin/sh`nexec python `"`$@`"`n"
Set-Content -LiteralPath (Join-Path $localBin 'python3.cmd') -Encoding ascii -Value '@python %*'

Write-Step 'Installing the Copilot CLI and agent-browser'
# Windows PowerShell drops a bare -- on its way to mise, so the quotes stay.
mise exec '--' npm install -g @github/copilot agent-browser
if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }

# --- Git config --------------------------------------------------------------
Write-Step 'Setting git config'
git config --global color.ui true
git config --global push.autosetupremote true
# input keeps LF on checkout, so bash scripts run in Git Bash and on the runner.
git config --global core.autocrlf input
if (-not (git config --global user.name)) { git config --global user.name (Read-Host 'git user.name') }
if (-not (git config --global user.email)) { git config --global user.email (Read-Host 'git user.email') }

# --- GitHub CLI --------------------------------------------------------------
# The repos below are private in workbench-soft, so the login goes first.
# Windows PowerShell turns native stderr into an error, and Stop would throw it.
$loggedIn = try { gh auth status *> $null; $LASTEXITCODE -eq 0 } catch { $false }
if (-not $loggedIn) {
	Write-Step 'Logging into GitHub'
	gh auth login
}

# --- My repos ----------------------------------------------------------------
# gh-review-notify is a macOS LaunchAgent, so only the Mac gets it.
New-Item -ItemType Directory -Force -Path $devDir | Out-Null
foreach ($repo in 'git-aliases', 'agent-skills') {
	$repoDir = Join-Path $devDir $repo
	if (-not (Test-Path -LiteralPath $repoDir)) {
		Write-Step "Cloning $repo"
		gh repo clone "workbench-soft/$repo" $repoDir
	}
	Write-Step "Running $repo\install.ps1"
	$repoInstaller = Join-Path $repoDir 'install.ps1'
	# Without a console agent-skills can't ask for the language, so it gets English.
	if ($repo -eq 'agent-skills' -and [Console]::IsInputRedirected) {
		& $repoInstaller -Lang English -Yes
	} else {
		& $repoInstaller
	}
}

# --- gh extensions -----------------------------------------------------------
$ghExtensions = try { gh extension list 2>$null | Out-String } catch { '' }
if ($ghExtensions -notmatch 'gh-stack') {
	Write-Step 'Installing gh-stack'
	gh extension install github/gh-stack
}

# --- VS Code extensions ------------------------------------------------------
Write-Step 'Installing VS Code extensions'
foreach ($extension in $vscodeExtensions) {
	code --install-extension $extension | Out-Null
}

# --- Claude Code memory ------------------------------------------------------
$claudeDir = Join-Path $HOME '.claude'
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
Copy-IfMissing (Join-Path $PSScriptRoot 'claude\MEMORY.md') (Join-Path $claudeDir 'MEMORY.md') 'Copying Claude memory'
$claudeMd = Join-Path $claudeDir 'CLAUDE.md'
$claudeText = if (Test-Path -LiteralPath $claudeMd) { Get-Content -Raw -LiteralPath $claudeMd } else { '' }
if ($claudeText -notmatch '(?m)^@~/\.claude/MEMORY\.md\s*$') {
	# Set-Content in Windows PowerShell adds a BOM, and the import line has to start the file.
	[IO.File]::WriteAllText($claudeMd, "@~/.claude/MEMORY.md`n`n$claudeText", [Text.UTF8Encoding]::new($false))
}

# --- MCP servers -------------------------------------------------------------
Copy-IfMissing (Join-Path $PSScriptRoot 'mcp-config.json') (Join-Path $HOME '.copilot\mcp-config.json') 'Copying MCP config'

# --- CI runner ---------------------------------------------------------------
if (Confirm-Choice 'Register this PC as a GitHub Actions runner for workbench-soft?') {
	& (Join-Path $PSScriptRoot 'runner\install.ps1')
}

Write-Step 'Done. Open a new terminal to pick up the PATH and mise.'
