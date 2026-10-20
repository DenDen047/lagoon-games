/* =========================================================================
   ハムスターの冒険 ― 音
   効果音も音楽もその場で合成する。外部の音源ファイルは使わない。
   ========================================================================= */
'use strict';

const Snd = {
  ctx: null, master: null, sfxBus: null, musBus: null,

  /* ブラウザは最初の操作のあとでしか音を鳴らせない */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = Options.sound ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.55; this.sfxBus.connect(this.master);
    this.musBus = this.ctx.createGain(); this.musBus.gain.value = 0.32; this.musBus.connect(this.master);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    Music.start();
  },
  setOn(on) {
    Options.sound = on; Options.save();
    if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  },

  tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, bus = null, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, { vol = 0.3, freq = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  },
};

const Sfx = {
  swing() { Snd.noise(0.09, { vol: 0.18, freq: 2400, q: 0.8 }); },
  hit() { Snd.tone(220, 0.08, { type: 'square', vol: 0.2, slide: -120 }); Snd.noise(0.06, { vol: 0.2, freq: 900 }); },
  chop() { Snd.noise(0.07, { vol: 0.3, freq: 500, q: 2 }); Snd.tone(140, 0.06, { type: 'triangle', vol: 0.25 }); },
  clink() { Snd.tone(1320, 0.08, { type: 'triangle', vol: 0.18 }); Snd.tone(1760, 0.06, { type: 'triangle', vol: 0.12, delay: 0.02 }); },
  rustle() { Snd.noise(0.12, { vol: 0.2, freq: 3200, q: 0.6 }); },
  pickup() { Snd.tone(880, 0.06, { type: 'square', vol: 0.12 }); Snd.tone(1320, 0.08, { type: 'square', vol: 0.12, delay: 0.05 }); },
  coin() { Snd.tone(1568, 0.05, { type: 'square', vol: 0.1 }); Snd.tone(2093, 0.12, { type: 'square', vol: 0.1, delay: 0.05 }); },
  craft() { [523, 659, 784, 1046].forEach((f, i) => Snd.tone(f, 0.12, { type: 'triangle', vol: 0.22, delay: i * 0.06 })); },
  buy() { Snd.tone(988, 0.07, { type: 'square', vol: 0.12 }); Snd.tone(1319, 0.14, { type: 'square', vol: 0.12, delay: 0.07 }); },
  error() { Snd.tone(180, 0.14, { type: 'square', vol: 0.14 }); Snd.tone(140, 0.16, { type: 'square', vol: 0.14, delay: 0.1 }); },
  click() { Snd.tone(660, 0.04, { type: 'triangle', vol: 0.12 }); },
  hurt() { Snd.tone(330, 0.16, { type: 'sawtooth', vol: 0.2, slide: -220 }); },
  roll() { Snd.noise(0.18, { vol: 0.15, freq: 800, q: 0.7 }); },
  bolt() { Snd.tone(900, 0.14, { type: 'sine', vol: 0.2, slide: 500 }); },
  fire() { Snd.noise(0.3, { vol: 0.25, freq: 600, q: 0.5 }); Snd.tone(200, 0.25, { type: 'sawtooth', vol: 0.12, slide: 200 }); },
  boom() { Snd.noise(0.4, { vol: 0.35, freq: 300, q: 0.5, type: 'lowpass' }); Snd.tone(90, 0.3, { type: 'sine', vol: 0.3, slide: -40 }); },
  wind() { Snd.noise(0.6, { vol: 0.22, freq: 1400, q: 3 }); },
  heal() { [784, 988, 1175, 1568].forEach((f, i) => Snd.tone(f, 0.2, { type: 'sine', vol: 0.18, delay: i * 0.07 })); },
  star() { for (let i = 0; i < 6; i++) Snd.tone(1200 + i * 220, 0.18, { type: 'triangle', vol: 0.14, delay: i * 0.05 }); },
  door() { Snd.tone(300, 0.1, { type: 'triangle', vol: 0.2 }); Snd.tone(200, 0.12, { type: 'triangle', vol: 0.2, delay: 0.08 }); },
  levelup() { [523, 659, 784, 1046, 1318].forEach((f, i) => Snd.tone(f, 0.2, { type: 'square', vol: 0.14, delay: i * 0.08 })); },
  fanfare() {
    const n = [523, 523, 523, 659, 784, 659, 784, 1046];
    const d = [0, 0.12, 0.24, 0.36, 0.6, 0.84, 0.96, 1.2];
    n.forEach((f, i) => Snd.tone(f, i === n.length - 1 ? 0.7 : 0.16, { type: 'square', vol: 0.14, delay: d[i] }));
  },
  roar() { Snd.tone(110, 0.7, { type: 'sawtooth', vol: 0.25, slide: -50 }); Snd.noise(0.6, { vol: 0.2, freq: 400 }); },
  burn() { Snd.noise(0.5, { vol: 0.3, freq: 900, q: 0.4 }); },
  build() { for (let i = 0; i < 4; i++) { Snd.noise(0.06, { vol: 0.3, freq: 600, q: 2, delay: i * 0.14 }); } },
  eat() { Snd.tone(500, 0.05, { type: 'square', vol: 0.1 }); Snd.tone(560, 0.05, { type: 'square', vol: 0.1, delay: 0.08 }); Snd.tone(620, 0.05, { type: 'square', vol: 0.1, delay: 0.16 }); },
  shoot() { Snd.tone(500, 0.1, { type: 'triangle', vol: 0.12, slide: -200 }); },
  warp() { Snd.tone(300, 0.5, { type: 'sine', vol: 0.2, slide: 900 }); },
};

