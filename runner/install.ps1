# Registers this PC as self-hosted GitHub Actions runners for the org and
# starts each at boot. A runner takes one job at a time, so RUNNER_COUNT runners
# build that many jobs at once. Running it again keeps the registrations,
# removes the runners above the count and rewrites the start files and the boot
# tasks. runner/install.sh is the Mac version.
# Each admin run writes its output to ~/actions-runner/install.log.
param(
	# The admin window and the count task pass it, so the window stays open on an error.
	[switch]$PauseOnError
)
$ErrorActionPreference = 'Stop'
# Windows PowerShell redraws a progress bar per chunk, which made downloads 10 times slower.
$ProgressPreference = 'SilentlyContinue'
trap {
	Write-Host "`n$($_.InvocationInfo.PositionMessage)`n$_" -ForegroundColor Red
	if ($PauseOnError) { Read-Host 'Press Enter to close' | Out-Null }
	break
}
. (Join-Path $PSScriptRoot '..\windows\boot-task.ps1')

if (-not (Test-IsAdmin)) { exit (Start-AsAdmin $PSCommandPath @('-PauseOnError')) }

$logFile = Join-Path $HOME 'actions-runner\install.log'
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null
Start-Transcript -LiteralPath $logFile | Out-Null

$org = if ($env:RUNNER_ORG) { $env:RUNNER_ORG } else { 'workbench-soft' }
# The status page writes the count it wants to this file, and the script saves the count it used there.
$countFile = Join-Path $HOME 'actions-runner\runner-count'
$count = if ($env:RUNNER_COUNT) { [int]$env:RUNNER_COUNT } elseif (Test-Path -LiteralPath $countFile) { [int](Get-Content -LiteralPath $countFile -TotalCount 1) } else { 4 }
if ($count -lt 1) { throw 'RUNNER_COUNT must be 1 or more' }
# The status page starts this task to apply a new count.
$countTask = "GitHub Actions runner count ($org)"
# local marks the machine you develop on, Mac or Windows. Workflows ask for it.
$labels = 'Windows,X64,local'
# heavy marks the runners that take a Gradle, Cargo or Tauri build. 8 such builds at once
# starved the PC: a release took 50 minutes where it takes 10 alone. Light jobs run on every runner.
$heavyCount = if ($env:RUNNER_HEAVY_COUNT) { [int]$env:RUNNER_HEAVY_COUNT } else { [Math]::Min(2, $count) }
$env:GH_PAGER = 'cat'

function Write-Step([string]$text) { Write-Host "`n==> $text" }

# The first runner keeps the folder, name and task it had before runners got numbers.
# Jobs check repos out here, a short root so deep node_modules paths stay under 260 characters.
$workRoot = if ($env:RUNNER_WORK_ROOT) { $env:RUNNER_WORK_ROOT } else { Join-Path $env:SystemDrive 'ci' }

# The SDK sits outside AppData. Claude Desktop is a packaged app, so a tool it
# runs writes %LOCALAPPDATA% into its own LocalCache folder. An SDK part
# installed from there is invisible to the runners, which start from a boot task.
$androidHome = if ($env:ANDROID_HOME -and $env:ANDROID_HOME -notlike "$env:LOCALAPPDATA\*") { $env:ANDROID_HOME } else { Join-Path $env:SystemDrive 'Android\Sdk' }

