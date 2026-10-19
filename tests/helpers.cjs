const {expect}=require('@playwright/test');
async function openScene(page){await page.goto('./?inspect');await expect.poll(()=>page.evaluate(()=>!!globalThis.SleepyTenantPreview)).toBe(true);}
async function scene(page){return page.evaluate(()=>SleepyTenantPreview.getState());}
async function point(page,kind,x=0,y=65){return page.evaluate(({kind,x,y})=>{
 const s=SleepyTenantPreview.getState(),r=document.querySelector('canvas').getBoundingClientRect();let X,Y;
 if(kind==='tray'){X=s.saucer.x+x;Y=s.saucer.y+y;}
 else{
  if(kind==='pet'){x+=s.pet.lean*10;y=60-103*s.pet.reveal-5+y;}
  const c=Math.cos(s.mug.tilt),a=Math.sin(s.mug.tilt);
  X=s.mug.x+x*c-(y-153)*a;Y=s.mug.y-s.mug.lift+153+x*a+(y-153)*c;
 }
 return{x:r.x+s.camera.ox+X*s.camera.scale,y:r.y+s.camera.oy+Y*s.camera.scale};
},{kind,x,y});}
async function drag(page,start,dx,dy=0,steps=30,delay=25){
 await page.mouse.move(start.x,start.y);await page.mouse.down();
 for(let i=1;i<=steps;i++){await page.mouse.move(start.x+dx*i/steps,start.y+dy*i/steps);await page.waitForTimeout(delay);}
}
async function waitForPlacement(page){await expect.poll(async()=>{const s=await scene(page);return !s.mug.landing&&s.mug.lift<.3;},{timeout:6000}).toBe(true);}
async function parkMug(page){
 const initial=await scene(page),wide=initial.camera.w>=900,start=await point(page,'mug');
 const target=wide?{x:-320,y:0}:{x:-25,y:110};
 await drag(page,start,(target.x-initial.mug.x)*initial.camera.scale,(target.y-initial.mug.y)*initial.camera.scale,45,25);
 return{initial,start,target};
}
async function capture(page,info,name){await page.screenshot({path:info.outputPath(name+'.png')});}
module.exports={openScene,scene,point,drag,waitForPlacement,parkMug,capture};
