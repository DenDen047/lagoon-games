/* =========================================================================
   KAIJU CLASH ― 起動と入力
   キーボードとタッチを読み、毎フレーム 60 回の歩幅で世界を進める。
   ========================================================================= */
'use strict';

/* ------------------------------ 入力 ------------------------------ */
const KEYMAP = {
  /* 1P */
  KeyA: [0, 'left'], KeyD: [0, 'right'], KeyW: [0, 'up'], KeyS: [0, 'down'],
  KeyJ: [0, 'light'], KeyK: [0, 'heavy'], KeyL: [0, 'special'], KeyI: [0, 'super'],
  /* 2P */
  ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], ArrowUp: [1, 'up'], ArrowDown: [1, 'down'],
  Digit1: [1, 'light'], Digit2: [1, 'heavy'], Digit3: [1, 'special'], Digit4: [1, 'super'],
  Numpad1: [1, 'light'], Numpad2: [1, 'heavy'], Numpad3: [1, 'special'], Numpad4: [1, 'super'],
};

const Input = {
  keys: [{}, {}],
  touch: {},
  forSide(side) {
    const k = this.keys[side];
    const out = emptyInput();
    for (const name in out) out[name] = !!k[name];
    if (side === 0) {
      for (const name in this.touch) if (this.touch[name]) out[name] = true;
    }
    return out;
  },
  clear() { this.keys = [{}, {}]; this.touch = {}; },
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { e.preventDefault(); Game.togglePause(); return; }
  const m = KEYMAP[e.code];
  if (!m) return;
  e.preventDefault();
  Sound.ensure();
  Input.keys[m[0]][m[1]] = true;
});
window.addEventListener('keyup', (e) => {
  const m = KEYMAP[e.code];
  if (!m) return;
  e.preventDefault();
  Input.keys[m[0]][m[1]] = false;
});
window.addEventListener('blur', () => Input.clear());

/* タッチ */
function bindTouch() {
  document.querySelectorAll('#touch .tkey').forEach((b) => {
    const key = b.dataset.k;
    const on = (e) => { e.preventDefault(); Sound.ensure(); Input.touch[key] = true; b.classList.add('on'); };
    const off = (e) => { e.preventDefault(); Input.touch[key] = false; b.classList.remove('on'); };
    b.addEventListener('touchstart', on, { passive: false });
    b.addEventListener('touchend', off, { passive: false });
    b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on);
    b.addEventListener('mouseup', off);
    b.addEventListener('mouseleave', off);
  });
  $('btnPause').addEventListener('click', () => Game.togglePause());
}

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* ------------------------------ 画面の出し入れ ------------------------------ */
function hideBattleChrome() {
  $('game').hidden = true;
  $('hud').hidden = true;
  $('touch').hidden = true;
  clearBanner();
}
function showBattleChrome() {
  $('game').hidden = false;
  $('hud').hidden = false;
  $('touch').hidden = !IS_TOUCH;
  hideUI();
}

/* ------------------------------ ゲームの入口 ------------------------------ */
const Game = {
  hudGhost: [1, 1],
  hudWins: [-1, -1],

  startFight(cfg) {
    Sound.ensure();
    showBattleChrome();
    resizeCanvas();
    Battle.start(cfg);
    this.hudGhost = [1, 1];
    this.syncHudNames();
  },

  syncHudNames() {
    const [a, b] = Battle.fighters;
    $('n1').textContent = a.k.name;
    $('t1').textContent = a.k.en;
    $('n2').textContent = b.k.name;
    $('t2').textContent = b.k.en;
    $('hudStage').textContent = Battle.stage.data.name;
    this.hudWins = [-1, -1];
    this.syncWins();
  },

  /* 取ったラウンドの丸。数が変わったときだけ書き直す */
  syncWins() {
    const need = Battle.cfg.mode === 'practice' ? 0 : G.rounds;
    Battle.fighters.forEach((f, i) => {
      if (this.hudWins[i] === f.wins) return;
      this.hudWins[i] = f.wins;
      const box = $('w' + (i + 1));
      box.innerHTML = '';
      for (let j = 0; j < need; j++) box.appendChild(el('i', { class: j < f.wins ? 'on' : '' }));
    });
  },

  updateHud() {
    if (!Battle.active) return;
    this.syncWins();
    const fs = Battle.fighters;
    for (let i = 0; i < 2; i++) {
      const f = fs[i];
      const ratio = clamp(f.hp / f.maxHp, 0, 1);
      this.hudGhost[i] = this.hudGhost[i] > ratio
        ? Math.max(ratio, this.hudGhost[i] - 0.006)
        : ratio;
      const fill = $('h' + (i + 1));
      fill.style.width = (ratio * 100) + '%';
      fill.className = 'fill' + (ratio < 0.22 ? ' crit' : ratio < 0.45 ? ' low' : '');
      $('g' + (i + 1)).style.width = (this.hudGhost[i] * 100) + '%';
      const rage = $('r' + (i + 1));
      rage.style.width = clamp(f.gauge, 0, 100) + '%';
      rage.parentNode.classList.toggle('full', f.gauge >= 100);
    }
    const secs = Math.max(0, Math.ceil(Battle.timer / 60));
    const tm = $('hudTimer');
    tm.textContent = Battle.cfg.mode === 'practice' ? '∞' : String(secs);
    tm.classList.toggle('warn', secs <= 10 && Battle.cfg.mode !== 'practice');
  },

  togglePause() {
    if (!Battle.active) return;
    if (Battle.paused) { this.resume(); return; }
    Battle.paused = true;
    Input.clear();
    const ui = $('ui');
    ui.hidden = false;
    ui.innerHTML = '';
    ui.appendChild(el('div', 'screen', panel({
      eyebrow: '一時停止',
      title: 'どうしますか',
      body: el('p', { class: 'note', text: '1P: A/D 移動　W ジャンプ　S ガード　J 弱　K 強　L 必殺　I 超必殺' }),
      foot: [
        btn('つづける', () => Game.resume(), 'primary'),
        btn('この試合をやり直す', () => { Battle.resetRound(); Battle.fighters.forEach((f) => { f.wins = 0; }); Battle.round = 1; Game.syncHudNames(); Game.resume(); }, 'ghost'),
        btn('タイトルへ', () => { Battle.active = false; Battle.paused = false; Menu.title(); }, 'danger'),
      ],
    })));
  },

  resume() {
    Battle.paused = false;
    hideUI();
    Input.clear();
  },
};

/* ------------------------------ 画面の大きさ ------------------------------ */
let canvas, ctx;

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  View.w = w; View.h = h; View.dpr = dpr;
  View.gl = h > w * 1.15 ? 0.66 : 0.82;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ------------------------------ 本体のループ ------------------------------ */
let acc = 0, last = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  let dt = (ts - last) / 1000;
  last = ts;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  const step = 1 / 60;
  let steps = 0;
  while (acc >= step && steps < 4) {
    acc -= step;
    steps++;
    if (Battle.active) Battle.update();
    else Menu.tick();
  }
  if (Battle.active) {
    Battle.render(ctx);
    Game.updateHud();
  }
}

/* ------------------------------ 起動 ------------------------------ */
window.addEventListener('resize', () => { if (!$('game').hidden) resizeCanvas(); });
window.addEventListener('orientationchange', () => setTimeout(() => { if (!$('game').hidden) resizeCanvas(); }, 300));

(function boot() {
  canvas = $('game');
  ctx = canvas.getContext('2d');
  View.w = window.innerWidth; View.h = window.innerHeight;
  loadGame();
  bindTouch();
  Menu.title();
  requestAnimationFrame(frame);
})();
