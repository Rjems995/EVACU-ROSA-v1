import { test, expect, chooseFixtureLocation, fixtureSnapshot } from './fixtures';
test.use({ serviceWorkers: 'block' });
test('Filipino controls preserve the route and persist after reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await chooseFixtureLocation(page);
  await page.getByRole('button', { name: 'Find Shelter Now' }).filter({ visible: true }).click();
  await expect(page.locator('.route-summary')).toBeVisible();
  const destination = await page.locator('.route-summary h3').textContent();
  await page.getByRole('combobox', { name: 'Language / Wika' }).selectOption('fil');
  await expect(page.getByRole('heading', { name: 'Nasaan ka ngayon?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.locator('.route-summary h3')).toHaveText(destination!);
  await page.getByRole('button', { name: 'Buksan ang gabay sa mapa', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mga kalsada papunta sa masisilungan' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Isara ang gabay sa ruta' }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('combobox', { name: 'Language / Wika' })).toHaveValue('fil');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
  await expect(
    page.getByRole('button', { name: 'Humanap ng masisilungan' }).filter({ visible: true }),
  ).toBeVisible();
});
test('shows supply uncertainty, staff updates and paused shelter status', async ({ page }) => {
  await page.route('**/api/snapshot', (route) =>
    route.fulfill({
      json: {
        ...fixtureSnapshot,
        shelters: [
          {
            ...fixtureSnapshot.shelters[0],
            status: 'paused',
            water_status: 'low',
            food_status: 'unknown',
            medical_status: 'adequate',
            entrance_verified: true,
            operational_notes: 'Water delivery pending',
            updated_at: '2020-01-01T00:00:00Z',
          },
        ],
      },
    }),
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Not accepting', { exact: true })).toBeVisible();
  await page.getByText('Facilities and access', { exact: true }).click();
  await expect(page.getByText('Water delivery pending', { exact: true })).toBeVisible();
  await expect(page.getByText('Entrance checked by staff', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Shelter information is over 24 hours old. Confirm with staff.', {
      exact: true,
    }),
  ).toBeVisible();
  await chooseFixtureLocation(page);
  await page.getByRole('button', { name: 'Find Shelter Now' }).filter({ visible: true }).click();
  await expect(page.locator('.route-summary')).toHaveCount(0);
});
