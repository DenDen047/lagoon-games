/* =========================================================================
   PHANTOM DUEL ― メニュー画面
   タイトル、拠点、キャラづくり、レベルアップ、挑戦者えらび、練習場
   ========================================================================= */
'use strict';

const MAX_CHARS = 10;

/* --------------------------------------------------------------
   小さな見本。画面に置いてあるあいだだけ動く。
   -------------------------------------------------------------- */
function previewCanvas(c, w, h, opts) {
  opts = opts || {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = el('canvas', {
    class: 'pv' + (opts.cls ? ' ' + opts.cls : ''),
    width: Math.round(w * dpr), height: Math.round(h * dpr),
    style: { width: w + 'px', height: h + 'px' },
  });
  const ctx = cv.getContext('2d');
  cv.charRef = c;
  const t0 = performance.now();
  const sc = opts.scale || 1;

  function frame(now) {
    if (!cv.isConnected) { requestAnimationFrame(frame); return; }
    const t = (now - t0) / 1000;
    const cc = cv.charRef;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.55);
    g.addColorStop(0, rgba(cc.colors.glow, 0.20));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    drawGhost(ctx, cc, w / 2, h / 2 + Math.sin(t * 1.8) * 3, -Math.PI / 2, t, { scale: sc });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return cv;
}

function statLetter(v) { return RANK_LETTER[v]; }

function statTable(c, editable, onChange) {
  const free = freePoints(c);
  return el('div', 'stats', [
    editable ? el('p', { class: 'stat-free' }, ['配れる点 ', el('b', { text: String(free) })]) : null,
    el('div', 'stat-list', STAT_KEYS.map((k) => el('div', 'stat-row', [
      el('span', { class: 'st-name', text: STATS[k].ja }),
      el('span', 'st-pips', [1, 2, 3, 4, 5].map((i) =>
        el('i', { class: 'pip' + (i <= c.stats[k] ? ' on' : '') }))),
      el('span', { class: 'st-letter', text: statLetter(c.stats[k]) }),
      editable ? el('span', 'st-btns', [
        el('button', { class: 'sq', type: 'button', disabled: c.stats[k] <= 1,
          onClick: () => { if (c.stats[k] > 1) { c.stats[k]--; Sound.ui(); onChange(); } } }, '−'),
        el('button', { class: 'sq', type: 'button', disabled: c.stats[k] >= 5 || free <= 0,
          onClick: () => { if (c.stats[k] < 5 && freePoints(c) > 0) { c.stats[k]++; Sound.ui(); onChange(); } } }, '＋'),
      ]) : null,
      el('span', { class: 'st-desc', text: STATS[k].desc }),
    ]))),
  ]);
}

/* =========================================================================
   タイトル
   ========================================================================= */
function screenTitle() {
  const demo = makePreset('starplatinya');
  show(el('div', 'title-screen', [
    el('div', 'title-art', previewCanvas(demo, 220, 200, { scale: 1.0 })),
    el('h1', 'big-title', 'PHANTOM DUEL'),
    el('p', 'title-sub', '自分だけの幻影'),
    el('p', 'title-lead',
      '猫の街のはなしです。路地でくらすキジトラのニャ太郎が、光る矢に引っかかれて'
      + '幻影スタープラチニャを連れることになりました。動かすのは幻影のほうで、'
      + '使い手の猫は物陰で見ています。相棒は10体、闘技場は16、挑戦者は17匹います。'),
    el('div', 'title-btns', [
      G.chars.length ? btn('つづきから', screenHome, 'big primary') : null,
      btn(G.chars.length ? 'あたらしく作る' : 'はじめる', () => {
        if (!G.chars.length) startFresh(); else screenCreate(null);
      }, 'big ' + (G.chars.length ? 'ghost' : 'primary')),
      btn('あそびかた', () => screenHelp(screenTitle), 'big ghost'),
    ]),
    el('p', 'title-foot', 'セーブはこの端末のブラウザにだけ残ります。'),
  ]));
}

function startFresh() {
  G.chars = [makePreset('starplatinya')];
  G.active = 0;
  G.seenStory = [];
  saveGame();
  screenStory(STORY[0], screenIntro);
}

function screenIntro() {
  const me = activeChar();
  show(panel({
    eyebrow: 'はじめに',
    title: 'うしろに立っているもの',
    body: el('div', 'intro', [
      el('div', 'intro-art', previewCanvas(me, 240, 210, { scale: 1.15 })),
      el('p', null, 'ニャ太郎のうしろに立っているのが、幻影スタープラチニャです。'
        + '動かすのはこの幻影のほうで、ニャ太郎は物陰から見ています。'),
      el('p', null, '殴りかたは連打です。ボタンを押しっぱなしにすると軽い拳を絶え間なく浴びせます。'
        + '一発は小さいので、当てつづけられる間合いに居座れるかどうかで勝負が決まります。'),
      el('p', null, 'レベルを10まで上げると「衝波」を覚えます。連打が8発たまるたびに衝撃波が出るようになります。'),
      el('p', null, '「キャラをえらぶ」からは、拳の重いムートくん、時間を止めるニャワールドなど、'
        + 'ほかの猫の幻影も迎えられます。'),
    ]),
    foot: [
      btn('練習場でためす', () => Main.startPractice(), 'primary'),
      btn('拠点へ', screenHome, 'ghost'),
    ],
  }));
}

/* =========================================================================
   ものがたり
   ========================================================================= */
function screenStory(entry, onDone) {
  if (!entry) { onDone(); return; }
  if (G.seenStory.indexOf(entry.id) < 0) { G.seenStory.push(entry.id); saveGame(); }
  show(el('div', 'story', [
    el('p', { class: 'eyebrow', text: entry.ending ? 'エンディング' : 'ものがたり' }),
    el('h2', { class: 'story-title', text: entry.title }),
    el('div', 'story-body', entry.lines.map((t) => el('p', { text: t }))),
    el('div', 'title-btns', [btn(entry.ending ? '拠点へ' : 'つづける', onDone, 'big primary')]),
  ]));
}

function screenStoryList() {
  const read = STORY.filter((s) => G.seenStory.indexOf(s.id) >= 0);
  show(panel({
    eyebrow: 'ものがたり',
    title: 'これまでの話',
    lead: '挑戦者を倒していくと、話が進みます。読んだ章はいつでも読み返せます。',
    body: el('div', 'story-list', read.length
      ? read.map((e) => el('button', {
          class: 'schap', type: 'button',
          onClick: () => { Sound.ui(); screenStory(e, screenStoryList); },
        }, [
          el('b', { text: e.title }),
          el('span', { class: 'schap-lead', text: e.lines[0].slice(0, 34) + '…' }),
        ]))
      : el('p', { class: 'note', text: 'まだ何も起きていません。' })),
    foot: btn('拠点へ', screenHome, 'ghost'),
  }));
}

/* =========================================================================
   拠点
   ========================================================================= */
function screenHome() {
  const c = activeChar();
  if (!c) { screenTitle(); return; }
  const need = expNeed(c.level);
  const canLevel = c.level < MAX_LEVEL && c.exp >= need;

  show(el('div', 'home', [
    el('div', 'home-hero', [
      previewCanvas(c, 190, 180, { scale: 0.95 }),
      el('div', 'hero-info', [
        el('p', { class: 'eyebrow', text: TYPES[c.type].ja + '　' + TYPES[c.type].lead }),
        el('h2', { class: 'hero-name', text: c.name }),
        el('p', { class: 'hero-user', text: '使い手：' + (c.owner || 'ニャ太郎') }),
        el('div', 'hero-lv', [
          el('b', { text: 'Lv' + c.level }),
          c.level >= MAX_LEVEL
            ? el('span', { class: 'awaken-tag', text: '覚醒ずみ：' + TYPES[c.type].awaken.name })
            : el('span', 'exp-wrap', [
                el('span', 'exp-bar', el('i', { style: { width: Math.min(100, (c.exp / need) * 100) + '%' } })),
                el('span', { class: 'exp-num', text: c.exp + ' / ' + need }),
              ]),
        ]),
        canLevel ? el('p', { class: 'ready-tag', text: 'レベルを上げられます' }) : null,
      ]),
    ]),
    el('div', 'menu-grid', [
      menuCard('🥊', 'ストーリーモード', FOES[G.rank] ? '次は「' + FOES[G.rank].who + '」' : '挑戦者は全員たおした', screenFoes),
      menuCard('⚔️', 'フリー対戦', '好きな相手と好きな場所で戦う', screenFree),
      menuCard('🎯', '練習場', '的を殴って経験値をためる', () => Main.startPractice()),
      menuCard('⬆️', 'レベルアップ', canLevel ? 'いま上げられます' : '能力表を組みなおす', () => screenLevel(c), canLevel),
      menuCard('🐾', 'キャラをえらぶ', G.chars.length + '体もっている', screenRoster),
      menuCard('📖', 'ものがたり', G.seenStory.length + ' / ' + STORY.length + ' 章', screenStoryList),
      menuCard('❓', 'あそびかた', '操作と仕組み', () => screenHelp(screenHome)),
    ]),
    el('p', 'home-foot', ['戦績 ', el('b', { text: G.wins + '勝 ' + G.losses + '敗' }),
      '　／　倒した挑戦者 ', el('b', { text: G.rank + ' / ' + FOES.length })]),
  ]));
}

function menuCard(icon, title, note, onClick, hot) {
  return el('button', {
    class: 'mcard' + (hot ? ' hot' : ''), type: 'button',
    onClick: () => { Sound.ui(); onClick(); },
  }, [
    el('span', { class: 'mc-icon', text: icon }),
    el('span', 'mc-body', [
      el('b', { text: title }),
      el('span', { class: 'mc-note', text: note }),
    ]),
  ]);
}

/* =========================================================================
   あそびかた
   ========================================================================= */
function screenHelp(back) {
  show(panel({
    eyebrow: 'あそびかた',
    title: '動かすのは幻影そのもの',
    body: el('div', 'help', [
      el('h3', null, '操作'),
      el('table', 'keys', [
        el('tbody', null, [
          keyRow('W A S D ／ ↑←↓→', '幻影が歩く'),
          keyRow('マウスを動かす', 'その方向を向く。攻撃は向いているほうへ出る'),
          keyRow('左クリック ／ J', '攻撃。型によって殴る・撃つが変わる'),
          keyRow('右クリック ／ K', '能力。ゲージが溜まっているときだけ出せる'),
          keyRow('スペース ／ L', '回避。短いあいだ無敵になる'),
          keyRow('Esc', 'バトルをやめる'),
        ]),
      ]),
      el('p', 'note', 'スマホとタブレットでは、画面の左半分をなぞると歩き、右半分をなぞるとその向きに攻撃します。'),
      el('h3', null, 'ふたつのモード'),
      el('ul', 'bullets', [
        el('li', null, 'ストーリーモードは17匹を上から順に。勝つと章が進み、負けても何度でも挑めます。'),
        el('li', null, 'フリー対戦は相手も場所も自由。まだ倒していない相手ともいきなり戦えますが、物語は進まず、経験値は半分です。'),
      ]),
      el('h3', null, '大事な仕組み'),
      el('ul', 'bullets', [
        el('li', null, '使い手は戦場に出てきません。倒れるのは幻影のほうで、体力がなくなった側の負けです。'),
        el('li', null, '柱や壁は幻影も通り抜けられません。弾はさえぎられるので、隠れて距離を詰められます。'),
        el('li', null, '能力ゲージは時間とともに溜まり、攻撃を当てると少し早く溜まります。'),
        el('li', null, 'レベルを10にすると、型ごとの「覚醒」を覚えます。'),
      ]),
      el('h3', null, 'ムートくんの殴りかた'),
      el('p', null, '拳を2発つづけて出すと、そのあと少し溜めが入ります。'
        + '溜めているあいだは足もとに輪が出て、いっぱいになるとまた殴れます。'
        + 'Lv10 の「爆砕」を覚えると、殴った相手がそのあと爆発します。'),
      el('h3', null, 'ニャワールドの時間停止'),
      el('p', null, '猫のかたちをした幻影で、背中に時計をしょっています。'
        + '能力を使うと2.6秒のあいだ相手も弾もその場で止まり、そのあいだ動けるのは自分だけです。'
        + '止まっている相手は避けも防ぎもできないうえ、この間に入れた一撃は1.4倍になります。'
        + 'Lv10 の「止まった世界」で、止められる時間が4秒に延びます。'),
    ]),
    foot: btn('もどる', back, 'ghost'),
  }));
}

function keyRow(k, v) {
  return el('tr', null, [el('th', { text: k }), el('td', { text: v })]);
}

/* =========================================================================
   キャラをえらぶ
   ========================================================================= */
function screenRoster() {
  const owned = G.chars.map((c) => c.kit).filter(Boolean);
  show(panel({
    eyebrow: 'キャラ',
    title: 'つれていく幻影をえらぶ',
    body: el('div', 'roster', [
      el('div', 'roster-list', G.chars.map((c, i) => el('div', {
        class: 'rcard' + (i === G.active ? ' active' : ''),
      }, [
        previewCanvas(c, 140, 130, { scale: 0.68 }),
        el('b', { class: 'rc-name', text: c.name }),
        el('span', { class: 'rc-type', text: TYPES[c.type].ja + '　Lv' + c.level }),
        el('div', 'rc-btns', [
          i === G.active ? el('span', { class: 'rc-cur', text: 'えらび中' })
            : btn('えらぶ', () => { G.active = i; saveGame(); screenRoster(); }, 'small primary'),
          btn('レベル', () => screenLevel(c), 'small ghost'),
          btn('なおす', () => screenCreate(c), 'small ghost'),
          G.chars.length > 1 ? btn('けす', () => {
            if (!window.confirm(c.name + ' を消しますか。もとに戻せません。')) return;
            G.chars.splice(i, 1);
            G.active = clamp(G.active, 0, G.chars.length - 1);
            saveGame();
            screenRoster();
          }, 'small danger') : null,
        ]),
      ]))),

      el('h3', null, '用意されている相棒'),
      el('div', 'preset-list', PRESETS.map((p) => {
        const have = owned.indexOf(p.id) >= 0;
        const full = G.chars.length >= MAX_CHARS;
        return el('div', 'pcard', [
          previewCanvas(presetChar(p), 120, 110, { scale: 0.75 }),
          el('div', 'pc-info', [
            el('b', { text: p.name }),
            el('span', { class: 'pc-type', text: TYPES[p.type].ja }),
            el('span', { class: 'pc-note', text: p.note }),
          ]),
          have ? el('span', { class: 'pc-have', text: 'もう連れている' })
            : btn(full ? 'いっぱい' : '迎える', () => {
                if (full) { toast('キャラは' + MAX_CHARS + '体までです。'); return; }
                G.chars.push(presetChar(p));
                G.active = G.chars.length - 1;
                saveGame();
                toast(p.name + ' を迎えた。');
                screenRoster();
              }, 'small primary'),
        ]);
      })),

      G.chars.length < MAX_CHARS
        ? btn('自分で作る（' + G.chars.length + ' / ' + MAX_CHARS + '）', () => screenCreate(null), 'primary')
        : el('p', { class: 'note', text: 'キャラは' + MAX_CHARS + '体まで持てます。' }),
    ]),
    foot: btn('拠点へ', screenHome, 'ghost'),
  }));
}

/* =========================================================================
   レベルアップ
   ========================================================================= */
function screenLevel(c) {
  const need = expNeed(c.level);
  const maxed = c.level >= MAX_LEVEL;
  const canLevel = !maxed && c.exp >= need;
  const t = TYPES[c.type];

  const rerender = () => { saveGame(); screenLevel(c); };

  show(panel({
    eyebrow: 'レベルアップ',
    title: c.name + '　Lv' + c.level,
    body: el('div', 'levelup', [
      el('div', 'lv-top', [
        previewCanvas(c, 160, 150, { scale: 0.8 }),
        el('div', 'lv-exp', [
          maxed
            ? el('p', { class: 'lv-max', text: 'レベルは最大です' })
            : el('div', null, [
                el('p', 'lv-need', ['つぎのレベルまで ',
                  el('b', { text: String(Math.max(0, need - c.exp)) }), ' 経験値']),
                el('span', 'exp-bar big', el('i', { style: { width: Math.min(100, (c.exp / need) * 100) + '%' } })),
                el('p', { class: 'lv-have', text: 'いま ' + c.exp + ' / ' + need }),
              ]),
          el('div', 'lv-act', [
            canLevel ? btn('レベルを上げる', () => {
              c.exp -= need;
              c.level++;
              Sound.levelup();
              if (c.level >= MAX_LEVEL) {
                banner('覚醒　' + t.awaken.name, 1800, 'win');
                toast(t.awaken.name + 'を覚えた：' + t.awaken.desc);
              } else {
                toast('Lv' + c.level + ' になった。配れる点が1つ増えた。');
              }
              rerender();
            }, 'primary')
            : el('p', { class: 'note', text: maxed ? '' : 'バトルに勝つか、練習場で的を壊すと経験値がたまります。' }),
          ]),
        ]),
      ]),
      el('h3', null, '能力表'),
      el('p', { class: 'note', text: 'レベルが1つ上がるごとに配れる点が1つ増えます。点はいつでも振り直せます。' }),
      statTable(c, true, rerender),
      el('h3', null, '覚醒（Lv10）'),
      el('div', { class: 'awaken-card' + (maxed ? ' on' : '') }, [
        el('b', { text: t.awaken.name }),
        el('p', { text: t.awaken.desc }),
        el('span', { class: 'aw-state', text: maxed ? '使えます' : 'あと ' + (MAX_LEVEL - c.level) + ' レベル' }),
      ]),
      el('h3', null, 'いまの数値'),
      derivedTable(c),
    ]),
    foot: [
      btn('練習場でためす', () => {
        const i = G.chars.indexOf(c);
        if (i >= 0) { G.active = i; saveGame(); }
        Main.startPractice();
      }, 'ghost'),
      btn('拠点へ', screenHome, 'ghost'),
    ],
  }));
}

function derivedTable(c) {
  const d = derive(c);
  const rows = [
    ['体力', Math.round(d.maxHp)],
    ['一撃の重さ', Math.round(BASE_DMG * d.dmg)],
    ['動く速さ', Math.round(d.moveSpd)],
    ['攻撃の届く距離', Math.round(d.reach)],
    ['能力ゲージ（毎秒）', d.gaugeRate.toFixed(1)],
  ];
  return el('table', 'dtable', el('tbody', null, rows.map((r) =>
    el('tr', null, [el('th', { text: r[0] }), el('td', { text: String(r[1]) })]))));
}

/* =========================================================================
   キャラづくり
   ========================================================================= */
function screenCreate(existing) {
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : makeBlankChar();
  if (!existing) draft.name = '';
  createStep(draft, existing, 0);
}

const CREATE_STEPS = ['なまえ', 'かた', 'すがた', '能力表'];

function createStep(d, existing, step) {
  const pv = previewCanvas(d, 200, 190, { scale: 0.95 });
  const body = el('div', 'create-body');
  const refresh = () => { pv.charRef = d; };

  if (step === 0) {
    const nameBox = textInput('例：ムートくん', d.name, 10);
    const cryBox = textInput('例：ドドドド', d.cry, 8);
    const ownerBox = textInput('例：ニャ太郎', d.owner, 8);
    nameBox.input.addEventListener('input', () => { d.name = nameBox.input.value; });
    cryBox.input.addEventListener('input', () => { d.cry = cryBox.input.value; });
    ownerBox.input.addEventListener('input', () => { d.owner = ownerBox.input.value; });
    body.append(
      el('label', 'field', [el('span', { text: '幻影の名前' }), nameBox]),
      el('label', 'field', [el('span', { text: '攻撃が当たったときのかけ声' }), cryBox]),
      el('label', 'field', [el('span', { text: '使い手の猫の名前' }), ownerBox]),
      el('p', { class: 'note', text: 'かけ声は攻撃が当たるたびに画面へ出ます。' }),
    );
  } else if (step === 1) {
    body.append(el('div', 'type-grid', Object.keys(TYPES).filter((k) => !TYPES[k].foeOnly).map((k) => {
      const t = TYPES[k];
      return el('button', {
        class: 'tcard' + (d.type === k ? ' on' : ''), type: 'button',
        onClick: () => { d.type = k; Sound.ui(); createStep(d, existing, 1); },
      }, [
        el('b', { text: t.ja }),
        el('span', { class: 'tc-lead', text: t.lead }),
        el('p', { class: 'tc-desc', text: t.desc }),
        el('span', { class: 'tc-ab', text: '能力：' + t.ability.name + '　' + t.ability.desc }),
        el('span', { class: 'tc-aw', text: 'Lv10：' + t.awaken.name + '　' + t.awaken.desc }),
      ]);
    })));
  } else if (step === 2) {
    const parts = el('div', 'parts');
    PART_KEYS.forEach((key) => {
      const def = PARTS[key];
      const nameEl = el('b', { class: 'pk-val', text: labelOf(def, d.parts[key]) });
      const move = (dir) => {
        const ids = def.list.map((x) => x.id);
        const i = (ids.indexOf(d.parts[key]) + dir + ids.length) % ids.length;
        d.parts[key] = ids[i];
        nameEl.textContent = labelOf(def, d.parts[key]);
        refresh();
        Sound.ui();
      };
      parts.appendChild(el('div', 'pk', [
        el('span', { class: 'pk-name', text: def.ja }),
        el('button', { class: 'sq', type: 'button', onClick: () => move(-1) }, '◀'),
        nameEl,
        el('button', { class: 'sq', type: 'button', onClick: () => move(1) }, '▶'),
      ]));
    });

    const swatchRow = (label, get, set, list) => {
      const wrap = el('div', 'swatches');
      list.forEach((hex) => {
        const b = el('button', {
          class: 'sw' + (get() === hex ? ' on' : ''), type: 'button', style: { background: hex },
          onClick: () => {
            set(hex); refresh(); Sound.ui();
            Array.from(wrap.children).forEach((n) => n.classList.remove('on'));
            b.classList.add('on');
          },
        });
        wrap.appendChild(b);
      });
      return el('div', 'crow', [el('span', { class: 'cr-name', text: label }), wrap]);
    };

    body.append(
      d.preset
        ? el('p', { class: 'note', text: 'この幻影のすがたは決まっています。色だけ変えられます。' })
        : parts,
      swatchRow('おもな色', () => d.colors.main, (v) => { d.colors.main = v; }, PALETTE.main),
      swatchRow('差し色', () => d.colors.sub, (v) => { d.colors.sub = v; }, PALETTE.sub),
      swatchRow('光の色', () => d.colors.glow, (v) => { d.colors.glow = v; }, PALETTE.glow),
    );
  } else {
    body.append(
      el('p', { class: 'note', text: '点を配って能力表を決めます。あとからレベルアップ画面で振り直せます。' }),
      statTable(d, true, () => createStep(d, existing, 3)),
      el('h3', null, 'いまの数値'),
      derivedTable(d),
    );
  }

  show(panel({
    eyebrow: existing ? 'キャラをなおす' : 'キャラをつくる',
    title: CREATE_STEPS[step],
    body: el('div', 'create', [
      el('div', 'create-top', [
        pv,
        el('div', 'steps', CREATE_STEPS.map((s, i) =>
          el('span', { class: 'stepdot' + (i === step ? ' on' : '') + (i < step ? ' done' : ''), text: s }))),
      ]),
      body,
    ]),
    foot: [
      step > 0 ? btn('もどる', () => createStep(d, existing, step - 1), 'ghost')
        : btn('やめる', () => { if (G.chars.length) screenRoster(); else screenTitle(); }, 'ghost'),
      step < 3
        ? btn('つぎへ', () => {
            /* 押した時点の入力を見る。画面を組んだ時点で判定すると、
               あとから入れた名前が反映されない。 */
            if (step === 0 && !(d.name || '').trim()) { toast('名前を入れてください。'); return; }
            createStep(d, existing, step + 1);
          }, 'primary')
        : btn(existing ? 'なおす' : 'この幻影にする', () => {
            d.name = (d.name || '').trim() || '名もなき幻影';
            d.cry = (d.cry || '').trim() || 'ドドドド';
            d.owner = (d.owner || '').trim() || 'ニャ太郎';
            if (existing) {
              G.chars[G.chars.indexOf(existing)] = d;
            } else {
              G.chars.push(d);
              G.active = G.chars.length - 1;
            }
            saveGame();
            toast(d.name + ' ができた。');
            screenHome();
          }, 'primary'),
    ],
  }));
}

function labelOf(def, id) {
  const f = def.list.find((x) => x.id === id);
  return f ? f.ja : id;
}

/* =========================================================================
   挑戦者
   ========================================================================= */
function screenFoes() {
  show(panel({
    eyebrow: 'ストーリーモード',
    title: '挑戦者をえらぶ',
    lead: '上から順に戦います。勝つと話が進みます。倒した相手にはもう一度挑めますが、もらえる経験値は半分です。',
    body: el('div', 'foes', FOES.map((f, i) => {
      const cleared = i < G.rank;
      const locked = i > G.rank;
      return el('div', { class: 'fcard' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '') }, [
        locked ? el('div', 'fc-lock', '？') : previewCanvas(foeToChar(f), 120, 120, { scale: 0.6 }),
        el('div', 'fc-info', [
          el('span', { class: 'fc-tag', text: f.tag }),
          el('b', { class: 'fc-name', text: locked ? '？？？' : f.who }),
          el('span', { class: 'fc-ghost', text: locked ? '' : '幻影「' + f.name + '」　' + TYPES[f.type].ja + '　Lv' + f.level }),
          el('span', { class: 'fc-exp', text: locked ? '' : '経験値 ' + (cleared ? Math.round(f.exp / 2) : f.exp) }),
        ]),
        locked ? el('span', { class: 'fc-note', text: '前の相手を倒すと出てくる' })
          : btn(cleared ? '再戦' : '挑む', () => screenPrefight(f, cleared), cleared ? 'small ghost' : 'small primary'),
      ]);
    })),
    foot: btn('拠点へ', screenHome, 'ghost'),
  }));
}

