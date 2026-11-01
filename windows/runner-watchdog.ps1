# Finds the runners GitHub shows offline while their task runs, and restarts
# them. On 2026-11-01 starved listeners stayed offline for 12 hours with their
# tasks Running, and START.cmd skips a task that runs. windows\update.ps1 and
# windows\start.ps1 dot-source this file.

# A listener on a busy PC can take minutes to come online after a start.
$runnerGraceMinutes = 10

# Returns the runner tasks that run, started over 10 minutes ago, and whose
# runner GitHub shows offline. Without an answer from gh it returns none.
function Get-HungRunnerTasks {
	$org = if ($env:RUNNER_ORG) { $env:RUNNER_ORG } else { 'workbench-soft' }
	# Windows PowerShell splits an argument at a double quote, so the filter holds none.
	$runners = try { gh api "orgs/$org/actions/runners" --paginate --jq '.runners[] | {name, status}' 2>$null | ConvertFrom-Json } catch { $null }
	$offline = @($runners | Where-Object status -eq 'offline' | ForEach-Object name)
	$since = (Get-Date).AddMinutes(-$runnerGraceMinutes)
	Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "GitHub Actions runner ($org*" -and $_.State -eq 'Running' } | Where-Object {
		$file = Join-Path $_.Actions[0].WorkingDirectory '.runner'
		if (-not (Test-Path -LiteralPath $file)) { return $false }
		$name = (Get-Content -Raw -LiteralPath $file | ConvertFrom-Json).agentName
		$offline -contains $name -and ($_ | Get-ScheduledTaskInfo).LastRunTime -lt $since
	}
}

# Stopping the task leaves its listener running, so the listener goes by its
# path. Reading the path of a listener takes admin rights.
function Restart-RunnerTask($task) {
	$dir = $task.Actions[0].WorkingDirectory
	Stop-ScheduledTask -TaskName $task.TaskName
	Get-Process Runner.Listener, Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$dir\*" } | Stop-Process -Force
	Start-ScheduledTask -TaskName $task.TaskName
}
