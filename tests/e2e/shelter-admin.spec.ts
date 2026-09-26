import { test, expect } from '@playwright/test';

test('staff publishes shelter supplies and moving the entrance clears verification', async ({
  page,
}) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  test.skip(!url, 'Requires the CI fake-project build; all requests are mocked.');
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.invalid',
  };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires, role: 'authenticated' })).toString('base64url')}.test-signature`;
  const key = `sb-${new URL(url!).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key,
      session: {
        access_token: token,
        refresh_token: 'test-refresh',
        expires_at: expires,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      },
    },
  );
  await page.route('https://*.supabase.co/**', (route) => route.abort());
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/rest/v1/admin_accounts*', (route) =>
    route.fulfill({ json: { role: 'barangay', barangay: 'Tagapo' } }),
  );
  await page.route('**/api/snapshot', (route) =>
    route.fulfill({ json: { roads: [], hazards: [], shelters: [], boundaries: [] } }),
  );
  let saved: Record<string, unknown> | undefined;
  const shelter = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Test shelter',
    barangay: 'Tagapo',
    capacity: 100,
    occupancy: 20,
    status: 'open',
    accessible: true,
    amenities: [],
    geom: { type: 'Point', coordinates: [121.109, 14.297] },
    entrance_verified: true,
    water_status: 'adequate',
    food_status: 'unknown',
    medical_status: 'unknown',
    operational_notes: '',
  };
  await page.route('**/api/admin/**', async (route) => {
    if (route.request().method() === 'PATCH') {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { ...shelter, ...saved } });
    } else
      await route.fulfill({
        json: route.request().url().includes('/evacuation_centers') ? [shelter] : [],
      });
  });
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Shelters', exact: true }).click();
  await page.getByRole('button', { name: 'Edit record', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Current occupancy' }).fill('90');
  await page.getByRole('combobox', { name: 'Shelter status' }).selectOption('paused');
  await page.getByRole('combobox', { name: 'Drinking water supplies' }).selectOption('low');
  await page
    .getByRole('textbox', { name: 'Public shelter update (optional)' })
    .fill('Water delivery pending');
  await page.getByRole('button', { name: 'Use map center as shelter location' }).click();
  await expect(
    page.getByRole('combobox', { name: 'Entrance pin checked in person by staff' }),
  ).toHaveValue('false');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByText('Record saved. Public data will refresh within one minute.', { exact: true }),
  ).toBeVisible();
  expect(saved).toMatchObject({
    occupancy: 90,
    status: 'paused',
    water_status: 'low',
    entrance_verified: false,
    operational_notes: 'Water delivery pending',
    barangay: 'Tagapo',
  });
});
