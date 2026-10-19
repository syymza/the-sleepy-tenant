const {test,expect}=require('@playwright/test');
const {openScene,scene,point,drag,waitForPlacement,parkMug,capture}=require('./helpers.cjs');
async function observe(page){
 await page.addInitScript(()=>{let C;window.__contacts=[];window.addEventListener('pointerdown',e=>window.__pointerId=e.pointerId,true);Object.defineProperty(window,'SleepySound',{get:()=>C,set:Base=>C=class extends Base{constructor(...a){super(...a);window.__sound=this;}place(surface,speed){const played=super.place(surface,speed);__contacts.push({surface,speed,played,lift:SleepyTenantPreview.getState().mug.lift});return played;}}});});
 await openScene(page);await page.getByRole('button',{name:'Enable sound',exact:true}).click();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
}
const contacts=page=>page.evaluate(()=>__contacts);
const clear=page=>page.evaluate(()=>__contacts=[]);

test('airborne cup stays quiet and each real landing uses its support surface',async({page},info)=>{
 await observe(page);await drag(page,await point(page,'mug'),15,0,12,25);await page.waitForTimeout(200);
 expect(await contacts(page)).toEqual([]);expect(await page.evaluate(()=>__sound.scrape)).toBe(null);
 await page.mouse.up();await waitForPlacement(page);let events=await contacts(page);
 expect(events).toHaveLength(1);expect(events[0]).toMatchObject({surface:'ceramic',played:true,lift:0});expect(events[0].speed).toBeGreaterThan(20);
 await page.waitForTimeout(700);expect(await contacts(page)).toHaveLength(1);
 await parkMug(page);expect(await contacts(page)).toHaveLength(1);expect(await page.evaluate(()=>__sound.scrape)).toBe(null);
 await page.mouse.up();await waitForPlacement(page);events=await contacts(page);
 expect(events).toHaveLength(2);expect(events[1]).toMatchObject({surface:'table',played:true,lift:0});await capture(page,info,'damped-table-contact');
});

test('saucer slides on the table, stops scraping at rest and has no release impact',async({page})=>{
 await observe(page);await parkMug(page);await page.mouse.up();await waitForPlacement(page);await clear(page);
 const parked=(await scene(page)).mug;
 for(const [dx,dy] of [[20,0],[0,-12]]){
  await drag(page,await point(page,'tray',-150,151),dx,dy,20,30);
  expect((await scene(page)).active.kind).toBe('tray');expect(await page.evaluate(()=>!!__sound.scrape)).toBe(true);
  await page.waitForTimeout(600);expect(await page.evaluate(()=>__sound.scrape)).toBe(null);await page.mouse.up();
  expect(await contacts(page)).toEqual([]);
 }
 const after=(await scene(page)).mug;expect(after.x).toBeCloseTo(parked.x,2);expect(after.y).toBeCloseTo(parked.y,2);
});

test('cancel, reset and pause do not manufacture placement impacts',async({page})=>{
 await observe(page);
 const lift=async()=>drag(page,await point(page,'mug'),15,0,12,25);
 await lift();await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>__pointerId)});await page.mouse.up();await waitForPlacement(page);
 expect(await contacts(page)).toEqual([]);expect(await page.evaluate(()=>({voices:__sound.voices.size,scrape:__sound.scrape}))).toEqual({voices:0,scrape:null});
 await lift();await page.keyboard.press('Home');await page.mouse.up();await waitForPlacement(page);expect(await contacts(page)).toEqual([]);
 await lift();await page.keyboard.press('Space');await page.mouse.up();expect((await scene(page)).paused).toBe(true);
 expect(await page.evaluate(()=>({voices:__sound.voices.size,scrape:__sound.scrape,purr:__sound.purring}))).toEqual({voices:0,scrape:null,purr:null});
 await page.getByRole('button',{name:'Resume',exact:true}).click();await waitForPlacement(page);expect(await contacts(page)).toEqual([]);
});

test('smaller real lift gives a gentler measured contact velocity',async({page})=>{
 const epoch=new Date('2026-01-01T00:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(+epoch+1000));await observe(page);await page.clock.runFor(100);
 for(const hold of [35,450]){
  const p=await point(page,'mug');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+12,p.y);await page.clock.runFor(hold);await page.mouse.up();await page.clock.runFor(800);await waitForPlacement(page);await page.waitForTimeout(250);
 }
 const events=await contacts(page);expect(events).toHaveLength(2);expect(events.every(e=>e.surface==='ceramic'&&e.played&&e.lift===0)).toBe(true);expect(events[0].speed).toBeLessThan(events[1].speed*.9);
});
