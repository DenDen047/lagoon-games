/* =========================================================================
   BEAST CRADLE ― 画面づくりの共通部品
   DOM を組み立てる el()、能力バー、けものカード、選ばせる窓。
   ========================================================================= */
'use strict';

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
        for (const sk in v) {
          if (sk.slice(0, 2) === '--') n.style.setProperty(sk, v[sk]);
          else n.style[sk] = v[sk];
        }
      } else if (k.length > 2 && k.slice(0, 2) === 'on' && typeof v === 'function') {
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

const stageEl = () => document.getElementById('stage');

function show(node) {
  const s = stageEl();
  s.innerHTML = '';
  s.scrollTop = 0;
  s.appendChild(node);
  return node;
}

/* 見出し + 中身 + 下のボタン、という決まった枠 */
function panel(o) {
  return el('div', 'panel', [
    o.eyebrow ? el('div', 'eyebrow', o.eyebrow) : null,
    o.title ? el('h2', 'panel-title', o.title) : null,
    o.lead ? el('p', 'panel-lead', o.lead) : null,
    o.body || null,
    o.foot ? el('div', 'panel-foot', o.foot) : null,
  ]);
}

/* --------------------------------------------------------------
   バーと数値
   -------------------------------------------------------------- */
function bar(ratio, color, cls) {
  return el('div', 'bar ' + (cls || ''), [
    el('i', { class: 'bar-fill', style: { width: clamp(ratio, 0, 1) * 100 + '%', background: color } }),
  ]);
}

function typeChip(sp) {
  const t = TYPES[sp.type];
  return el('span', { class: 'chip type', style: { '--c': t.color } }, t.name);
}

/* 能力4本ぶん。限界値までの位置がひと目で分かるようにする。 */
function statBlock(c, compact) {
  return el('div', 'stats' + (compact ? ' compact' : ''), STATS.map((s) => {
    const cap = statCap(c, s.id);
    const v = c.stats[s.id];
    return el('div', 'stat-row', [
      el('span', 'stat-name', compact ? s.kanji : s.name),
      el('div', 'stat-bar', [
        el('i', { class: 'sb-fill', style: { width: clamp(v / cap, 0, 1) * 100 + '%', background: s.color } }),
      ]),
      el('span', 'stat-num', String(Math.round(v))),
      compact ? null : el('span', 'stat-cap', '/ ' + cap),
      compact ? null : el('span', { class: 'stat-star', title: '才能' }, '★'.repeat(talentStars(c, s.id))),
    ]);
  }));
}

/* 疲れ・ごきげん・体重・けが */
function conditionBlock(c) {
  const w = c.weight;
  const wLabel = w > TUNE.weightIdeal + TUNE.weightBand ? '太りぎみ'
    : w < TUNE.weightIdeal - TUNE.weightBand ? '痩せぎみ' : 'ちょうどよい';
  return el('div', 'cond', [
    el('div', 'cond-row', [
      el('span', 'cond-name', 'つかれ'),
      bar(c.fatigue / 100, c.fatigue > TUNE.fatigueHard ? '#e05a5a' : c.fatigue > TUNE.fatigueSoft ? '#e0a33c' : '#6bbf7a'),
      el('span', 'cond-num', Math.round(c.fatigue) + ''),
    ]),
    el('div', 'cond-row', [
      el('span', 'cond-name', 'ごきげん'),
      bar(c.mood / 100, c.mood > 66 ? '#f0b23c' : c.mood > 33 ? '#c9b06a' : '#8b8b9a'),
      el('span', 'cond-num', Math.round(c.mood) + ''),
    ]),
    el('div', 'cond-row', [
      el('span', 'cond-name', '体重'),
      bar(clamp((w - 18) / 70, 0, 1), '#8fb4d6'),
      el('span', 'cond-num', wLabel),
    ]),
    c.injury ? el('div', 'cond-injury',
      (c.injuryLv >= 2 ? '重いけが' : '軽いけが') + '（あと ' + c.injury + ' 週）') : null,
  ]);
}

/* --------------------------------------------------------------
   けものカード
   -------------------------------------------------------------- */
function portraitCanvas(c, size, cls) {
  const cv = el('canvas', {
    class: 'portrait ' + (cls || ''),
    style: { width: size + 'px', height: size + 'px' },
  });
  cv.dataset.sp = c.sp;
  cv.dataset.tint = String(c.tint);
  return cv;
}

function beastCard(c, o) {
  o = o || {};
  const sp = speciesOf(c);
  const stage = ageStage(c);
  return el('div', {
    class: 'beast-card' + (o.selected ? ' on' : '') + (o.dim ? ' dim' : '') + (o.onClick ? ' tappable' : ''),
    onClick: o.onClick,
  }, [
    el('div', 'bc-pic', [
      portraitCanvas(c, o.size || 96),
      c.injury ? el('span', 'bc-hurt', '＋') : null,
    ]),
    el('div', 'bc-body', [
      el('div', 'bc-head', [
        el('b', 'bc-name', c.name),
        typeChip(sp),
        o.badge ? el('span', 'chip badge', o.badge) : null,
      ]),
      el('div', 'bc-sub', sp.name + '　' + persOf(c).name + '　' + c.age + '週（' + stage.name + '）'),
      statBlock(c, !o.full),
      o.extra || null,
    ]),
  ]);
}

/* --------------------------------------------------------------
   似顔絵を動かす。画面に出ている canvas.portrait をまとめて描きなおす。
   -------------------------------------------------------------- */
let portraitClock = 0;
let portraitLast = 0;
function portraitLoop(now) {
  requestAnimationFrame(portraitLoop);
  if (now - portraitLast < 45) return;   /* 20fps ほどで十分 */
  portraitLast = now;
  portraitClock = now / 1000;
  document.querySelectorAll('canvas.portrait').forEach((cv) => {
    const sp = SPECIES[cv.dataset.sp];
    if (!sp) return;
    paintPortrait(cv, sp, Number(cv.dataset.tint || 0), portraitClock + (cv.dataset.ph ? Number(cv.dataset.ph) : 0), cv.dataset.pose);
  });
}
requestAnimationFrame(portraitLoop);

/* --------------------------------------------------------------
   かぶせる窓
   -------------------------------------------------------------- */
function overlay(node, opt) {
  opt = opt || {};
  const back = el('div', 'overlay', [el('div', 'ov-box', node)]);
  if (!opt.sticky) {
    back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  }
  document.body.appendChild(back);
  return back;
}

function askConfirm(title, body, okLabel, onOk, opt) {
  opt = opt || {};
  const box = el('div', 'ask', [
    el('h3', null, title),
    typeof body === 'string' ? el('p', null, body) : body,
    el('div', 'ask-btns', [
      opt.single ? null : btn(opt.cancelLabel || 'やめる', () => back.remove(), 'ghost'),
      btn(okLabel, () => { back.remove(); onOk(); }, opt.danger ? 'danger' : 'primary'),
    ]),
  ]);
  const back = overlay(box);
  return back;
}

function askPick(title, lead, items, onPick, opt) {
  opt = opt || {};
  const cancel = () => { back.remove(); if (opt.onCancel) opt.onCancel(); };
  const box = el('div', 'ask wide', [
    el('h3', null, title),
    lead ? el('p', 'ask-lead', lead) : null,
    el('div', 'ask-list', items.map((it) =>
      el('button', {
        class: 'pick' + (it.disabled ? ' off' : ''), type: 'button',
        disabled: !!it.disabled,
        onClick: () => { back.remove(); onPick(it.value); },
      }, [
        it.icon ? el('span', 'pick-icon', it.icon) : null,
        el('span', 'pick-body', [
          el('b', null, it.label),
          it.note ? el('span', 'pick-note', it.note) : null,
        ]),
        it.right ? el('span', 'pick-right', it.right) : null,
      ]))),
    el('div', 'ask-btns', [btn(opt.cancelLabel || 'もどる', cancel, 'ghost')]),
  ]);
  const back = overlay(box, { sticky: !!opt.sticky });
  return back;
}

let toastTimer = 0;
function toast(msg, kind) {
  let t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast' }); document.body.appendChild(t); }
  t.className = 'on ' + (kind || '');
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2400);
}
