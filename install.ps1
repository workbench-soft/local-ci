# Installs everything README.md lists on Windows. Safe to run again: each step
# checks whether its piece is already in place. install.sh does the same on a Mac.
$ErrorActionPreference = 'Stop'

$devDir = if ($env:DEV_DIR) { $env:DEV_DIR } else { 'C:\Programming\WorkbenchSoft' }
$env:GH_PAGER = 'cat'

function Say([string]$text) { Write-Host "`n==> $text" }

# No console (piped, CI) means no changes that need a decision.
function Ask([string]$question) {
	if ([Console]::IsInputRedirected) { return $false }
	return (Read-Host "$question [y/N]") -match '^(y|yes)$'
}

# winget adds to PATH in the registry, and this session keeps the old copy.
function Update-Path {
	$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# Windows PowerShell 5.1 and PowerShell 7 read profiles from different folders.
function Add-ProfileLine([string]$line) {
	$docs = [Environment]::GetFolderPath('MyDocuments')
	foreach ($file in "$docs\WindowsPowerShell\profile.ps1", "$docs\PowerShell\profile.ps1") {
		New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
		$text = if (Test-Path -LiteralPath $file) { Get-Content -Raw -LiteralPath $file } else { '' }
		if ($text -notlike "*$line*") { Add-Content -LiteralPath $file -Value $line }
	}
}

# --- winget ------------------------------------------------------------------
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
	throw 'winget is missing. Install App Installer from the Microsoft Store and run this again.'
}

Say 'Installing tools with winget'
$packages = @(
	'Git.Git', 'GitHub.cli', 'jdx.mise', 'junegunn.fzf', 'jqlang.jq',
	'koalaman.shellcheck', 'mvdan.shfmt', 'FiloSottile.mkcert',
	'Microsoft.VisualStudioCode', 'Docker.DockerDesktop', 'Anthropic.Claude', 'Google.PlatformTools'
)
foreach ($id in $packages) {
	# winget list cuts long ids to fit the console, so ask about each one.
	winget list --id $id --exact --accept-source-agreements | Out-Null
	if ($LASTEXITCODE -eq 0) { continue }
	Write-Host "  $id"
	winget install --id $id --exact --source winget --silent --accept-source-agreements --accept-package-agreements
}
Update-Path

# --- PATH and the PowerShell profile -----------------------------------------
Say 'Updating PATH and the PowerShell profile'
$localBin = Join-Path $HOME '.local\bin'
New-Item -ItemType Directory -Force -Path $localBin | Out-Null
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $localBin) {
	[Environment]::SetEnvironmentVariable('Path', "$localBin;$userPath", 'User')
	Update-Path
}
Add-ProfileLine '(&mise activate pwsh) | Out-String | Invoke-Expression'

# --- Node toolchain ----------------------------------------------------------
Say 'Installing node, pnpm and yarn through mise'
mise use -g node@22 pnpm@latest yarn@1

Say 'Installing the Copilot CLI and agent-browser'
mise exec -- npm install -g @github/copilot agent-browser

# --- Git config --------------------------------------------------------------
Say 'Setting git config'
git config --global color.ui true
git config --global push.autosetupremote true
git config --global core.autocrlf true
if (-not (git config --global user.name)) { git config --global user.name (Read-Host 'git user.name') }
if (-not (git config --global user.email)) { git config --global user.email (Read-Host 'git user.email') }

# --- GitHub CLI --------------------------------------------------------------
# The repos below are private in workbench-soft, so the login comes first.
# Windows PowerShell turns native stderr into an error that Stop would throw.
$loggedIn = try { gh auth status *> $null; $LASTEXITCODE -eq 0 } catch { $false }
if (-not $loggedIn) {
	Say 'Logging into GitHub'
	gh auth login
}

# --- My repos ----------------------------------------------------------------
# gh-review-notify is a macOS LaunchAgent, so it stays on the Mac.
New-Item -ItemType Directory -Force -Path $devDir | Out-Null
foreach ($repo in 'git-aliases', 'agent-skills') {
	$dir = Join-Path $devDir $repo
	if (-not (Test-Path -LiteralPath $dir)) {
		Say "Cloning $repo"
		gh repo clone "workbench-soft/$repo" $dir
	}
	Say "Running $repo\install.ps1"
	& (Join-Path $dir 'install.ps1')
}

# --- gh extensions -----------------------------------------------------------
$extensions = try { gh extension list 2>$null | Out-String } catch { '' }
if ($extensions -notmatch 'gh-stack') {
	Say 'Installing gh-stack'
	gh extension install github/gh-stack
}

# --- VS Code extensions ------------------------------------------------------
Say 'Installing VS Code extensions'
foreach ($ext in @(
		'anthropic.claude-code',
		'dbaeumer.vscode-eslint',
		'esbenp.prettier-vscode',
		'formulahendry.auto-rename-tag',
		'huizhou.githd',
		'nrwl.angular-console',
		'oleg-chibikov.open-in-remote-repo',
		'orta.vscode-jest'
	)) {
	code --install-extension $ext | Out-Null
}

# --- Claude Code memory ------------------------------------------------------
$claudeDir = Join-Path $HOME '.claude'
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $claudeDir 'MEMORY.md'))) {
	Say 'Copying Claude memory'
	Copy-Item (Join-Path $PSScriptRoot 'claude\MEMORY.md') (Join-Path $claudeDir 'MEMORY.md')
}
$claudeMd = Join-Path $claudeDir 'CLAUDE.md'
$claudeText = if (Test-Path -LiteralPath $claudeMd) { Get-Content -Raw -LiteralPath $claudeMd } else { '' }
if ($claudeText -notmatch '(?m)^@~/\.claude/MEMORY\.md\s*$') {
	Set-Content -LiteralPath $claudeMd -Encoding utf8 -Value "@~/.claude/MEMORY.md`n`n$claudeText"
}

# --- MCP servers -------------------------------------------------------------
$mcp = Join-Path $HOME '.copilot\mcp-config.json'
if (-not (Test-Path -LiteralPath $mcp)) {
	Say 'Copying MCP config'
	New-Item -ItemType Directory -Force -Path (Split-Path $mcp) | Out-Null
	Copy-Item (Join-Path $PSScriptRoot 'mcp-config.json') $mcp
}

# --- CI runner ---------------------------------------------------------------
if (Ask 'Register this PC as a GitHub Actions runner for workbench-soft?') {
	& (Join-Path $PSScriptRoot 'runner\install.ps1')
}

Say 'Done. Open a new terminal to pick up the PATH and mise.'
