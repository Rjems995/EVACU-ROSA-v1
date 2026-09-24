import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../../src/lib/types';
import { DEMO_ORIGIN } from '../../src/lib/constants';

// Fictional data is injected only into browser tests, never served by the app.
export const fixtureSnapshot: Snapshot = { ...JSON.parse(readFileSync('src/data/santa-rosa-roads.json', 'utf8')), demo: false, setupRequired: false };
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/snapshot', async route => {
      try {
        const response = await route.fetch();
        await route.fulfill({ response, json: fixtureSnapshot });
      } catch { await route.abort(); }
    });
    await use(page);
  },
});
export { expect };
export async function chooseFixtureLocation(page: Page) {
  const details = page.locator('.coordinate-entry');
  if (!await details.evaluate(element => (element as HTMLDetailsElement).open))
    await details.locator('summary').click();
  await page.getByRole('spinbutton', {name: 'Latitude'}).fill(String(DEMO_ORIGIN[1]));
  await page.getByRole('spinbutton', {name: 'Longitude'}).fill(String(DEMO_ORIGIN[0]));
  await page.getByRole('button', {name: 'Use this starting point'}).click();
}
