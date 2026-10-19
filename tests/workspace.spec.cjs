const {test,expect}=require('@playwright/test');
const {openScene,scene,point,drag,waitForPlacement,capture}=require('./helpers.cjs');
async function foreground(page){return page.locator('canvas').evaluate(c=>{
 const r=c.getBoundingClientRect(),d=c.width/r.width,data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let left=c.width,right=0,top=c.height,bottom=0;
 for(let y=0;y<c.height;y+=2)for(let x=0;x<c.width;x+=2){const i=(y*c.width+x)*4,R=data[i],G=data[i+1],B=data[i+2];if(R-B>28&&G-B>14&&R<249&&G<239){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 return{left:left/d,right:right/d,top:top/d,bottom:bottom/d,width:r.width,height:r.height};
});}

test('desktop, laptop and phone bounds contain rendered objects without overflow',async({page},info)=>{
 test.setTimeout(90000);
 for(const [name,width,height]of[['wide',1920,1080],['desktop',1440,1000],['laptop',1280,720],['portrait',390,844],['landscape',844,390],['small',320,568]]){
  await page.setViewportSize({width,height});await openScene(page);const before=await scene(page),start=await point(page,'mug');
  await drag(page,start,-2000,-2000,35,18);await page.waitForTimeout(300);let s=await scene(page);
  expect(s.mug.x).toBeGreaterThanOrEqual(s.limits.mug.minX-.01);expect(s.mug.y).toBeGreaterThanOrEqual(s.limits.mug.minY-.01);expect(s.saucer.x).toBe(before.saucer.x);
  await expect.poll(async()=>(await scene(page)).pet.expression,{timeout:5000}).not.toBe('startled');await page.waitForTimeout(500);
  const box=await foreground(page);expect(box.left).toBeGreaterThan(3);expect(box.right).toBeLessThan(box.width-3);expect(box.top).toBeGreaterThan(3);expect(box.bottom).toBeLessThan(box.height-3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight&&scrollX===0&&scrollY===0)).toBe(true);
  await capture(page,info,name+'-bound');await page.mouse.up();await waitForPlacement(page);
 }
});

test('resize ends capture before changing pointer coordinates',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await openScene(page);const start=await point(page,'mug');await drag(page,start,18,0,6,30);await page.setViewportSize({width:1100,height:740});await expect.poll(async()=>(await scene(page)).active).toBe(null);await waitForPlacement(page);const before=await scene(page);await page.mouse.move(start.x+19,start.y);await page.waitForTimeout(200);const after=await scene(page);expect(after.mug.x).toBeCloseTo(before.mug.x,1);expect(after.mug.y).toBeCloseTo(before.mug.y,1);await page.mouse.up();
});

test('regrabbing during settling keeps the mug under the new gesture',async({page})=>{
 await openScene(page);await drag(page,await point(page,'mug'),-55,0,15,20);await page.mouse.up();await page.waitForTimeout(40);const before=await scene(page),p=await point(page,'mug');
 await page.mouse.move(p.x,p.y);await page.mouse.down();const captured=await scene(page);await page.waitForTimeout(150);let s=await scene(page);expect(s.active.kind).toBe('mug');expect(s.mug.x).toBeCloseTo(captured.mug.x,1);expect(s.mug.landing).toBe(null);
 await page.mouse.move(p.x+20,p.y);await page.waitForTimeout(150);s=await scene(page);expect(s.active.dragged).toBe(true);expect(s.mug.lift).toBeGreaterThan(5);await page.mouse.up();await waitForPlacement(page);
});

test('native phone touch supports lifting, stroke/poke, cancellation and orientation',async({browser,browserName},info)=>{
 test.skip(browserName!=='chromium','Native touch protocol is Chromium-specific; WebKit covers the same model and touch audio activation.');
 const context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();await openScene(page);const cdp=await context.newCDPSession(page);let s=await scene(page),p=await point(page,'mug');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});for(let i=1;i<=25;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-20*i/25,y:p.y-110*s.camera.scale*i/25}]});await page.waitForTimeout(30);}await capture(page,info,'touch-held');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitForPlacement(page);s=await scene(page);expect(s.mug.seated).toBe(false);expect(s.mug.y).toBeLessThan(-80);
 p=await point(page,'mug');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+12,y:p.y}]});await page.waitForTimeout(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await waitForPlacement(page);expect((await scene(page)).active).toBe(null);
 await page.locator('[data-object="mug"]').focus();await page.keyboard.press('Home');await waitForPlacement(page);p=await point(page,'pet',-12,0);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});for(let i=1;i<=20;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+i,y:p.y}]});await page.waitForTimeout(35);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>(await scene(page)).pet.expression).toBe('petted');
 p=await point(page,'pet',0,0);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await page.waitForTimeout(50);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>(await scene(page)).pet.expression).toBe('startled');
 p=await point(page,'mug');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+12,y:p.y}]});await page.waitForTimeout(100);await page.setViewportSize({width:844,height:390});await expect.poll(async()=>(await scene(page)).active).toBe(null);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitForPlacement(page);expect(await page.evaluate(()=>scrollX===0&&scrollY===0)).toBe(true);await capture(page,info,'touch-landscape');await context.close();
});
