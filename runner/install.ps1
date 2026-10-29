# Registers this PC as a self-hosted GitHub Actions runner for the org and
# starts it at boot. Running it again keeps the registration and only rewrites
# the start files and the boot task. runner/install.sh is the Mac version.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\windows\boot-task.ps1')

if (-not (Test-IsAdmin)) { exit (Start-AsAdmin $PSCommandPath) }

$org = if ($env:RUNNER_ORG) { $env:RUNNER_ORG } else { 'workbench-soft' }
$runnerDir = Join-Path $HOME "actions-runner\$org"
# local marks the machine you develop on, Mac or Windows. Workflows ask for it.
$labels = 'Windows,X64,local'
$taskName = "GitHub Actions runner ($org)"
$env:GH_PAGER = 'cat'

function Write-Step([string]$text) { Write-Host "`n==> $text" }

function Install-Runner {
	Write-Step 'Finding the latest runner release'
	$release = gh api repos/actions/runner/releases/latest | ConvertFrom-Json
	$version = $release.tag_name.TrimStart('v')
	# The release notes list each file's hash between BEGIN SHA and END SHA.
	if ($release.body -notmatch 'BEGIN SHA win-x64 -->([0-9a-f]+)<') { throw 'No win-x64 hash in the release notes' }
	$expectedHash = $Matches[1]
	$file = "actions-runner-win-x64-$version.zip"

	Write-Step "Downloading $file"
	New-Item -ItemType Directory -Force -Path $runnerDir | Out-Null
	$zip = Join-Path $env:TEMP $file
	Invoke-WebRequest -UseBasicParsing -OutFile $zip "https://github.com/actions/runner/releases/download/v$version/$file"
	if ((Get-FileHash -Algorithm SHA256 $zip).Hash -ne $expectedHash) { throw "SHA256 of $file does not match the release notes" }
	Expand-Archive -Force -Path $zip -DestinationPath $runnerDir
	Remove-Item $zip

	$token = Get-RegistrationToken
	Write-Step 'Registering the runner'
	& (Join-Path $runnerDir 'config.cmd') --unattended --url "https://github.com/$org" --token $token --name $env:COMPUTERNAME --labels $labels
	if ($LASTEXITCODE -ne 0) { throw 'config.cmd failed' }
}

# GitHub hands out a token only to an org admin whose login has the admin:org scope.
function Get-RegistrationToken {
	# Windows PowerShell turns gh's stderr into an error, and Stop would throw it.
	$token = try { gh api -X POST "orgs/$org/actions/runners/registration-token" --jq .token 2>$null } catch { $null }
	if ($token) { return $token }
	Write-Host "Copy the token from https://github.com/organizations/$org/settings/actions/runners/new?arch=x64&os=win"
	return Read-Host 'Registration token'
}

# WindowsApps holds a WSL bash and a Store stub for python, both ahead of the
# real ones. The runner takes the bash for shell: bash from its own PATH, which
# start.cmd sets. Steps take PATH from .path. Both put Git's bash and the
# installed Python first, so run this script again after installing a tool.
function Get-ToolDirs {
	$git = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Where-Object { $_.Source -like '*\Git\cmd\git.exe' } | Select-Object -First 1
	$gitRoot = if ($git) { Split-Path (Split-Path $git.Source) } else { Join-Path $env:ProgramFiles 'Git' }
	$dirs = @("$gitRoot\bin", "$gitRoot\usr\bin")
	$python = Get-Command python -All -CommandType Application -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike '*\WindowsApps\*' } | Select-Object -First 1
	# The python.org installer leaves PATH alone unless asked, so its own folder gets a look too.
	$pythonDir = if ($python) { Split-Path $python.Source } else {
		Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Programs\Python') -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
	}
	if ($pythonDir) { $dirs += $pythonDir }
	return $dirs
}

function Write-RunnerEnvironment([string]$startScript) {
	$toolDirs = Get-ToolDirs
	Set-Content -LiteralPath $startScript -Encoding ascii -Value "@echo off`r`nset `"PATH=$($toolDirs -join ';');%PATH%`"`r`ncall `"%~dp0run.cmd`""
	$path = $toolDirs + ([Environment]::GetEnvironmentVariable('Path', 'Machine') -split ';') + ([Environment]::GetEnvironmentVariable('Path', 'User') -split ';')
	Set-Content -LiteralPath (Join-Path $runnerDir '.path') -Encoding ascii -Value (($path | Where-Object { $_ } | Select-Object -Unique) -join ';')

	$android = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
	$jobVars = [ordered]@{ LANG = 'en_US.UTF-8' }
	if (Test-Path -LiteralPath $android) { $jobVars.ANDROID_HOME = $android; $jobVars.ANDROID_SDK_ROOT = $android }
	Set-Content -LiteralPath (Join-Path $runnerDir '.env') -Encoding ascii -Value ($jobVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })
}

if (Test-Path -LiteralPath (Join-Path $runnerDir '.runner')) {
	Write-Step "The runner in $runnerDir is already registered"
} else {
	Install-Runner
}

Write-Step 'Writing start.cmd, .path and the variables jobs see'
$startScript = Join-Path $runnerDir 'start.cmd'
Write-RunnerEnvironment $startScript

Write-Step 'Starting the runner at boot'
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
# Stopping the task leaves its listener running, still with the old PATH.
Get-Process Runner.Listener, Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$runnerDir\*" } | Stop-Process -Force
# Jobs reach GitHub through their GITHUB_TOKEN, since the task can't read the gh login.
Register-BootTask $taskName $startScript $runnerDir
