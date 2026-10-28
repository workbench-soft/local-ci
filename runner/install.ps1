# Registers this PC as a self-hosted GitHub Actions runner for the org and
# starts it at boot. Safe to run again: a configured runner keeps its
# registration and only gets its start task refreshed.
# runner/install.sh does the same on a Mac.
$ErrorActionPreference = 'Stop'

# A task that starts at boot without a password needs admin to register.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
	Write-Host 'Asking Windows for admin rights in a new window'
	$p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
	exit $p.ExitCode
}

$org = if ($env:RUNNER_ORG) { $env:RUNNER_ORG } else { 'workbench-soft' }
$dir = Join-Path $HOME "actions-runner\$org"
# local: the machine you develop on, Mac or Windows. Workflows ask for it.
$labels = 'Windows,X64,local'
$taskName = "GitHub Actions runner ($org)"
$env:GH_PAGER = 'cat'

function Say([string]$text) { Write-Host "`n==> $text" }

function Register-Runner {
Say 'Finding the latest runner release'
$release = gh api repos/actions/runner/releases/latest | ConvertFrom-Json
$version = $release.tag_name.TrimStart('v')
# The release notes carry the hash of each file between BEGIN SHA and END SHA.
if ($release.body -notmatch 'BEGIN SHA win-x64 -->([0-9a-f]+)<') { throw 'No win-x64 hash in the release notes' }
$sha = $Matches[1]
$file = "actions-runner-win-x64-$version.zip"

Say "Downloading $file"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$zip = Join-Path $env:TEMP $file
Invoke-WebRequest -UseBasicParsing -OutFile $zip "https://github.com/actions/runner/releases/download/v$version/$file"
if ((Get-FileHash -Algorithm SHA256 $zip).Hash -ne $sha) { throw "SHA256 of $file does not match the release notes" }
Expand-Archive -Force -Path $zip -DestinationPath $dir
Remove-Item $zip

# The API hands out a token only to an org admin with the admin:org scope.
# Windows PowerShell turns gh's stderr into an error that Stop would throw.
$token = try { gh api -X POST "orgs/$org/actions/runners/registration-token" --jq .token 2>$null } catch { $null }
if (-not $token) {
	Write-Host "Copy the token from https://github.com/organizations/$org/settings/actions/runners/new?arch=x64&os=win"
	$token = Read-Host 'Registration token'
}

Say 'Registering the runner'
& (Join-Path $dir 'config.cmd') --unattended --url "https://github.com/$org" --token $token --name $env:COMPUTERNAME --labels $labels
if ($LASTEXITCODE -ne 0) { throw 'config.cmd failed' }
}

if (Test-Path -LiteralPath (Join-Path $dir '.runner')) {
	Say "The runner in $dir is already registered"
} else {
	Register-Runner
}

# shell: bash takes the first bash on the runner's PATH, and the one in
# WindowsApps is WSL. start.cmd puts Git's bash first, then runs the runner.
Say 'Writing start.cmd and the variables jobs see'
$git = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Where-Object { $_.Source -like '*\Git\cmd\git.exe' } | Select-Object -First 1
$gitRoot = if ($git) { Split-Path (Split-Path $git.Source) } else { Join-Path $env:ProgramFiles 'Git' }
$start = Join-Path $dir 'start.cmd'
Set-Content -LiteralPath $start -Encoding ascii -Value "@echo off`r`nset `"PATH=$gitRoot\bin;$gitRoot\usr\bin;%PATH%`"`r`ncall `"%~dp0run.cmd`""
# The runner keeps PATH from .path when it exists, so a stale one would win.
Remove-Item -LiteralPath (Join-Path $dir '.path') -ErrorAction SilentlyContinue

$android = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$vars = [ordered]@{ LANG = 'en_US.UTF-8' }
if (Test-Path -LiteralPath $android) { $vars.ANDROID_HOME = $android; $vars.ANDROID_SDK_ROOT = $android }
Set-Content -LiteralPath (Join-Path $dir '.env') -Encoding ascii -Value ($vars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })

# A Windows service runs as NETWORK SERVICE, without the user's mise and
# ~/.gitconfig. The task runs as the user from boot, before anyone logs in.
# S4U needs no stored password, but it can't read the Windows credential
# store, so a job gets GitHub access from its GITHUB_TOKEN.
Say 'Starting the runner at boot'
$user = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute $start -WorkingDirectory $dir
$triggers = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn -User $user))
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
# Stopping the task leaves the listener it started running, with the old PATH.
Get-Process Runner.Listener, Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$dir\*" } | Stop-Process -Force
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Format-Table TaskName, State
