/* =========================================================================
   KAIJU CLASH ― 画面まわり
   タイトル、怪獣えらび、ステージえらび、アーケード、結果。
   小さな canvas に怪獣を描いて動かしている。
   ========================================================================= */
'use strict';

const Menu = {
  anims: [],
  t: 0,

  open(node) {
    hideBattleChrome();
    show(node);
  },

  /* 画面から消えた canvas は描かない */
  tick() {
    this.t++;
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      if (!a.c.isConnected) { this.anims.splice(i, 1); continue; }
      a.run(this.t);
    }
  },

  /** 小さな canvas を作って、毎フレーム描く関数を登録する */
  live(w, h, draw, cls) {
    const c = el('canvas', cls ? { class: cls } : {});
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const set = () => {
      const rect = c.getBoundingClientRect();
      const cw = rect.width || w, ch = rect.height || h;
      c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
      c._w = cw; c._h = ch; c._dpr = dpr;
    };
    requestAnimationFrame(set);
    this.anims.push({ c, run: (t) => {
      if (!c._w || Math.abs(c.getBoundingClientRect().width - c._w) > 1) set();
      const ctx = c.getContext('2d');
      ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0);
      ctx.clearRect(0, 0, c._w, c._h);
      draw(ctx, c._w, c._h, t);
    } });
    return c;
  },

  /* ====================================================================
     タイトル
     ==================================================================== */
  title() {
    const art = this.live(900, 220, (ctx, w, h, t) => {
      drawTitleScene(ctx, w, h, t);
    });
    art.id = 'titleArt';
    art.style.height = '210px';
    art.style.width = '100%';

    const cleared = G.cleared.length;
    const node = el('div', 'title-screen', [
      art,
      el('h1', { class: 'big-title', text: 'KAIJU CLASH' }),
      el('p', { class: 'title-sub', text: '街を壊す怪獣たち' }),
      el('p', { class: 'title-lead', text: '街のまんなかで怪獣どうしが殴りあう対戦格闘です。8体それぞれに熱線・ミサイル・鱗粉・火柱といった必殺技があり、怒りが満ちると超必殺が撃てます。ビルは背景ではなく壊れる物で、殴っても、ふっとばされた体がぶつかっても倒れます。' }),
      el('div', 'title-btns', [
        btn('アーケード', () => Menu.charSelect({ mode: 'arcade' }), 'primary big'),
        btn('ふたりで対戦', () => Menu.charSelect({ mode: 'versus' }), 'big'),
        btn('練習', () => Menu.charSelect({ mode: 'practice' }), 'big'),
      ]),
      el('div', { class: 'title-btns', style: { marginTop: '10px' } }, [
        btn('あそびかた', () => Menu.help(), 'ghost small'),
        btn('設定', () => Menu.options(), 'ghost small'),
        btn('怪獣図鑑', () => Menu.gallery(), 'ghost small'),
      ]),
      el('p', {
        class: 'title-foot',
        text: cleared > 0
          ? '制覇した怪獣 ' + cleared + ' / ' + KAIJU.length + '　　通算 ' + G.wins + '勝 ' + G.losses + '敗　　壊した建物 ' + G.destroyed
          : '通算 ' + G.wins + '勝 ' + G.losses + '敗　　壊した建物 ' + G.destroyed,
      }),
    ]);
    this.open(node);
  },

  /* ====================================================================
     怪獣えらび
     ==================================================================== */
  charSelect(cfg, forSide) {
    const side = forSide || 1;
    let chosen = KAIJU_BY_ID[G.lastKaiju] || KAIJU[0];
    if (side === 2 && cfg.p1 === chosen.id) chosen = KAIJU[(KAIJU.indexOf(chosen) + 1) % KAIJU.length];

    const detail = el('div', 'detail');
    const cards = [];

    const paint = () => {
      cards.forEach((c) => c.el.classList.toggle('on', c.k.id === chosen.id));
      detail.innerHTML = '';
      detail.appendChild(this.live(220, 200, (ctx, w, h, t) => {
        drawShowcase(ctx, w, h, t, chosen);
      }));
      const m = chosen.moves;
      const reach = Math.max(m.light.box.x + m.light.box.w / 2, m.heavy.box.x + m.heavy.box.w / 2);
      detail.appendChild(el('div', {}, [
        el('h2', { text: chosen.name }),
        el('p', { class: 'sub', text: chosen.en + ' ― ' + chosen.title }),
        el('p', { text: chosen.desc }),
        el('div', 'stats', [
          statRow('体力', chosen.hp, 860, 1150),
          statRow('攻撃', m.heavy.dmg, 74, 106),
          statRow('速さ', chosen.speed, 2.8, 4.3),
          statRow('守り', chosen.defense, 0.88, 1.28),
          statRow('リーチ', reach, 100, 200),
        ]),
        el('div', 'moves', [
          moveRow('弱', m.light.name),
          moveRow('強', m.heavy.name),
          moveRow('空中', m.air.name),
          moveRow('必殺', m.special.name),
          moveRow('超必殺', m.super.name),
        ]),
        el('p', { class: 'note', text: 'コツ: ' + chosen.tips }),
      ]));
    };

    const grid = el('div', 'grid', KAIJU.map((k) => {
      const c = el('div', {
        class: 'card',
        onClick: () => { chosen = k; Sound.ui(); paint(); },
      }, [
        this.live(150, 120, (ctx, w, h, t) => drawCardArt(ctx, w, h, t, k)),
        el('div', { class: 'cname', text: k.name }),
        el('div', { class: 'cen', text: k.en }),
      ]);
      cards.push({ el: c, k });
      return c;
    }));

    const heading = cfg.mode === 'versus'
      ? (side === 1 ? '1P の怪獣をえらぶ' : '2P の怪獣をえらぶ')
      : cfg.mode === 'practice' ? '練習する怪獣をえらぶ' : '街に出す怪獣をえらぶ';

    const next = () => {
      Sound.ui();
      if (side === 1) {
        cfg.p1 = chosen.id;
        G.lastKaiju = chosen.id;
        saveGame();
        if (cfg.mode === 'versus') Menu.charSelect(cfg, 2);
        else if (cfg.mode === 'practice') Menu.charSelect(cfg, 2);
        else Menu.arcadeStart(cfg);
      } else {
        cfg.p2 = chosen.id;
        Menu.stageSelect(cfg);
      }
    };

    this.open(el('div', {}, [
      panel({
        eyebrow: cfg.mode === 'arcade' ? 'アーケード' : cfg.mode === 'versus' ? 'ふたりで対戦' : '練習',
        title: heading,
        lead: side === 2 && cfg.mode === 'practice' ? '相手にする怪獣をえらびます。' : null,
        body: el('div', {}, [grid, detail]),
        foot: [
          btn('この怪獣で進む', next, 'primary'),
          btn('もどる', () => (side === 2 ? Menu.charSelect(cfg, 1) : Menu.title()), 'ghost'),
        ],
      }),
    ]));
    paint();
  },

  /* ====================================================================
     ステージえらび
     ==================================================================== */
  stageSelect(cfg) {
    const go = (sid) => {
      cfg.stage = sid;
      if (cfg.mode === 'practice') Menu.practiceSetup(cfg);
      else Game.startFight({
        p1: cfg.p1, p2: cfg.p2, stage: sid, mode: cfg.mode,
        p2human: cfg.mode === 'versus',
        onEnd: (won) => Menu.result({ cfg, won }),
      });
    };
    const grid = el('div', 'sgrid', STAGES.map((s) => el('div', {
      class: 'scard', onClick: () => { Sound.ui(); go(s.id); },
    }, [
      this.live(220, 108, (ctx, w, h, t) => drawStageThumb(ctx, w, h, t, s)),
      el('div', 'sbody', [
        el('div', { class: 'swhen', text: s.when }),
        el('div', { class: 'sname', text: s.name }),
        el('div', { class: 'slead', text: s.lead }),
      ]),
    ])));

    this.open(panel({
      eyebrow: 'ステージ',
      title: '戦う街をえらぶ',
      lead: '建物はどのステージでも壊せます。壊すと怒りが少し溜まります。',
      body: grid,
      foot: [
        btn('おまかせ', () => go(pick(STAGES).id), 'primary'),
        btn('もどる', () => Menu.charSelect(cfg, cfg.mode === 'arcade' ? 1 : 2), 'ghost'),
      ],
    }));
  },

  /* ====================================================================
     練習の設定
     ==================================================================== */
  practiceSetup(cfg) {
    let dummy = true;
    const row = el('div', 'rowset');
    const paint = () => {
      row.innerHTML = '';
      [['棒立ち', true], ['CPU', false]].forEach(([label, v]) => {
        row.appendChild(el('button', {
          class: 'chip' + (dummy === v ? ' on' : ''), type: 'button',
          onClick: () => { dummy = v; Sound.ui(); paint(); },
        }, label));
      });
    };
    paint();
    this.open(panel({
      eyebrow: '練習',
      title: '相手の動き方',
      lead: '棒立ちなら技の間合いをゆっくり確かめられます。体力は減っても勝負はつきません。',
      body: row,
      foot: [
        btn('はじめる', () => Game.startFight({
          p1: cfg.p1, p2: cfg.p2, stage: cfg.stage, mode: 'practice', dummy,
          onEnd: () => Menu.title(),
        }), 'primary'),
        btn('もどる', () => Menu.stageSelect(cfg), 'ghost'),
      ],
    }));
  },

  /* ====================================================================
     アーケード
     ==================================================================== */
  arcadeStart(cfg) {
    const others = KAIJU.filter((k) => k.id !== cfg.p1).map((k) => k.id);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const order = others.slice(0, ARCADE_LENGTH - 1);
    order.push('BOSS');
    Menu.arcadeNext({ p1: cfg.p1, order, step: 0 });
  },

  arcadeNext(st) {
    const isBoss = st.order[st.step] === 'BOSS';
    const foeId = isBoss ? BOSS.base : st.order[st.step];
    const foe = KAIJU_BY_ID[foeId];
    const stageId = isBoss ? BOSS.stage : pick(STAGES).id;
    const stage = STAGE_BY_ID[stageId];
    const name = isBoss ? BOSS.name : foe.name;

    const ladder = el('div', 'ladder', st.order.map((_, i) => el('i', {
      class: i < st.step ? 'done' : i === st.step ? 'now' : '',
    })));

    this.open(panel({
      eyebrow: '第 ' + (st.step + 1) + ' 戦 / ' + st.order.length,
      title: isBoss ? '最終戦　' + name : name + ' があらわれた',
      lead: isBoss ? BOSS.lead : foe.desc,
      body: el('div', {}, [
        ladder,
        el('div', { class: 'detail', style: { marginTop: '14px' } }, [
          this.live(220, 200, (ctx, w, h, t) => drawShowcase(ctx, w, h, t, foe, isBoss ? BOSS.colors : null)),
          el('div', {}, [
            el('h2', { text: name }),
            el('p', { class: 'sub', text: (isBoss ? BOSS.en : foe.en) + ' ― ' + stage.name }),
            el('p', { text: stage.lead }),
            el('p', { class: 'note', text: '必殺技: ' + foe.moves.special.name + '　超必殺: ' + foe.moves.super.name }),
          ]),
        ]),
      ]),
      foot: [
        btn('戦う', () => Game.startFight({
          p1: st.p1, p2: foeId, stage: stageId, boss: isBoss,
          mode: 'arcade',
          onEnd: (won) => Menu.result({ arcade: st, won, foeName: name }),
        }), 'primary big'),
        btn('やめる', () => Menu.title(), 'ghost'),
      ],
    }));
  },

  /* ====================================================================
     結果
     ==================================================================== */
  result(r) {
    const arcade = r.arcade;
    const won = r.won;
    const B = Battle;
    const me = B.fighters[0], foe = B.fighters[1];
    const last = arcade && arcade.step >= arcade.order.length - 1;

    let title, lead;
    if (won && arcade && last) { title = '街に残ったのは一体'; lead = 'すべての怪獣を退けました。'; }
    else if (won) { title = 'WIN'; lead = (r.foeName || foe.k.name) + ' を倒しました。'; }
    else { title = 'LOSE'; lead = '倒されました。もう一度いきますか。'; }

    if (won && arcade && last && G.cleared.indexOf(arcade.p1) < 0) {
      G.cleared.push(arcade.p1);
      saveGame();
    }

    const foot = [];
    if (won && arcade && !last) {
      foot.push(btn('次の相手へ', () => Menu.arcadeNext({ p1: arcade.p1, order: arcade.order, step: arcade.step + 1 }), 'primary big'));
    } else if (!won && arcade) {
      foot.push(btn('もう一度', () => Menu.arcadeNext(arcade), 'primary big'));
    } else if (!arcade) {
      foot.push(btn('もう一度', () => Game.startFight(Object.assign({}, B.cfg)), 'primary big'));
    }
    foot.push(btn('タイトルへ', () => Menu.title(), 'ghost'));

    const winner = won ? me : foe;
    this.open(el('div', {}, [
      el('div', 'result-hero', [
        this.live(260, 200, (ctx, w, h, t) => drawShowcase(ctx, w, h, t, winner.base, winner.k.colors)),
        el('div', { class: 'result-title ' + (won ? 'win' : 'lose'), text: title }),
        el('p', { class: 'lead', text: lead }),
      ]),
      el('div', 'tally', [
        el('div', {}, [el('b', { text: String(me.wins) + ' - ' + String(foe.wins) }), 'ラウンド']),
        el('div', {}, [el('b', { text: String(B.stage.destroyed) }), 'この試合で壊した建物']),
        el('div', {}, [el('b', { text: String(G.bestChain) }), '最大コンボ']),
      ]),
      el('div', { class: 'pfoot', style: { justifyContent: 'center' } }, foot),
    ]));
  },

  /* ====================================================================
     図鑑・設定・あそびかた
     ==================================================================== */
  gallery() {
    const list = KAIJU.map((k) => el('div', { class: 'detail', style: { marginTop: '12px' } }, [
      this.live(220, 200, (ctx, w, h, t) => drawShowcase(ctx, w, h, t, k)),
      el('div', {}, [
        el('h2', { text: k.name }),
        el('p', { class: 'sub', text: k.en + ' ― ' + k.title + (G.cleared.indexOf(k.id) >= 0 ? '　★制覇' : '') }),
        el('p', { text: k.desc }),
        el('div', 'moves', [
          moveRow('弱', k.moves.light.name),
          moveRow('強', k.moves.heavy.name),
          moveRow('空中', k.moves.air.name),
          moveRow('必殺', k.moves.special.name),
          moveRow('超必殺', k.moves.super.name),
        ]),
      ]),
    ]));
    this.open(panel({
      eyebrow: '図鑑',
      title: '怪獣 ' + KAIJU.length + '体',
      lead: 'アーケードを勝ち抜いた怪獣には ★ が付きます。',
      body: el('div', {}, list),
      foot: [btn('もどる', () => Menu.title(), 'ghost')],
    }));
  },

  options() {
    const wrap = el('div');
    const paint = () => {
      wrap.innerHTML = '';
      wrap.appendChild(el('h3', { text: '何本先取' }));
      const r1 = el('div', 'rowset');
      [1, 2, 3].forEach((v) => r1.appendChild(el('button', {
        class: 'chip' + (G.rounds === v ? ' on' : ''), type: 'button',
        onClick: () => { G.rounds = v; saveGame(); Sound.ui(); paint(); },
      }, v + '本先取')));
      wrap.appendChild(r1);

      wrap.appendChild(el('h3', { text: 'CPU の強さ' }));
      const r2 = el('div', 'rowset');
      DIFFICULTIES.forEach((d) => r2.appendChild(el('button', {
        class: 'chip' + (G.difficulty === d.id ? ' on' : ''), type: 'button',
        onClick: () => { G.difficulty = d.id; saveGame(); Sound.ui(); paint(); },
      }, d.name)));
      wrap.appendChild(r2);
      wrap.appendChild(el('p', { class: 'note', text: DIFFICULTIES[G.difficulty].note }));

      wrap.appendChild(el('h3', { text: '音' }));
      const r3 = el('div', 'rowset');
      [['鳴らす', false], ['消す', true]].forEach(([label, v]) => r3.appendChild(el('button', {
        class: 'chip' + (G.muted === v ? ' on' : ''), type: 'button',
        onClick: () => { G.muted = v; saveGame(); Sound.ui(); paint(); },
      }, label)));
      wrap.appendChild(r3);
    };
    paint();
    this.open(panel({
      eyebrow: '設定',
      title: '遊びかたの調整',
      body: wrap,
      foot: [
        btn('もどる', () => Menu.title(), 'ghost'),
        btn('記録を消す', () => {
          if (!confirm('勝敗の記録と制覇した怪獣を消します。よろしいですか。')) return;
          try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 消せなくても続行 */ }
          G.cleared = []; G.wins = 0; G.losses = 0; G.destroyed = 0; G.bestChain = 0;
          toast('記録を消しました');
          Menu.title();
        }, 'danger small'),
      ],
    }));
  },

  help() {
    const row = (a, b, c) => el('tr', {}, [
      el('td', { text: a }),
      el('td', {}, b.map((k) => el('span', { class: 'keycap', text: k }))),
      el('td', {}, c ? c.map((k) => el('span', { class: 'keycap', text: k })) : [el('span', { class: 'note', text: '―' })]),
    ]);
    this.open(panel({
      eyebrow: 'あそびかた',
      title: '操作と戦いかた',
      lead: '技はすべてボタン1つで出ます。コマンド入力はありません。',
      body: el('div', {}, [
        el('table', 'keys', [
          el('thead', {}, el('tr', {}, [el('th', { text: '' }), el('th', { text: '1P' }), el('th', { text: '2P' })])),
          el('tbody', {}, [
            row('左右に歩く', ['A', 'D'], ['←', '→']),
            row('ジャンプ', ['W'], ['↑']),
            row('ガード', ['S'], ['↓']),
            row('弱攻撃', ['J'], ['1']),
            row('強攻撃', ['K'], ['2']),
            row('必殺技', ['L'], ['3']),
            row('超必殺', ['I'], ['4']),
            row('一時停止', ['Esc'], []),
          ]),
        ]),
        el('h3', { text: '覚えておくこと' }),
        el('ul', { class: 'lead' }, [
          el('li', { text: '弱攻撃を当てたあとは強攻撃につながります。まずはこれだけで戦えます。' }),
          el('li', { text: 'ガードしていても少しずつ削られます。守り続けるだけでは勝てません。' }),
          el('li', { text: 'ダメージを与えても受けても RAGE が溜まり、満ちると超必殺が撃てます。使うとゼロに戻ります。' }),
          el('li', { text: '必殺技には少しの待ち時間があります。連発はできません。' }),
          el('li', { text: '空中の相手には強攻撃が届きにくいので、必殺技で落とすと楽です。' }),
          el('li', { text: '建物は攻撃でも、ふっとばされた体でも、歩いて踏んでも壊れます。壊すと怒りが少し溜まります。' }),
          el('li', { text: 'トライガとリンネは空中でもう一度ジャンプできます。' }),
        ]),
        el('h3', { text: 'スマホ・タブレット' }),
        el('p', { class: 'lead', text: '画面の下にボタンが出ます。左が移動とガード、右が攻撃です。ふたりで対戦するときはキーボードが要ります。' }),
      ]),
      foot: [btn('もどる', () => Menu.title(), 'ghost')],
    }));
  },
};

