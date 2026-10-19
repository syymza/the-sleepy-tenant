const {test}=require('node:test'),assert=require('node:assert/strict');require('../assets/purr.js');require('../assets/foley.js');require('../assets/meow.js');require('../audio.js');
class Param {constructor(){this.value=0;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node {constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();}connect(){return this;}disconnect(){}start(){this.started=true;}stop(){this.stopped=true;}}
class Context {constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination=new Node();this.listeners={};Context.count++;}decodeAudioData(){return Promise.resolve({duration:4});}createGain(){return this.lastGain=new Node();}createBuffer(_channels,length=48000,rate=48000){return{duration:length/rate,getChannelData:()=>new Float32Array(length)};}createBufferSource(){return new Node();}createOscillator(){return new Node();}createBiquadFilter(){return new Node();}addEventListener(n,f){this.listeners[n]=f;}resume(){this.state='running';return Promise.resolve();}}
Context.count=0;globalThis.AudioContext=Context;
test('off by default without allocating a context or voices',()=>{const n=Context.count,s=new SleepySound();s.motion(200);s.headPose(.83);assert.equal(Context.count,n);assert.equal(s.context,null);assert.equal(s.voices.size,0);});
test('enable is silent and movement uses one bounded scrape source',async()=>{const s=new SleepySound();await s.enable();assert.equal(s.voices.size,0);assert.equal(s.scrape,null);s.motion(1000);const source=s.scrape.source;for(let i=0;i<100;i++)s.motion(1000);assert.equal(s.scrape.source,source);assert.ok(s.scrape.gain.gain.value<=.065);s.disable();assert.ok(source.stopped);assert.equal(s.scrape,null);});
test('reactions have cooldowns, bounded polyphony and mute clears every voice',async()=>{const s=new SleepySound();await s.enable();s.headPose(.83);s.headPose(.83);assert.equal(s.voices.size,1);s.react('startled');for(let i=0;i<20;i++)s.react('startled');assert.equal(s.voices.size,2);s.disable();assert.equal(s.voices.size,0);s.headPose(.83);assert.equal(s.voices.size,0);});
test('pause stops all voices and prevents new sound until resumed',async()=>{const s=new SleepySound();await s.enable();s.motion(100);s.headPose(.83);s.setBlocked(true);assert.equal(s.scrape,null);assert.equal(s.voices.size,0);s.motion(100);assert.equal(s.scrape,null);s.setBlocked(false);s.motion(100);assert.ok(s.scrape);s.disable();});
test('muting while a resume is pending cannot re-enable sound',async()=>{const s=new SleepySound();let resume;const original=Context.prototype.resume;Context.prototype.resume=function(){return new Promise(resolve=>{resume=()=>{this.state='running';resolve();};});};const pending=s.enable();s.disable();resume();await pending;assert.equal(s.enabled,false);assert.equal(s.master.gain.value,0);Context.prototype.resume=original;});
test('suspension clears pending voices and muted gestures do not resume',async()=>{const s=new SleepySound();await s.enable();s.motion(100);s.headPose(.83);s.context.state='suspended';s.context.listeners.statechange();assert.equal(s.voices.size,0);assert.equal(s.scrape,null);s.disable();s.unlock();assert.equal(s.context.state,'suspended');});
test('placement is silent while off and cooldown prevents contact chatter',async()=>{const s=new SleepySound();s.place();assert.equal(s.context,null);await s.enable();for(let i=0;i<20;i++)s.place();assert.equal(s.voices.size,1);s.disable();assert.equal(s.voices.size,0);});

