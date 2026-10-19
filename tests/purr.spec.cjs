const {test,expect}=require('@playwright/test');
const {openScene,scene,point}=require('./helpers.cjs');
async function stroke(page,duration=1000){
 const p=await point(page,'pet',-15,0);await page.mouse.move(p.x,p.y);await page.mouse.down();
 for(let i=0;i<Math.ceil(duration/35);i++){await page.mouse.move(p.x+15*Math.sin(i/7),p.y);await page.waitForTimeout(35);}
}
async function quiet(page){
 await expect.poll(()=>page.evaluate(()=>!!__sound.purring)).toBe(false);await page.waitForTimeout(100);
 expect(await page.evaluate(()=>{const a=new Float32Array(__analyser.fftSize);__analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})).toBeLessThan(.0001);
}
test('approved recorded purr follows gentle strokes and all stop conditions',async({page,isMobile},info)=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{let C;Object.defineProperty(window,'SleepySound',{configurable:true,get:()=>C,set:Base=>C=class extends Base{constructor(...a){super(...a);window.__sound=this;}}});window.addEventListener('pointerdown',e=>window.__pointerId=e.pointerId,true);});
 await openScene(page);await stroke(page,400);expect(await page.evaluate(()=>__sound.context)).toBe(null);await page.mouse.up();
 const enable=async()=>{const b=page.getByRole('button',{name:'Enable sound',exact:true});if(isMobile)await b.tap();else await b.click();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');};
 await enable();const decoded=await page.evaluate(()=>({frames:__sound.purrBuffer.length,rate:__sound.purrBuffer.sampleRate,purr:__sound.purring}));
 // Resampling 24 kHz to the output device rate can round by one output frame.
 expect(Math.abs(decoded.frames-4*decoded.rate)).toBeLessThanOrEqual(1);expect(decoded.purr).toBe(null);
 await page.evaluate(()=>{const c=__sound.context,a=c.createAnalyser(),zero=c.createGain();zero.gain.value=0;__sound.master.connect(a);a.connect(zero).connect(c.destination);window.__analyser=a;window.__peak=0;window.__meter=setInterval(()=>{const d=new Float32Array(a.fftSize);a.getFloatTimeDomainData(d);for(const v of d)__peak=Math.max(__peak,Math.abs(v));},8);});
 await stroke(page,1800);expect(await page.evaluate(()=>!!__sound.purring)).toBe(true);expect((await scene(page)).pet.expression).toBe('petted');
 await page.screenshot({path:info.outputPath('recorded-purr-stroke.png')});await quiet(page);await page.mouse.up();
 const peak=await page.evaluate(()=>__peak);expect(peak).toBeGreaterThan(.0001);expect(peak).toBeLessThan(.03);await info.attach('recorded-purr-level.json',{body:JSON.stringify({peak,recordingSha256:await page.evaluate(()=>SleepyPurrRecording.sha256),normalized:false}),contentType:'application/json'});
 const p=await point(page,'pet',0,0);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(50);await page.mouse.up();await expect.poll(async()=>(await scene(page)).pet.reveal).toBeLessThan(.1);expect(await page.evaluate(()=>__sound.purring)).toBe(null);await expect.poll(async()=>(await scene(page)).pet.reveal,{timeout:6000}).toBeGreaterThan(.4);
 await stroke(page);await page.mouse.up();await quiet(page);
 await stroke(page);await page.getByRole('button',{name:'Mute sound',exact:true}).focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>__sound.enabled)).toBe(false);await quiet(page);await page.mouse.up();await enable();
 await stroke(page);await page.getByRole('button',{name:'Pause',exact:true}).focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>__sound.blocked)).toBe(true);await quiet(page);await page.mouse.up();await page.getByRole('button',{name:'Resume',exact:true}).click();
 await stroke(page);await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>__pointerId)});await quiet(page);expect((await scene(page)).active).toBe(null);await page.mouse.up();
 await page.locator('[data-object="pet"]').focus();await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>!!__sound.purring)).toBe(true);await page.keyboard.press('Shift+Enter');await quiet(page);await expect.poll(async()=>(await scene(page)).pet.reveal,{timeout:6000}).toBeGreaterThan(.4);
 await stroke(page);await page.evaluate(()=>__sound.context.suspend());await expect.poll(()=>page.evaluate(()=>!!__sound.purring)).toBe(false);await page.mouse.up();await stroke(page);await expect.poll(()=>page.evaluate(()=>__sound.context.state)).toBe('running');expect(await page.evaluate(()=>!!__sound.purring)).toBe(true);await page.mouse.up();await quiet(page);
 await stroke(page);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});expect(await page.evaluate(()=>__sound.blocked)).toBe(true);await quiet(page);expect((await scene(page)).active).toBe(null);await page.mouse.up();await page.evaluate(()=>clearInterval(__meter));
});
