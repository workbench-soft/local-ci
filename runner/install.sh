#!/usr/bin/env bash
# Registers this Mac as self-hosted GitHub Actions runners for the org and
# starts each under launchd. A runner takes one job at a time, so RUNNER_COUNT
# runners build that many jobs at once. Running it again keeps the registrations
# and only rewrites the job variables. runner/install.ps1 is the Windows version.
set -euo pipefail

org="${RUNNER_ORG:-workbench-soft}"
count="${RUNNER_COUNT:-1}"
# local marks the machine you develop on, Mac or Windows. Workflows ask for it.
labels="macOS,ARM64,android,local"
export GH_PAGER=cat

step() { printf '\n==> %s\n' "$*"; }

if ! [[ "$count" =~ ^[1-9][0-9]*$ ]]; then
	echo "RUNNER_COUNT must be 1 or more" >&2
	exit 1
fi

# The first runner keeps the folder and name it had before runners got numbers.
suffix() { if [ "$1" -eq 1 ]; then printf ''; else printf -- '-%s' "$1"; fi; }
runner_dir() { printf '%s' "$HOME/actions-runner/$org$(suffix "$1")"; }
# The setup-* actions then download a tool once for every runner, not once per runner.
tool_cache="$HOME/actions-runner/_tool"

# config.sh writes .env with LANG and the like. This keeps those lines and
# rewrites the ones the script owns. Prints changed when the file changed.
write_env() {
	local file="$1/.env" before after
	before=$(cat "$file" 2>/dev/null || true)
	after=$(
		printf '%s\n' "$before" | grep -vE '^(ANDROID_HOME|ANDROID_SDK_ROOT|RUNNER_TOOL_CACHE|AGENT_TOOLSDIRECTORY)=|^$' || true
		printf 'RUNNER_TOOL_CACHE=%s\nAGENT_TOOLSDIRECTORY=%s\n' "$tool_cache" "$tool_cache"
		if [ -n "${ANDROID_HOME:-}" ]; then
			printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$ANDROID_HOME" "$ANDROID_HOME"
		fi
	)
	if [ "$before" != "$after" ]; then
		printf '%s\n' "$after" >"$file"
		echo changed
	fi
}

# The runner reads .env at start. A restart would kill the job it builds now.
restart_when_idle() {
	if pgrep -f "$1/bin/Runner.Worker" >/dev/null; then
		echo "The runner in $1 is running a job, waiting for it to finish"
	fi
	while pgrep -f "$1/bin/Runner.Worker" >/dev/null; do sleep 10; done
	(cd "$1" && ./svc.sh stop && ./svc.sh start)
}

# GitHub hands out a token only to an org admin whose login has the admin:org scope.
registration_token() {
	local token
	token=$(gh api -X POST "orgs/$org/actions/runners/registration-token" --jq .token 2>/dev/null || true)
	if [ -z "$token" ]; then
		echo "Copy the token from https://github.com/organizations/$org/settings/actions/runners/new?arch=arm64&os=osx" >&2
		read -rsp "Registration token: " token
		echo >&2
	fi
	printf '%s' "$token"
}

mkdir -p "$tool_cache"
missing=()
for n in $(seq 1 "$count"); do
	dir=$(runner_dir "$n")
	if [ -f "$dir/.runner" ]; then
		step "The runner in $dir is already registered"
		if [ -n "$(write_env "$dir")" ]; then
			step "Restarting the runner in $dir with the new job variables"
			restart_when_idle "$dir"
		fi
		(cd "$dir" && ./svc.sh status) || true
	else
		missing+=("$n")
	fi
done
[ ${#missing[@]} -eq 0 ] && exit 0

step "Finding the latest runner release"
release=$(gh api repos/actions/runner/releases/latest)
version=$(jq -r '.tag_name | ltrimstr("v")' <<<"$release")
# The release notes list each file's hash between BEGIN SHA and END SHA.
expected_hash=$(jq -r .body <<<"$release" | sed -n 's/.*BEGIN SHA osx-arm64 -->\([0-9a-f]*\)<.*/\1/p')
file="actions-runner-osx-arm64-$version.tar.gz"

step "Downloading $file"
download_dir=$(mktemp -d)
curl -fsSL -o "$download_dir/$file" "https://github.com/actions/runner/releases/download/v$version/$file"
echo "$expected_hash  $download_dir/$file" | shasum -a 256 -c -

# One token registers every runner within its hour.
token=$(registration_token)
machine=$(scutil --get ComputerName | tr ' ' '-')

for n in "${missing[@]}"; do
	dir=$(runner_dir "$n")
	name="$machine$(suffix "$n")"
	step "Registering $name in $dir"
	mkdir -p "$dir"
	tar -xzf "$download_dir/$file" -C "$dir"
	"$dir/config.sh" --unattended --url "https://github.com/$org" --token "$token" --name "$name" --labels "$labels"
	write_env "$dir" >/dev/null

	step "Starting $name"
	# launchd keeps the service up only while the user is logged in.
	(cd "$dir" && ./svc.sh install && ./svc.sh start && ./svc.sh status)
done
rm -rf "$download_dir"