test('recorded purr is the approved WAV, lazy and bounded; release, mute and suspension stop it',async()=>{
 const crypto=require('node:crypto'),bytes=Buffer.from(SleepyPurrRecording.wavBase64,'base64');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'72e267b067cf96f0a2d6a30f712def226b00ec91d318b54bbe7621b9e36f4bb3');
 assert.equal(SleepyPurrRecording.sourceId,'freesound:695630:reviewed-B');
 const s=new SleepySound();s.purr(true);assert.equal(s.context,null);await s.enable();assert.equal(s.purring,null);
 s.purr(true);const source=s.purring.source;for(let i=0;i<100;i++)s.purr(true);assert.equal(s.purring.source,source);
 s.purr(false);s.context.currentTime+=.5;s.purr(false);assert.equal(s.purring,null);assert.ok(source.stopped);
 s.purr(true);s.setBlocked(true);assert.equal(s.purring,null);s.setBlocked(false);s.purr(true);s.context.state='suspended';s.context.listeners.statechange();assert.equal(s.purring,null);
 s.disable();s.purr(true);assert.equal(s.purring,null);
});
test('muting during purr decode cannot enable sound or start a loop',async()=>{
 const original=Context.prototype.decodeAudioData;let finish;Context.prototype.decodeAudioData=function(){return new Promise(resolve=>{finish=resolve;});};
 const s=new SleepySound(),pending=s.enable();await Promise.resolve();s.disable();finish({duration:4});await pending;assert.equal(s.enabled,false);assert.equal(s.master.gain.value,0);assert.equal(s.purring,null);Context.prototype.decodeAudioData=original;
});

// Isolate navigator and context behavior without altering the host or other tests.
function sessionSound(navigator,onResume=()=>{}) {
 const sandbox={AudioContext:class extends Context {resume(){onResume();return super.resume();}},SleepyPurrRecording,SleepyFoleyRecording,SleepyMeowRecording,atob,navigator};
 require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../audio.js'),'utf8'),sandbox);
 return new sandbox.SleepySound();
}
test('playback session is requested only by enable and before its synchronous resume',async()=>{
 const events=[],session={set type(value){events.push(value);}},s=sessionSound({audioSession:session},()=>events.push('resume'));
 s.unlock();s.motion(200);s.headPose(.83);s.purr(true);s.setBlocked(true);s.setBlocked(false);
 assert.deepEqual(events,[]);assert.equal(s.context,null);
 const pending=s.enable();assert.deepEqual(events,['playback','resume']);assert.equal(await pending,true);
 assert.equal(s.voices.size,0);assert.equal(s.purring,null);s.disable();
 s.unlock();assert.deepEqual(events,['playback','resume']);
 assert.equal(await s.enable(),true);assert.deepEqual(events,['playback','resume','playback','resume']);s.disable();
});
test('missing navigator or audio session API leaves opt-in audio usable',async()=>{
 for(const navigator of [undefined,{}]){const s=sessionSound(navigator);assert.equal(await s.enable(),true);assert.equal(s.context.state,'running');s.motion(100);assert.ok(s.scrape);s.disable();assert.equal(s.scrape,null);}
});
test('throwing audio session lookup or setter cannot fail sound enable',async()=>{
 const lookup={get audioSession(){throw Error('Unavailable');}},setter={audioSession:{set type(_){throw Error('Restricted');}}};
 for(const navigator of [lookup,setter]){const s=sessionSound(navigator);assert.equal(await s.enable(),true);s.purr(true);assert.ok(s.purring);s.setBlocked(true);assert.equal(s.purring,null);s.disable();assert.equal(s.enabled,false);}
});

test('recorded contact families differ, scale modestly, and never overlap',async()=>{const s=new SleepySound();assert.equal(s.foley,null);await s.enable();assert.notEqual(s.foley.ceramic,s.foley.table);assert.ok(s.foley.ceramic.duration>s.foley.table.duration);assert.equal(s.place('ceramic',30),true);const first=s.contactVoice;assert.equal(s.place('table',160),false);s.context.currentTime+=.2;assert.equal(s.place('table',160),true);assert.equal(s.voices.has(first),false);assert.equal(s.voices.size,1);s.setBlocked(true);assert.equal(s.contactVoice,null);assert.equal(s.place('ceramic',120),false);s.disable();});
test('recorded scrape stops at rest and stays below the prior noise level',async()=>{const s=new SleepySound();await s.enable();s.motion(100);const source=s.scrape.source;assert.equal(source.buffer,s.foley.scrape);s.motion(1000);assert.equal(s.scrape.source,source);assert.ok(s.scrape.gain.gain.value<=.019);s.motion(0);s.context.currentTime+=.1;s.motion(0);assert.equal(s.scrape,null);assert.ok(source.stopped);s.disable();});

