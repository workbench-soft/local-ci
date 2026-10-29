# Registers this PC as self-hosted GitHub Actions runners for the org and
# starts each at boot. A runner takes one job at a time, so RUNNER_COUNT runners
# build that many jobs at once. Running it again keeps the registrations and
# only rewrites the start files and the boot tasks. runner/install.sh is the Mac
# version.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\windows\boot-task.ps1')

if (-not (Test-IsAdmin)) { exit (Start-AsAdmin $PSCommandPath) }

$org = if ($env:RUNNER_ORG) { $env:RUNNER_ORG } else { 'workbench-soft' }
$count = if ($env:RUNNER_COUNT) { [int]$env:RUNNER_COUNT } else { 4 }
if ($count -lt 1) { throw 'RUNNER_COUNT must be 1 or more' }
# local marks the machine you develop on, Mac or Windows. Workflows ask for it.
$labels = 'Windows,X64,local'
$env:GH_PAGER = 'cat'

function Write-Step([string]$text) { Write-Host "`n==> $text" }

# The first runner keeps the folder, name and task it had before runners got numbers.
function Get-Runner([int]$number) {
	$suffix = if ($number -eq 1) { '' } else { "-$number" }
	$taskSuffix = if ($number -eq 1) { '' } else { " $number" }
	return [pscustomobject]@{
		Dir = Join-Path $HOME "actions-runner\$org$suffix"
		Name = "$env:COMPUTERNAME$suffix"
		Task = "GitHub Actions runner ($org$taskSuffix)"
	}
}

# Downloads the latest runner once and returns the zip.
function Get-RunnerArchive {
	Write-Step 'Finding the latest runner release'
	$release = gh api repos/actions/runner/releases/latest | ConvertFrom-Json
	$version = $release.tag_name.TrimStart('v')
	# The release notes list each file's hash between BEGIN SHA and END SHA.
	if ($release.body -notmatch 'BEGIN SHA win-x64 -->([0-9a-f]+)<') { throw 'No win-x64 hash in the release notes' }
	$expectedHash = $Matches[1]
	$file = "actions-runner-win-x64-$version.zip"

	Write-Step "Downloading $file"
	$zip = Join-Path $env:TEMP $file
	Invoke-WebRequest -UseBasicParsing -OutFile $zip "https://github.com/actions/runner/releases/download/v$version/$file"
	if ((Get-FileHash -Algorithm SHA256 $zip).Hash -ne $expectedHash) { throw "SHA256 of $file does not match the release notes" }
	return $zip
}

function Install-Runner($runner, [string]$zip, [string]$token) {
	Write-Step "Registering $($runner.Name) in $($runner.Dir)"
	New-Item -ItemType Directory -Force -Path $runner.Dir | Out-Null
	Expand-Archive -Force -Path $zip -DestinationPath $runner.Dir
	& (Join-Path $runner.Dir 'config.cmd') --unattended --url "https://github.com/$org" --token $token --name $runner.Name --labels $labels
	if ($LASTEXITCODE -ne 0) { throw "config.cmd failed for $($runner.Name)" }
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
	# install.ps1 puts mise's python in the shims and python3 forwarders in .local\bin.
	$dirs += (Join-Path $HOME '.local\bin'), (Join-Path $env:LOCALAPPDATA 'mise\shims')
	return $dirs
}

function Write-RunnerEnvironment([string]$runnerDir, [string[]]$toolDirs, [string]$toolCache) {
	Set-Content -LiteralPath (Join-Path $runnerDir 'start.cmd') -Encoding ascii -Value "@echo off`r`nset `"PATH=$($toolDirs -join ';');%PATH%`"`r`ncall `"%~dp0run.cmd`""
	$path = $toolDirs + ([Environment]::GetEnvironmentVariable('Path', 'Machine') -split ';') + ([Environment]::GetEnvironmentVariable('Path', 'User') -split ';')
	Set-Content -LiteralPath (Join-Path $runnerDir '.path') -Encoding ascii -Value (($path | Where-Object { $_ } | Select-Object -Unique) -join ';')

	$android = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
	# The setup-* actions then download a tool once for every runner, not once per runner.
	$jobVars = [ordered]@{ LANG = 'en_US.UTF-8'; RUNNER_TOOL_CACHE = $toolCache; AGENT_TOOLSDIRECTORY = $toolCache }
	if (Test-Path -LiteralPath $android) { $jobVars.ANDROID_HOME = $android; $jobVars.ANDROID_SDK_ROOT = $android }
	Set-Content -LiteralPath (Join-Path $runnerDir '.env') -Encoding ascii -Value ($jobVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })
}

# Defender scans each file a job writes, and pnpm install writes tens of
# thousands. The runners build only the org's own repos.
function Add-DefenderExclusions {
	if ($env:RUNNER_DEFENDER_EXCLUSIONS -eq 'off') { Write-Host 'RUNNER_DEFENDER_EXCLUSIONS=off, skipping'; return }
	$paths = @(
		(Join-Path $HOME 'actions-runner'),
		(Join-Path $HOME '.gradle'),
		(Join-Path $env:LOCALAPPDATA 'pnpm'),
		(Join-Path $env:LOCALAPPDATA 'npm-cache'),
		(Join-Path $env:LOCALAPPDATA 'mise')
	)
	# Another antivirus switches Defender off, and Add-MpPreference then fails.
	try {
		Add-MpPreference -ExclusionPath $paths
		$paths | ForEach-Object { Write-Host "Excluded  $_" }
	} catch {
		Write-Host "Defender refused the exclusions: $($_.Exception.Message)"
	}
}

function Start-Runner($runner) {
	# A restart would kill the job this runner builds now.
	$ownWorker = { Get-Process Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$($runner.Dir)\*" } }
	if (& $ownWorker) { Write-Host "$($runner.Name) is running a job, waiting for it to finish" }
	while (& $ownWorker) { Start-Sleep -Seconds 10 }
	Stop-ScheduledTask -TaskName $runner.Task -ErrorAction SilentlyContinue
	# Stopping the task leaves its listener running, still with the old PATH.
	Get-Process Runner.Listener, Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$($runner.Dir)\*" } | Stop-Process -Force
	# Jobs reach GitHub through their GITHUB_TOKEN, since the task can't read the gh login.
	Register-BootTask $runner.Task (Join-Path $runner.Dir 'start.cmd') $runner.Dir
}

$runners = 1..$count | ForEach-Object { Get-Runner $_ }
$missing = @($runners | Where-Object { -not (Test-Path -LiteralPath (Join-Path $_.Dir '.runner')) })
foreach ($runner in $runners | Where-Object { $missing -notcontains $_ }) {
	Write-Step "$($runner.Name) in $($runner.Dir) is already registered"
}
if ($missing.Count) {
	$zip = Get-RunnerArchive
	# One token registers every runner within its hour.
	$token = Get-RegistrationToken
	foreach ($runner in $missing) { Install-Runner $runner $zip $token }
	Remove-Item $zip
}

Write-Step 'Adding the runner folders and the package caches to the Defender exclusions'
Add-DefenderExclusions

$toolDirs = Get-ToolDirs
$toolCache = Join-Path $HOME 'actions-runner\_tool'
New-Item -ItemType Directory -Force -Path $toolCache | Out-Null
foreach ($runner in $runners) {
	Write-Step "Writing start.cmd, .path and the job variables for $($runner.Name), and starting it at boot"
	Write-RunnerEnvironment $runner.Dir $toolDirs $toolCache
	Start-Runner $runner
}
