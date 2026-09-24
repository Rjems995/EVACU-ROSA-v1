import { expect, test } from '@playwright/test';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

async function outageProxy() {
  const server = createServer((incoming, outgoing) => {
    const upstream = httpRequest(
      `http://127.0.0.1:3000${incoming.url}`,
      { method: incoming.method, headers: incoming.headers },
      (response) => {
        outgoing.writeHead(response.statusCode || 502, response.headers);
        response.pipe(outgoing);
      },
    );
    upstream.on('error', () => outgoing.destroy());
    incoming.pipe(upstream);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  let closed = false;
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    stop: async () => {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
test('public route flow, filters, theme and responsive layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demonstration only.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try sample location' }).click();
  await page.getByRole('button', { name: 'Find Shelter Now' }).filter({ visible: true }).click();
  await expect(page.getByRole('region', { name: 'Selected route' })).toBeVisible();
  await expect(page.getByText('SAMPLE ROUTE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('tab', { name: /Hazards/ }).click();
  await expect(page.getByText('Hidden map layers still affect routing.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('cached snapshot survives offline reload', async ({ page, context, browserName }) => {
  // WebKit offline emulation rejects even literal service-worker responses:
  // https://github.com/microsoft/playwright/issues/42775
  // A real origin outage verifies the same cache fallback without hiding a reload failure.
  const proxy = browserName === 'webkit' ? await outageProxy() : null;
  try {
    await page.goto(proxy ? proxy.url : '/');
    await expect(page.getByRole('button', { name: 'Try sample location' })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      await new Promise<void>((resolve) => {
        if (navigator.serviceWorker.controller) resolve();
        else
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          });
      });
    });
    await page.waitForFunction(
      async () =>
        new Promise<boolean>((resolve) => {
          const r = indexedDB.open('evacu-rosa', 1);
          r.onsuccess = () => {
            const db = r.result;
            const get = db.transaction('snapshots').objectStore('snapshots').get('latest');
            get.onsuccess = () => {
              resolve(Boolean(get.result));
              db.close();
            };
          };
          r.onerror = () => resolve(false);
        }),
    );
    if (proxy) await proxy.stop();
    else await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByText(proxy ? 'Live updates unavailable.' : 'You’re offline.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Try sample location' }).click();
    await page.getByRole('button', { name: 'Find Shelter Now' }).filter({ visible: true }).click();
    await expect(page.getByRole('region', { name: 'Selected route' })).toBeVisible();
  } finally {
    await proxy?.stop();
  }
});
test('admin demo is read only and unauthenticated writes are rejected', async ({
  page,
  request,
}) => {
  await page.goto('/admin');
  await expect(page.getByText('Read-only demonstration.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add record' })).toHaveCount(0);
  const response = await request.post('/api/admin/evacuation_centers', { data: {} });
  expect([401, 503]).toContain(response.status());
});