/* ------------------------------- 音楽 -------------------------------
   1 文字並び = 8 分音符 1 つ。"." は休み、"-" は前の音をのばす。 */
const NOTE_IDX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function noteFreq(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  const midi = 12 * (+m[2] + 1) + NOTE_IDX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function parseLine(s) {
  const toks = s.trim().split(/\s+/), ev = [];
  toks.forEach((t, i) => {
    if (t === '.') return;
    if (t === '-') { if (ev.length) ev[ev.length - 1].len++; return; }
    ev.push({ step: i, f: noteFreq(t), len: 1 });
  });
  return { ev, steps: toks.length };
}

const THEMES = {
  title: { bpm: 96, lw: 'triangle', bw: 'sine',
    lead: 'E5 . G5 . C6 - B5 . A5 . G5 . E5 - . . F5 . A5 . D6 - C6 . B5 . G5 . D5 - . .',
    bass: 'C3 - . . G2 - . . A2 - . . E2 - . . F2 - . . C3 - . . G2 - . . G2 - . .' },
  forest: { bpm: 120, lw: 'square', bw: 'triangle',
    lead: 'G4 . B4 D5 E5 . D5 B4 A4 . B4 . G4 - . . E4 . G4 A4 B4 . D5 . E5 D5 B4 A4 G4 - . .',
    bass: 'G2 . D3 . G2 . D3 . C3 . G2 . C3 . G2 . E2 . B2 . E2 . B2 . D3 . A2 . D3 . A2 .' },
  town: { bpm: 112, lw: 'square', bw: 'triangle',
    lead: 'C5 E5 G5 E5 F5 A5 G5 . E5 G5 C6 G5 A5 G5 E5 . F5 E5 D5 E5 F5 G5 A5 . G5 F5 E5 D5 C5 - . .',
    bass: 'C3 . G3 . F3 . C3 . C3 . G3 . F3 . G3 . D3 . A3 . F3 . G3 . E3 . G3 . C3 . G2 .' },
  mountain: { bpm: 100, lw: 'square', bw: 'triangle',
    lead: 'A4 - C5 . E5 - D5 C5 D5 - E5 . A4 - . . G4 - B4 . D5 - C5 B4 C5 - A4 . E4 - . .',
    bass: 'A2 - - . E3 - - . F2 - - . G2 - - . A2 - - . E3 - - . F2 - - . E2 - - .' },
  snow: { bpm: 84, lw: 'triangle', bw: 'sine',
    lead: 'E6 . . B5 . . G5 . A5 . . E5 . . . . D6 . . A5 . . F5 . G5 . . D5 . . . .',
    bass: 'E3 - - - - - - . C3 - - - - - - . D3 - - - - - - . B2 - - - - - - .' },
  valley: { bpm: 92, lw: 'triangle', bw: 'sine',
    lead: 'D5 . F5 . A5 - G5 . F5 . E5 . D5 - . . C5 . E5 . G5 - F5 . E5 . D5 . A4 - . .',
    bass: 'D3 - . A2 . . D3 . C3 - . G2 . . C3 . A#2 - . F2 . . A#2 . A2 - . E2 . . A2 .' },
  moon: { bpm: 80, lw: 'sine', bw: 'triangle',
    lead: 'B4 . D5 . F#5 - E5 . D5 - B4 . A4 - . . G4 . B4 . D5 - C#5 . B4 - F#4 . . . . .',
    bass: 'B2 - - . F#2 - - . G2 - - . D3 - - . E2 - - . G2 - - . F#2 - - . F#2 - - .' },
  tower: { bpm: 108, lw: 'square', bw: 'triangle',
    lead: 'A4 . C5 . B4 . G#4 . A4 . E5 . D5 - C5 . F4 . A4 . G4 . E4 . A4 . B4 . C5 - . .',
    bass: 'A2 A2 . A2 E2 E2 . E2 F2 F2 . F2 E2 E2 . E2 D2 D2 . D2 E2 E2 . E2 A2 A2 . A2 E2 E2 . E2' },
  boss: { bpm: 150, lw: 'sawtooth', bw: 'square',
    lead: 'E5 . E5 G5 . E5 D5 . C5 . D5 E5 . B4 . . E5 . E5 G5 . A5 G5 . F5 . E5 D5 . E5 . .',
    bass: 'E2 E3 E2 E3 E2 E3 E2 E3 C2 C3 C2 C3 D2 D3 D2 D3 E2 E3 E2 E3 E2 E3 E2 E3 F2 F3 D2 D3 B1 B2 B1 B2' },
  win: { bpm: 110, lw: 'square', bw: 'triangle',
    lead: 'C5 E5 G5 C6 - . B5 - G5 . A5 - F5 . G5 - . . E5 G5 C6 E6 - . D6 - B5 . C6 - - - - .',
    bass: 'C3 . G3 . C3 . G3 . F3 . C4 . G3 . D3 . C3 . G3 . A2 . E3 . G2 . D3 . C3 - - .' },
};
for (const k in THEMES) {
  THEMES[k].L = parseLine(THEMES[k].lead);
  THEMES[k].B = parseLine(THEMES[k].bass);
}

const Music = {
  cur: null, want: null, step: 0, nextT: 0, timer: null, fade: 1,

  start() {
    if (this.timer || !Snd.ctx) return;
    this.timer = setInterval(() => this.tick(), 60);
  },
  play(name) { this.want = name; },

  tick() {
    const ac = Snd.ctx;
    if (!ac || ac.state !== 'running') return;
    if (this.want !== this.cur) {
      this.cur = this.want; this.step = 0; this.nextT = ac.currentTime + 0.12;
    }
    const th = THEMES[this.cur];
    if (!th) return;
    const sp = 60 / th.bpm / 2;
    while (this.nextT < ac.currentTime + 0.25) {
      const st = this.step % th.L.steps;
      for (const e of th.L.ev) if (e.step === st) this.note(e.f, e.len * sp * 0.92, this.nextT, th.lw, 0.07);
      const bst = this.step % th.B.steps;
      for (const e of th.B.ev) if (e.step === bst) this.note(e.f, e.len * sp * 0.9, this.nextT, th.bw, 0.09);
      this.step++;
      this.nextT += sp;
    }
  },
  note(f, dur, t, type, vol) {
    const ac = Snd.ctx;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Snd.musBus);
    o.start(t); o.stop(t + dur + 0.02);
  },
};
