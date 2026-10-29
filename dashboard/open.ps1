# Waits until the CI status page answers, then opens it in the default browser.
# install.ps1 runs it after the build, and a shortcut in the Startup folder runs
# it at each logon.
param([string]$Port = $(if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { '4280' }), [int]$TimeoutSeconds = 300)

$url = "http://localhost:$Port"
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
	# next start listens on 127.0.0.1 only. An error page still counts, so the person sees it.
	$client = [Net.Sockets.TcpClient]::new()
	try { $listening = $client.ConnectAsync('127.0.0.1', [int]$Port).Wait(2000) } catch { $listening = $false } finally { $client.Dispose() }
	if ($listening) {
		# explorer hands the link to the shell of the logged in user, so an elevated install still opens a normal browser.
		Start-Process explorer.exe $url
		exit 0
	}
	Start-Sleep -Seconds 3
}
Write-Host "The page at $url didn't answer within $TimeoutSeconds s. See dashboard.log."
exit 1
