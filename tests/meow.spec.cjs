const {test,expect}=require('@playwright/test');
const {openScene,scene,point}=require('./helpers.cjs');
async function observe(page){
 await page.addInitScript(()=>{let C;window.__meows=[];window.addEventListener('pointerdown',e=>window.__pointerId=e.pointerId,true);Object.defineProperty(window,'SleepySound',{get:()=>C,set:Base=>C=class extends Base{
  constructor(...a){super(...a);window.__sound=this;}
  meow(){__meows.push({expression:SleepyTenantPreview.getState().pet.expression,reveal:SleepyTenantPreview.getState().pet.reveal});super.meow();}
 }});});
 const epoch=new Date('2026-01-01T00:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(+epoch+1000));await openScene(page);
}
async function enable(page){await page.getByRole('button',{name:'Enable sound',exact:true}).click();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');}
async function liftHead(page){await page.clock.runFor(5900);expect(await page.evaluate(()=>__meows.length)).toBe(0);await page.clock.runFor(180);expect(await page.evaluate(()=>__meows.length)).toBe(1);}

test('only a rising idle peek plays exact meow A once, with quiet real output',async({page},info)=>{
 await observe(page);await page.clock.runFor(6100);expect(await page.evaluate(()=>({context:__sound.context,meows:__meows.length}))).toEqual({context:null,meows:0});
 // Enabling while the head is already up does not replay an old transition.
 await enable(page);expect(await page.evaluate(()=>__meows.length)).toBe(0);
 await page.locator('[data-object="mug"]').focus();await page.keyboard.press('Enter');await page.clock.runFor(1000);expect((await scene(page)).pet.expression).toBe('curious');expect(await page.evaluate(()=>__meows.length)).toBe(0);
 await page.keyboard.press('Enter');await page.clock.runFor(5900);expect(await page.evaluate(()=>__meows.length)).toBe(0);await page.clock.runFor(250);
 const events=await page.evaluate(()=>__meows);expect(events).toHaveLength(1);expect(events[0].expression).toBe('peeking');expect(events[0].reveal).toBeLessThan(.84);
 await page.clock.runFor(2500);expect(await page.evaluate(()=>__meows.length)).toBe(1);
 const output=await page.evaluate(async()=>{const buffer=__sound.meowBuffer,c=new OfflineAudioContext(1,buffer.length,buffer.sampleRate),source=c.createBufferSource(),gain=c.createGain(),master=c.createGain();source.buffer=buffer;gain.gain.value=1/.45;master.gain.value=.45;source.connect(gain).connect(master).connect(c.destination);source.start();const rendered=await c.startRendering();return{duration:rendered.duration,peak:Math.max(...rendered.getChannelData(0).map(Math.abs)),sha:SleepyMeowRecording.sha256};});
 expect(output.duration).toBeCloseTo(14813/24000,6);expect(output.peak).toBeGreaterThan(.01);expect(output.peak).toBeLessThan(.013);expect(output.sha).toBe('f6bfa96d04fdf5ae94e24405ca4e54458eabe2fa2c1b3eb571f43d9f6758491b');
 await info.attach('meow-output.json',{body:JSON.stringify(output),contentType:'application/json'});await page.screenshot({path:info.outputPath('idle-head-lift-meow.png')});
});

test('active meow stops on mute, pause, cancellation, background and interruption',async({page})=>{
 test.setTimeout(60000);await observe(page);
 for(const action of ['mute','pause','cancel','background','suspend']){
  await page.reload();await expect.poll(()=>page.evaluate(()=>!!globalThis.SleepyTenantPreview)).toBe(true);await enable(page);await liftHead(page);
  expect(await page.evaluate(()=>__sound.voices.size)).toBe(1);
  if(action==='mute')await page.getByRole('button',{name:'Mute sound',exact:true}).click();
  if(action==='pause')await page.getByRole('button',{name:'Pause',exact:true}).click();
  if(action==='cancel'){const p=await point(page,'mug');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>__pointerId)});await page.mouse.up();}
  if(action==='background')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  if(action==='suspend')await page.evaluate(()=>__sound.context.suspend());
  await expect.poll(()=>page.evaluate(()=>__sound.voices.size)).toBe(0);await page.clock.runFor(200);expect(await page.evaluate(()=>__meows.length)).toBe(1);
 }
});
