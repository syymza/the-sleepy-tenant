const {test,expect,devices}=require('@playwright/test');
const {openScene,scene,point}=require('./helpers.cjs');
async function observe(page){
 await page.addInitScript(()=>{let C;window.__meows=[];window.__pointerTypes=[];window.addEventListener('pointerdown',e=>{window.__pointerId=e.pointerId;if(e.target.id==='scene')__pointerTypes.push(e.pointerType);},true);Object.defineProperty(window,'SleepySound',{get:()=>C,set:Base=>C=class extends Base{
  constructor(...a){super(...a);window.__sound=this;}
  meow(){__meows.push({expression:SleepyTenantPreview.getState().pet.expression,reveal:SleepyTenantPreview.getState().pet.reveal,time:this.context.currentTime});super.meow();}
 }});});
 const epoch=new Date('2026-01-01T00:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(+epoch+1000));await openScene(page);
}
async function enable(page){await page.getByRole('button',{name:'Enable sound',exact:true}).click();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');}
const count=page=>page.evaluate(()=>__meows.length);
async function idleLift(page){await page.clock.runFor(6100);expect(await count(page)).toBe(0);await page.clock.runFor(250);expect(await count(page)).toBe(1);}
async function lowerThenStroke(page){
 await page.locator('[data-object="pet"]').focus();await page.keyboard.press('Shift+Enter');await page.clock.runFor(1800);expect((await scene(page)).pet.reveal).toBeLessThan(.78);
 await page.keyboard.press('Enter');await page.clock.runFor(600);expect((await scene(page)).pet.reveal).toBeGreaterThan(.82);
}

test('pointer lift greets once; lowering rearms while cooldown never queues a greeting',async({page},info)=>{
 await observe(page);await enable(page);const p=await point(page,'mug');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+12,p.y);await page.clock.runFor(220);
 expect(await count(page)).toBe(1);expect((await scene(page)).pet.expression).toBe('curious');
 await page.mouse.move(p.x+18,p.y);await page.clock.runFor(1000);expect(await count(page)).toBe(1);await page.mouse.up();await page.clock.runFor(800);
 await lowerThenStroke(page);expect(await count(page)).toBe(1);
 // AudioContext time is real, independent of the controlled animation clock.
 await page.waitForTimeout(8100);await page.clock.runFor(500);expect(await count(page)).toBe(1);
 await lowerThenStroke(page);expect(await count(page)).toBe(2);
 const events=await page.evaluate(()=>__meows);expect(events.every(e=>e.reveal>=.82&&e.reveal<.88)).toBe(true);expect(events[1].time-events[0].time).toBeGreaterThan(8);
 await page.clock.runFor(1000);expect(await count(page)).toBe(2);
 const output=await page.evaluate(async()=>{const buffer=__sound.meowBuffer,c=new OfflineAudioContext(1,buffer.length,buffer.sampleRate),source=c.createBufferSource(),gain=c.createGain(),master=c.createGain();source.buffer=buffer;gain.gain.value=1/.45;master.gain.value=.45;source.connect(gain).connect(master).connect(c.destination);source.start();const rendered=await c.startRendering();return{duration:rendered.duration,peak:Math.max(...rendered.getChannelData(0).map(Math.abs)),sha:SleepyMeowRecording.sha256};});
 expect(output.duration).toBeCloseTo(14813/24000,6);expect(output.peak).toBeGreaterThan(.01);expect(output.peak).toBeLessThan(.013);expect(output.sha).toBe('f6bfa96d04fdf5ae94e24405ca4e54458eabe2fa2c1b3eb571f43d9f6758491b');
 await info.attach('meow-output-and-rises.json',{body:JSON.stringify({output,events}),contentType:'application/json'});await page.screenshot({path:info.outputPath('gesture-head-rise-meow.png')});
});

test('idle head rises still greet once after lowering and cooldown',async({page})=>{
 await observe(page);await enable(page);await page.clock.runFor(6400);expect(await count(page)).toBe(1);await page.clock.runFor(3500);expect(await count(page)).toBe(1);
 await page.clock.runFor(3000);expect((await scene(page)).pet.reveal).toBeLessThan(.78);await page.waitForTimeout(8100);await page.clock.runFor(4300);
 expect(await count(page)).toBe(2);expect(await page.evaluate(()=>__meows.every(e=>e.expression==='peeking'))).toBe(true);
});

test('enabling sound mid-pose or after a muted rise never replays it',async({page})=>{
 await observe(page);await page.clock.runFor(6400);expect(await page.evaluate(()=>__sound.context)).toBe(null);expect((await scene(page)).pet.reveal).toBeGreaterThan(.82);
 await enable(page);await page.clock.runFor(500);expect(await count(page)).toBe(0);
 await page.getByRole('button',{name:'Mute sound',exact:true}).click();await lowerThenStroke(page);expect(await count(page)).toBe(0);
 await enable(page);await page.clock.runFor(500);expect(await count(page)).toBe(0);await lowerThenStroke(page);expect(await count(page)).toBe(1);
});

test('active meow stops on mute, pause, cancellation, background and interruption',async({page})=>{
 test.setTimeout(60000);await observe(page);
 for(const action of ['mute','pause','cancel','background','suspend']){
  await page.reload();await expect.poll(()=>page.evaluate(()=>!!globalThis.SleepyTenantPreview)).toBe(true);await enable(page);await idleLift(page);
  expect(await page.evaluate(()=>__sound.voices.size)).toBe(1);
  if(action==='mute')await page.getByRole('button',{name:'Mute sound',exact:true}).click();
  if(action==='pause')await page.getByRole('button',{name:'Pause',exact:true}).click();
  if(action==='cancel'){const p=await point(page,'mug');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>__pointerId)});await page.mouse.up();}
  if(action==='background')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  if(action==='suspend')await page.evaluate(()=>__sound.context.suspend());
  await expect.poll(()=>page.evaluate(()=>__sound.voices.size)).toBe(0);await page.clock.runFor(200);expect(await count(page)).toBe(1);
 }
});

test('native touch head rise greets once and raised-head touches stay quiet',async({browser,browserName},info)=>{
 const context=await browser.newContext({...devices['iPhone 13'],baseURL:info.project.use.baseURL}),page=await context.newPage();await observe(page);
 await page.getByRole('button',{name:'Enable sound',exact:true}).tap();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');const p=await point(page,'mug');
 if(browserName==='chromium'){
  const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+12,y:p.y}]});await page.clock.runFor(220);expect(await count(page)).toBe(1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+18,y:p.y}]});await page.clock.runFor(350);expect(await count(page)).toBe(1);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 }else{
  // WebKit exposes native taps, rather than Chromium's touch-drag protocol.
  await page.touchscreen.tap(p.x,p.y);await page.clock.runFor(300);expect(await count(page)).toBe(1);
  const q=await point(page,'mug');await page.touchscreen.tap(q.x,q.y);await page.clock.runFor(300);expect(await count(page)).toBe(1);
 }
 expect(await page.evaluate(()=>__pointerTypes.every(t=>t==='touch')&&__pointerTypes.length>0)).toBe(true);expect(await count(page)).toBe(1);await page.screenshot({path:info.outputPath('native-touch-head-rise.png')});await context.close();
});
