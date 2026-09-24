import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('public light/dark and admin semantic and contrast checks', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Automated axe audit runs once on desktop Chromium.',
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try sample location' })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Use dark theme' }).click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        null,
        2,
      ),
    ).toEqual([]);
  }
  await page.goto('/admin');
  await expect(page.getByText('Read-only demonstration.', { exact: true })).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    result.violations,
    JSON.stringify(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
      null,
      2,
    ),
  ).toEqual([]);
});
