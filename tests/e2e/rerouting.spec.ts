import { test, expect } from './fixtures';

// WebKit can bypass page.route after the production worker claims the page.
// Keep this changing-snapshot fixture isolated; public.spec.ts tests the real offline worker.
test.use({ serviceWorkers: 'block' });

test('navigation detours after a road closes and stops when all exits close', async ({
  page,
  context,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const state = window as unknown as {
      holdSnapshotCache: boolean;
      snapshotWritePending: boolean;
    };
    state.holdSnapshotCache = false;
    state.snapshotWritePending = false;
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof transaction>) {
      const tx = transaction.apply(this, args);
      if (
        args[1] === 'readwrite' &&
        tx.objectStoreNames.contains('snapshots') &&
        state.holdSnapshotCache
      ) {
        state.snapshotWritePending = true;
        const keepAlive = () => {
          if (!state.holdSnapshotCache) {
            state.snapshotWritePending = false;
            return;
          }
          tx.objectStore('snapshots').get('latest').onsuccess = keepAlive;
        };
        keepAlive();
      }
      return tx;
    };
    Object.defineProperty(window, 'routeAlertCount', { value: 0, writable: true });
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        const state = window as unknown as { routeAlertCount: number };
        state.routeAlertCount++;
        return true;
      },
    });
  });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 121.1114, latitude: 14.3124, accuracy: 10 });
  const a = [121.1114, 14.3124],
    b = [121.1154, 14.3124],
    c = [121.1114, 14.3164];
  let closed = 0;
  const road = (
    id: string,
    name: string,
    from: string,
    to: string,
    coordinates: number[][],
    blocked: boolean,
  ) => ({
    id,
    name,
    source: from,
    target: to,
    geometry: { type: 'LineString', coordinates },
    barangay: 'Test',
    base_cost: 0,
    condition: 0,
    blocked,
    oneway: false,
    access: { tags: { highway: 'residential' }, reversed: false },
  });
  await page.route('**/api/snapshot', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 2,
        demo: false,
        syncedAt: new Date().toISOString(),
        hazards: [],
        boundaries: [],
        roads: [
          road('direct', 'Direct Street', 'a', 'b', [a, b], closed > 0),
          road('side', 'Side Street', 'a', 'c', [a, c], closed > 1),
          road('return', 'Return Street', 'c', 'b', [c, b], false),
        ],
        shelters: [
          {
            id: 's',
            name: 'Test Shelter',
            barangay: 'Test',
            capacity: 100,
            occupancy: 0,
            status: 'open',
            accessible: true,
            amenities: [],
            geometry: { type: 'Point', coordinates: b },
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.location-field')).toContainText('Your current location');
  await page.getByRole('radio', { name: 'Car', exact: true }).check();
  await page
    .getByRole('button', { name: 'Find Shelter Now', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Open navigation view' }).click();
  await page.getByRole('button', { name: 'Enable sound and vibration' }).click();
  await expect(page.locator('.live-gps-marker')).toBeVisible();
  await expect(page.locator('.navigation-directions ol')).toContainText('Direct Street');
  await context.setGeolocation({ longitude: c[0], latitude: c[1], accuracy: 100 });
  await expect(page.locator('.live-navigation')).toContainText('GPS accuracy is low');
  await expect(page.locator('.navigation-directions ol')).toContainText('Direct Street');
  await context.setGeolocation({ longitude: c[0], latitude: c[1], accuracy: 10 });
  await expect(page.locator('.navigation-directions ol')).toContainText('Return Street');
  await expect(page.locator('.navigation-directions ol')).not.toContainText('Direct Street');
  await context.setGeolocation({ longitude: a[0], latitude: a[1], accuracy: 10 });
  await expect(page.locator('.navigation-directions ol')).toContainText('Direct Street');
  closed = 1;
  await page.evaluate(() => {
    (window as unknown as { holdSnapshotCache: boolean }).holdSnapshotCache = true;
  });
  const alertCount = await page.evaluate(
    () => (window as unknown as { routeAlertCount: number }).routeAlertCount,
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.navigation-directions ol')).toContainText('Side Street');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { routeAlertCount: number }).routeAlertCount),
    )
    .toBeGreaterThan(alertCount);
  await expect(
    page.locator('.navigation-directions [role="status"]').filter({ hasText: 'Route updated' }),
  ).toBeVisible();
  closed = 2;
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { snapshotWritePending: boolean }).snapshotWritePending,
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    (window as unknown as { holdSnapshotCache: boolean }).holdSnapshotCache = false;
  });
  await expect(page.locator('.navigation-view')).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'No suitable route is available now' }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});
