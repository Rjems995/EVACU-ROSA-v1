import { expect, test, chooseFixtureLocation } from './fixtures';

test('shelter navigation shows the route and blocked streets, then exits', async ({ page }) => {
  await page.goto('/');
  await chooseFixtureLocation(page);
  await page.getByRole('button', { name: 'Find Shelter Now' }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'flood', exact: true }).click();
  await page.getByRole('button', { name: 'Open navigation view' }).click();
  await expect(page.locator('.navigation-view')).toBeVisible();
  await expect(page.locator('.evacuation-route')).toHaveAttribute('stroke', '#1265dd');
  await expect(page.locator('.blocked-street')).toHaveCount(2);
  await expect(page.locator('.navigation-blocked')).toContainText('Tatlong Hari Street');
  await expect(page.locator('.navigation-blocked')).toContainText('Rizal Boulevard');
  await expect(page.getByRole('heading', { name: 'Streets to the shelter' })).toBeVisible();
  await page.getByRole('button', { name: 'Show entire route' }).click();
  const map = await page.locator('.map-stage').boundingBox();
  expect(map!.height).toBeGreaterThan(190);
  await page.getByRole('button', { name: 'Exit navigation' }).click();
  await expect(page.locator('.navigation-view')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open navigation view' })).toBeFocused();
});

test('outside coverage origins do not create misleading Santa Rosa routes', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Enter a location by coordinates', { exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Latitude' }).fill('15');
  await page.getByRole('spinbutton', { name: 'Longitude' }).fill('120');
  await page.getByRole('button', { name: 'Use this starting point' }).click();
  await page.getByRole('button', { name: 'Find Shelter Now' }).filter({ visible: true }).click();
  await expect(page.locator('.notice')).toContainText('outside the loaded Santa Rosa road coverage');
  await expect(page.getByRole('button', { name: 'Open navigation view' })).toHaveCount(0);
});