test('contact intensity follows normal velocity with a restrained cap',async()=>{const s=new SleepySound();await s.enable();s.place('ceramic',30);const low=s.context.lastGain.gain.value;s.context.currentTime+=.2;s.place('ceramic',180);const high=s.context.lastGain.gain.value;assert.ok(high>low);assert.ok(high<.04);s.context.currentTime+=.2;s.place('ceramic',100000);assert.equal(s.context.lastGain.gain.value,high);s.disable();});

test('Foley uses the exact three reviewed PCM edits',()=>{const crypto=require('node:crypto'),expected={ceramic:'7a3fa3fa3812435be1ff2e1b01dff9e4ebfafffa4ab3753d215f1af0994e75a4',table:'94c66e7bae47cb6c03bc13c263267cc290ef9adca4ce81b22ce8e1183d9c9194',scrape:'61f173b813ec98391f34c1397abfc1fb993ff9aa81380dc6eb6433f680eb7de0'};assert.deepEqual(Object.keys(SleepyFoleyRecording).sort(),Object.keys(expected).sort());for(const [name,sha]of Object.entries(expected)){assert.equal(SleepyFoleyRecording[name].sampleRate,24000);assert.equal(crypto.createHash('sha256').update(Buffer.from(SleepyFoleyRecording[name].pcm16,'base64')).digest('hex'),sha);}});

test('head-lift meow is exact audition A, lazy, quiet and not normalized',async()=>{
 const bytes=Buffer.from(SleepyMeowRecording.wavBase64,'base64');
 assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),'f6bfa96d04fdf5ae94e24405ca4e54458eabe2fa2c1b3eb571f43d9f6758491b');
 assert.equal(SleepyMeowRecording.sourceId,'freesound:262312:reviewed-A');
 assert.equal(bytes.readUInt32LE(24),24000);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt16LE(34),16);
 const s=new SleepySound();assert.equal(s.meowBuffer,null);s.headPose(.83);assert.equal(s.context,null);
 await s.enable();assert.equal(s.voices.size,0);assert.equal(s.meowBuffer.duration,14813/24000);s.headPose(.72);
 s.headPose(.83);assert.equal(s.voices.size,1);assert.equal(s.context.lastGain.gain.value,1/.45);
 let peak=0;for(let i=44;i<bytes.length;i+=2)peak=Math.max(peak,Math.abs(bytes.readInt16LE(i)/32768));
 assert.ok(peak>.01&&peak<.013);s.disable();
});
test('visible head rises rearm only after lowering, retain cooldown and never replay missed rises',async()=>{
 const s=new SleepySound();await s.enable();
 for(const expression of ['curious','content','petted','sleepy','nesting','peeking'])s.react(expression);
 s.headPose(.81);assert.equal(s.voices.size,0);s.headPose(.83);assert.equal(s.voices.size,1);
 for(let i=0;i<100;i++){s.headPose(.80);s.headPose(.95);}assert.equal(s.voices.size,1);
 s.stop();s.context.currentTime=7.9;s.headPose(.72);s.headPose(.83);assert.equal(s.voices.size,0);
 s.context.currentTime=8.1;s.headPose(.95);assert.equal(s.voices.size,0);
 s.headPose(.72);s.headPose(.83);assert.equal(s.voices.size,1);s.setBlocked(true);assert.equal(s.voices.size,0);
 s.context.currentTime=17;s.headPose(.72);s.headPose(.83);s.setBlocked(false);s.headPose(.95);assert.equal(s.voices.size,0);
 s.headPose(.72);s.headPose(.83);assert.equal(s.voices.size,1);s.context.state='suspended';s.context.listeners.statechange();assert.equal(s.voices.size,0);
 s.context.state='running';s.context.currentTime=26;s.headPose(.72);s.headPose(.83);assert.equal(s.voices.size,1);s.disable();assert.equal(s.voices.size,0);
 s.context.currentTime=35;s.headPose(.72);s.headPose(.83);await s.enable();s.headPose(.95);assert.equal(s.voices.size,0);
 s.headPose(.72);s.headPose(.83);assert.equal(s.voices.size,1);s.disable();
});
