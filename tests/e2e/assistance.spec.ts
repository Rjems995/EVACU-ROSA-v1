import {test,expect,chooseFixtureLocation,fixtureSnapshot} from './fixtures';
// Service-worker-controlled requests can bypass Playwright route mocks in WebKit.
// Offline/service-worker behavior is covered separately in public.spec.ts.
test.use({serviceWorkers:'block'});
test.beforeEach(async({page})=>{
  await page.route('**/api/snapshot', route=>route.fulfill({json:{...fixtureSnapshot,shelters:fixtureSnapshot.shelters.map(s=>({...s,status:'closed'}))}}));
});
test('automatically sends once after opt-in and no suitable route',async({page})=>{
  const requests:Record<string,unknown>[]=[];
  await page.route('**/api/assistance',async route=>{
    const data=route.request().postDataJSON();requests.push(data);
    await route.fulfill({json:{id:data.id,received:true}});
  });
  await page.goto('/');await chooseFixtureLocation(page);
  await page.getByRole('checkbox',{name:/Automatically notify CDRRMO/}).check();
  expect(requests).toHaveLength(0);
  await page.getByRole('button',{name:'Find Shelter Now'}).filter({visible:true}).click();
  await expect(page.getByRole('button',{name:'Request received',exact:true})).toBeDisabled();
  expect(requests).toHaveLength(1);
  expect(requests[0].consent).toBe(true);
  expect(requests[0].source).toBe('selected');
  await page.getByRole('button',{name:'Find Shelter Now'}).filter({visible:true}).click();
  expect(requests).toHaveLength(1);
});
test('requires consent and retries failed delivery with the same ID',async({page})=>{
  const requests:Record<string,unknown>[]=[];
  await page.route('**/api/assistance',async route=>{
    const data=route.request().postDataJSON();requests.push(data);
    await route.fulfill(requests.length===1?{status:503,json:{error:'Delivery could not be confirmed.'}}:{json:{id:data.id,received:true}});
  });
  await page.goto('/');await chooseFixtureLocation(page);
  await page.getByRole('button',{name:'Find Shelter Now'}).filter({visible:true}).click();
  await expect(page.getByRole('button',{name:'Share location and notify CDRRMO'})).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole('button',{name:'Share location and notify CDRRMO'}).click();
  await page.getByRole('button',{name:'Retry assistance request'}).click();
  await expect(page.getByRole('button',{name:'Request received',exact:true})).toBeDisabled();
  expect(requests).toHaveLength(2);
  expect(requests[0].id).toBe(requests[1].id);
});