function Get-Runner([int]$number) {
	$suffix = if ($number -eq 1) { '' } else { "-$number" }
	$taskSuffix = if ($number -eq 1) { '' } else { " $number" }
	return [pscustomobject]@{
		Dir = Join-Path $HOME "actions-runner\$org$suffix"
		Name = "$env:COMPUTERNAME$suffix"
		# Windows can't start a .bat past 260 characters, and Expo's CMake writes one deep in node_modules.
		Work = Join-Path $workRoot $number
		Task = "GitHub Actions runner ($org$taskSuffix)"
		# The first runners carry heavy, so the label survives a lower count.
		Labels = if ($number -le $heavyCount) { "$labels,heavy" } else { $labels }
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
	& (Join-Path $runner.Dir 'config.cmd') --unattended --url "https://github.com/$org" --token $token --name $runner.Name --labels $runner.Labels --work $runner.Work | Out-Host
	if ($LASTEXITCODE -ne 0) { throw "config.cmd failed for $($runner.Name)" }
}

# GitHub hands out a token only to an org admin whose login has the admin:org scope.
function Get-RegistrationToken {
	# Windows PowerShell turns gh's stderr into an error, and Stop would throw it.
	$token = try { gh api -X POST "orgs/$org/actions/runners/registration-token" --jq .token 2>$null } catch { $null }
	if ($token) { return $token }
	Write-Host "Copy the token from https://github.com/organizations/$org/settings/actions/runners/new?arch=x64&os=win"
	# The token stays off the screen, as read -s keeps it in runner/install.sh.
	$secure = Read-Host 'Registration token' -AsSecureString
	return [Net.NetworkCredential]::new('', $secure).Password
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

	# The setup-* actions then download a tool once for every runner, not once per runner.
	$jobVars = [ordered]@{ LANG = 'en_US.UTF-8'; RUNNER_TOOL_CACHE = $toolCache; AGENT_TOOLSDIRECTORY = $toolCache }
	# action-setup puts PNPM_HOME, and with it the pnpm store, in _temp, which the runner wipes after each job.
	$jobVars.pnpm_config_store_dir = Join-Path $env:LOCALAPPDATA 'pnpm\store'
	if (Test-Path -LiteralPath $androidHome) { $jobVars.ANDROID_HOME = $androidHome; $jobVars.ANDROID_SDK_ROOT = $androidHome }
	# Two jobs downloading the same SDK part at once leave it half written, so jobs only read the SDK.
	$jobVars.'ORG_GRADLE_PROJECT_android.builder.sdkDownload' = 'false'
	# The runner reads .env too. It copies each action's zip from this folder in place of a download, so
	# "Set up job" stops fetching checkout, mise-action and the rest on every job. That took 1 to 3 minutes
	# when GitHub throttled it. The runner only reads the folder: runner\cache-actions.ps1 fills it, and
	# every runner shares it.
	$jobVars.ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE = $actionCache
	Set-Content -LiteralPath (Join-Path $runnerDir '.env') -Encoding ascii -Value ($jobVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })
}