function statRow(label, v, min, max) {
  const p = clamp((v - min) / (max - min), 0.04, 1);
  return el('div', 'stat', [
    el('span', { text: label }),
    el('div', 'track', el('i', { style: { width: (p * 100).toFixed(0) + '%' } })),
    el('span', { text: Math.round(p * 100) + '' }),
  ]);
}

function moveRow(label, name) {
  return el('div', 'move', [el('b', { text: label }), el('span', { text: name })]);
}

/* =========================================================================
   メニュー用の絵
   ========================================================================= */
function drawCardArt(ctx, w, h, t, k) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(k.colors.dark, 0.25));
  g.addColorStop(1, '#0b0d14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = k.colors.accent;
  for (let i = 0; i < 7; i++) {
    const bw = w * 0.16, bh = h * (0.16 + ((i * 37) % 10) / 22);
    ctx.fillRect(i * (w / 7), h - bh, bw, bh);
  }
  ctx.restore();
  drawPortrait(ctx, k, w * 0.56, h - 8, h * 0.72, t * 1.2, 1);
}

function drawShowcase(ctx, w, h, t, k, colorOverride) {
  const cols = colorOverride ? Object.assign({}, k.colors, colorOverride) : k.colors;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(cols.dark, 0.3));
  g.addColorStop(0.7, '#0c0e16');
  g.addColorStop(1, '#070810');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  /* 後光 */
  const rg = ctx.createRadialGradient(w / 2, h * 0.62, 4, w / 2, h * 0.62, h * 0.66);
  rg.addColorStop(0, rgba(cols.accent, 0.34));
  rg.addColorStop(1, rgba(cols.accent, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  /* 足元の街 */
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#0a0c14';
  for (let i = 0; i < 10; i++) {
    const bw = w * 0.12, bh = h * (0.08 + ((i * 53) % 9) / 40);
    ctx.fillRect(i * (w / 10) - 4, h - bh - 6, bw, bh);
  }
  ctx.restore();
  const kk = colorOverride ? Object.assign({}, k, { colors: cols }) : k;
  drawPortrait(ctx, kk, w * 0.56, h - 10, h * 0.74, t, 1);
}

function drawTitleScene(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a1030');
  g.addColorStop(0.55, '#3a2358');
  g.addColorStop(1, '#8a3a3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  /* 月 */
  ctx.fillStyle = '#ffe9c0';
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.26, 28, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.35;
  const rg = ctx.createRadialGradient(w * 0.5, h * 0.26, 10, w * 0.5, h * 0.26, 120);
  rg.addColorStop(0, 'rgba(255,233,192,.8)'); rg.addColorStop(1, 'rgba(255,233,192,0)');
  ctx.fillStyle = rg; ctx.fillRect(w * 0.5 - 120, h * 0.26 - 120, 240, 240);
  ctx.restore();
  /* 街 */
  ctx.fillStyle = '#101426';
  for (let i = 0; i < 34; i++) {
    const bx = (i * w) / 34;
    const bh = h * (0.12 + ((i * 97) % 23) / 46);
    ctx.fillRect(bx, h - bh - 6, w / 40, bh);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffd98a';
    for (let j = 0; j < 4; j++) {
      if ((i * 7 + j * 13) % 5 > 2) continue;
      ctx.fillRect(bx + 2, h - bh + 4 + j * 9, 3, 4);
    }
    ctx.restore();
    ctx.fillStyle = '#101426';
  }
  ctx.fillStyle = '#080a12';
  ctx.fillRect(0, h - 8, w, 8);
  /* 対峙する二体 */
  const s = Math.min(h * 0.86, w * 0.24);
  drawPortrait(ctx, KAIJU_BY_ID.gaion, w * 0.5 - s * 0.72, h - 6, s, t, 1);
  drawPortrait(ctx, KAIJU_BY_ID.triga, w * 0.5 + s * 0.78, h - 6, s * 0.98, t + 40, -1);
}

function drawStageThumb(ctx, w, h, t, sd) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sd.sky[0]);
  g.addColorStop(0.55, sd.sky[1]);
  g.addColorStop(1, sd.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const orb = sd.sun || sd.moon;
  if (orb) {
    ctx.fillStyle = orb.color;
    ctx.beginPath(); ctx.arc(w * orb.x, h * orb.y * 0.8, 9, 0, Math.PI * 2); ctx.fill();
  }
  const gy = h * 0.86;
  const r = mulberry32(sd.id.length * 977 + 13);
  ctx.fillStyle = sd.far.color;
  for (let i = 0; i < 26; i++) {
    const bw = w * (0.04 + r() * 0.05);
    const bh = h * (0.12 + r() * 0.42);
    ctx.fillRect(i * (w / 26), gy - bh, bw, bh);
  }
  ctx.fillStyle = rgba(sd.haze, 0.55);
  ctx.fillRect(0, gy - h * 0.3, w, h * 0.3);
  ctx.fillStyle = sd.mid.color;
  for (let i = 0; i < 12; i++) {
    const bw = w * (0.06 + r() * 0.07);
    const bh = h * (0.18 + r() * 0.4);
    ctx.fillRect(i * (w / 12) + r() * 8, gy - bh, bw, bh);
  }
  ctx.fillStyle = sd.ground.body;
  ctx.fillRect(0, gy, w, h - gy);
  ctx.fillStyle = sd.ground.top;
  ctx.fillRect(0, gy, w, 4);
  /* 天気 */
  ctx.save();
  if (sd.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,210,240,.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) {
      const x = (i * 53 + t * 6) % w, y = (i * 31 + t * 11) % h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 11); ctx.stroke();
    }
  } else if (sd.weather === 'sakura') {
    ctx.fillStyle = 'rgba(255,208,224,.8)';
    for (let i = 0; i < 22; i++) {
      const x = (i * 47 + t * 0.7) % w, y = (i * 29 + t * 1.1) % h;
      ctx.beginPath(); ctx.ellipse(x, y, 3, 1.6, i, 0, Math.PI * 2); ctx.fill();
    }
  } else if (sd.weather === 'ash') {
    ctx.fillStyle = 'rgba(230,174,122,.45)';
    for (let i = 0; i < 26; i++) {
      const x = (i * 41 + t * 0.4) % w, y = (i * 37 + t * 0.9) % h;
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
