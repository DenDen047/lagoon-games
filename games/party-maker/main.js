/* =========================================================================
   PARTY MAKER ― 進行
   タイトル → メンバー登録 → 構成づくり → ラウンド → 結果発表
   ========================================================================= */
'use strict';

const SAVE_KEY = 'party-maker-program';

const G = {
  players: [],       /* {index, name, color, score} */
  program: [],       /* {game, hostMode, bonus} */
  builderIndex: 0,   /* 構成を作る人 */
  round: 0,
  rotateCursor: 0,
};

/* --------------------------------------------------------------
   上のバー（ラウンド表示と得点）
   -------------------------------------------------------------- */
function updateHud(visible) {
  const hud = document.getElementById('hud');
  hud.hidden = !visible;
  if (!visible) return;
  const tag = document.getElementById('roundTag');
  tag.textContent = '第 ' + (G.round + 1) + ' 回 ／ 全 ' + G.program.length + ' 回';
  const strip = document.getElementById('scoreStrip');
  strip.innerHTML = '';
  G.players.forEach((p) => {
    strip.appendChild(el('div', { class: 'score-cell', style: { '--c': p.color.hex } }, [
      el('span', { class: 'sc-name', text: p.name }),
      el('b', { class: 'sc-num', text: String(p.score) }),
    ]));
  });
}

/* --------------------------------------------------------------
   タイトル
   -------------------------------------------------------------- */
function screenTitle() {
  updateHud(false);
  show(el('div', 'title-screen', [
    el('h1', 'big-title', 'PARTY MAKER'),
    el('p', 'title-sub', 'みんなでつくる大会'),
    el('p', 'title-lead',
      '1台の画面をぐるぐる回して遊ぶ、2〜5人のパーティーゲームです。'
      + 'キャラクターを動かす場面はひとつもありません。'
      + 'まず誰か1人が「今日はどのミニゲームを何回やるか」という構成を組み、'
      + 'あとはその番組表どおりに順番を回していきます。'),
    el('div', 'title-games', MINIGAMES.map((m) => el('div', 'tg', [
      el('span', 'tg-icon', m.icon),
      el('span', 'tg-name', m.name),
    ]))),
    el('div', 'title-btns', [
      btn('はじめる', screenPlayers, 'big primary'),
      btn('あそびかた', screenHelp, 'big ghost'),
    ]),
    el('p', 'title-foot', '得点も構成もこの端末のブラウザにだけ残ります。'),
  ]));
}

function screenHelp() {
  show(panel({
    eyebrow: 'あそびかた',
    title: '1台を回して、順番にやる',
    body: el('div', 'help', [
      el('ol', 'help-steps', [
        el('li', null, 'メンバーを2〜5人ぶん登録します。'),
        el('li', null, '「構成を作る人」を1人決めます。その人がミニゲームを並べて番組表を作ります。'),
        el('li', null, 'ラウンドごとに出題者が1人立ちます。出題者は答えを決める側、残りの人は当てる側です。'),
        el('li', null, '秘密を入力する前には「◯◯さんだけが見る画面です」という一枚がはさまります。ここで画面をその人に渡してください。'),
        el('li', null, '番組表を全部やり終えたら合計点で優勝が決まります。'),
      ]),
      el('h3', null, 'ミニゲーム'),
      el('div', 'help-games', MINIGAMES.map((m) => el('div', 'hg', [
        el('div', 'hg-head', [el('span', 'hg-icon', m.icon), el('b', { text: m.name }),
          m.minPlayers > 2 ? el('span', { class: 'hg-min', text: m.minPlayers + '人以上' }) : null]),
        el('p', { class: 'hg-desc', text: m.desc }),
        el('p', { class: 'hg-rule', text: m.rule }),
      ]))),
      el('h3', null, '文字の答えあわせ'),
      el('p', 'help-note',
        'ひらがなとカタカナ、大文字と小文字、長音や記号のちがいは同じ言葉とみなします。'
        + '漢字とかなのちがいまでは見分けられないので、そこは出題者が「✓ 正解にする」を押して決めてください。'),
    ]),
    foot: btn('もどる', screenTitle, 'big'),
  }));
}