function screenPrefight(foe, isRematch) {
  const me = activeChar();
  show(el('div', 'prefight', [
    el('div', 'pf-row', [
      el('div', 'pf-side', [
        previewCanvas(me, 170, 160, { scale: 0.85 }),
        el('b', { text: me.name }),
        el('span', { class: 'pf-sub', text: TYPES[me.type].ja + '　Lv' + me.level }),
      ]),
      el('div', 'pf-vs', 'VS'),
      el('div', 'pf-side', [
        previewCanvas(foeToChar(foe), 170, 160, { scale: 0.85 }),
        el('b', { text: foe.who }),
        el('span', { class: 'pf-sub', text: '幻影「' + foe.name + '」　Lv' + foe.level }),
      ]),
    ]),
    el('p', 'pf-line', '「' + foe.lines.in + '」'),
    el('div', 'title-btns', [
      btn('はじめる', () => Main.startRank(foe, isRematch), 'big primary'),
      btn('やめる', screenFoes, 'big ghost'),
    ]),
  ]));
}


/* =========================================================================
   フリー対戦
   相手も場所も自由。物語は進まず、経験値は半分。
   ========================================================================= */
const FreePick = { foe: 0, stage: 'home' };

function screenFree() {
  const foe = FOES[FreePick.foe];
  const stageIds = Object.keys(STAGES).filter((id) => id !== 'dojo');

  show(panel({
    eyebrow: 'フリー対戦',
    title: '好きな相手と、好きな場所で',
    lead: '倒していない相手ともいきなり戦えます。物語は進みませんが、経験値は半分もらえます。',
    body: el('div', 'free', [
      el('h3', null, 'あいて'),
      el('div', 'free-foes', FOES.map((f, i) => el('button', {
        class: 'ffoe' + (i === FreePick.foe ? ' on' : ''), type: 'button',
        onClick: () => { FreePick.foe = i; Sound.ui(); screenFree(); },
      }, [
        previewCanvas(foeToChar(f), 84, 78, { scale: 0.42 }),
        el('b', { text: f.who }),
        el('span', { class: 'ff-sub', text: TYPES[f.type].ja + ' Lv' + f.level }),
      ]))),

      el('h3', null, 'ばしょ'),
      el('div', 'free-stages', [
        el('button', {
          class: 'fstage' + (FreePick.stage === 'home' ? ' on' : ''), type: 'button',
          onClick: () => { FreePick.stage = 'home'; Sound.ui(); screenFree(); },
        }, 'この相手の場所（' + STAGES[foe.stage].ja + '）'),
      ].concat(stageIds.map((id) => el('button', {
        class: 'fstage' + (FreePick.stage === id ? ' on' : ''), type: 'button',
        onClick: () => { FreePick.stage = id; Sound.ui(); screenFree(); },
      }, STAGES[id].ja)))),

      el('div', 'free-go', [
        el('p', { class: 'note', text: activeChar().name + '（Lv' + activeChar().level + '）で '
          + foe.who + '「' + foe.name + '」に挑みます。' }),
        btn('はじめる', () => {
          Main.startFree(foe, FreePick.stage === 'home' ? foe.stage : FreePick.stage);
        }, 'big primary'),
      ]),
    ]),
    foot: [
      btn('キャラをえらぶ', screenRoster, 'ghost'),
      btn('拠点へ', screenHome, 'ghost'),
    ],
  }));
}

