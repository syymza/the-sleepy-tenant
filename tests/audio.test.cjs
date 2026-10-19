const {test}=require('node:test'),assert=require('node:assert/strict');require('../assets/purr.js');require('../audio.js');
class Param {constructor(){this.value=0;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node {constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();}connect(){return this;}disconnect(){}start(){this.started=true;}stop(){this.stopped=true;}}
class Context {constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination=new Node();this.listeners={};Context.count++;}decodeAudioData(){return Promise.resolve({duration:6});}createGain(){return new Node();}createBuffer(){return{getChannelData:()=>new Float32Array(48000)};}createBufferSource(){return new Node();}createOscillator(){return new Node();}createBiquadFilter(){return new Node();}addEventListener(n,f){this.listeners[n]=f;}resume(){this.state='running';return Promise.resolve();}}
Context.count=0;globalThis.AudioContext=Context;
test('off by default without allocating a context or voices',()=>{const n=Context.count,s=new SleepySound();s.motion(200);s.react('peeking');assert.equal(Context.count,n);assert.equal(s.context,null);assert.equal(s.voices.size,0);});
test('enable is silent and movement uses one bounded scrape source',async()=>{const s=new SleepySound();await s.enable();assert.equal(s.voices.size,0);assert.equal(s.scrape,null);s.motion(1000);const source=s.scrape.source;for(let i=0;i<100;i++)s.motion(1000);assert.equal(s.scrape.source,source);assert.ok(s.scrape.gain.gain.value<=.065);s.disable();assert.ok(source.stopped);assert.equal(s.scrape,null);});
test('reactions have cooldowns, bounded polyphony and mute clears every voice',async()=>{const s=new SleepySound();await s.enable();s.react('peeking');s.react('peeking');assert.equal(s.voices.size,1);s.react('startled');for(let i=0;i<20;i++)s.react('startled');assert.equal(s.voices.size,2);s.disable();assert.equal(s.voices.size,0);s.react('peeking');assert.equal(s.voices.size,0);});
test('pause stops all voices and prevents new sound until resumed',async()=>{const s=new SleepySound();await s.enable();s.motion(100);s.react('peeking');s.setBlocked(true);assert.equal(s.scrape,null);assert.equal(s.voices.size,0);s.motion(100);assert.equal(s.scrape,null);s.setBlocked(false);s.motion(100);assert.ok(s.scrape);s.disable();});
test('muting while a resume is pending cannot re-enable sound',async()=>{const s=new SleepySound();let resume;const original=Context.prototype.resume;Context.prototype.resume=function(){return new Promise(resolve=>{resume=()=>{this.state='running';resolve();};});};const pending=s.enable();s.disable();resume();await pending;assert.equal(s.enabled,false);assert.equal(s.master.gain.value,0);Context.prototype.resume=original;});
test('suspension clears pending voices and muted gestures do not resume',async()=>{const s=new SleepySound();await s.enable();s.motion(100);s.react('peeking');s.context.state='suspended';s.context.listeners.statechange();assert.equal(s.voices.size,0);assert.equal(s.scrape,null);s.disable();s.unlock();assert.equal(s.context.state,'suspended');});
test('placement is silent while off and respects the transient voice cap',async()=>{const s=new SleepySound();s.place();assert.equal(s.context,null);await s.enable();for(let i=0;i<20;i++)s.place();assert.equal(s.voices.size,2);s.disable();assert.equal(s.voices.size,0);});

test('recorded purr is the approved WAV, lazy and bounded; release, mute and suspension stop it',async()=>{
 const crypto=require('node:crypto'),bytes=Buffer.from(SleepyPurrRecording.wavBase64,'base64');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'2a745db9f10b0b74316795b17c9d7290738256946f0d61f8e20011428fb48ecb');
 const s=new SleepySound();s.purr(true);assert.equal(s.context,null);await s.enable();assert.equal(s.purring,null);
 s.purr(true);const source=s.purring.source;for(let i=0;i<100;i++)s.purr(true);assert.equal(s.purring.source,source);
 s.purr(false);s.context.currentTime+=.5;s.purr(false);assert.equal(s.purring,null);assert.ok(source.stopped);
 s.purr(true);s.setBlocked(true);assert.equal(s.purring,null);s.setBlocked(false);s.purr(true);s.context.state='suspended';s.context.listeners.statechange();assert.equal(s.purring,null);
 s.disable();s.purr(true);assert.equal(s.purring,null);
});
test('muting during purr decode cannot enable sound or start a loop',async()=>{
 const original=Context.prototype.decodeAudioData;let finish;Context.prototype.decodeAudioData=function(){return new Promise(resolve=>{finish=resolve;});};
 const s=new SleepySound(),pending=s.enable();await Promise.resolve();s.disable();finish({duration:6});await pending;assert.equal(s.enabled,false);assert.equal(s.master.gain.value,0);assert.equal(s.purring,null);Context.prototype.decodeAudioData=original;
});

// Isolate navigator and context behavior without altering the host or other tests.
function sessionSound(navigator,onResume=()=>{}) {
 const sandbox={AudioContext:class extends Context {resume(){onResume();return super.resume();}},SleepyPurrRecording,atob,navigator};
 require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../audio.js'),'utf8'),sandbox);
 return new sandbox.SleepySound();
}
test('playback session is requested only by enable and before its synchronous resume',async()=>{
 const events=[],session={set type(value){events.push(value);}},s=sessionSound({audioSession:session},()=>events.push('resume'));
 s.unlock();s.motion(200);s.react('peeking');s.purr(true);s.setBlocked(true);s.setBlocked(false);
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
