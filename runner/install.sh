#!/usr/bin/env bash
# Registers this Mac as a self-hosted GitHub Actions runner for the org and
# starts it under launchd. Safe to run again: a configured runner is left alone.
# runner/install.ps1 does the same on Windows.
set -euo pipefail

org="${RUNNER_ORG:-workbench-soft}"
dir="$HOME/actions-runner/$org"
labels="macOS,ARM64,android"
export GH_PAGER=cat

say() { printf '\n==> %s\n' "$*"; }

if [ -f "$dir/.runner" ]; then
	say "The runner in $dir is already registered"
	(cd "$dir" && ./svc.sh status) || true
	exit 0
fi

say "Finding the latest runner release"
release=$(gh api repos/actions/runner/releases/latest)
version=$(jq -r '.tag_name | ltrimstr("v")' <<<"$release")
# The release notes carry the hash of each file between BEGIN SHA and END SHA.
sha=$(jq -r .body <<<"$release" | sed -n 's/.*BEGIN SHA osx-arm64 -->\([0-9a-f]*\)<.*/\1/p')
file="actions-runner-osx-arm64-$version.tar.gz"

say "Downloading $file"
mkdir -p "$dir"
tmp=$(mktemp -d)
curl -fsSL -o "$tmp/$file" "https://github.com/actions/runner/releases/download/v$version/$file"
echo "$sha  $tmp/$file" | shasum -a 256 -c -
tar -xzf "$tmp/$file" -C "$dir"
rm -rf "$tmp"

# The API hands out a token only to an org admin with the admin:org scope.
token=$(gh api -X POST "orgs/$org/actions/runners/registration-token" --jq .token 2>/dev/null || true)
if [ -z "$token" ]; then
	echo "Copy the token from https://github.com/organizations/$org/settings/actions/runners/new?arch=arm64&os=osx"
	read -rsp "Registration token: " token
	echo
fi

say "Registering the runner"
name=$(scutil --get ComputerName | tr ' ' '-')
"$dir/config.sh" --unattended --url "https://github.com/$org" --token "$token" --name "$name" --labels "$labels"

if [ -n "${ANDROID_HOME:-}" ]; then
	printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$ANDROID_HOME" "$ANDROID_HOME" >>"$dir/.env"
fi

say "Starting the runner"
# launchd runs the service only while the user is logged in.
cd "$dir" && ./svc.sh install && ./svc.sh start && ./svc.sh status
