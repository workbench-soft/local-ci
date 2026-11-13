// Saves the README shots of the status page to docs/screenshots.
// demo/run.ts serves the page with the made up runs of demo/fake-github.ts first.
//   mise run demo
import { chromium, type Page } from 'playwright';

const site = process.env.DEMO_URL ?? 'http://127.0.0.1:4282/';
const out = process.env.DEMO_OUT ?? '../docs/screenshots';

async function shot(page: Page, name: string, url: string, scrollTo?: string, selector?: string) {
  await page.goto(url, { waitUntil: 'networkidle' });
  // The dev server puts its own badge in a corner.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  if (scrollTo) await page.getByRole('heading', { name: scrollTo }).evaluate((heading) => heading.scrollIntoView());
  if (selector)
    await page
      .locator(selector)
      .first()
      .evaluate((node) => {
        node.closest('li')?.scrollIntoView({ block: 'start' });
        // The headline and the tabs stay on top of the page.
        window.scrollBy(0, -150);
      });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'light' });
// Releases is the tab the page opens on; the status card sits one click away.
await shot(page, '01-status', `${site}?tab=status`);
await shot(page, '02-latest-runs', `${site}?tab=status`, 'Latest runs');
await shot(page, '03-releases', site);
// The errored and cancelled rows say what stopped them.
await shot(page, '04-release-reasons', site, undefined, '.stop-reason');
await browser.close();
