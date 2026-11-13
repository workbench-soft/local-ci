#!/usr/bin/env bash
# Makes an Oracle Always Free ARM VM a runner of the org, over SSH from this PC.
# The PC asks GitHub for the registration token, so the VM needs no GitHub login.
# Usage: ./runner/oracle.sh ubuntu@<vm address> [runner count, 2 by default]
set -euo pipefail

host="${1:?Usage: ./runner/oracle.sh ubuntu@<vm address> [runner count]}"
count="${2:-2}"
org="${RUNNER_ORG:-workbench-soft}"
export GH_PAGER=cat

if ! [[ "$count" =~ ^[1-9][0-9]*$ ]]; then
	echo "The runner count must be 1 or more" >&2
	exit 1
fi

token=$(gh api -X POST "orgs/$org/actions/runners/registration-token" --jq .token)
release=$(gh api repos/actions/runner/releases/latest)
version=$(jq -r .tag_name <<<"$release")
version="${version#v}"
# The release notes carry the SHA256 of each archive between BEGIN and END markers.
sha=$(jq -r .body <<<"$release" | sed -n 's/.*BEGIN SHA linux-arm64 -->\([0-9a-f]*\)<!-- END.*/\1/p')
if [ -z "$sha" ]; then
	echo "No SHA256 for the linux-arm64 runner in the $version release notes" >&2
	exit 1
fi

# The VM gets the arguments in order: org, token, version, sha, count.
ssh "$host" bash -s -- "$org" "$token" "$version" "$sha" "$count" <<'REMOTE'
set -euo pipefail
org="$1" token="$2" version="$3" sha="$4" count="$5"
archive="actions-runner-linux-arm64-$version.tar.gz"
# A fresh VM runs its first updates through cloud-init and holds the apt lock.
sudo cloud-init status --wait >/dev/null || true
sudo apt-get -o DPkg::Lock::Timeout=600 update -qq
sudo apt-get -o DPkg::Lock::Timeout=600 install -y -qq git curl jq unzip zip build-essential pkg-config libssl-dev >/dev/null
cd "$HOME"
if [ ! -f "$archive" ]; then
	curl -fsSL -o "$archive" "https://github.com/actions/runner/releases/download/v$version/$archive"
fi
echo "$sha  $archive" | sha256sum -c -
for n in $(seq 1 "$count"); do
	dir="$HOME/actions-runner/$org-$n"
	if [ -f "$dir/.runner" ]; then
		echo "oracle-$n is registered already"
		continue
	fi
	mkdir -p "$dir"
	tar -xzf "$HOME/$archive" -C "$dir"
	(cd "$dir" && ./config.sh --unattended --replace --url "https://github.com/$org" --token "$token" \
		--name "oracle-$n" --labels oracle,cloud --work _work)
	(cd "$dir" && sudo ./svc.sh install "$USER" && sudo ./svc.sh start)
done
echo "Oracle runners ready: $count"
REMOTE
