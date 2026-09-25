import { expect, test, chooseFixtureLocation, fixtureSnapshot } from './fixtures';
import { DEMO_ORIGIN } from '../../src/lib/constants';

test('requests current location on opening without pressing a location button', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    longitude: DEMO_ORIGIN[0],
    latitude: DEMO_ORIGIN[1],
    accuracy: 15,
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Your current location/ })).toBeVisible();
  await page.getByRole('button', { name: 'Find Shelter Now' }).filter({ visible: true }).click();
  await expect(page.getByRole('region', { name: 'Selected route' })).toBeVisible();
});

test('denied automatic location preserves a manual starting-point fallback', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) =>
          fail({ code: 1 }),
      },
    }),
  );
  await page.goto('/');
  await expect(
    page.getByText(
      'Location permission was denied or a position could not be found. Choose a point on the map.',
    ),
  ).toBeVisible();
  await chooseFixtureLocation(page);
  await expect(page.getByRole('button', { name: /Entered location/ })).toBeVisible();
});

test('a late GPS callback cannot overwrite a manually selected start', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (callback: unknown) => {
          (window as unknown as { finishLocation: unknown }).finishLocation = callback;
        },
      },
    });
  });
  await page.goto('/');
  await chooseFixtureLocation(page);
  await page.evaluate(() => {
    (window as unknown as { finishLocation: (position: unknown) => void }).finishLocation({
      coords: { longitude: 120, latitude: 13 },
    });
  });
  await expect(page.getByRole('button', { name: /Entered location/ })).toBeVisible();
});

test('hazard reports are street lines and named blocked streets are visible', async ({
  page,
  request,
}) => {
  const data = fixtureSnapshot;
  expect(data.schemaVersion).toBe(2);
  expect(
    data.hazards.every(
      (h: { road_id: string; geometry: { type: string } }) =>
        h.road_id && h.geometry.type === 'LineString',
    ),
  ).toBe(true);
  await page.goto('/');
  await expect(page.locator('.hazard-street')).toHaveCount(3);
  await expect(page.locator('.blocked-street')).toHaveCount(2);
  await page.getByRole('tab', { name: /Hazards/ }).click();
  await expect(page.getByRole('heading', { name: 'Tatlong Hari Street' })).toBeVisible();
  await expect(
    page.locator('.hazard-card').filter({ hasText: 'Tatlong Hari Street' }),
  ).toContainText('Blocked street');
  await page.getByRole('button', { name: 'flood', exact: true }).click();
  await expect(page.locator('.hazard-street')).toHaveCount(2);
});

test('CDRRMO preview selects a street instead of entering a polygon', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Street hazards', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare street report' }).click();
  await page.getByRole('searchbox', { name: 'Search street name' }).fill('Tatlong Hari Street');
  await page.locator('.street-picker-options input[type=checkbox]').first().check();
  await expect(page.getByRole('list', {name:'Selected streets'})).toContainText('Tatlong Hari Street');
  await expect(page.getByLabel('GeoJSON geometry (longitude, latitude)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Publish report' })).toBeDisabled();
});