/* --------------------------------------------------------------
   メンバー登録
   -------------------------------------------------------------- */
function screenPlayers() {
  updateHud(false);
  let count = Math.max(MIN_PLAYERS, G.players.length || 4);
  const inputs = [];

  const listBox = el('div', 'player-fields');
  const countRow = el('div', 'count-row');

  function renderCount() {
    countRow.innerHTML = '';
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const v = n;
      countRow.appendChild(el('button', {
        class: 'countbtn' + (v === count ? ' on' : ''), type: 'button',
        onClick: () => { count = v; renderCount(); renderFields(); },
      }, v + '人'));
    }
  }

  function renderFields() {
    listBox.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const c = PLAYER_COLORS[i];
      if (!inputs[i]) {
        inputs[i] = el('input', {
          class: 'tin', type: 'text', maxlength: 8, autocomplete: 'off',
          placeholder: 'プレイヤー' + (i + 1),
        });
        const old = G.players[i];
        if (old) inputs[i].value = old.name;
      }
      listBox.appendChild(el('div', { class: 'player-field', style: { '--c': c.hex } }, [
        el('span', 'pf-dot'),
        inputs[i],
        el('span', { class: 'pf-color', text: c.name }),
      ]));
    }
  }

  function go() {
    G.players = [];
    for (let i = 0; i < count; i++) {
      const name = (inputs[i].value || '').trim() || ('プレイヤー' + (i + 1));
      G.players.push({ index: i, name: name, color: PLAYER_COLORS[i], score: 0 });
    }
    G.builderIndex = 0;
    screenBuilder();
  }

  renderCount();
  renderFields();

  show(panel({
    eyebrow: 'STEP 1',
    title: 'あそぶ人を登録する',
    lead: '名前は空のままでも大丈夫です。色は上から順に決まります。',
    body: el('div', 'form', [countRow, listBox]),
    foot: el('div', 'row', [btn('もどる', screenTitle, 'ghost'), btn('つぎへ', go, 'big primary')]),
  }));
}

/* --------------------------------------------------------------
   構成づくり
   -------------------------------------------------------------- */
