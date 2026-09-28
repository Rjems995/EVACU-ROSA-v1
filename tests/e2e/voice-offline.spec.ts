import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';

test('GPS announces an upcoming turn and route download works without external assets', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 121.1114, latitude: 14.3124, accuracy: 10 });
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, 'voiceTest', { value: calls });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'en-PH' }],
        cancel: () => {},
        speak: (speech: { text: string }) => calls.push(speech.text),
      },
    });
  });
  const a = [121.1114, 14.3124],
    b = [121.1114, 14.3134],
    c = [121.1134, 14.3134];
  await page.route('**/api/snapshot', (r) =>
    r.fulfill({
      json: {
        schemaVersion: 2,
        demo: false,
        syncedAt: new Date().toISOString(),
        hazards: [],
        boundaries: [],
        roads: [
          {
            id: 'a',
            name: 'North Street',
            source: 'a',
            target: 'b',
            geometry: { type: 'LineString', coordinates: [a, b] },
          },
          {
            id: 'b',
            name: 'East Street',
            source: 'b',
            target: 'c',
            geometry: { type: 'LineString', coordinates: [b, c] },
          },
        ].map((r) => ({
          ...r,
          base_cost: 0,
          condition: 0,
          blocked: false,
          oneway: false,
          barangay: 'Test',
        })),
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
            geometry: { type: 'Point', coordinates: c },
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.location-field')).toContainText('Your current location');
  await page
    .getByRole('button', { name: 'Find Shelter Now', exact: true })
    .filter({ visible: true })
    .click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download offline route', exact: true }).click();
  const download = await downloadEvent;
  const html = await readFile((await download.path())!, 'utf8');
  expect(html).toContain('East Street');
  expect(html).toContain('Turn right');
  expect(html).not.toMatch(/<script|<img|<link/);
  await page.getByRole('button', { name: 'Open navigation view' }).click();
  await page.getByRole('button', { name: 'Enable turn-by-turn voice' }).click();
  await context.setGeolocation({ longitude: 121.1114, latitude: 14.3128, accuracy: 10 });
  const spoken = () =>
    page.evaluate(() => (window as unknown as { voiceTest: string[] }).voiceTest);
  await expect
    .poll(spoken)
    .toEqual(expect.arrayContaining([expect.stringContaining('Turn right onto East Street')]));
  const before = (await spoken()).length;
  await context.setGeolocation({ longitude: 121.1114, latitude: 14.31281, accuracy: 10 });
  await expect(page.locator('.live-navigation')).toContainText('Live GPS');
  expect((await spoken()).length).toBe(before);
  await page.getByRole('button', { name: 'Exit navigation', exact: true }).click();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.setContent(html);
  await expect(offline.getByRole('heading', { name: 'Test Shelter', exact: true })).toBeVisible();
  await expect(offline.getByText('Turn right onto East Street', { exact: false })).toBeVisible();
});
