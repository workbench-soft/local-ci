# Helpers for runner\install.ps1 and dashboard\install.ps1, which both start a
# program at boot through a scheduled task. Dot-source this file.

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
