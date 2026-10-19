const {test,expect}=require('@playwright/test');
const {openScene,scene,point,drag,waitForPlacement,parkMug,capture}=require('./helpers.cjs');

test('painted objects have honest hit targets and cursors',async({page})=>{
 await openScene(page);
 for(const [kind,x,y,cursor]of[['mug',0,65,'grab'],['mug',175,40,'grab'],['mug',140,40,'default'],['pet',0,0,'pointer'],['tray',205,205,'default'],['mug',-230,-80,'default']]){
  const p=await point(page,kind,x,y);await page.mouse.move(p.x,p.y);
  await expect(page.locator('canvas')).toHaveCSS('cursor',cursor);
 }
 const handle=await point(page,'mug',175,40);await drag(page,handle,-15,0,8,30);
 await expect.poll(async()=>(await scene(page)).mug.lift).toBeGreaterThan(10);
 expect((await scene(page)).active.kind).toBe('mug');await expect(page.locator('canvas')).toHaveCSS('cursor','grabbing');await page.mouse.up();await waitForPlacement(page);
});

test('mug lifts independently and settles on the table',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await openScene(page);
 const {initial}=await parkMug(page);let s=await scene(page);
 expect(s.mug.seated).toBe(false);expect(s.mug.lift).toBeGreaterThan(10);
 expect(s.saucer.x).toBeCloseTo(initial.saucer.x,2);expect(s.saucer.y).toBeCloseTo(initial.saucer.y,2);
 await capture(page,info,'mug-held');await page.mouse.up();await waitForPlacement(page);s=await scene(page);
 expect(s.mug.seated).toBe(false);expect(Math.abs(s.mug.tilt)).toBeLessThan(.01);
 await capture(page,info,'mug-on-table');expect(errors).toEqual([]);
});

test('empty saucer moves alone, nearby mug docks, seated pair travels together',async({page},info)=>{
 await openScene(page);await parkMug(page);await page.mouse.up();await waitForPlacement(page);
 let s=await scene(page);const parked={...s.mug},dx=s.camera.w>=900?90:20;
 await drag(page,await point(page,'tray',-150,151),dx*s.camera.scale);await page.mouse.up();await page.waitForTimeout(350);s=await scene(page);
 expect(s.mug.x).toBeCloseTo(parked.x,1);expect(s.mug.y).toBeCloseTo(parked.y,1);expect(s.saucer.x).toBeGreaterThan(dx-2);
 await capture(page,info,'separate-objects');
 const target={x:s.saucer.x+8,y:s.saucer.y+4};await drag(page,await point(page,'mug'),(target.x-s.mug.x)*s.camera.scale,(target.y-s.mug.y)*s.camera.scale,55,25);await page.mouse.up();await waitForPlacement(page);s=await scene(page);
 expect(s.mug.seated).toBe(true);expect(s.mug.x).toBeCloseTo(s.saucer.x,2);expect(s.mug.y).toBeCloseTo(s.saucer.y,2);await capture(page,info,'docked');
 const before=s.saucer.x;await drag(page,await point(page,'tray',-150,151),-15*s.camera.scale);await page.mouse.up();await page.waitForTimeout(350);s=await scene(page);
 expect(s.saucer.x).toBeLessThan(before-10);expect(s.mug.seated).toBe(true);expect(s.mug.x).toBeCloseTo(s.saucer.x,2);expect(s.mug.y).toBeCloseTo(s.saucer.y,2);
});

test('slow stroke soothes, quick poke ducks, and the resident stays in its cup',async({page},info)=>{
 await openScene(page);const before=await scene(page);
 await drag(page,await point(page,'pet',-18,0),30,0,20,35);await page.mouse.up();await expect.poll(async()=>(await scene(page)).pet.expression).toBe('petted');await page.waitForTimeout(250);await capture(page,info,'stroke');
 let s=await scene(page);expect(s.mug.x).toBe(before.mug.x);expect(s.mug.y).toBe(before.mug.y);expect(s.saucer.x).toBe(before.saucer.x);
 const p=await point(page,'pet',0,0);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(50);await page.mouse.up();await expect.poll(async()=>(await scene(page)).pet.reveal).toBeLessThan(.1);s=await scene(page);expect(s.pet.expression).toBe('startled');await capture(page,info,'poke');
 const floor=await point(page,'mug',0,162);
 const pixel=await page.locator('canvas').evaluate((c,p)=>{const r=c.getBoundingClientRect(),d=c.width/r.width;return Array.from(c.getContext('2d').getImageData(Math.round((p.x-r.x)*d),Math.round((p.y-r.y)*d),1,1).data);},floor);
 expect(pixel[1]).toBeGreaterThanOrEqual(pixel[0]);
 await expect.poll(async()=>(await scene(page)).pet.reveal,{timeout:5000}).toBeGreaterThan(.35);
});

test('keyboard object controls, pause, reset and reduced motion remain usable',async({page})=>{
 await openScene(page);await page.locator('[data-object="mug"]').focus();await page.keyboard.press('Enter');await expect.poll(async()=>(await scene(page)).mug.lift).toBeGreaterThan(10);
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(1400);await page.keyboard.up('ArrowDown');await page.keyboard.press('Enter');await waitForPlacement(page);expect((await scene(page)).mug.seated).toBe(false);
 await page.locator('[data-object="pet"]').focus();await page.keyboard.press('Enter');await expect.poll(async()=>(await scene(page)).pet.expression).toBe('petted');await page.keyboard.press('Shift+Enter');await expect.poll(async()=>(await scene(page)).pet.expression).toBe('startled');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('#pause')).toHaveAttribute('aria-pressed','true');await page.waitForTimeout(50);const frozen=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(250);expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).toBe(frozen);await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.locator('[data-object="mug"]').focus();await page.keyboard.press('Home');await waitForPlacement(page);expect((await scene(page)).mug.seated).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForTimeout(250);const still=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(250);expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).toBe(still);
});

test('idle peeking and settling retain their timing',async({page},info)=>{
 await page.clock.install();await openScene(page);await page.clock.runFor(7500);await expect.poll(async()=>(await scene(page)).pet.expression).toBe('peeking');await capture(page,info,'idle-peeking');await page.clock.runFor(5700);await expect.poll(async()=>(await scene(page)).pet.expression).toBe('nesting');await capture(page,info,'idle-nesting');
});
