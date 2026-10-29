#!/usr/bin/env bash
# Registers this Mac as a self-hosted GitHub Actions runner for the org and
# starts it under launchd. Running it again leaves a registered runner as it is.
# runner/install.ps1 is the Windows version.
set -euo pipefail

org="${RUNNER_ORG:-workbench-soft}"
runner_dir="$HOME/actions-runner/$org"
# local marks the machine you develop on, Mac or Windows. Workflows ask for it.
labels="macOS,ARM64,android,local"
export GH_PAGER=cat

step() { printf '\n==> %s\n' "$*"; }

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

if [ -f "$runner_dir/.runner" ]; then
	step "The runner in $runner_dir is already registered"
	(cd "$runner_dir" && ./svc.sh status) || true
	exit 0
fi

step "Finding the latest runner release"
release=$(gh api repos/actions/runner/releases/latest)
version=$(jq -r '.tag_name | ltrimstr("v")' <<<"$release")
# The release notes list each file's hash between BEGIN SHA and END SHA.
expected_hash=$(jq -r .body <<<"$release" | sed -n 's/.*BEGIN SHA osx-arm64 -->\([0-9a-f]*\)<.*/\1/p')
file="actions-runner-osx-arm64-$version.tar.gz"

step "Downloading $file"
mkdir -p "$runner_dir"
download_dir=$(mktemp -d)
curl -fsSL -o "$download_dir/$file" "https://github.com/actions/runner/releases/download/v$version/$file"
echo "$expected_hash  $download_dir/$file" | shasum -a 256 -c -
tar -xzf "$download_dir/$file" -C "$runner_dir"
rm -rf "$download_dir"

token=$(registration_token)

step "Registering the runner"
name=$(scutil --get ComputerName | tr ' ' '-')
"$runner_dir/config.sh" --unattended --url "https://github.com/$org" --token "$token" --name "$name" --labels "$labels"

if [ -n "${ANDROID_HOME:-}" ]; then
	printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$ANDROID_HOME" "$ANDROID_HOME" >>"$runner_dir/.env"
fi

step "Starting the runner"
# launchd keeps the service up only while the user is logged in.
cd "$runner_dir" && ./svc.sh install && ./svc.sh start && ./svc.sh status