# A restart or a removal would kill the job this runner builds now.
function Stop-RunnerWhenIdle($runner) {
	$ownWorker = { Get-Process Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$($runner.Dir)\*" } }
	if (& $ownWorker) { Write-Host "$($runner.Name) is running a job, waiting for it to finish" }
	while (& $ownWorker) { Start-Sleep -Seconds 10 }
	Stop-ScheduledTask -TaskName $runner.Task -ErrorAction SilentlyContinue
	# Stopping the task leaves its listener running.
	Get-Process Runner.Listener, Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$($runner.Dir)\*" } | Stop-Process -Force
}

# Runners registered before the short root still point at _work in their own folder.
function Set-RunnerWork($runner) {
	$file = Join-Path $runner.Dir '.runner'
	$config = Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
	if ($config.workFolder -eq $runner.Work) { return }
	$config.workFolder = $runner.Work
	Set-Content -LiteralPath $file -Encoding utf8 -Value ($config | ConvertTo-Json)
}

function Start-Runner($runner) {
	Stop-RunnerWhenIdle $runner
	Set-RunnerWork $runner
	# Jobs reach GitHub through their GITHUB_TOKEN, since the task can't read the gh login.
	Register-BootTask $runner.Task (Join-Path $runner.Dir 'start.cmd') $runner.Dir
}

# A runner registered before the heavy label, or moved across the heavy count, gets its labels fixed on GitHub.
# config.cmd sets labels only at registration, and the API changes them without a restart.
function Sync-RunnerLabels($runners) {
	$registered = try { gh api "orgs/$org/actions/runners" --paginate --jq '.runners[] | {id, name, labels: [.labels[].name]}' 2>$null | ConvertFrom-Json } catch { $null }
	if (-not $registered) { Write-Host 'gh could not list the runners, so the heavy label stays as it is'; return }
	foreach ($runner in $runners) {
		$remote = $registered | Where-Object name -eq $runner.Name | Select-Object -First 1
		if (-not $remote) { continue }
		$wantsHeavy = $runner.Labels -match '(^|,)heavy(,|$)'
		$hasHeavy = $remote.labels -contains 'heavy'
		if ($wantsHeavy -and -not $hasHeavy) {
			Write-Host "Adding heavy to $($runner.Name)"
			gh api -X POST "orgs/$org/actions/runners/$($remote.id)/labels" -f 'labels[]=heavy' | Out-Null
		} elseif ($hasHeavy -and -not $wantsHeavy) {
			Write-Host "Removing heavy from $($runner.Name)"
			gh api -X DELETE "orgs/$org/actions/runners/$($remote.id)/labels/heavy" | Out-Null
		}
	}
}

# The runners above the count, from the folders runner n leaves in actions-runner.
function Get-ExtraRunners {
	Get-ChildItem -Directory -LiteralPath (Join-Path $HOME 'actions-runner') -Filter "$org-*" -ErrorAction SilentlyContinue |
		Where-Object { $_.Name.Substring($org.Length + 1) -match '^\d+$' -and [int]$Matches[0] -gt $count } |
		ForEach-Object { Get-Runner ([int]$_.Name.Substring($org.Length + 1)) }
}

function Remove-Runner($runner, [string]$token) {
	Write-Step "Removing $($runner.Name) from GitHub and $($runner.Dir)"
	Stop-RunnerWhenIdle $runner
	Unregister-ScheduledTask -TaskName $runner.Task -Confirm:$false -ErrorAction SilentlyContinue
	if (Test-Path -LiteralPath (Join-Path $runner.Dir '.runner')) {
		& (Join-Path $runner.Dir 'config.cmd') remove --token $token | Out-Host
		if ($LASTEXITCODE -ne 0) { throw "config.cmd remove failed for $($runner.Name)" }
	}
	# node_modules in _work holds paths over 260 characters.
	Remove-Item -LiteralPath "\\?\$($runner.Dir)" -Recurse -Force
	if (Test-Path -LiteralPath $runner.Work) { Remove-Item -LiteralPath "\\?\$($runner.Work)" -Recurse -Force }
}

# The task runs this script as admin in the person's session, so gh keeps its login and UAC asks nothing.
function Register-CountTask {
	$user = "$env:USERDOMAIN\$env:USERNAME"
	$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -PauseOnError" -WorkingDirectory $PSScriptRoot
	$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
	$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 4) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
	Register-ScheduledTask -TaskName $countTask -Action $action -Principal $principal -Settings $settings -Force | Out-Null
}

New-Item -ItemType Directory -Force -Path (Split-Path $countFile) | Out-Null
Set-Content -LiteralPath $countFile -Encoding ascii -Value $count
Write-Step "Setting up $count runners"

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

Write-Step "Giving the first $heavyCount runners the heavy label"
Sync-RunnerLabels $runners

$extra = @(Get-ExtraRunners)
if ($extra.Count) {
	$removeToken = try { gh api -X POST "orgs/$org/actions/runners/remove-token" --jq .token 2>$null } catch { $null }
	if (-not $removeToken) { throw "gh got no removal token. Removing a runner takes an org admin login with the admin:org scope: gh auth refresh -s admin:org" }
	foreach ($runner in $extra) { Remove-Runner $runner $removeToken }
}

Write-Step 'Adding the runner folders and the package caches to the Defender exclusions'
& (Join-Path $PSScriptRoot '..\windows\defender-exclusions.ps1')

