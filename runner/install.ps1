# Registers this PC as a self-hosted GitHub Actions runner for the org and
# starts it at logon. Safe to run again: a configured runner is left alone.
# runner/install.sh does the same on a Mac.
$ErrorActionPreference = 'Stop'

$org = if ($env:RUNNER_ORG) { $env:RUNNER_ORG } else { 'workbench-soft' }
$dir = Join-Path $HOME "actions-runner\$org"
$labels = 'Windows,X64'
$taskName = "GitHub Actions runner ($org)"
$env:GH_PAGER = 'cat'

function Say([string]$text) { Write-Host "`n==> $text" }

if (Test-Path -LiteralPath (Join-Path $dir '.runner')) {
	Say "The runner in $dir is already registered"
	Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Format-Table TaskName, State
	return
}

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

if ($env:ANDROID_HOME) {
	Add-Content -LiteralPath (Join-Path $dir '.env') -Value "ANDROID_HOME=$env:ANDROID_HOME`nANDROID_SDK_ROOT=$env:ANDROID_HOME"
}

# A Windows service runs as NETWORK SERVICE, without the user's mise, gh login
# and ~/.gitconfig. A task at logon runs as the user, like launchd on the Mac.
Say 'Starting the runner at logon'
$action = New-ScheduledTaskAction -Execute (Join-Path $dir 'run.cmd') -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero)-RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Format-Table TaskName, State
