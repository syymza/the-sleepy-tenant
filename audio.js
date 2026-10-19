/* Local sound only. The bundled public-domain purr decodes only after opt-in. */
globalThis.SleepySound = class SleepySound {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.enabled = false;
    this.blocked = false;
    this.context = null;
    this.master = null;
    this.voices = new Set();
    this.scrape = null;
    this.purring = null;
    this.purrBuffer = null;
    this.purrLoading = null;
    this.generation = 0;
    this.lastPeek = -Infinity;
    this.lastRustle = -Infinity;
    this.lastContact = -Infinity;
    this.contactVoice = null;
    this.foley = null;
  }
  async enable() {
    const attempt = ++this.generation;
    this.enabled = true;
    try {
      if (!this.context || this.context.state === 'closed') {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) throw new Error('Audio unavailable');
        this.context = new Audio({latencyHint:'interactive'});
        this.purrBuffer = null;this.purrLoading = null;this.foley = null;
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const context=this.context;
        context.addEventListener('statechange', () => {
          if (this.context === context && context.state !== 'running') this.stop();
        });
      }
      this.loadFoley();
      // Explicit opt-in uses media playback routing, including iPhone silent mode.
      // Unsupported or restricted session APIs must not prevent ordinary audio.
      try {
        if (globalThis.navigator?.audioSession) navigator.audioSession.type = 'playback';
      } catch {}
      // Called synchronously from the button's activation, before the first await.
      await this.context.resume();
      if (attempt !== this.generation || !this.enabled) return false;
      if (this.context.state !== 'running') throw new Error('Audio interrupted');
      await this.loadPurr();
      if (attempt !== this.generation || !this.enabled) return false;
      this.level();
      this.onChange(true);
      return true;
    } catch {
      if (attempt === this.generation) {
        this.enabled = false;
        this.stop();
        this.onChange(false, 'Sound is unavailable. You can try enabling it again.');
      }
      return false;
    }
  }
  disable() {
    ++this.generation;
    this.enabled = false;
    this.stop();
    this.onChange(false);
  }
  unlock() {
    if (!this.enabled || !this.context || this.context.state === 'closed') return;
    // Safari may suspend or interrupt audio after a lock screen or a phone call.
    // Resume only from a fresh pointer/key/button gesture; never replay old voices.
    const attempt = this.generation;
    if (this.context.state !== 'running') {
      this.context.resume().then(() => {
        if (attempt === this.generation && this.enabled) this.level();
      }).catch(() => {});
    } else this.level();
  }
  level() {
    if (!this.master) return;
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.enabled && !this.blocked ? .45 : 0, t, .015);
  }
  setBlocked(value) {
    this.blocked = value;
    if (value) this.stop();
    else this.level();
  }
  ready() {
    return this.enabled && !this.blocked && this.context?.state === 'running';
  }
  stop() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, .008);
    this.stopScrape();
    this.stopPurr();
    for (const voice of [...this.voices]) voice.finish(true);
  }
  loadPurr() {
    if (this.purrBuffer) return Promise.resolve();
    if (!this.purrLoading) {
      const context=this.context;
      const bytes=Uint8Array.from(atob(SleepyPurrRecording.wavBase64),c=>c.charCodeAt(0));
      this.purrLoading=context.decodeAudioData(bytes.buffer).then(buffer=>{
        if (this.context===context) this.purrBuffer=buffer;
      });
    }
    return this.purrLoading;
  }
  stopPurr() {
    if (!this.purring) return;
    try { this.purring.source.stop(); } catch {}
    this.purring.nodes.forEach(node=>node.disconnect());
    this.purring=null;
  }
  purr(stroking) {
    if (!this.ready() || !this.purrBuffer) { this.stopPurr(); return; }
    const t=this.context.currentTime;
    if (stroking && !this.purring) {
      const source=this.context.createBufferSource(),gain=this.context.createGain();
      source.buffer=this.purrBuffer;source.loop=true;gain.gain.value=0;
      source.connect(gain).connect(this.master);source.start();
      this.purring={source,gain,nodes:[source,gain],quietSince:null};
    }
    const voice=this.purring;if (!voice) return;
    // The approved WAV is already quiet. Undo the synth bus's .45 attenuation
    // so its settled level matches that preview, without normalization.
    voice.gain.gain.setTargetAtTime(stroking?1/.45:0,t,stroking?.18:.09);
    if (stroking) voice.quietSince=null;
    else {voice.quietSince??=t;if(t-voice.quietSince>.45)this.stopPurr();}
  }
  loadFoley() {
    if (this.foley) return;
    this.foley = {};
    for (const [name,clip] of Object.entries(SleepyFoleyRecording)) {
      const bytes=atob(clip.pcm16),buffer=this.context.createBuffer(1,bytes.length/2,clip.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const value=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);data[i]=(value&32768?value-65536:value)/32768;}
      this.foley[name]=buffer;
    }
  }
  stopScrape() {
    if (!this.scrape) return;
    try {this.scrape.source.stop();} catch {}
    this.scrape.nodes.forEach(n=>n.disconnect());this.scrape=null;
  }
  motion(speed) {
    if (!this.ready()) {this.stopScrape();return;}
    const t=this.context.currentTime,sliding=speed>=5;
    if (sliding && !this.scrape) {
      const source=this.context.createBufferSource(),gain=this.context.createGain();
      source.buffer=this.foley.scrape;source.loop=true;gain.gain.value=0;
      source.connect(gain).connect(this.master);source.start();
      this.scrape={source,gain,nodes:[source,gain],quietSince:null};
    }
    if (!this.scrape) return;
    const amount=Math.sqrt(Math.min(speed/240,1));
    this.scrape.gain.gain.setTargetAtTime(sliding?.009+.010*amount:0,t,.025);
    if (!sliding) {
      this.scrape.quietSince??=t;
      if(t-this.scrape.quietSince>.08)this.stopScrape();
    } else this.scrape.quietSince=null;
  }
  react(expression) {
    if (!this.ready() || this.voices.size >= 2) return;
    const t = this.context.currentTime;
    if (expression === 'peeking' && t-this.lastPeek > 8) {
      this.lastPeek = t;this.murmur();
    }
    if (expression === 'startled' && t-this.lastRustle > 1.5) {
      this.lastRustle = t;this.rustle();
    }
  }
  place(surface='ceramic',normalSpeed=100) {
    if(!this.ready()||this.voices.size>=2||!['ceramic','table'].includes(surface))return false;
    const t=this.context.currentTime;
    if(t-this.lastContact<.18)return false;
    this.lastContact=t;
    if(this.contactVoice)this.contactVoice.finish(true);
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=this.foley[surface];
    const energy=Math.min(Math.max(normalSpeed,0)/180,1);
    gain.gain.value=surface==='ceramic'?.018+.020*energy:.010+.012*energy;
    source.connect(gain).connect(this.master);
    this.contactVoice=this.voice(source,[source,gain],source.buffer.duration);
    return true;
  }
  voice(source, nodes, duration) {
    const voice = {finish: stop => {
      if (!this.voices.delete(voice)) return;
      source.onended = null;
      if(this.contactVoice===voice)this.contactVoice=null;
      if (stop) { try {source.stop();} catch {} }
      nodes.forEach(n=>n.disconnect());
    }};
    this.voices.add(voice);source.onended=()=>voice.finish(false);
    source.start();source.stop(this.context.currentTime+duration);return voice;
  }
  murmur() {
    const t=this.context.currentTime, source=this.context.createOscillator();
    source.type='sine';source.frequency.setValueAtTime(290,t);
    source.frequency.exponentialRampToValueAtTime(225,t+.32);
    const gain=this.context.createGain();gain.gain.setValueAtTime(0,t);
    gain.gain.linearRampToValueAtTime(.044,t+.08);
    gain.gain.exponentialRampToValueAtTime(.001,t+.38);
    gain.gain.linearRampToValueAtTime(0,t+.43);
    source.connect(gain).connect(this.master);this.voice(source,[source,gain],.45);
  }
  rustle() {
    const t=this.context.currentTime,source=this.context.createBufferSource();source.buffer=this.noise;
    const filter=this.context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1550;filter.Q.value=.6;
    const gain=this.context.createGain();gain.gain.setValueAtTime(0,t);
    gain.gain.linearRampToValueAtTime(.045,t+.035);
    gain.gain.exponentialRampToValueAtTime(.001,t+.21);
    gain.gain.linearRampToValueAtTime(0,t+.25);
    source.connect(filter).connect(gain).connect(this.master);this.voice(source,[source,filter,gain],.27);
  }
};