function screenBuilder() {
  updateHud(false);
  const n = G.players.length;
  const usable = MINIGAMES.filter((m) => m.minPlayers <= n);
  if (G.program.length === 0) G.program = autoProgram(4);
  G.program = G.program.filter((r) => MG_BY_ID[r.game] && MG_BY_ID[r.game].minPlayers <= n);

  const listBox = el('div', 'program-list');
  const pickerBox = el('div', 'picker');

  function renderPicker() {
    pickerBox.innerHTML = '';
    MINIGAMES.forEach((m) => {
      const ok = m.minPlayers <= n;
      pickerBox.appendChild(el('button', {
        class: 'gcard' + (ok ? '' : ' off'), type: 'button', disabled: !ok,
        onClick: ok ? () => {
          if (G.program.length >= MAX_ROUNDS) { toast('ラウンドは' + MAX_ROUNDS + '回までです'); return; }
          G.program.push({ game: m.id, hostMode: 'rotate', bonus: false });
          renderList();
        } : null,
      }, [
        el('span', 'gc-icon', m.icon),
        el('span', 'gc-name', m.name),
        el('span', 'gc-tag', m.tag),
        el('span', { class: 'gc-desc', text: m.desc }),
        el('span', { class: 'gc-rule', text: m.rule }),
        ok ? null : el('span', { class: 'gc-lock', text: m.minPlayers + '人以上でつかえます' }),
      ]));
    });
  }

  function renderList() {
    listBox.innerHTML = '';
    if (G.program.length === 0) {
      listBox.appendChild(el('p', 'empty-note', '左のミニゲームを押すと、ここに1回ぶんずつ積まれます。'));
    }
    G.program.forEach((r, i) => {
      const m = MG_BY_ID[r.game];
      const sel = el('select', 'hostsel');
      const opts = [{ v: 'rotate', t: 'じゅんばんに' }, { v: 'random', t: 'ランダム' }]
        .concat(G.players.map((p) => ({ v: String(p.index), t: p.name + 'さん' })));
      opts.forEach((o) => {
        const op = el('option', { value: o.v, text: o.t });
        if (String(r.hostMode) === o.v) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', () => {
        r.hostMode = (sel.value === 'rotate' || sel.value === 'random') ? sel.value : Number(sel.value);
      });

      listBox.appendChild(el('div', 'prow', [
        el('span', 'prow-no', String(i + 1)),
        el('span', 'prow-icon', m.icon),
        el('span', 'prow-name', m.name),
        el('label', 'prow-host', [el('span', null, '出題者'), sel]),
        el('button', {
          class: 'starbtn' + (r.bonus ? ' on' : ''), type: 'button', title: '得点2倍',
          onClick: () => { r.bonus = !r.bonus; renderList(); },
        }, '⭐ 2倍'),
        el('div', 'prow-move', [
          el('button', { class: 'mv', type: 'button', title: '上へ', onClick: () => move(i, -1) }, '▲'),
          el('button', { class: 'mv', type: 'button', title: '下へ', onClick: () => move(i, 1) }, '▼'),
          el('button', { class: 'mv del', type: 'button', title: '消す', onClick: () => { G.program.splice(i, 1); renderList(); } }, '✕'),
        ]),
      ]));
    });
    countLine.textContent = '全 ' + G.program.length + ' ラウンド';
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= G.program.length) return;
    const t = G.program[i]; G.program[i] = G.program[j]; G.program[j] = t;
    renderList();
  }

  function autoProgram(len) {
    const pool = shuffled(usable);
    const out = [];
    for (let i = 0; i < len; i++) out.push({ game: pool[i % pool.length].id, hostMode: 'rotate', bonus: false });
    if (out.length) out[out.length - 1].bonus = true;
    return out;
  }

  const countLine = el('span', 'count-line');

  const builderSel = el('select', 'hostsel wide');
  G.players.forEach((p) => {
    const op = el('option', { value: String(p.index), text: p.name + 'さん' });
    if (p.index === G.builderIndex) op.selected = true;
    builderSel.appendChild(op);
  });
  builderSel.addEventListener('change', () => {
    G.builderIndex = Number(builderSel.value);
    head.textContent = G.players[G.builderIndex].name + 'さんが今日の構成を作ります';
  });
  const head = el('h2', { class: 'ptitle', text: G.players[G.builderIndex].name + 'さんが今日の構成を作ります' });

  function start() {
    if (G.program.length === 0) { toast('ラウンドを1つ以上入れてください'); return; }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.program)); } catch (e) {}
    G.players.forEach((p) => { p.score = 0; });
    G.round = 0;
    G.rotateCursor = 0;
    screenRoundIntro();
  }

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}

  renderPicker();
  renderList();

  show(el('div', 'builder', [
    el('p', 'eyebrow', 'STEP 2 ― 番組表を組む'),
    head,
    el('div', 'builder-top', [
      el('label', 'prow-host', [el('span', null, '構成を作る人'), builderSel]),
      countLine,
      btn('おまかせで組む', () => { G.program = autoProgram(4); renderList(); }, 'tiny'),
      Array.isArray(saved) && saved.length
        ? btn('前回の構成', () => {
            G.program = saved.filter((r) => MG_BY_ID[r.game] && MG_BY_ID[r.game].minPlayers <= n);
            renderList();
          }, 'tiny')
        : null,
      btn('ぜんぶ消す', () => { G.program = []; renderList(); }, 'tiny danger'),
    ]),
    el('div', 'builder-cols', [
      el('div', 'builder-col', [el('h3', null, 'ミニゲーム'), pickerBox]),
      el('div', 'builder-col', [el('h3', null, '今日の番組表'), listBox]),
    ]),
    el('div', 'row end', [
      btn('メンバーへもどる', screenPlayers, 'ghost'),
      btn('この構成ではじめる', start, 'big primary'),
    ]),
  ]));
}

/* --------------------------------------------------------------
   ラウンド
   -------------------------------------------------------------- */
