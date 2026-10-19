/* Local synthesis only. No AudioContext or sound is created before opt-in. */
globalThis.SleepySound = class SleepySound {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.enabled = false;
    this.blocked = false;
    this.context = null;
    this.master = null;
    this.voices = new Set();
    this.scrape = null;
    this.generation = 0;
    this.lastPeek = -Infinity;
    this.lastRustle = -Infinity;
  }
  async enable() {
    const attempt = ++this.generation;
    this.enabled = true;
    try {
      if (!this.context || this.context.state === 'closed') {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) throw new Error('Audio unavailable');
        this.context = new Audio({latencyHint:'interactive'});
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
      // Called synchronously from the button's activation, before the first await.
      await this.context.resume();
      if (attempt !== this.generation || !this.enabled) return false;
      if (this.context.state !== 'running') throw new Error('Audio interrupted');
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
    if (this.scrape) {
      this.scrape.source.stop();
      this.scrape.nodes.forEach(n => n.disconnect());
      this.scrape = null;
    }
    for (const voice of [...this.voices]) voice.finish(true);
  }
  motion(speed) {
    if (!this.ready()) return;
    const t = this.context.currentTime;
    if (speed > 2 && !this.scrape) {
      const source = this.context.createBufferSource();
      source.buffer = this.noise; source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 760; filter.Q.value = .55;
      const gain = this.context.createGain(); gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.master);source.start();
      this.scrape = {source,gain,nodes:[source,filter,gain],quietSince:null};
    }
    if (!this.scrape) return;
    const amount = Math.min(speed / 180, 1);
    this.scrape.gain.gain.setTargetAtTime(speed > 1 ? .065 * Math.sqrt(amount) : 0, t, .045);
    if (speed < 1) {
      this.scrape.quietSince ??= t;
      if (t-this.scrape.quietSince > .3) {
        this.scrape.source.stop();this.scrape.nodes.forEach(n=>n.disconnect());this.scrape=null;
      }
    } else this.scrape.quietSince = null;
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
  place() {
    if(!this.ready() || this.voices.size>=2)return;
    const t=this.context.currentTime,source=this.context.createOscillator(),gain=this.context.createGain();
    source.frequency.setValueAtTime(820,t);source.frequency.exponentialRampToValueAtTime(610,t+.09);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.018,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+.09);gain.gain.linearRampToValueAtTime(0,t+.11);
    source.connect(gain).connect(this.master);this.voice(source,[source,gain],.13);
  }
  voice(source, nodes, duration) {
    const voice = {finish: stop => {
      if (!this.voices.delete(voice)) return;
      source.onended = null;
      if (stop) { try {source.stop();} catch {} }
      nodes.forEach(n=>n.disconnect());
    }};
    this.voices.add(voice);source.onended=()=>voice.finish(false);
    source.start();source.stop(this.context.currentTime+duration);
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
