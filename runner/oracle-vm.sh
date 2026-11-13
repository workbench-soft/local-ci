#!/usr/bin/env bash
# Creates the Oracle Always Free ARM VM and makes it a runner of the org.
# Sydney rarely has free A1 hosts, so the launch retries until a slot comes up.
# Usage: ./runner/oracle-vm.sh [hours to keep trying, 72 by default]
set -uo pipefail

hours="${1:-72}"
here="$(cd "$(dirname "$0")" && pwd)"
export SUPPRESS_LABEL_WARNING=True OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING=True PYTHONWARNINGS=ignore
oci() { mise x -- oci "$@" 2> >(grep -v -E 'SyntaxWarning|REGEX|Warning:' >&2); }
log() { echo "[$(date '+%F %T')] $*"; }

tenancy=$(sed -n 's/^tenancy=//p' "$HOME/.oci/config")
name=ci-runner

find_vm() {
	oci compute instance list -c "$tenancy" --display-name "$name" --all \
		--query "data[?\"lifecycle-state\"!='TERMINATED'] | [0].id" --raw-output
}

vm=$(find_vm)
if [ -z "$vm" ] || [ "$vm" = "null" ]; then
	ad=$(oci iam availability-domain list -c "$tenancy" --query 'data[0].name' --raw-output)
	subnet=$(oci network subnet list -c "$tenancy" --all --display-name ci-subnet --query 'data[0].id' --raw-output)
	image=$(oci compute image list -c "$tenancy" --operating-system "Canonical Ubuntu" --operating-system-version 24.04 \
		--shape VM.Standard.A1.Flex --sort-by TIMECREATED --limit 1 --query 'data[0].id' --raw-output)
	deadline=$(($(date +%s) + hours * 3600))
	try=0
	# The smaller size gets a free host more often, so every other try asks for it.
	while [ -z "$vm" ] || [ "$vm" = "null" ]; do
		try=$((try + 1))
		if [ $((try % 2)) -eq 1 ]; then cfg='{"ocpus":4,"memoryInGBs":24}'; else cfg='{"ocpus":2,"memoryInGBs":12}'; fi
		out=$(oci compute instance launch -c "$tenancy" --availability-domain "$ad" --display-name "$name" \
			--shape VM.Standard.A1.Flex --shape-config "$cfg" --image-id "$image" --subnet-id "$subnet" \
			--assign-public-ip true --boot-volume-size-in-gbs 100 \
			--ssh-authorized-keys-file "$HOME/.ssh/id_ed25519.pub" \
			--query 'data.id' --raw-output 2>&1)
		case "$out" in
		ocid1.instance*) vm="$out" ;;
		*"Out of host capacity"* | *TooManyRequests* | *InternalError* | *timed\ out*)
			log "try $try ($cfg): no free host"
			[ "$(date +%s)" -lt "$deadline" ] || {
				log "gave up after $hours hours"
				exit 1
			}
			sleep 180
			;;
		*)
			log "launch failed: $out"
			exit 1
			;;
		esac
	done
	log "VM created: $vm"
fi

oci compute instance action --instance-id "$vm" --action START >/dev/null 2>&1 || true
oci compute instance get --instance-id "$vm" --wait-for-state RUNNING >/dev/null
ip=$(oci compute instance list-vnics --instance-id "$vm" --query 'data[0]."public-ip"' --raw-output)
log "VM is running at $ip"

# A fresh VM takes a minute or two before SSH answers.
for _ in $(seq 1 30); do
	ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "ubuntu@$ip" true 2>/dev/null && break
	sleep 10
done
"$here/oracle.sh" "ubuntu@$ip" 2 && log "Oracle runners are online"
