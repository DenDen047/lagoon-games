/* =========================================================================
   PARTY MAKER ― 画面づくりの共通部品
   DOM を組み立てる el()、画面の差し替え、バトンパス、秒読み、得点表示
   ========================================================================= */
'use strict';

/* --------------------------------------------------------------
   el('div', {class:'card', onClick:fn}, [子, '文字'])
   -------------------------------------------------------------- */
function el(tag, opts, kids) {
  const n = document.createElement(tag);
  if (typeof opts === 'string') {
    n.className = opts;
  } else if (Array.isArray(opts)) {
    kids = opts;
  } else if (opts) {
    for (const k in opts) {
      const v = opts[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') {
        /* --c のようなカスタムプロパティは setProperty でないと入らない */
        for (const sk in v) {
          if (sk.slice(0, 2) === '--') n.style.setProperty(sk, v[sk]);
          else n.style[sk] = v[sk];
        }
      }
      else if (k.length > 2 && k.slice(0, 2) === 'on' && typeof v === 'function') {
        n.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    }
  }
  if (kids != null) {
    (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
  }
  return n;
}

function btn(label, onClick, cls) {
  return el('button', { class: 'btn ' + (cls || ''), type: 'button', onClick: onClick }, label);
}

/* プレイヤー名を色つきのタグで出す。名前は必ず textContent で入れる。 */
function nameTag(p, extra) {
  return el('span', {
    class: 'ptag ' + (extra || ''),
    style: { '--c': p.color.hex, '--ci': p.color.ink },
  }, p.name);
}

/* --------------------------------------------------------------
   画面の差し替え
   -------------------------------------------------------------- */
const stage = () => document.getElementById('stage');

function show(node) {
  const s = stage();
  s.innerHTML = '';
  const wrap = el('div', 'screen', node);
  s.appendChild(wrap);
  s.scrollTop = 0;
  window.scrollTo(0, 0);
  return wrap;
}

/* 見出し + 説明 + 中身 の定型 */
function panel(opts) {
  return el('div', 'panel', [
    opts.eyebrow ? el('p', { class: 'eyebrow', text: opts.eyebrow }) : null,
    opts.title ? el('h2', { class: 'ptitle', text: opts.title }) : null,
    opts.lead ? el('p', { class: 'lead', text: opts.lead }) : null,
    opts.body || null,
    opts.foot ? el('div', 'pfoot', opts.foot) : null,
  ]);
}

/* --------------------------------------------------------------
   バトンパス
   秘密を入力する前に必ずはさむ。他の人が画面を見ないための一枚。
   -------------------------------------------------------------- */
function handoff(player, note, onReady) {
  show(el('div', 'handoff', [
    el('div', { class: 'hand-icon' }, '🙈'),
    el('p', 'hand-lead', 'ここから先は'),
    el('h2', { class: 'hand-name', style: { '--c': player.color.hex } }, player.name + ' さんだけ'),
    el('p', 'hand-lead', 'が見る画面です。'),
    el('p', { class: 'hand-note', text: note || 'ほかの人は画面から目をそらしてください。' }),
    btn('受け取った（' + player.name + '）', onReady, 'big primary'),
  ]));
}

/* --------------------------------------------------------------
   秒読み
   戻り値の stop() を呼ぶと止まる。0 になったら onEnd。
   -------------------------------------------------------------- */
function countdown(seconds, onEnd) {
  const fill = el('i');
  const num = el('b', { text: seconds + '秒' });
  const bar = el('div', 'timer', [el('div', 'timer-track', fill), num]);
  const total = seconds * 1000;
  const start = performance.now();
  let raf = 0, done = false;

  function tick(now) {
    const left = Math.max(0, total - (now - start));
    const r = left / total;
    fill.style.width = (r * 100) + '%';
    fill.style.background = r > 0.4 ? 'var(--mint)' : r > 0.18 ? 'var(--sun)' : 'var(--pink)';
    num.textContent = Math.ceil(left / 1000) + '秒';
    bar.classList.toggle('hurry', r <= 0.18);
    if (left <= 0) { if (!done) { done = true; onEnd(); } return; }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  bar.stop = function () { done = true; cancelAnimationFrame(raf); };
  return bar;
}

/* --------------------------------------------------------------
   入力まわり
   -------------------------------------------------------------- */

/* 伏せ字つきの入力欄。👁 を押しているあいだだけ中身が見える。 */
function secretInput(placeholder) {
  const input = el('input', {
    class: 'tin secret', type: 'password', placeholder: placeholder || '',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
  });
  const eye = el('button', { class: 'eye', type: 'button', title: '見る' }, '👁');
  const showIt = () => { input.type = 'text'; };
  const hideIt = () => { input.type = 'password'; };
  eye.addEventListener('pointerdown', showIt);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => eye.addEventListener(e, hideIt));
  const box = el('div', 'tin-wrap', [input, eye]);
  box.input = input;
  return box;
}

function textInput(placeholder) {
  const input = el('input', {
    class: 'tin', type: 'text', placeholder: placeholder || '',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
  });
  const box = el('div', 'tin-wrap', input);
  box.input = input;
  return box;
}

/* Enter で送信できるようにする */
function onEnter(input, fn) {
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } });
}

function focusSoon(input) {
  setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
}

/* 短い注意書きを画面上に出す */
function toast(msg) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1400);
  setTimeout(() => t.remove(), 2000);
}
