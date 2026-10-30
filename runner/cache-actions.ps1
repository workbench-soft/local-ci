# Fills the action cache the runners read, one zip per action and commit.
# The runner looks for <cache>\<owner>_<repo>\<sha>.zip and copies it in place of a download
# from codeload.github.com, which throttled 8 runners down to 10 KB/s. The runner never writes
# the cache, so this script does. runner\install.ps1 runs it, and it is safe to run again after
# a workflow pins a new action version.
# The actions come from the uses: lines of the workflows under DEV_DIR and from the runner logs.
$ErrorActionPreference = 'Stop'
# Windows PowerShell redraws a progress bar per chunk, which made a 2 MB zip take 6.6 s in place of 0.65 s.
$ProgressPreference = 'SilentlyContinue'

$devDir = if ($env:DEV_DIR) { $env:DEV_DIR } else { 'C:\Programming\WorkbenchSoft' }
$cache = if ($env:RUNNER_ACTION_CACHE) { $env:RUNNER_ACTION_CACHE } else { Join-Path $HOME 'actions-runner\_actions-cache' }
$env:GH_PAGER = 'cat'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$token = gh auth token
if (-not $token) { throw 'gh is not logged in. Run gh auth login first.' }
$headers = @{ Authorization = "token $token"; 'User-Agent' = 'local-ci' }

# A uses: line names owner/repo, maybe a folder inside it, then @ref. A local workflow (./...) has no @.
$wanted = @{}
Get-ChildItem -Directory -LiteralPath $devDir -ErrorAction SilentlyContinue | ForEach-Object {
	Get-ChildItem -Path (Join-Path $_.FullName '.github\workflows') -Filter *.yml -ErrorAction SilentlyContinue
} | Select-String -Pattern '^\s*-?\s*uses:\s*([\w.-]+/[\w.-]+)(/[\w./-]+)?@(\S+)' | ForEach-Object {
	$m = $_.Matches[0]
	$wanted["$($m.Groups[1].Value)@$($m.Groups[3].Value)"] = $true
}
# The runners log each action they looked for, already resolved to its commit.
# Only _diag of each runner holds them. A walk of the whole folder also crosses _tool and took 200 s.
Get-ChildItem -Path (Join-Path $HOME 'actions-runner\*\_diag\Worker_*.log') -ErrorAction SilentlyContinue |
	Select-String -Pattern "Check if action archive '([\w.-]+/[\w.-]+)@([0-9a-f]{40})'" | ForEach-Object {
		$m = $_.Matches[0]
		$wanted["$($m.Groups[1].Value)@$($m.Groups[2].Value)"] = $true
	}

$done = 0
foreach ($entry in $wanted.Keys | Sort-Object) {
	$repo, $ref = $entry -split '@', 2
	# A tag or a branch resolves to the commit the runner asks for.
	$sha = if ($ref -match '^[0-9a-f]{40}$') { $ref } else {
		try { gh api "repos/$repo/commits/$ref" --jq .sha 2>$null } catch { $null }
	}
	if (-not $sha) { Write-Host "Skipping $entry, no commit found"; continue }
	$dir = Join-Path $cache ($repo -replace '/', '_')
	$file = Join-Path $dir "$sha.zip"
	if (Test-Path -LiteralPath $file) { continue }
	New-Item -ItemType Directory -Force -Path $dir | Out-Null
	Write-Host "Downloading $repo@$ref ($sha)"
	$tmp = "$file.tmp"
	try {
		Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri "https://api.github.com/repos/$repo/zipball/$sha" -OutFile $tmp -TimeoutSec 600
		Move-Item -LiteralPath $tmp -Destination $file -Force
		$done++
	} catch {
		Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
		Write-Host "Could not download ${repo}@${ref}: $($_.Exception.Message)"
	}
}
Write-Host "Action cache $cache holds $((Get-ChildItem -Path $cache -Recurse -Filter *.zip).Count) zips, $done new"
