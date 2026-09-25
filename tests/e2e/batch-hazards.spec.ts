import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('CDRRMO selects several streets, removes one, and publishes a single batch', async({page})=>{
  const snapshot=JSON.parse(readFileSync('src/data/santa-rosa-roads.json','utf8'));
  const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'test@example.invalid'};
  const expires=Math.floor(Date.now()/1000)+3600;
  const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:expires,role:'authenticated'})).toString('base64url')}.test-signature`;
  const env=readFileSync('.env.local','utf8');
  const url=env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1].trim();
  test.skip(!url,'This test mocks a configured Supabase browser session.');
  const key=`sb-${new URL(url!).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)), {key,session:{access_token:token,refresh_token:'test-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user}});
  // No mock credentials or reports reach Supabase.
  await page.route('https://*.supabase.co/**',route=>route.abort());
  await page.route('**/rest/v1/admin_accounts*',route=>route.fulfill({json:{role:'citywide',barangay:null}}));
  await page.route('**/api/snapshot',route=>route.fulfill({json:snapshot}));
  let batch:Record<string,unknown>|undefined;
  await page.route('**/api/admin/**',async route=>{
    if(route.request().method()==='POST') {batch=route.request().postDataJSON();await route.fulfill({status:201,json:[{id:'saved'}]});}
    else await route.fulfill({json:[]});
  });
  await page.goto('/admin');
  await page.getByRole('button',{name:'Report flooding'}).click();
  const search=page.getByRole('searchbox',{name:'Search street name'});
  await search.fill('Tatlong Hari Street');
  await page.locator('.street-picker-options input[type=checkbox]').nth(0).check();
  await page.locator('.street-picker-options input[type=checkbox]').nth(1).check();
  await search.fill('Rizal Boulevard');
  await page.locator('.street-picker-options input[type=checkbox]').first().check();
  await expect(page.getByText('3 / 100 streets selected',{exact:true})).toBeVisible();
  await page.getByRole('list',{name:'Selected streets'}).getByRole('button').first().click();
  await expect(page.getByText('2 / 100 streets selected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Publish report',exact:true}).click();
  await expect(page.getByText('2 street reports published. Public data will refresh within one minute.',{exact:true})).toBeVisible();
  expect(batch?.hazard_type).toBe('flood');
  expect(batch?.road_ids).toHaveLength(2);
  expect(batch).not.toHaveProperty('road_id');
});
