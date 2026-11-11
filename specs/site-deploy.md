# Site deploy

## One-pager

- **Problem** each org repo with a site deploys it its own way, and a person had to open GitHub to deploy one again.
- **Fix** a Sites card on the Releases tab lists each repo with a site and gives it a Deploy site button.
- **How** the page finds the workflow that deploys the site and dispatches it on `main`, as Release on CI does.
- **Risks** a repo whose deploy sits in no dispatchable workflow doesn't show. A deploy that also releases, such as `release.yml`, makes a release too.

## What it does for the person

The Releases tab shows a Sites card. Each row is a repo with a site, its last
deploy run with its state and age, and a **Deploy site** button. The button
starts the deploy workflow on `main`, on the org runners, with the secrets the
workflow already has.

## User flows

1. The person opens the Releases tab.
2. The Sites card lists each repo with a site and its last deploy.
3. The person presses **Deploy site** on a row.
4. The page dispatches the workflow on `main` and says "Deploy queued on CI".
   The button stays gray while a run of that workflow is queued or running.
5. The row shows the new run once GitHub lists it.

## How it works: modules, files, data

- **`dashboard/status/site-deploy.ts`** lists the org repos, reads each repo's
  workflows and their YAML once an hour, and picks the site deploy workflow.
- **Which workflow** an active workflow with `workflow_dispatch` whose YAML
  deploys: `wrangler deploy`, `wrangler pages deploy`, `actions/deploy-pages`,
  `mise run deploy`, `deploy-site`, `deploy-web` or a push to a `-site` repo.
  A file named `deploy-web`, `deploy-site` or `deploy` wins, then `pages`,
  then `release`, then any other. Two at the same rank pick the first by name.
- **`dashboard/status/site-actions.ts`** the server action. It finds the
  workflow itself, so the page can only start a site deploy of an org repo,
  refuses while a run of it is unfinished, and dispatches on `main`.
- **`dashboard/cards/sites-card.tsx`** the card and its buttons.
- **Last run** comes from the runs the page already reads, by repo and
  workflow name.

## Limits

- A deploy kept only in a mise task with no workflow doesn't show.
- A workflow with a required input and no default fails to dispatch, and the
  row shows GitHub's error.
- The lookup costs about one GitHub call per workflow an hour.

## Changes

### 2026-11-12 Deploy site button for every app with a site

- **Why** the person asked for a button in local CI that deploys the site of
  every app that has one.
- **Changes** `site-deploy.ts` finds the workflows, `site-actions.ts`
  dispatches one, `sites-card.tsx` shows the card, `page.tsx` adds it to the
  Releases tab. `release-workflow.ts` shares its cached workflow and YAML
  reads.
- **Steps** this spec, then the code and tests, then the docs.
- **Docs** `docs/features.md`, `docs/user-flows.md`, `README.md`,
  `CHANGELOG.md`.
