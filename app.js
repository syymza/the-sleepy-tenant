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
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motion.matches, paused = false, w = 0, h = 0, scale = 1, ox = 0, oy = 0, boundX = 105;
  let now = 0, previous = 0, idle = 0, frightenedUntil = 0, releasedAt = -10;
  let active = null, lastPointer = null, lastInputTime = 0;
  const keys = new Set();
  const state = {x:0,y:0,tx:0,ty:0,lean:0,reveal:.72,expression:'sleepy',speed:0};
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const mix = (a,b,t) => a+(b-a)*t;
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
  function saucer(){
    shadow(6,172,240,41,.16);shadow(0,163,174,20,.14);
    ellipse(0,157,188,47,'#a7aa8d');
    ellipse(0,151,190,47,gradient(-120,120,90,183,[[0,'#dedcc6'],[.45,'#c9ccb1'],[1,'#a7af92']]));
    ctx.save();ctx.beginPath();ctx.ellipse(0,150,187,44,0,0,Math.PI*2);ctx.clip();grain(null,.35);ctx.restore();
    ctx.beginPath();ctx.ellipse(0,148,176,38,0,.12,Math.PI-.12);ctx.strokeStyle='#e2e1cb';ctx.lineWidth=2;ctx.stroke();
    ellipse(0,150,127,27,'#aeb69a');ellipse(0,148,125,25,'#c1c5aa');
    shadow(-3,151,119,24,.25);
    // A little fallen sprig, painted with the same restrained material palette.
    ctx.save();ctx.translate(-143,151);ctx.rotate(-.28);
    path('M-13 4 Q1 -2 24 -4',null,'#858b68',1.5);
    path('M0 0 Q-16 -18 -22 -9 Q-17 3 0 0','#8b9776');
    path('M8 -2 Q13 -17 24 -12 Q24 -3 8 -2','#a0a783');ctx.restore();
  }
  function cupBack(t){
    // The handle has real negative space instead of a painted-on inner patch.
    const handle=new Path2D('M105 -22 C181 -45 199 42 165 90 C151 110 132 116 111 106 L104 84 C147 104 165 59 157 24 C151 2 136 -5 109 9 Z');
    ctx.save();ctx.shadowColor='#79604c35';ctx.shadowBlur=5;ctx.shadowOffsetY=4;
    ctx.fillStyle=gradient(100,-20,180,95,[[0,'#c9a78b'],[.4,'#b88b70'],[1,'#8e6554']]);ctx.fill(handle);ctx.restore();grain(handle,.7);
    path('M125 -14 C170 -17 181 68 135 96',null,'#d7b89a',2.4);
    ellipse(0,-22,116,36,gradient(0,-55,0,13,[[0,'#d6b49a'],[1,'#b58b70']]));
    ellipse(0,-24,104,27,gradient(0,-50,0,10,[[0,'#604a3e'],[.55,'#8a6b54'],[1,'#b69272']]));
    // A folded moss-green quilt in the far side of the little home.
    ctx.save();ctx.translate(state.expression==='nesting'&&!reduced?Math.sin(t*3)*2.5:0,0);
    path('M-86 -14 Q-74 -36 -49 -25 Q-33 -18 -17 -19 L-18 2 L-86 2 Z','#939a77');
    path('M-78 -15 Q-55 -24 -28 -11',null,'#b2b394',2);
    ctx.restore();
  }
  function pose(t){
    const breathe=reduced?0:Math.sin(t*1.7)*.7;
    const grip=clamp((state.reveal-.69)/.26,0,1);
    return {x:state.lean*10,y:mix(60,-43,state.reveal)+breathe,
      angle:reduced?0:state.lean*.08,grip:grip*grip*(3-2*grip)};
  }
  function hand(sign,p){
    const x=sign*46+state.lean*3;
    const lip=-23+31*Math.sqrt(1-(x/110)**2);
    return {x,y:lip+(1-p.grip)*20,lip};
  }
  function creature(t){
    const p=pose(t),lean=state.lean;
    const fur=gradient(-50,-80,50,40,[[0,'#f4e8cc'],[.52,'#e7d6b2'],[1,'#c3a984']]);
    // A compact body follows the head as one rigid pose; the arms bend to the lip.
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ellipse(0,29,39,33,fur);ctx.restore();
    for(const sign of [-1,1]){
      const h=hand(sign,p),sx=p.x+sign*35*Math.cos(p.angle)-27*Math.sin(p.angle),sy=p.y+sign*35*Math.sin(p.angle)+27*Math.cos(p.angle);
      const arm=new Path2D();arm.moveTo(sx,sy);arm.bezierCurveTo(sx+sign*13,sy+8,h.x,h.y-14,h.x,h.y-3);
      ctx.strokeStyle=fur;ctx.lineWidth=16;ctx.lineCap='round';ctx.stroke(arm);
      ellipse(h.x,h.y-4,11,10,fur);
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
    for(const x of [-36,36]){const blush=ctx.createRadialGradient(x,12,1,x,12,12);blush.addColorStop(0,'#dcae9766');blush.addColorStop(1,'#dcae9700');ellipse(x,12,12,8,blush);}
    const blink=(!reduced && (t%5.7<.16 || state.expression==='sleepy' && t%5.7<2.5));
    ctx.lineCap='round';ctx.lineWidth=2.8;ctx.strokeStyle='#4b4739';
    const gaze=clamp(lean*2,-2,2);
    for(const ex of [-22,22]){
      if(blink || state.expression==='nesting' || state.expression==='content')path(`M${ex-5.5} -4 Q${ex} 1 ${ex+5.5} -4`,null,'#62523f',2.5);
      else {ellipse(ex+gaze,-5,4.7,state.expression==='startled'?6.6:5.8,'#4c4435');ellipse(ex+gaze-1.2,-7,1.35,1.5,'#fff5db');}
    }
    path('M-4 10 Q0 7 4 10 Q4 13 0 14 Q-4 13 -4 10','#94745d');
    path('M0 14 L0 17 M-5 18 Q0 22 5 18',null,'#87715a',1.25);
    ctx.restore();
  }
  function cupFront(){
    const body=new Path2D('M-116 -22 C-113 24 -112 102 -84 132 C-55 160 55 160 84 132 C112 102 113 24 116 -22');
    body.ellipse(0,-22,116,36,0,0,Math.PI);body.closePath();
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
    const p=pose(t),curl=clamp((p.grip-.6)/.4,0,1);
    if(!curl)return;
    for(const sign of [-1,1]){
      const h=hand(sign,p);ctx.save();ctx.translate(h.x,h.lip);
      shadow(0,4,13,4,.17*curl);
      const fingers=path(`M-10 -2 Q0 ${-2-6*curl} 10 -2 C12 ${-2+11*curl} 6 ${-2+15*curl} 0 ${-2+15*curl} C-7 ${-2+15*curl} -12 ${-2+11*curl} -10 -2 Z`,gradient(-10,-7,9,16,[[0,'#f0e2c2'],[.55,'#e0ccaa'],[1,'#bfa27d']]));
      grain(fingers,.18);
      if(curl>.3)path(`M-3 4 L-3 ${4+4*curl} M3 4 L3 ${4+4*curl}`,null,'#b49a7766',.85);
      ctx.restore();
    }
  }
  const descriptions={sleepy:'a very small someone, almost awake',curious:'oh. is that you?',startled:'a little slower, perhaps',content:'yes. this is a good place.',peeking:'just checking on the world',nesting:'one more tuck, then a little rest'};
  function setExpression(value){if(value===state.expression)return;state.expression=value;mood.textContent=descriptions[value];announcement.textContent=descriptions[value];sound.react(value);}
  function animate(ms){
    const raw=ms/1000,dt=Math.min((raw-previous)||.016,.04);previous=raw;
    if(!paused && !document.hidden){
      now+=dt;
      idle+=dt;
      if(keys.size){let dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);state.tx=clamp(state.tx+dx*dt*42,-boundX,boundX);state.ty=clamp(state.ty+dy*dt*27,-27,27);idle=0;}
      state.speed*=Math.exp(-dt*8);
      const moving=active!==null||keys.size>0;
      let expression, target;
      if(now<frightenedUntil){expression='startled';target=0;}
      else if(moving){expression='curious';target=1;}
      else if(now-releasedAt<3){expression='content';target=.9;}
      else if(idle%20>12&&idle%20<16){expression='nesting';target=.34;}
      else if(idle%20>6){expression='peeking';target=.88;}
      else{expression='sleepy';target=.72;}
      setExpression(expression);
      const smoothing=1-Math.exp(-dt*(reduced?15:8));
      const oldX=state.x,oldY=state.y;
      state.x=mix(state.x,state.tx,smoothing);state.y=mix(state.y,state.ty,smoothing);
      sound.motion(Math.hypot(state.x-oldX,state.y-oldY)/dt);
      state.reveal=mix(state.reveal,target,1-Math.exp(-dt*(expression==='startled'?13:2.8)));
      const nest=expression==='nesting'&&!reduced?Math.sin(now*3)*.24:0;
      state.lean=mix(state.lean,clamp((state.tx-state.x)*-.035+state.tx/250+nest,-.65,.65),smoothing);
    }
    draw(paused?lastInputTime:now);
    requestAnimationFrame(animate);
  }
  function draw(t){
    ctx.setTransform(devicePixelRatio>2?2:devicePixelRatio,0,0,devicePixelRatio>2?2:devicePixelRatio,0,0);ctx.clearRect(0,0,w,h);
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
    // Grounded ambient shadow belongs to the room, contact shadows to the saucer.
    shadow(15,175,269,47,.08);
    ctx.translate(state.x,state.y);
    saucer();
    ctx.save();ctx.rotate(reduced?0:state.lean*.018);cupBack(t);
    ctx.save();ctx.clip(new Path2D('M-103 -250 L103 -250 L103 -24 C103 12 -103 12 -103 -24 Z'));
    creature(t);ctx.restore();cupFront();paws(t);ctx.restore();
    ctx.restore();
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();w=rect.width;h=rect.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    scale=Math.min(w/510,h/450,1.35);ox=w/2;oy=h*.5-20*scale;
    boundX=Math.max(0,Math.min(105,(w/scale-400)/2-12));
    state.tx=clamp(state.tx,-boundX,boundX);state.x=clamp(state.x,-boundX,boundX);
  }
  function point(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left-ox)/scale,y:(e.clientY-b.top-oy)/scale};}
  canvas.addEventListener('pointerdown',e=>{
    if(paused||active!==null||e.button!==0)return;const p=point(e);
    if(Math.abs(p.x-state.x)>211||p.y-state.y<109||p.y-state.y>211)return;
    sound.unlock();canvas.classList.add('pointer-focus');active=e.pointerId;lastPointer={...p,t:e.timeStamp};canvas.setPointerCapture(active);canvas.focus({preventScroll:true});idle=0;
  });
  canvas.addEventListener('pointermove',e=>{
    if(active!==e.pointerId)return;e.preventDefault();const p=point(e), elapsed=Math.max((e.timeStamp-lastPointer.t)/1000,.008);
    const dx=p.x-lastPointer.x,dy=p.y-lastPointer.y, speed=Math.hypot(dx,dy)/elapsed;
    state.tx=clamp(state.tx+dx,-boundX,boundX);state.ty=clamp(state.ty+dy*.65,-27,27);
    if(speed>650&&Math.hypot(dx,dy)>10){frightenedUntil=now+2.6;state.speed=speed;}
    lastPointer={...p,t:e.timeStamp};idle=0;
  });
  function release(e){if(e.pointerId!==active)return;active=null;lastPointer=null;releasedAt=now;idle=0;}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('keydown',e=>{
    sound.unlock();
    canvas.classList.remove('pointer-focus');
    if(e.key.startsWith('Arrow')){e.preventDefault();if(!paused)keys.add(e.key);}
    if(e.code==='Space'){e.preventDefault();if(!e.repeat)togglePause();}
    if(e.key==='Home'){e.preventDefault();state.tx=state.ty=0;idle=0;releasedAt=now;}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key));
  function cancel(){keys.clear();if(active!==null){const id=active;active=null;lastPointer=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}}
  window.addEventListener('blur',()=>{cancel();sound.setBlocked(true);});
  window.addEventListener('focus',()=>sound.setBlocked(paused||document.hidden));
  document.addEventListener('visibilitychange',()=>{cancel();sound.setBlocked(paused||document.hidden);});
  function togglePause(){paused=!paused;lastInputTime=now;cancel();sound.setBlocked(paused||document.hidden);if(!paused)sound.unlock();pauseButton.textContent=paused?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));announcement.textContent=paused?'The scene is paused.':'The scene is playing.';}
  pauseButton.addEventListener('click',togglePause);
  motion.addEventListener('change',e=>{reduced=e.matches;});window.addEventListener('resize',resize);resize();requestAnimationFrame(animate);
})();
