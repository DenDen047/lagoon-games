// 効果音と BGM は音声ファイルを使わず、Web Audio でその場で作る。
let AC = null, master = null, musicGain = null, sfxGain = null, noiseBuf = null;
let enabled = true;

export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = AC.createGain(); master.gain.value = enabled ? 0.8 : 0; master.connect(AC.destination);
  sfxGain = AC.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(master);
  musicGain = AC.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.8 : 0; }

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', delay = 0, slide = 0 } = {}) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

const SFX = {
  swing: () => noise(0.18, { vol: 0.25, freq: 900, slide: 3, q: 0.8 }),
  hit: () => { tone(160, 0.12, { type: 'triangle', vol: 0.4, slide: 0.5 }); noise(0.08, { vol: 0.35, freq: 2500 }); },
  bone: () => { for (let i = 0; i < 3; i++) tone(900 + Math.random() * 900, 0.05, { type: 'square', vol: 0.08, delay: i * 0.035 }); },
  block: () => { tone(620, 0.15, { type: 'square', vol: 0.12, slide: 0.8 }); noise(0.1, { vol: 0.2, freq: 4000 }); },
  hurt: () => { tone(220, 0.25, { type: 'sawtooth', vol: 0.18, slide: 0.5 }); },
  coin: () => { tone(1320, 0.08, { type: 'square', vol: 0.07 }); tone(1760, 0.18, { type: 'square', vol: 0.07, delay: 0.07 }); },
  pick: () => tone(700, 0.08, { type: 'triangle', vol: 0.2, slide: 1.5 }),
  put: () => tone(420, 0.08, { type: 'triangle', vol: 0.2, slide: 0.7 }),
  chop: () => noise(0.06, { vol: 0.35, freq: 3000, q: 2 }),
  sizzle: () => noise(0.5, { vol: 0.06, freq: 6000, type: 'highpass' }),
  ding: () => { tone(1568, 0.5, { vol: 0.15 }); tone(2093, 0.6, { vol: 0.1, delay: 0.1 }); },
  serve: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.07 })),
  fail: () => { tone(330, 0.2, { type: 'square', vol: 0.08 }); tone(262, 0.3, { type: 'square', vol: 0.08, delay: 0.15 }); },
  quest: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.08 })),
  magic: () => { tone(500, 0.35, { vol: 0.15, slide: 2.5 }); tone(750, 0.35, { vol: 0.08, slide: 2.5, delay: 0.03 }); },
  throw: () => noise(0.12, { vol: 0.18, freq: 1800, slide: 2 }),
  dodge: () => noise(0.22, { vol: 0.15, freq: 500, slide: 2.5, q: 0.6 }),
  rise: () => { noise(0.8, { vol: 0.12, freq: 200, type: 'lowpass' }); tone(110, 0.8, { type: 'sawtooth', vol: 0.05, slide: 1.5 }); },
  die: () => { for (let i = 0; i < 6; i++) tone(500 + Math.random() * 1200, 0.06, { type: 'square', vol: 0.06, delay: i * 0.05 }); },
  ui: () => tone(880, 0.06, { type: 'triangle', vol: 0.12 }),
  buy: () => { tone(988, 0.08, { type: 'square', vol: 0.07 }); tone(1319, 0.2, { type: 'square', vol: 0.07, delay: 0.08 }); },
  bell: () => { tone(392, 2.2, { vol: 0.12 }); tone(587, 2.0, { vol: 0.05, delay: 0.02 }); },
  morning: () => [1200, 1500, 1350, 1800].forEach((f, i) => tone(f, 0.09, { vol: 0.06, slide: 1.2, delay: i * 0.12 })),
  roar: () => { tone(90, 1.2, { type: 'sawtooth', vol: 0.2, slide: 0.6 }); noise(1.2, { vol: 0.2, freq: 300, type: 'lowpass' }); },
  slam: () => { tone(70, 0.5, { type: 'sine', vol: 0.5, slide: 0.4 }); noise(0.4, { vol: 0.35, freq: 400, type: 'lowpass' }); },
};
export function sfx(name) { try { SFX[name]?.(); } catch { /* 音が出なくても遊べる */ } }

// ---------- BGM: ひるは のんびり、よるは すこし こわい ----------
const DAY = { tempo: 0.36, root: 60, scale: [0, 2, 4, 7, 9], bass: [0, -5, -3, -7], wave: 'triangle' };
const NIGHT = { tempo: 0.5, root: 57, scale: [0, 3, 5, 7, 10], bass: [0, -4, -2, -5], wave: 'sine' };
let musicMode = null, step = 0, nextT = 0, timer = null;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function note(m, t, dur, vol, wave) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = wave; o.frequency.value = mtof(m);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.05);
}
export function setMusic(mode) {
  if (!AC || mode === musicMode) return;
  musicMode = mode;
  if (timer) return;
  nextT = AC.currentTime + 0.1;
  timer = setInterval(() => {
    if (!musicMode || !enabled) { nextT = AC.currentTime + 0.1; return; }
    const M = musicMode === 'night' ? NIGHT : DAY;
    while (nextT < AC.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 4;
      if (step % 8 === 0) note(M.root - 24 + M.bass[bar], nextT, M.tempo * 7, 0.5, 'sine');
      if (step % 8 === 4 && musicMode === 'day') note(M.root - 12 + M.bass[bar] + 7, nextT, M.tempo * 3, 0.2, 'sine');
      const pat = (step * 7 + bar * 3) % 11;
      if (pat < (musicMode === 'night' ? 4 : 7)) {
        const deg = (step * 3 + bar * 2 + (pat % 3)) % M.scale.length;
        note(M.root + M.scale[deg] + (pat % 4 === 0 ? 12 : 0), nextT, M.tempo * 2.2, 0.22, M.wave);
      }
      nextT += M.tempo;
      step++;
    }
  }, 100);
}