function resolveHost(rule) {
  const n = G.players.length;
  if (rule.hostMode === 'random') return Math.floor(Math.random() * n);
  if (rule.hostMode === 'rotate') { const i = G.rotateCursor % n; G.rotateCursor++; return i; }
  const i = Number(rule.hostMode);
  return i >= 0 && i < n ? i : 0;
}

function screenRoundIntro() {
  if (G.round >= G.program.length) { screenFinal(); return; }
  updateHud(true);
  const rule = G.program[G.round];
  const m = MG_BY_ID[rule.game];
  const hostIndex = resolveHost(rule);
  const host = G.players[hostIndex];

  show(el('div', 'intro', [
    el('p', 'intro-no', '第 ' + (G.round + 1) + ' 回'),
    el('div', 'intro-icon', m.icon),
    el('h2', 'intro-name', m.name),
    el('p', { class: 'intro-desc', text: m.desc }),
    el('p', { class: 'intro-rule', text: m.rule }),
    rule.bonus ? el('p', 'intro-bonus', '⭐ ボーナスラウンド　このラウンドの得点は2倍') : null,
    el('div', 'intro-host', ['出題者は ', nameTag(host, 'big'), ' さん']),
    btn('はじめる', () => {
      m.run({
        players: G.players,
        hostIndex: hostIndex,
        host: host,
        finish: (res) => screenRoundResult(res, rule, m, host),
      });
    }, 'big primary'),
  ]));
}

function screenRoundResult(res, rule, m, host) {
  const mult = rule.bonus ? 2 : 1;
  const deltas = res.deltas.map((d) => d * mult);
  G.players.forEach((p, i) => { p.score += deltas[i]; });
  updateHud(true);

  const isLast = G.round + 1 >= G.program.length;
  show(panel({
    eyebrow: m.icon + ' ' + m.name + '　第 ' + (G.round + 1) + ' 回の結果'
      + (rule.bonus ? '　⭐ 得点2倍' : ''),
    title: res.headline,
    body: el('div', 'result-body', [
      res.body || null,
      el('div', 'delta-list', G.players.map((p, i) => el('div', {
        class: 'delta' + (deltas[i] > 0 ? ' up' : ''), style: { '--c': p.color.hex },
      }, [
        el('span', 'd-name', p.name),
        el('span', { class: 'd-plus', text: deltas[i] > 0 ? '+' + deltas[i] : '±0' }),
        el('b', { class: 'd-total', text: String(p.score) }),
      ]))),
    ]),
    foot: btn(isLast ? '結果発表へ' : 'つぎのラウンドへ', () => {
      G.round++;
      screenRoundIntro();
    }, 'big primary'),
  }));
}

/* --------------------------------------------------------------
   結果発表
   -------------------------------------------------------------- */
function screenFinal() {
  updateHud(false);
  const ranked = G.players.slice().sort((a, b) => b.score - a.score);
  let rank = 0, prev = null;
  const rows = ranked.map((p, i) => {
    if (prev === null || p.score !== prev) rank = i + 1;
    prev = p.score;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '　';
    return el('div', { class: 'rank-row' + (rank === 1 ? ' win' : ''), style: { '--c': p.color.hex } }, [
      el('span', 'rk-medal', medal),
      el('span', 'rk-no', rank + '位'),
      el('span', { class: 'rk-name', text: p.name }),
      el('b', { class: 'rk-score', text: p.score + '点' }),
    ]);
  });
  const winners = ranked.filter((p) => p.score === ranked[0].score);

  show(el('div', 'final', [
    el('p', 'eyebrow', '全 ' + G.program.length + ' ラウンド おしまい'),
    el('h2', 'final-title', winners.map((w) => w.name).join('・') + 'さんの優勝！'),
    el('div', 'rank-list', rows),
    el('div', 'row end', [
      btn('同じ構成でもう一度', () => {
        G.players.forEach((p) => { p.score = 0; });
        G.round = 0; G.rotateCursor = 0;
        screenRoundIntro();
      }, 'big primary'),
      btn('構成を組み直す', screenBuilder, 'ghost'),
      btn('メンバーから', screenPlayers, 'ghost'),
    ]),
  ]));
}

/* --------------------------------------------------------------
   起動
   -------------------------------------------------------------- */
screenTitle();
