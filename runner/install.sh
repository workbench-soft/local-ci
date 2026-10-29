#!/usr/bin/env bash
# Registers this Mac as self-hosted GitHub Actions runners for the org and
# starts each under launchd. A runner takes one job at a time, so RUNNER_COUNT
# runners build that many jobs at once. Running it again leaves a registered
# runner as it is. runner/install.ps1 is the Windows version.
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

missing=()
for n in $(seq 1 "$count"); do
	if [ -f "$(runner_dir "$n")/.runner" ]; then
		step "The runner in $(runner_dir "$n") is already registered"
		(cd "$(runner_dir "$n")" && ./svc.sh status) || true
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
	if [ -n "${ANDROID_HOME:-}" ]; then
		printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$ANDROID_HOME" "$ANDROID_HOME" >>"$dir/.env"
	fi

	step "Starting $name"
	# launchd keeps the service up only while the user is logged in.
	(cd "$dir" && ./svc.sh install && ./svc.sh start && ./svc.sh status)
done
rm -rf "$download_dir"
