const {test,expect}=require('@playwright/test');
const {openScene,scene,point,drag,waitForPlacement,parkMug}=require('./helpers.cjs');

test('opt-in audio follows contact, remains bounded, mutes and resumes after interruption',async({page,isMobile},info)=>{
 await page.addInitScript(()=>{let value;Object.defineProperty(globalThis,'SleepySound',{configurable:true,get:()=>value,set:Base=>{value=class extends Base{constructor(...args){super(...args);globalThis.__sound=this;}};}});});
 await openScene(page);expect(await page.evaluate(()=>__sound.context)).toBe(null);await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
 const enable=async()=>{const button=page.getByRole('button',{name:'Enable sound',exact:true});if(isMobile)await button.tap();else await button.click();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');};
 await enable();expect(await page.evaluate(()=>({state:__sound.context.state,voices:__sound.voices.size,scrape:__sound.scrape}))).toEqual({state:'running',voices:0,scrape:null});
 await page.evaluate(()=>{
  const c=__sound.context,a=c.createAnalyser(),zero=c.createGain();zero.gain.value=0;__sound.master.connect(a);a.connect(zero).connect(c.destination);globalThis.__analyser=a;globalThis.__peak=0;
  globalThis.__meter=setInterval(()=>{const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);for(const v of data)__peak=Math.max(__peak,Math.abs(v));},8);
 });
 await parkMug(page);expect(await page.evaluate(()=>__sound.scrape)).toBe(null);await page.mouse.up();await waitForPlacement(page);await page.waitForTimeout(200);
 await drag(page,await point(page,'tray',-150,151),20);expect(await page.evaluate(()=>!!__sound.scrape)).toBe(true);await page.mouse.up();
 for(let i=0;i<20;i++)await page.evaluate(()=>{__sound.react('startled');__sound.place();});expect(await page.evaluate(()=>__sound.voices.size)).toBeLessThanOrEqual(2);
 await page.getByRole('button',{name:'Mute sound',exact:true}).click();expect(await page.evaluate(()=>({enabled:__sound.enabled,voices:__sound.voices.size,scrape:__sound.scrape}))).toEqual({enabled:false,voices:0,scrape:null});
 await enable();expect(await page.evaluate(()=>__sound.voices.size)).toBe(0);await page.evaluate(()=>__sound.react('peeking'));await page.waitForTimeout(500);expect(await page.evaluate(()=>__sound.voices.size)).toBe(0);
 const peak=await page.evaluate(()=>__peak);expect(peak).toBeGreaterThan(.0001);expect(peak).toBeLessThan(.12);await info.attach('measured-audio.json',{body:JSON.stringify({peak,maximumVoices:2,startupVoices:0}),contentType:'application/json'});
 await page.evaluate(()=>__sound.context.suspend());expect(await page.evaluate(()=>__sound.context.state)).toBe('suspended');await page.locator('[data-object="mug"]').focus();await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>__sound.context.state)).toBe('running');await page.keyboard.press('Enter');await waitForPlacement(page);
 await page.getByRole('button',{name:'Pause',exact:true}).click();expect(await page.evaluate(()=>({voices:__sound.voices.size,scrape:__sound.scrape,blocked:__sound.blocked}))).toEqual({voices:0,scrape:null,blocked:true});await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.evaluate(()=>__sound.context.suspend());await page.getByRole('button',{name:'Mute sound',exact:true}).click();await page.locator('[data-object="mug"]').focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>__sound.context.state)).toBe('suspended');await page.keyboard.press('Enter');await waitForPlacement(page);await enable();await expect.poll(()=>page.evaluate(()=>__sound.context.state)).toBe('running');await page.getByRole('button',{name:'Mute sound',exact:true}).click();await page.waitForTimeout(150);
 expect(await page.evaluate(()=>{const data=new Float32Array(__analyser.fftSize);__analyser.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs));})).toBeLessThan(.0001);
 await page.evaluate(()=>clearInterval(__meter));
});

test('explicit Sound enable selects playback routing when supported',async({page,isMobile})=>{
 await openScene(page);
 const session=()=>page.evaluate(()=>navigator.audioSession?.type??null);
 const initial=await session();
 await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
 await page.locator('[data-object="pet"]').focus();await page.keyboard.press('Enter');
 expect(await session()).toBe(initial);
 const enable=async()=>{
  const button=page.getByRole('button',{name:'Enable sound',exact:true});
  if(isMobile)await button.tap();else await button.click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
  if(initial!==null)expect(await session()).toBe('playback');
 };
 await enable();await page.getByRole('button',{name:'Mute sound',exact:true}).click();
 await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');await enable();
 await page.getByRole('button',{name:'Mute sound',exact:true}).click();
});
