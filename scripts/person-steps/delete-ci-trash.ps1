# Deletes the _trash-* folders the runner hook left in C:\ci\<n>, when drive C fills up.
# Safe to run again: a folder already gone is skipped, and a locked one stays for a later job.
$ErrorActionPreference = 'Stop'
$root = 'C:\ci'
$before = [IO.DriveInfo]::new($root).AvailableFreeSpace / 1GB
$trash = @(Get-ChildItem -LiteralPath $root -Directory -Force |
	ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Directory -Force -Filter '_trash-*' -ErrorAction SilentlyContinue })
Write-Host ('{0} trash folders, {1:N1} GB free before' -f $trash.Count, $before)
$left = 0
foreach ($t in $trash) {
	cmd /c "rd /s /q `"\\?\$($t.FullName)`"" 2>$null
	if (Test-Path -LiteralPath $t.FullName) { $left++; Write-Host "left (locked): $($t.FullName)" }
	else { Write-Host "done: $($t.FullName)" }
}
$after = [IO.DriveInfo]::new($root).AvailableFreeSpace / 1GB
Write-Host ('{0} deleted, {1} left, {2:N1} GB free now' -f ($trash.Count - $left), $left, $after)