function screenFreeResult(foe, result, gained) {
  const c = activeChar();
  const win = result === 'win';
  show(panel({
    eyebrow: 'フリー対戦',
    title: win ? foe.who + ' に勝った' : foe.who + ' に負けた',
    body: el('div', 'result', [
      el('p', 'res-line', '「' + (win ? foe.lines.lose : foe.lines.win) + '」'),
      el('div', 'res-exp', [el('span', { text: '経験値' }), el('b', { text: '+' + gained })]),
      c.level < MAX_LEVEL && c.exp >= expNeed(c.level)
        ? el('p', { class: 'ready-tag', text: 'レベルを上げられます' }) : null,
    ]),
    foot: [
      btn('もう一度', () => Main.startFree(foe, FreePick.stage === 'home' ? foe.stage : FreePick.stage), 'primary'),
      btn('相手をかえる', screenFree, 'ghost'),
      btn('拠点へ', screenHome, 'ghost'),
    ],
  }));
}

/* =========================================================================
   結果
   ========================================================================= */
function screenResult(foe, result, gained) {
  const c = activeChar();
  const win = result === 'win';
  show(panel({
    eyebrow: win ? '勝ち' : '負け',
    title: win ? foe.who + ' を倒した' : foe.who + ' に敗れた',
    body: el('div', 'result', [
      el('p', 'res-line', '「' + (win ? foe.lines.lose : foe.lines.win) + '」'),
      el('div', 'res-exp', [el('span', { text: '経験値' }), el('b', { text: '+' + gained })]),
      c.level < MAX_LEVEL && c.exp >= expNeed(c.level)
        ? el('p', { class: 'ready-tag', text: 'レベルを上げられます' }) : null,
      win && G.rank >= FOES.length
        ? el('p', { class: 'res-clear', text: '挑戦者は全員たおしました。あなたの幻影が最後に立っています。' }) : null,
    ]),
    foot: [
      btn('レベルアップへ', () => screenLevel(c), 'primary'),
      btn('拠点へ', screenHome, 'ghost'),
    ],
  }));
}

function screenPracticeEnd(gained) {
  const c = activeChar();
  show(panel({
    eyebrow: '練習場',
    title: 'おつかれさま',
    body: el('div', 'result', [
      el('div', 'res-exp', [el('span', { text: '経験値' }), el('b', { text: '+' + gained })]),
      c.level < MAX_LEVEL && c.exp >= expNeed(c.level)
        ? el('p', { class: 'ready-tag', text: 'レベルを上げられます' }) : null,
    ]),
    foot: [
      btn('もう一度', () => Main.startPractice(), 'primary'),
      btn('レベルアップへ', () => screenLevel(c), 'ghost'),
      btn('拠点へ', screenHome, 'ghost'),
    ],
  }));
}
