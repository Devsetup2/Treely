// Web Audio ile üretilen sakinleştirici ortam sesi (dosya gerektirmez):
// rüzgâr + yaprak hışırtısı + ara sıra kuş cıvıltısı.

export class Ambience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.on = false;
    this.season = 'summer';
    this.birdTimer = 0;
  }

  _build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // pembe-ish gürültü tamponu
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 3.2;
    }
    const mkNoise = () => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, Math.random() * 3);
      return s;
    };

    // rüzgâr
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.22;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.Q.value = 0.4;
    mkNoise().connect(lp).connect(this.windGain).connect(this.master);
    this.windFilter = lp;

    // yavaş LFO: rüzgâr dalgalanması
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain).connect(this.windGain.gain);
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 220;
    lfo.connect(lfo2Gain).connect(lp.frequency);
    lfo.start();

    // yaprak hışırtısı
    this.rustleGain = ctx.createGain();
    this.rustleGain.gain.value = 0.035;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3800;
    hp.Q.value = 0.7;
    mkNoise().connect(hp).connect(this.rustleGain).connect(this.master);
    const lfo3 = ctx.createOscillator();
    lfo3.frequency.value = 0.17;
    const lfo3Gain = ctx.createGain();
    lfo3Gain.gain.value = 0.025;
    lfo3.connect(lfo3Gain).connect(this.rustleGain.gain);
    lfo3.start();

    this._applySeasonMix();
    return true;
  }

  _applySeasonMix() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const mix = {
      spring: { wind: 0.16, rustle: 0.03 },
      summer: { wind: 0.2, rustle: 0.04 },
      autumn: { wind: 0.34, rustle: 0.07 },
    }[this.season];
    this.windGain.gain.setTargetAtTime(mix.wind, t, 0.8);
    this.rustleGain.gain.setTargetAtTime(mix.rustle, t, 0.8);
  }

  async start() {
    if (!this.ctx && !this._build()) return false;
    await this.ctx.resume();
    this.on = true;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.6);
    this._scheduleBird(1200);
    return true;
  }

  stop() {
    this.on = false;
    clearTimeout(this.birdTimer);
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
  }

  setSeason(s) {
    this.season = s;
    this._applySeasonMix();
    if (this.on) this.chime();
  }

  _scheduleBird(delay) {
    clearTimeout(this.birdTimer);
    this.birdTimer = setTimeout(() => {
      if (!this.on) return;
      if (this.season !== 'autumn' || Math.random() < 0.25) this._chirp();
      const base = this.season === 'spring' ? 1800 : this.season === 'summer' ? 3200 : 7000;
      this._scheduleBird(base + Math.random() * base * 1.6);
    }, delay);
  }

  _chirp() {
    const ctx = this.ctx;
    const notes = 2 + Math.floor(Math.random() * 4);
    let t = ctx.currentTime + 0.02;
    const f0 = 2300 + Math.random() * 1900;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.4 - 0.7;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const f = f0 * (1 + (Math.random() - 0.4) * 0.35);
      const dur = 0.07 + Math.random() * 0.07;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      if (pan) g.connect(pan);
      else g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur + 0.04 + Math.random() * 0.05;
    }
    if (pan) pan.connect(this.master);
  }

  chime() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const seq = { spring: [659, 784, 988], summer: [523, 659, 784], autumn: [440, 523, 392] }[this.season];
    seq.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.11;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1);
    });
  }
}