# The SDK parts the org's Android apps build with. Add one here and run the script again.
$androidPackages = 'ndk;27.1.12297006', 'platforms;android-36', 'platforms;android-37.0', 'build-tools;35.0.0', 'build-tools;36.0.0', 'build-tools;37.0.0'

# Android Studio puts the SDK under %LOCALAPPDATA%. The first run copies it to
# the SDK folder, and the copy is the one the runners and sdkmanager use after that.
function Copy-AndroidSdk {
	$old = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
	$sdkmanager = 'cmdline-tools\latest\bin\sdkmanager.bat'
	if ((Test-Path -LiteralPath (Join-Path $androidHome $sdkmanager)) -or -not (Test-Path -LiteralPath (Join-Path $old $sdkmanager))) { return }
	Write-Host "Copying $old to $androidHome"
	# .temp holds the half-written downloads of an interrupted sdkmanager run.
	robocopy $old $androidHome /E /XD .temp /R:1 /W:1 /MT:8 /NFL /NDL /NP | Out-Host
	# robocopy returns 0 to 7 on success.
	if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE" }
}

# jdx/mise-action exports `mise env` into every job, over the runner's .env.
# A global ANDROID_HOME under AppData there sends Gradle back to the old folder.
function Set-MiseAndroidHome {
	$config = Join-Path $HOME '.config\mise\config.toml'
	if (-not (Test-Path -LiteralPath $config)) { return }
	if ((Get-Content -Raw -LiteralPath $config) -notmatch '(?m)^ANDROID_HOME\s*=') { return }
	$value = $androidHome -replace '\\', '/'
	if ((mise env --json | ConvertFrom-Json).ANDROID_HOME -eq $value) { return }
	Write-Host "Pointing ANDROID_HOME in $config at $value"
	mise set --file $config "ANDROID_HOME=$value" | Out-Host
}

function Install-AndroidSdk {
	$sdkmanager = Join-Path $androidHome 'cmdline-tools\latest\bin\sdkmanager.bat'
	if (-not (Test-Path -LiteralPath $sdkmanager)) { Write-Host "No sdkmanager at $sdkmanager, skipping the Android SDK"; return }
	if (-not $env:JAVA_HOME) { $env:JAVA_HOME = mise where java }
	@('y') * 20 | & $sdkmanager --install @androidPackages | Out-Null
	if ($LASTEXITCODE -ne 0) { throw "sdkmanager failed with exit code $LASTEXITCODE" }
}

# node_modules and the .open-next cache hold paths over 260 characters.
Write-Step 'Turning on long paths for git and Windows'
git config --global core.longpaths true
try {
	Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1 -Type DWord -ErrorAction Stop
} catch {
	Write-Host "Windows long paths need an admin run: $($_.Exception.Message)"
}

Write-Step "Installing the Android SDK parts the apps build with, in $androidHome"
Copy-AndroidSdk
Set-MiseAndroidHome
Install-AndroidSdk

$toolDirs = Get-ToolDirs
$toolCache = Join-Path $HOME 'actions-runner\_tool'
New-Item -ItemType Directory -Force -Path $toolCache | Out-Null
$actionCache = if ($env:RUNNER_ACTION_CACHE) { $env:RUNNER_ACTION_CACHE } else { Join-Path $HOME 'actions-runner\_actions-cache' }
New-Item -ItemType Directory -Force -Path $actionCache | Out-Null
Write-Step "Filling the action cache in $actionCache"
# A download that fails leaves the runners to fetch that action themselves.
try { & (Join-Path $PSScriptRoot 'cache-actions.ps1') } catch { Write-Host "The action cache stays as it is: $($_.Exception.Message)" }
foreach ($runner in $runners) {
	Write-Step "Writing start.cmd, .path and the job variables for $($runner.Name), and starting it at boot"
	Write-RunnerEnvironment $runner.Dir $toolDirs $toolCache
	Start-Runner $runner
}

Write-Step "Registering the task the status page starts to change the count"
Register-CountTask

Stop-Transcript | Out-Null
