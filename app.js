/* The cup is drawn in three layers: interior, tenant, front wall. Paws are
   anchored to the lip, so a retreat cannot expose limbs through the ceramic. */
(() => {
  'use strict';
  const canvas = document.querySelector('#scene'), ctx = canvas.getContext('2d');
  const mood = document.querySelector('#mood'), announcement = document.querySelector('#announcement');
  const pauseButton = document.querySelector('#pause');
  const soundButton = document.querySelector('#sound');
  const sound = new SleepySound((enabled,message) => {
    soundButton.textContent=enabled?'Sound on':'Sound off';
    soundButton.setAttribute('aria-pressed',String(enabled));
    soundButton.setAttribute('aria-label',enabled?'Mute sound':'Enable sound');
    if(message)announcement.textContent=message;
  });
  soundButton.addEventListener('click',()=>sound.enabled?sound.disable():sound.enable());
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=motion.matches,paused=false,w=0,h=0,scale=1,ox=0,oy=0;
  let now=0,previous=0,idle=0,frightenedUntil=0,pettedUntil=0,peekUntil=0,releasedAt=-10;
  let keyboardPurrUntil=0;
  let active=null,keyboardHeld=false,selected='mug',focused=null,hover=null,strokeLean=0;
  const keys=new Set();
  const tray={x:0,y:0,tx:0,ty:0};
  const mug={x:0,y:0,tx:0,ty:0,lift:0,fallSpeed:0,tilt:0,seated:true,landing:null};
  const state={lean:0,reveal:.72,expression:'sleepy'};
  const limits={tray:{},mug:{}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const hint=document.querySelector('#hint');
  const objectControls=[...document.querySelectorAll('.object-control')];
  const noise = document.createElement('canvas'); noise.width=256;noise.height=256;
  const nc = noise.getContext('2d'), pixels = nc.createImageData(256,256);
  let seed = 7527;
  const random = () => { seed = (seed*1664525+1013904223)>>>0;return seed/4294967296; };
  for(let i=0;i<pixels.data.length;i+=4){const v=random()*255;pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=24;}
  nc.putImageData(pixels,0,0);const texture=ctx.createPattern(noise,'repeat');
  function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  function path(d,fill,stroke,width=1){const p=new Path2D(d);if(fill){ctx.fillStyle=fill;ctx.fill(p);}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(p);}return p;}
  function gradient(x,y,x2,y2,stops){const g=ctx.createLinearGradient(x,y,x2,y2);stops.forEach(s=>g.addColorStop(...s));return g;}
  function grain(p,alpha=.18){ctx.save();if(p)ctx.clip(p);ctx.globalAlpha=alpha;ctx.fillStyle=texture;ctx.fillRect(-300,-350,600,650);ctx.restore();}
  function shadow(x,y,rx,ry,opacity){ctx.save();ctx.translate(x,y);ctx.scale(1,ry/rx);const g=ctx.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,`rgba(65,51,33,${opacity})`);g.addColorStop(1,'rgba(65,51,33,0)');ellipse(0,0,rx,rx,g);ctx.restore();}
  const hitCtx=document.createElement('canvas').getContext('2d');
  const mugHandle=new Path2D('M104 -24 C154 -40 188 -7 187 39 C186 86 156 119 116 110 C100 110 86 102 88 92 C90 84 101 80 114 84 C148 90 164 66 164 39 C165 12 148 -5 111 -1 C100 1 96 -19 104 -24 Z');
  const mugBody=new Path2D('M-116 -22 C-113 24 -112 102 -84 132 C-55 160 55 160 84 132 C112 102 113 24 116 -22');
  mugBody.ellipse(0,-22,116,36,0,0,Math.PI);mugBody.closePath();
  function saucer(){
    shadow(6,172,240,41,.16);shadow(0,163,174,20,.14);
    ellipse(0,157,188,47,'#a7aa8d');
    ellipse(0,151,190,47,gradient(-120,120,90,183,[[0,'#dedcc6'],[.45,'#c9ccb1'],[1,'#a7af92']]));
    ctx.save();ctx.beginPath();ctx.ellipse(0,150,187,44,0,0,Math.PI*2);ctx.clip();grain(null,.35);ctx.restore();
    ctx.beginPath();ctx.ellipse(0,148,176,38,0,.12,Math.PI-.12);ctx.strokeStyle='#e2e1cb';ctx.lineWidth=2;ctx.stroke();
    ellipse(0,150,127,27,'#aeb69a');ellipse(0,148,125,25,'#c1c5aa');
  }
  function cupBack(t){
    // The handle has real negative space instead of a painted-on inner patch.
    const handle=mugHandle;
    ctx.save();ctx.shadowColor='#79604c35';ctx.shadowBlur=5;ctx.shadowOffsetY=4;
    ctx.fillStyle=gradient(100,-20,180,95,[[0,'#c9a78b'],[.4,'#b88b70'],[1,'#8e6554']]);ctx.fill(handle);ctx.restore();grain(handle,.7);
    path('M126 -17 C165 -12 180 57 142 96',null,'#d7b89a70',1.5);
    ellipse(0,-22,116,36,gradient(0,-55,0,13,[[0,'#d6b49a'],[1,'#b58b70']]));
    ellipse(0,-24,104,27,gradient(0,-50,0,10,[[0,'#604a3e'],[.55,'#8a6b54'],[1,'#b69272']]));
  }
  function pose(t){
    const breathe=reduced?0:Math.sin(t*1.7)*.7;
    const grip=clamp((state.reveal-.69)/.26,0,1);
    return {x:state.lean*13,y:mix(60,-43,state.reveal)+breathe,
      angle:reduced?0:state.lean*.08,grip:grip*grip*(3-2*grip)};
  }
  function hand(sign,p){
    const x=sign*48+state.lean*2;
    const inner=-24+27*Math.sqrt(1-(x/104)**2);
    const outer=-22+36*Math.sqrt(1-(x/116)**2);
    return {x,y:inner-4+(1-p.grip)*24,lip:outer-3,inner};
  }
  function creature(t){
    const p=pose(t),lean=state.lean;
    const fur=gradient(-50,-80,50,40,[[0,'#f4e8cc'],[.52,'#e7d6b2'],[1,'#c3a984']]);
    // A compact body follows the head as one rigid pose; the arms bend to the lip.
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ellipse(0,29,39,33,fur);ctx.restore();
    for(const sign of [-1,1]){
      const h=hand(sign,p),sx=p.x+sign*35*Math.cos(p.angle)-27*Math.sin(p.angle),sy=p.y+sign*35*Math.sin(p.angle)+27*Math.cos(p.angle);
      const arm=new Path2D();arm.moveTo(sx,sy);arm.bezierCurveTo(sx+sign*5,sy+6,h.x,h.y-5,h.x,h.y+2);
      ctx.strokeStyle=fur;ctx.lineWidth=13;ctx.lineCap='round';ctx.stroke(arm);
    }
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    const ears=path('M-40 -24 C-59 -38 -69 -73 -52 -78 C-36 -82 -22 -51 -26 -29 Z M25 -29 C21 -54 38 -84 52 -78 C69 -70 56 -39 40 -24 Z',fur);
    grain(ears,.24);
    path('M-39 -38 C-47 -48 -55 -68 -50 -68 C-44 -69 -35 -49 -34 -37 Z','#d3b69e');
    path('M34 -37 C35 -51 45 -71 50 -68 C56 -62 47 -45 40 -37 Z','#d3b69e');
    const head=path('M-59 -5 C-61 -35 -36 -53 -5 -51 C25 -55 56 -36 60 -9 C69 22 41 46 0 45 C-40 47 -68 24 -59 -5 Z',fur);
    grain(head,.29);
    path('M-11 -49 Q-16 -57 -8 -53 Q-2 -61 3 -52 Q10 -57 12 -49','#ebddbd');
    const muzzle=ctx.createRadialGradient(0,19,2,0,19,30);muzzle.addColorStop(0,'#f4e9d1');muzzle.addColorStop(1,'#eee1c100');
    ellipse(0,19,31,24,muzzle);
    for(const x of [-36,36]){const blush=ctx.createRadialGradient(x,12,1,x,12,12);blush.addColorStop(0,state.expression==='petted'?'#dca58a99':'#dcae9766');blush.addColorStop(1,'#dcae9700');ellipse(x,12,12,8,blush);}
    const blink=(!reduced && (t%5.7<.16 || state.expression==='sleepy' && t%5.7<2.5));
    ctx.lineCap='round';ctx.lineWidth=2.8;ctx.strokeStyle='#4b4739';
    const gaze=clamp(lean*2,-2,2);
    for(const ex of [-22,22]){
      if(blink || state.expression==='nesting' || state.expression==='content' || state.expression==='petted')path(`M${ex-5.5} -4 Q${ex} 1 ${ex+5.5} -4`,null,'#62523f',2.5);
      else {ellipse(ex+gaze,-5,4.7,state.expression==='startled'?6.6:5.8,'#4c4435');ellipse(ex+gaze-1.2,-7,1.35,1.5,'#fff5db');}
    }
    path('M-4 10 Q0 7 4 10 Q4 13 0 14 Q-4 13 -4 10','#94745d');
    path('M0 14 L0 17 M-5 18 Q0 22 5 18',null,'#87715a',1.25);
    ctx.restore();
  }
  function cupFront(){
    const body=mugBody;
    ctx.fillStyle=gradient(-115,0,120,30,[[0,'#a4775e'],[.16,'#c49a7a'],[.40,'#d9b795'],[.68,'#c69a7b'],[1,'#94654f']]);ctx.fill(body);
    grain(body,.56);
    ctx.save();ctx.clip(body);
    const shade=ctx.createRadialGradient(-40,15,2,-25,25,170);shade.addColorStop(0,'#f5d7ae23');shade.addColorStop(1,'#62422d1c');ctx.fillStyle=shade;ctx.fillRect(-120,-25,240,185);
    // Fine throwing lines make the surface read as matte, hand-thrown ceramic.
    for(let y=26;y<142;y+=5.2){ctx.beginPath();ctx.ellipse(0,y,119-y*.15,13,0,.12,Math.PI-.12);ctx.strokeStyle=y%2?'#74563d0a':'#fff0d70c';ctx.lineWidth=.7;ctx.stroke();}
    ctx.restore();
    // Both edges of the lip share the same ellipses as the opening and body.
    const lip=new Path2D();lip.ellipse(0,-22,116,36,0,0,Math.PI);
    lip.lineTo(-104,-24);lip.ellipse(0,-24,104,27,0,Math.PI,0,true);lip.closePath();
    ctx.fillStyle=gradient(0,-20,0,15,[[0,'#d3ad8e'],[.7,'#e1bea0'],[1,'#c49878']]);ctx.fill(lip);grain(lip,.2);
    ctx.beginPath();ctx.ellipse(0,-24,104,27,0,.02,Math.PI-.02);ctx.strokeStyle='#bc9375';ctx.lineWidth=1;ctx.stroke();
    // An unobtrusive potter's mark.
    path('M-5 121 Q0 116 5 121 M0 117 L0 126',null,'#a57e6360',1.3);
  }
  function paws(t){
    const p=pose(t),grip=clamp((p.grip-.5)/.5,0,1);
    if(!grip)return;
    for(const sign of [-1,1]){
      const h=hand(sign,p);ctx.save();ctx.translate(h.x,h.lip);
      shadow(0,8,12,3,.16*grip);
      // Rounded knuckles bridge the rim; the fingers curl over its front edge.
      const top=(h.inner-h.lip-1)*grip;ctx.globalAlpha=grip;
      const paw=path(`M-9 -1 C-10 ${top} -5 ${top-1} 0 ${top-1} C6 ${top-1} 10 ${top+1} 10 0 L10 ${4*grip} C10 ${8*grip} -9 ${8*grip} -9 ${3*grip} Z`,gradient(-8,top,8,12,[[0,'#f2e5c7'],[.55,'#e6d4b0'],[1,'#c9b18b']]));
      grain(paw,.2);
      if(grip>.35)path(`M-3 3 Q-4 5 -3 ${6*grip} M3 3 Q4 5 3 ${6*grip}`,null,'#b59d7966',.8);
      ctx.restore();
    }
  }
  const descriptions={sleepy:'a small home. a very sleepy tenant.',curious:'a little look around',startled:'oh! back inside.',content:'there. all tucked in.',petted:'that is a very good spot.',peeking:'just checking on the world',nesting:'one more wriggle, then a little rest'};
  function setExpression(value){
    if(value===state.expression)return;
    state.expression=value;mood.textContent=descriptions[value];announcement.textContent=descriptions[value];
    sound.react(value);
  }
  function liftHeight(){return Math.min(34,26/scale);}
  function fit(kind,x,y){const b=limits[kind];return{x:clamp(x,b.minX,b.maxX),y:clamp(y,b.minY,b.maxY)};}
  function overlaps(x,y,tx=tray.tx,ty=tray.ty){return ((x-tx)/272)**2+((y-ty)/72)**2<1;}
  function moveTray(x,y){
    let p=fit('tray',x,y);
    if(!mug.seated && !mug.landing?.seat && overlaps(mug.x,mug.y,p.x,p.y)){
      let dx=p.x-mug.x,dy=p.y-mug.y,n=Math.hypot(dx/272,dy/72);
      if(n<.01){dx=tray.x-mug.x;dy=tray.y-mug.y;n=Math.hypot(dx/272,dy/72)||1;}
      p=fit('tray',mug.x+dx/n,mug.y+dy/n);
      if(overlaps(mug.x,mug.y,p.x,p.y))return;
    }
    tray.tx=p.x;tray.ty=p.y;
  }
  function landMug(cancelled=false){
    const p=fit('mug',cancelled?mug.x:mug.tx,cancelled?mug.y:mug.ty);
    const seat=overlaps(p.x,p.y);
    mug.tx=seat?tray.tx:p.x;mug.ty=seat?tray.ty:p.y;
    mug.landing={seat,silent:cancelled,contacted:false,airborne:mug.lift>1};mug.fallSpeed=0;keyboardHeld=false;
    releasedAt=now;idle=0;
  }
  function mugPoint(point){
    const dx=point.x-mug.x,dy=point.y-(mug.y-mug.lift)-153,c=Math.cos(mug.tilt),s=Math.sin(mug.tilt);
    return{x:dx*c+dy*s,y:-dx*s+dy*c+153};
  }
  function petHit(p,slop){
    if(Math.abs(p.x)>103)return false;
    const front=-24+27*Math.sqrt(Math.max(0,1-(p.x/104)**2));
    if(p.y>front-1)return false;
    const head=pose(now),dx=p.x-head.x,dy=p.y-head.y,c=Math.cos(head.angle),s=Math.sin(head.angle),x=dx*c+dy*s,y=-dx*s+dy*c;
    return (x/(62+slop))**2+((y+4)/(49+slop))**2<1 || ((x+47)/(17+slop))**2+((y+59)/(24+slop))**2<1 || ((x-47)/(17+slop))**2+((y+59)/(24+slop))**2<1;
  }
  function hit(point,pointerType='mouse'){
    const p=mugPoint(point),slop=pointerType==='touch'?6/scale:0;
    const onTray=((point.x-tray.x)/(190+slop))**2+((point.y-tray.y-151)/(47+slop))**2<1;
    const trayInFront=!mug.seated&&!mug.landing&&mug.lift<1&&mug.y<tray.y-30;
    if(trayInFront&&onTray)return 'tray';
    if(petHit(p,slop*.35))return 'pet';
    hitCtx.lineWidth=slop*2;
    if(hitCtx.isPointInPath(mugBody,p.x,p.y)||hitCtx.isPointInPath(mugHandle,p.x,p.y)||(slop>0&&(hitCtx.isPointInStroke(mugBody,p.x,p.y)||hitCtx.isPointInStroke(mugHandle,p.x,p.y))))return 'mug';
    return onTray?'tray':null;
  }
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-ox)/scale,y:(e.clientY-r.top-oy)/scale};}
  function updateCursor(){canvas.style.cursor=paused?'default':active?(active.kind==='pet'?'pointer':'grabbing'):hover==='pet'?'pointer':hover?'grab':'default';}
  function releaseCapture(id){if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
  function finishGesture(cancelled=false){
    if(!active)return;
    const gesture=active;active=null;sound.purr(false);releaseCapture(gesture.id);
    if(cancelled){sound.stop();if(gesture.kind==='tray'){tray.tx=tray.x;tray.ty=tray.y;}}
    if(gesture.kind==='mug'&&(gesture.dragged||gesture.wasSettling))landMug(cancelled);
    else if(gesture.kind==='pet'){
      if(!cancelled&&!gesture.stroked&&now-gesture.time<.3&&gesture.travel<12)frightenedUntil=now+1.5;
      else if(gesture.stroked||(!cancelled&&!gesture.poked))pettedUntil=now+2.6;
    }else if(!cancelled){peekUntil=now+.8;releasedAt=now;}
    hover=null;updateCursor();
  }
  function cancel(){keyboardPurrUntil=0;sound.purr(false);finishGesture(true);keys.clear();if(keyboardHeld)landMug(true);keyboardHeld=false;}
  function reset(){cancel();tray.tx=0;tray.ty=0;mug.tx=0;mug.ty=0;mug.landing={seat:true,silent:true,contacted:false,airborne:false};mug.fallSpeed=0;releasedAt=now;}
  function keyboard(e,kind=selected){
    if(e.code==='Space'){e.preventDefault();if(!e.repeat)togglePause();return;}
    if(paused)return;
    sound.unlock();selected=kind;
    if(e.key==='Escape'){e.preventDefault();cancel();return;}
    if(e.key==='Home'){e.preventDefault();reset();return;}
    if(e.key.startsWith('Arrow')&&kind!=='pet'){
      e.preventDefault();keys.add(e.key);
      if(kind==='mug'&&!keyboardHeld){mug.seated=false;mug.landing=null;keyboardHeld=true;}
    }
    if(e.key==='Enter'&&!e.repeat){
      e.preventDefault();
      if(kind==='pet'){if(e.shiftKey){keyboardPurrUntil=0;frightenedUntil=now+1.5;}else{pettedUntil=now+2.8;keyboardPurrUntil=performance.now()+450;}}
      else if(kind==='mug'){if(keyboardHeld)landMug();else{mug.seated=false;mug.landing=null;keyboardHeld=true;}}
      else peekUntil=now+1;
      idle=0;
    }
  }
  canvas.addEventListener('pointerdown',e=>{
    if(paused||active||e.button!==0)return;
    const p=point(e),kind=hit(p,e.pointerType);if(!kind)return;
    e.preventDefault();if(keyboardHeld)landMug();sound.unlock();focused=null;selected=kind;canvas.focus({preventScroll:true});
    const wasSettling=kind==='mug'&&!!mug.landing,heldLift=wasSettling?mug.lift:0;
    if(wasSettling){mug.tx=mug.x;mug.ty=mug.y;mug.landing=null;mug.seated=false;}
    active={id:e.pointerId,kind,start:p,last:p,startScreen:{x:e.clientX,y:e.clientY},lastScreen:{x:e.clientX,y:e.clientY},stamp:e.timeStamp,time:now,travel:0,dragged:false,stroked:false,wasSettling,heldLift,startObject:{x:kind==='tray'?tray.tx:mug.x,y:kind==='tray'?tray.ty:mug.y}};
    canvas.setPointerCapture(e.pointerId);idle=0;updateCursor();
  });
  canvas.addEventListener('pointermove',e=>{
    const p=point(e);
    if(!active){hover=hit(p,e.pointerType);updateCursor();return;}
    if(active.id!==e.pointerId)return;e.preventDefault();
    const a=active,dx=e.clientX-a.lastScreen.x,dy=e.clientY-a.lastScreen.y,delta=Math.hypot(dx,dy),dt=Math.max((e.timeStamp-a.stamp)/1000,.008),speed=delta/dt;
    a.travel+=delta;
    if(a.kind==='pet'){
      if(speed>800&&delta>7){a.poked=true;a.purrUntil=0;frightenedUntil=now+1.5;}
      else if(now-a.time>.14&&a.travel>8&&speed<500){a.stroked=true;a.purrUntil=performance.now()+140;pettedUntil=now+2.6;strokeLean=clamp(dx*.025,-.3,.3);}
    }else{
      if(!a.dragged&&Math.hypot(e.clientX-a.startScreen.x,e.clientY-a.startScreen.y)>5){a.dragged=true;if(a.kind==='mug'){mug.seated=false;mug.landing=null;}}
      if(a.dragged){
        const x=a.startObject.x+p.x-a.start.x,y=a.startObject.y+p.y-a.start.y;
        if(a.kind==='mug'){const target=fit('mug',x,y);mug.tx=target.x;mug.ty=target.y;}
        else moveTray(x,y);
      }
    }
    a.last=p;a.lastScreen={x:e.clientX,y:e.clientY};a.stamp=e.timeStamp;idle=0;
  });
  canvas.addEventListener('pointerup',e=>{if(active?.id===e.pointerId)finishGesture();});
  canvas.addEventListener('pointercancel',e=>{if(active?.id===e.pointerId)finishGesture(true);});
  canvas.addEventListener('lostpointercapture',e=>{if(active?.id===e.pointerId)finishGesture(true);});
  canvas.addEventListener('pointerleave',()=>{if(!active){hover=null;updateCursor();}});
  canvas.addEventListener('keydown',e=>keyboard(e));
  window.addEventListener('keyup',e=>keys.delete(e.key));
  for(const control of objectControls){
    const kind=control.dataset.object;
    control.addEventListener('focus',()=>{if(keyboardHeld&&selected!==kind)landMug();selected=kind;focused=kind;peekUntil=now+.7;hint.textContent=kind==='pet'?'Enter for a gentle stroke. Shift + Enter for a quick poke.':kind==='mug'?'Enter to lift. Arrows to move. Enter to place.':'Arrow keys slide the saucer. Home brings everyone back.';});
    control.addEventListener('blur',()=>{focused=null;keys.clear();hint.textContent='Lift the cup. Stroke a sleepy head.';});
    control.addEventListener('keydown',e=>keyboard(e,kind));
    control.addEventListener('click',e=>{if(e.detail===0){keyboard({code:'',key:'Enter',repeat:false,shiftKey:false,preventDefault(){}},kind);}});
  }
  function togglePause(){paused=!paused;cancel();sound.setBlocked(paused||document.hidden);if(!paused)sound.unlock();pauseButton.textContent=paused?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));announcement.textContent=paused?'The scene is paused.':'The scene is playing.';updateCursor();draw(now);}
  pauseButton.addEventListener('click',togglePause);
  window.addEventListener('blur',()=>{cancel();sound.setBlocked(true);});
  window.addEventListener('focus',()=>sound.setBlocked(paused||document.hidden));
  document.addEventListener('visibilitychange',()=>{cancel();sound.setBlocked(paused||document.hidden);});
  motion.addEventListener('change',e=>{reduced=e.matches;});
  function animate(ms){
    const raw=ms/1000,dt=Math.min((raw-previous)||.016,.035);previous=raw;
    if(!paused&&!document.hidden){
      now+=dt;idle+=dt;
      const oldCupX=mug.x,oldCupY=mug.y,oldTrayX=tray.x,oldTrayY=tray.y;
      if(keys.size){
        const dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);
        if(selected==='mug'){const p=fit('mug',mug.tx+dx*dt*95,mug.ty+dy*dt*70);mug.tx=p.x;mug.ty=p.y;}
        else if(selected==='tray')moveTray(tray.tx+dx*dt*85,tray.ty+dy*dt*55);
        idle=0;
      }
      const follow=1-Math.exp(-dt*15),settle=1-Math.exp(-dt*11);
      tray.x=mix(tray.x,tray.tx,follow);tray.y=mix(tray.y,tray.ty,follow);
      if(mug.seated){mug.x=tray.x;mug.y=tray.y;mug.tx=tray.tx;mug.ty=tray.ty;}
      else{
        if(mug.landing?.seat){mug.tx=tray.x;mug.ty=tray.y;}
        mug.x=mix(mug.x,mug.tx,mug.landing?settle:follow);mug.y=mix(mug.y,mug.ty,mug.landing?settle:follow);
      }
      let targetLift=(active?.kind==='mug'&&active.dragged)||keyboardHeld?liftHeight():0;
      if(active?.kind==='mug'&&!active.dragged&&active.wasSettling)targetLift=active.heldLift;
      const align=Math.hypot(mug.tx-mug.x,mug.ty-mug.y);
      if(mug.landing){
        const landing=mug.landing;
        if(!landing.contacted){
          if(landing.seat&&align>7){
            mug.lift=mix(mug.lift,liftHeight(),1-Math.exp(-dt*13));mug.fallSpeed=0;
          }else{
            // Finite descent gives each real contact a measurable normal velocity.
            mug.fallSpeed+=360*dt;const next=mug.lift-mug.fallSpeed*dt;
            if(next<=0){
              const impactSpeed=mug.fallSpeed;mug.lift=0;mug.fallSpeed=0;landing.contacted=true;
              if(landing.airborne&&!landing.silent)sound.place(landing.seat?'ceramic':'table',impactSpeed);
            }else mug.lift=next;
          }
        }
        if(landing.contacted&&align<.6){mug.x=mug.tx;mug.y=mug.ty;mug.seated=landing.seat;mug.landing=null;releasedAt=now;}
      }else{
        mug.lift=mix(mug.lift,targetLift,1-Math.exp(-dt*(targetLift?13:10)));mug.fallSpeed=0;
      }
      const vx=(mug.x-oldCupX)/dt,vy=(mug.y-oldCupY)/dt,traySpeed=Math.hypot(tray.x-oldTrayX,tray.y-oldTrayY)/dt;
      // The saucer stays on the table. Mug drags are lifts, never surface scrapes.
      sound.motion(traySpeed);
      if(Math.hypot(vx,vy)>480&&((active?.dragged&&active.kind!=='pet')||keyboardHeld))frightenedUntil=now+1.6;
      mug.tilt=mix(mug.tilt,reduced?0:clamp(-vx*.00015,-.045,.045),1-Math.exp(-dt*9));
      if(active?.kind==='pet'&&now-active.time>.38&&!active.stroked&&now>frightenedUntil){active.stroked=true;pettedUntil=now+2.6;}
      const stroking=now>=frightenedUntil&&((active?.kind==='pet'&&!active.poked&&performance.now()<(active.purrUntil||0))||performance.now()<keyboardPurrUntil);
      sound.purr(stroking);
      let expression,target;
      if(now<frightenedUntil){expression='startled';target=0;}
      else if(now<pettedUntil){expression='petted';target=.93;}
      else if((active&&active.kind!=='pet'&&active.dragged)||keyboardHeld||now<peekUntil){expression='curious';target=1;}
      else if(mug.landing||now-releasedAt<2.4){expression='content';target=.9;}
      else if(idle%20>12&&idle%20<16){expression='nesting';target=.34;}
      else if(idle%20>6){expression='peeking';target=.88;}
      else{expression='sleepy';target=.72;}
      setExpression(expression);state.reveal=mix(state.reveal,target,1-Math.exp(-dt*(expression==='startled'?19:3.5)));
      sound.headPose(state.reveal);
      strokeLean*=Math.exp(-dt*.8);
      const nest=expression==='nesting'&&!reduced?Math.sin(now*3)*.18:0;
      state.lean=mix(state.lean,clamp(-vx/220+(expression==='petted'?strokeLean:0)+nest,-.7,.7),1-Math.exp(-dt*11));
      for(const control of objectControls)control.setAttribute('aria-pressed',String(control.dataset.object==='mug'&&keyboardHeld));
    }
    draw(now);requestAnimationFrame(animate);
  }
  function focusOutline(kind){
    if(focused!==kind)return;ctx.save();ctx.strokeStyle='#737b56';ctx.lineWidth=1.4;ctx.setLineDash([4,5]);
    if(kind==='tray'){ctx.beginPath();ctx.ellipse(0,151,198,53,0,0,Math.PI*2);ctx.stroke();}
    if(kind==='mug'){ctx.stroke(mugBody);ctx.stroke(mugHandle);}
    if(kind==='pet'){const p=pose(now);ctx.beginPath();ctx.ellipse(p.x,p.y-4,66,51,p.angle,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function drawTray(){ctx.save();ctx.translate(tray.x,tray.y);saucer();if((active?.kind==='mug'&&active.dragged)||keyboardHeld){if(overlaps(mug.tx,mug.ty)){ctx.beginPath();ctx.ellipse(0,148,91,18,0,0,Math.PI*2);ctx.strokeStyle='#e6e2caaa';ctx.lineWidth=2;ctx.stroke();}}focusOutline('tray');ctx.restore();}
  function drawMug(t){
    const spread=mug.lift*.55;shadow(mug.x,mug.y+153,110+spread,19+mug.lift*.12,.23/(1+mug.lift*.025));
    shadow(mug.x,mug.y+153,82,7,.25*Math.max(0,1-mug.lift/10));
    ctx.save();ctx.translate(mug.x,mug.y-mug.lift+153);ctx.rotate(mug.tilt);ctx.translate(0,-153);
    cupBack(t);ctx.save();ctx.clip(new Path2D('M-103 -250 L103 -250 L103 -24 C103 12 -103 12 -103 -24 Z'));creature(t);ctx.restore();cupFront();paws(t);focusOutline('mug');focusOutline('pet');
    if(hover==='mug'&&!active){ctx.beginPath();ctx.ellipse(0,-22,116,36,0,0,Math.PI*2);ctx.strokeStyle='#f4dcc170';ctx.lineWidth=1;ctx.stroke();}
    ctx.restore();
  }
  function draw(t){
    const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
    const trayInFront=!mug.seated&&!mug.landing&&mug.lift<1&&mug.y<tray.y-30;
    if(trayInFront){drawMug(t);drawTray();}else{drawTray();drawMug(t);}ctx.restore();
  }
  function resize(){
    cancel();const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const roomy=w>=900&&innerHeight>=600;scale=Math.min(w/510,h/470,1.35);ox=w/2;oy=h*.5-(roomy?25:20)*scale;
    const pad=16/scale,half=w/(2*scale),top=-oy/scale,bottom=(h-oy)/scale;
    limits.tray={minX:Math.min(0,-half+pad+198),maxX:Math.max(0,half-pad-198),minY:Math.min(0,top+pad+137),maxY:Math.max(0,bottom-pad-210)};
    limits.mug={minX:Math.min(0,-half+pad+132),maxX:Math.max(0,half-pad-198),minY:Math.min(0,top+pad+137+liftHeight()),maxY:Math.max(0,bottom-pad-165)};
    for(const [kind,object]of [['tray',tray],['mug',mug]]){const p=fit(kind,object.x,object.y),target=fit(kind,object.tx,object.ty);object.x=p.x;object.y=p.y;object.tx=target.x;object.ty=target.y;}
    if(mug.seated){mug.x=tray.x;mug.y=tray.y;mug.tx=tray.tx;mug.ty=tray.ty;}
    else if(!mug.landing&&overlaps(mug.tx,mug.ty))landMug(true);
    hover=null;updateCursor();
  }
  window.addEventListener('resize',resize);resize();requestAnimationFrame(animate);
  // Read-only scene diagnostics are opt-in for browser verification.
  if(new URLSearchParams(location.search).has('inspect'))globalThis.SleepyTenantPreview=Object.freeze({getState:()=>({mug:{...mug,landing:mug.landing?{...mug.landing}:null},saucer:{...tray},pet:{...state},active:active?{kind:active.kind,dragged:active.dragged}:null,keyboardHeld,paused,camera:{w,h,scale,ox,oy},limits:JSON.parse(JSON.stringify(limits)),cursor:canvas.style.cursor})});

})();
