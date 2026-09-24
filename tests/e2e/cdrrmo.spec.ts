import { test, expect } from '@playwright/test';

test('default public data has no fictional incidents or shelters', async ({ page, request }) => {
  const response = await request.get('/api/snapshot');
  const data = await response.json();
  expect(data.demo).toBe(false);
  expect(data.setupRequired).toBe(true);
  expect(data.hazards).toEqual([]);
  expect(data.shelters).toEqual([]);
  expect(data.roads.length).toBeGreaterThan(0);
  await page.goto('/');
  await expect(page.getByText('Demonstration only.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'CDRRMO panel' })).toBeVisible();
  await expect(page.locator('.pin-shelter')).toHaveCount(0);
});

test('CDRRMO can prepare all three report types with exact street selection', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'CDRRMO operations panel' })).toBeVisible();
  for (const [button, type] of [['Report flooding','flood'], ['Report fire','fire'], ['Report earthquake damage','earthquake']]) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByRole('combobox', {name:'Hazard type', exact: true})).toHaveValue(type);
    await page.getByRole('searchbox', {name:'Search street name'}).fill('Tatlong Hari Street');
    await page.getByRole('radio').first().check();
    await expect(page.locator('.selected-street')).toContainText('Tatlong Hari Street');
    await expect(page.getByRole('button', {name:'Publish report'})).toBeDisabled();
    await page.getByRole('button', {name:'Cancel', exact:true}).click();
  }
});
