# Helpers for runner\install.ps1 and dashboard\install.ps1, which both start a
# program at boot through a scheduled task, and for the install lock of
# windows\update.ps1 and windows\start.ps1. Dot-source this file.

# Registering a task that starts at boot without a stored password takes admin rights.
function Test-IsAdmin {
	$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
	return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Runs the script again in an elevated window, waits for it and returns its exit code.
function Start-AsAdmin([string]$scriptPath, [string[]]$scriptArgs = @()) {
	Write-Host 'Asking Windows for admin rights in a new window'
	$elevated = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList (@('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$scriptPath`"") + $scriptArgs)
	return $elevated.ExitCode
}

# A Windows service would run as NETWORK SERVICE, without the user's mise and
# ~/.gitconfig. This task runs as the user from boot, before anyone logs in, and
# again at logon. S4U stores no password, so the task can't read the Windows
# credential store.
function Register-BootTask([string]$name, [string]$program, [string]$folder) {
	$user = "$env:USERDOMAIN\$env:USERNAME"
	$action = New-ScheduledTaskAction -Execute $program -WorkingDirectory $folder
	$triggers = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn -User $user))
	$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
	$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
	Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force | Out-Null
	Start-ScheduledTask -TaskName $name
	Get-ScheduledTask -TaskName $name | Format-Table TaskName, State
}

# One install runs at a time. windows\update.ps1 and START.cmd hold this file
# open while they pull and install, and Windows closes it when the process ends.
# Returns $null when the file is busy and -Wait is off.
function Enter-InstallLock([switch]$Wait) {
	$path = Join-Path $HOME '.local-ci\install.lock'
	New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
	$told = $false
	while ($true) {
		try { return [IO.File]::Open($path, 'OpenOrCreate', 'ReadWrite', 'None') } catch { if (-not $Wait) { return $null } }
		if (-not $told) { Write-Host 'Another install is running, so this one waits for it.'; $told = $true }
		Start-Sleep -Seconds 5
	}
}
