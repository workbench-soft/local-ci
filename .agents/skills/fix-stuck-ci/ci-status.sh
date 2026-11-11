#!/bin/sh
# Prints the org's runners, then each run that waits or runs, across every repo.
#   sh .agents/skills/fix-stuck-ci/ci-status.sh [org]
set -eu
org=${1:-workbench-soft}
export GH_PAGER=cat

echo "Runners:"
gh api "orgs/$org/actions/runners" --jq '.runners[] | "  \(.name)  \(.status)\(if .busy then ", busy" else "" end)  [\([.labels[].name] | join(","))]"' \
  || echo "  (needs gh with the admin:org scope: gh auth refresh -s admin:org)"

echo "Runs waiting or running:"
for repo in $(gh repo list "$org" --no-archived --limit 100 --json name --jq '.[].name'); do
  gh run list -R "$org/$repo" --limit 20 --json status,workflowName,headBranch,createdAt,url \
    --jq ".[] | select(.status != \"completed\") | \"  $repo  \(.status)  \(.workflowName)  \(.headBranch)  \(.createdAt)  \(.url)\""
done
