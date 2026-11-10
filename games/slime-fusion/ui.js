/* =========================================================================
   SLIME FUSION ― 画面
   タイトル / ぼくじょう / とうばつ / くんれんじょう / なかま / ショップ / ずかん / バトルの コマンド
   ========================================================================= */
'use strict';

const colorDot = (c) => `<i class="cdot" style="background:${COLORS[c].c}"></i>`;

const UI = {
  back: null,

  init() {
    el('btnStart').onclick = () => { Sfx.unlock(); this.home(); };
    el('btnNew').onclick = () => {
      Sfx.unlock();
      if (Save.read()) {
        this.confirm('さいしょから', 'いまの データは きえます。いいですか？', () => { freshProfile(); saveGame(); this.home(); });
      } else { freshProfile(); saveGame(); this.home(); }
    };
    el('btnHelpT').onclick = () => this.help();
    el('btnBack').onclick = () => { Sfx.ui(); const b = this.back; this.back = null; (b || (() => this.home()))(); };
    el('navQuest').onclick = () => { Sfx.ui(); this.quests(); };
    el('navTrain').onclick = () => { Sfx.ui(); this.training(); };
    el('navLab').onclick = () => { Sfx.ui(); Lab.open(); };
    el('navTeam').onclick = () => { Sfx.ui(); this.team(); };
    el('navShop').onclick = () => { Sfx.ui(); this.shop(); };
    el('navDex').onclick = () => { Sfx.ui(); this.dex(); };
    el('btnMenu').onclick = () => { Sfx.ui(); this.menu(); };
    el('fzStop').onclick = () => Movie.stopWheel();
    el('fzNext').onclick = () => { Sfx.ui(); Movie.nextMsg(); };
    el('fzSkip').onclick = () => Movie.skip();
    el('edDone').onclick = () => { Sfx.ui(); Editor.close(); };
    el('edClear').onclick = () => { Sfx.ui(); Editor.clear(); };
    el('bFast').onclick = () => { Battle.fast = !Battle.fast; el('bFast').classList.toggle('on', Battle.fast); };
    addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (G.mode === 'fusion' && Movie.st && Movie.st.phase === 'wheel') { e.preventDefault(); Movie.stopWheel(); }
      }
    });
    const ec = el('edCanvas');
    const pos = (e) => { const r = ec.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    ec.addEventListener('pointerdown', (e) => { ec.setPointerCapture(e.pointerId); Editor.down(...pos(e)); });
    ec.addEventListener('pointermove', (e) => Editor.move(...pos(e)));
    ec.addEventListener('pointerup', () => Editor.up());
    ec.addEventListener('pointercancel', () => Editor.up());
    const gc = el('game');
    gc.addEventListener('pointerdown', (e) => {
      Sfx.unlock();
      if (G.mode === 'battle') Battle.tap(e.clientX, e.clientY);
      else if (G.mode === 'home') Ranch.tap(e.clientX, e.clientY);
      else if (G.mode === 'fusion' && Movie.st && Movie.st.phase === 'wheel') Movie.stopWheel();
    });
  },

  hideAll() {
    for (const id of ['titleScreen', 'homeUI', 'screen', 'battleUI', 'fusionUI', 'editor']) el(id).classList.add('hidden');
    this.closeModal();
  },

  title() {
    G.mode = 'title';
    this.hideAll();
    el('titleScreen').classList.remove('hidden');
    const has = loadGame();
    el('btnStart').textContent = has ? 'つづきから' : 'はじめる';
    if (!has) freshProfile();
    el('btnNew').classList.toggle('hidden', !has);
    Sfx.on = P.sound !== false;
    el('titleInfo').textContent = has ? `スライム ${P.slimes.length}ひき　ずかん ${Object.keys(P.seen).length}/${DEX.length}　コイン ${P.coins}` : '';
  },

  /* ------------------------------ ぼくじょう ------------------------------ */
  home() {
    G.mode = 'home';
    this.hideAll();
    el('homeUI').classList.remove('hidden');
    this.refreshTop();
    Ranch.sync();
    const firstFuse = P.fusions === 0;
    el('navLab').classList.toggle('glow', firstFuse);
    el('navQuest').classList.toggle('glow', !firstFuse && P.wins === 0);
    if (!P.tut.hello) {
      P.tut.hello = true; saveGame();
      this.modal('スライムぼくじょうへ ようこそ！', `<p>いまは <b>ただのスライム</b> が 2ひき いるよ。</p><p>まずは <b>ごうせいだい</b> に 2ひきを いれて ごうせいしてみよう。大きくなったり、ルーレットで ちがう スライムに しんかしたり するよ！</p><p>ごうせいすると <b>つの</b> や <b>トゲ</b> などの パーツを すきな ばしょに つけられるように なる。つよくなったら <b>とうばつ</b> へ でかけよう。</p>`, [{ t: 'ごうせいだいへ', primary: true, f: () => Lab.open() }, { t: 'あとで' }]);
    }
  },
  refreshTop() {
    el('coins').textContent = P.coins;
    el('dexCount').textContent = `${Object.keys(P.seen).length}/${DEX.length}`;
  },

  screen(title, render, back) {
    G.mode = 'screen';
    this.hideAll();
    el('screen').classList.remove('hidden');
    el('scrTitle').textContent = title;
    el('scrCoins').textContent = P.coins;
    this.back = back || null;
    this.rerender = () => { el('scrCoins').textContent = P.coins; render(el('scrBody')); };
    this.rerender();
    el('scrBody').scrollTop = 0;
  },

  slimeCard(s, o = {}) {
    const inParty = P.party.includes(s.id);
    const c = h('button', 'scard' + (o.used ? ' used' : '') + (inParty ? ' party' : ''));
    c.appendChild(slimeCanvas(s, o.px || 72));
    c.appendChild(h('div', 'nm', spName(s)));
    c.appendChild(h('div', 'sub', `Lv${s.lv}・おおきさ${s.size}`));
    c.appendChild(h('div', 'cols', s.colors.map(colorDot).join('') || colorDot('plain')));
    if (inParty) c.appendChild(h('span', 'badge', 'パーティ'));
    return c;
  },

  /* ------------------------------ スライムの くわしい 画面 ------------------------------ */
  detail(s, onClose) {
    const st = calcStats(s);
    const sp = spOf(s);
    const body = h('div', 'detail');
    const top = h('div', 'dTop');
    top.appendChild(slimeCanvas(s, 150));
    const info = h('div', 'dInfo');
    info.innerHTML = `
      <div class="row"><b>Lv ${s.lv}</b> <span class="dim">おおきさ ${s.size}/5　${'★'.repeat(Math.min(6, sp.tier)) || '・'}</span></div>
      <div class="xbar"><i style="width:${s.lv >= MAX_LV ? 100 : (s.exp / expNeed(s.lv)) * 100}%"></i></div>
      <div class="stats"><span>HP <b>${st.hp}</b></span><span>こうげき <b>${st.atk}</b></span><span>ぼうぎょ <b>${st.def}</b></span><span>すばやさ <b>${st.spd}</b></span></div>
      <div class="row">色: ${(s.colors.length ? s.colors : ['plain']).map((c) => `${colorDot(c)}${COLORS[c].name}`).join('　')}</div>`;
    top.appendChild(info);
    body.appendChild(top);
    body.appendChild(h('h4', '', 'とくせい'));
    body.appendChild(h('div', 'tlist', traitsOf(s).map((t) => `<div><b>${TRAITS[t].name}</b> <small>${TRAITS[t].info}</small></div>`).join('')));
    body.appendChild(h('h4', '', 'わざ'));
    const ml = h('div', 'mlist');
    for (const m of movesOf(s)) {
      const pw = m.heal ? 'かいふく' : `いりょく ${m.pow}${m.hits ? '×2' : ''}${m.all ? ' ぜんたい' : ''}`;
      ml.appendChild(h('div', 'mv', `${colorDot(m.el)}<b>${m.name}</b> <small>${pw}　パワー${m.cost}</small>`));
    }
    body.appendChild(ml);
    body.appendChild(h('h4', '', 'パーツ'));
    body.appendChild(h('div', 'plist', s.unlocked.length ? s.unlocked.map((t) => `<span>${PARTS[t].icon}${PARTS[t].name} ${partCount(s, t)}/${PARTS[t].cap(s.size)}</span>`).join('') : '<small class="dim">まだ なし。ごうせいすると つけられるように なるよ</small>'));
    const inParty = P.party.includes(s.id);
    const btns = [];
    btns.push({ t: inParty ? 'パーティから はずす' : 'パーティに いれる', f: () => {
      if (inParty) { if (P.party.length <= 1) { toast('パーティには 1ぴきは いないと だめだよ'); this.detail(s, onClose); return; } P.party = P.party.filter((x) => x !== s.id); }
      else { if (P.party.length >= PARTY_MAX) { toast(`パーティは ${PARTY_MAX}ひき までだよ。だれかを はずしてね`); this.detail(s, onClose); return; } P.party.push(s.id); }
      saveGame(); onClose && onClose();
    } });
    if (s.unlocked.length) btns.push({ t: 'パーツを つける', primary: true, f: () => Editor.open(s, null, () => (onClose ? onClose() : this.team())) });
    btns.push({ t: 'にがす', danger: true, f: () => {
      if (P.slimes.length <= 1) { toast('さいごの 1ぴきは にがせないよ'); this.detail(s, onClose); return; }
      this.confirm('にがす', `${spName(s)} を のはらに かえしますか？ もどって こないよ`, () => {
        P.slimes = P.slimes.filter((x) => x !== s); P.party = P.party.filter((x) => x !== s.id);
        if (!P.party.length) P.party = [P.slimes[0].id];
        saveGame(); onClose && onClose();
      }, onClose);
    } });
    btns.push({ t: 'とじる', f: () => onClose && onClose() });
    this.modal(spName(s), body, btns);
  },
  afterFusion(child) {
    this.detail(child, () => Lab.open());
  },

  /* ------------------------------ なかま ------------------------------ */
  team() {
    this.screen('なかま', (body) => {
      body.innerHTML = '';
      body.appendChild(h('h3', 'sec', `パーティ (${P.party.length}/${PARTY_MAX})　バトルに でる スライム`));
      const pg = h('div', 'sgrid party');
      for (const s of partySlimes()) { const c = this.slimeCard(s, { px: 84 }); c.onclick = () => this.detail(s, () => this.team()); pg.appendChild(c); }
      body.appendChild(pg);
      body.appendChild(h('h3', 'sec', `ぜんぶの スライム (${P.slimes.length}/${BOX_MAX})`));
      const g = h('div', 'sgrid');
      const list = P.slimes.slice().sort((a, b) => powerOf(b) - powerOf(a));
      for (const s of list) { const c = this.slimeCard(s); c.onclick = () => this.detail(s, () => this.team()); g.appendChild(c); }
      body.appendChild(g);
    });
  },

  /* ------------------------------ とうばつ ------------------------------ */
  stageOpen(ai, si) {
    if (si > 0) return !!P.cleared[`${ai}-${si - 1}`];
    return ai === 0 || !!P.cleared[`${ai - 1}-${STAGES_PER_AREA - 1}`];
  },
  quests() {
    this.screen('とうばつ', (body) => {
      body.innerHTML = '';
      body.appendChild(h('p', 'dim', 'てきの スライムを たおして コインと けいけんちを あつめよう。たおした スライムが ついてくる ことも あるよ。'));
      AREAS.forEach((a, ai) => {
        const open = this.stageOpen(ai, 0);
        const card = h('div', 'area' + (open ? '' : ' locked'));
        card.style.background = `linear-gradient(135deg, ${a.bg[0]}, ${a.bg[1]})`;
        card.appendChild(h('div', 'aname', `${ai + 1}. ${a.name} <small>Lv ${a.lv}〜</small>`));
        const row = h('div', 'stages');
        for (let si = 0; si < STAGES_PER_AREA; si++) {
          const boss = si === STAGES_PER_AREA - 1;
          const ok = this.stageOpen(ai, si);
          const done = P.cleared[`${ai}-${si}`];
          const b = h('button', 'stage' + (boss ? ' boss' : '') + (done ? ' done' : ''), boss ? '👑 ボス' : si === 3 ? '⚔ つよい' : `${si + 1}`);
          b.disabled = !ok;
          b.onclick = () => { Sfx.ui(); this.startStage(ai, si); };
          row.appendChild(b);
        }
        card.appendChild(row);
        if (!open) card.appendChild(h('div', 'lockmsg', '🔒 まえの ばしょの ボスを たおすと ひらく'));
        body.appendChild(card);
      });
    });
  },
  startStage(ai, si) {
    const a = AREAS[ai];
    const boss = si === STAGES_PER_AREA - 1;
    const enemies = [];
    let bossIndex;
    const lv0 = a.lv + si;
    if (boss) {
      const b = a.boss;
      enemies.push(makeEnemy(b.sp, b.lv, { size: b.size, colors: b.colors, parts: b.parts, name: b.name }));
      bossIndex = 0;
      for (let i = 0; i < (ai < 3 ? 1 : 2); i++) enemies.push(makeEnemy(pick(a.pool), Math.max(1, b.lv - 4), { size: 1 + Math.floor(ai / 2) }));
    } else {
      const n = si === 0 ? (ai === 0 ? 1 : 2) : ai === 0 && si === 1 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const sp = pick(a.pool);
        /* さいしょの そうげんは やさしく。おくの ばしょほど 大きな てきが でる */
        const big = Math.floor(ai / 3);
        const lv = ai === 0 ? lv0 - 1 + randi(-1, 0) + (si === 3 ? 1 : 0) : lv0 + randi(-1, 1) + (si === 3 ? 2 : 0);
        const size = ai === 0 ? (si === 3 ? 2 : 1) : clamp((si === 3 ? 2 : randi(1, 2)) + big, 1, 5);
        const e = makeEnemy(sp, Math.max(1, lv), { size });
        if (si === 3 && Math.random() < 0.6) { const extra = pick(ELEMS); if (!e.colors.includes(extra)) e.colors.push(extra); }
        enemies.push(e);
      }
    }
    Battle.start({
      kind: 'quest', title: boss ? `ボス: ${a.boss.name}` : `${a.name} ${si + 1}`, bg: a.bg, enemies, bossIndex, bossHp: 1.2 + ai * 0.06,
      intro: boss ? `${a.boss.name} ${SP[a.boss.sp].name}が あらわれた！` : 'てきの スライムが あらわれた！',
      onEnd: (res) => {
        if (!res.win) return;
        const key = `${ai}-${si}`;
        const first = !P.cleared[key];
        P.cleared[key] = true;
        if (boss && first) {
          const b = a.boss;
          res.recruit = makeEnemy(b.sp, Math.max(1, b.lv - 3), { size: 3, colors: b.colors.slice(0, 3), parts: b.parts.slice(0, 4) });
          res.recruitForce = true;
          if (first) { res.coins += 100 * (ai + 1); P.coins += 100 * (ai + 1); }
        } else if (!boss && Math.random() < (si === 3 ? 0.5 : 0.35)) {
          res.recruit = pick(enemies.filter((e) => !e.nick));
        }
      },
      back: () => this.quests(),
    });
  },

  /* ------------------------------ くんれんじょう ------------------------------ */
  training() {
    this.screen('くんれんじょう', (body) => {
      body.innerHTML = '';
      body.appendChild(h('h3', 'sec', '🎯 かかしとっくん'));
      body.appendChild(h('p', 'dim', 'こうげきして こない かかしスライムで わざと 色チェンジの れんしゅう。まけることは ないよ。かかしの 色を えらんでね。'));
      const row = h('div', 'colorPick');
      for (const c of ELEMS) {
        const b = h('button', 'cbtn', `${colorDot(c)}${COLORS[c].name}`);
        b.onclick = () => { Sfx.ui(); this.startDummy(c); };
        row.appendChild(b);
      }
      body.appendChild(row);
      body.appendChild(h('h3', 'sec', '🥋 きょうかんと しあい'));
      body.appendChild(h('p', 'dim', '色を かえながら たたかう つよい きょうかん。かつと たくさん けいけんちが もらえる。'));
      for (const c of COACHES) {
        const won = P.coaches[c.id];
        const b = h('button', 'coach' + (won ? ' done' : ''), `<b>${c.name}</b> <small>Lv ${c.lv}　${won ? '✔ かった' : 'はじめて かつと ボーナス'}</small>`);
        b.onclick = () => { Sfx.ui(); this.startCoach(c); };
        body.appendChild(b);
      }
    });
  },
  startDummy(col) {
    const party = partySlimes();
    const lv = Math.max(1, Math.round(party.reduce((a, s) => a + s.lv, 0) / party.length));
    const enemies = [0, 1, 2].map(() => {
      const e = makeEnemy(col + '1', lv, { size: 2, parts: [], colors: [col] });
      e.nick = 'かかしスライム';
      return e;
    });
    Battle.start({ kind: 'dummy', title: 'かかしとっくん', bg: ['#ffe8b0', '#b8945a'], enemies, dummy: true, hpMul: 1.6, expMul: 0.6, coinMul: 0.3, intro: `${COLORS[col].name}の かかしだ。こうかばつぐんの 色を さがそう！`, back: () => this.training() });
  },
  startCoach(c) {
    const enemies = c.team.map((spId) => {
      const sp = SP[spId];
      const cols = sp.el.filter((e) => e !== 'plain').slice(0, 3);
      while (cols.length < 3) { const x = pick(ELEMS); if (!cols.includes(x)) cols.push(x); }
      const e = makeEnemy(spId, c.lv, { size: 3, colors: cols });
      return e;
    });
    Battle.start({ kind: 'coach', title: c.name, bg: ['#d8e8ff', '#7a8aa8'], enemies, expMul: 1.5, coinMul: 1.5, intro: `${c.name}「さあ、かかってきなさい！」`,
      onEnd: (res) => { if (res.win && !P.coaches[c.id]) { P.coaches[c.id] = true; const bonus = 150 + c.lv * 10; P.coins += bonus; res.coins += bonus; } },
      back: () => this.training() });
  },

  /* ------------------------------ ショップ ------------------------------ */
  shop() {
    this.screen('ショップ', (body) => {
      body.innerHTML = '';
      const items = [
        { name: 'ただのスライム', price: PRICE.plain, info: 'ごうせいの ざいりょうに。ただのスライム どうしを ごうせいすると ルーレット！', icon: slimeCanvas(makeSlime('plain'), 64), f: () => {
          if (P.slimes.length >= BOX_MAX) { toast('ぼくじょうが いっぱいだよ'); return false; }
          const s = makeSlime('plain', 1); P.slimes.push(s); toast('ただのスライムが ぼくじょうに きた！'); return true;
        } },
        { name: 'いろのみ', price: PRICE.fruit, info: 'たべた スライムが あたらしい 色に かわれるように なる。バトルで 色チェンジ！', emoji: '🍇', f: () => { this.pickColorThen((c) => this.pickSlimeThen(`${COLORS[c].name}の いろのみを だれに あげる？`, (s) => s.colors.includes(c) ? `${COLORS[c].name}は もう もっているよ` : null, (s) => { s.colors.push(c); this.pay(PRICE.fruit); toast(`${spName(s)}は ${COLORS[c].name}に かわれるように なった！`); })); return null; } },
        { name: 'パーツのたね', price: PRICE.seed, info: 'えらんだ パーツを つけられるように なる。ひみつのレシピさがしに！', emoji: '🌱', f: () => { this.pickPartThen((t) => this.pickSlimeThen(`${PARTS[t].name}の たねを だれに あげる？`, (s) => s.unlocked.includes(t) ? 'もう つけられるよ' : null, (s) => { s.unlocked.push(t); this.pay(PRICE.seed); saveGame(); Editor.open(s, t, () => this.shop()); })); return null; } },
      ];
      for (const it of items) {
        const row = h('div', 'shopItem');
        const ic = h('div', 'ic');
        if (it.icon) ic.appendChild(it.icon); else ic.textContent = it.emoji;
        row.appendChild(ic);
        row.appendChild(h('div', 'tx', `<b>${it.name}</b><small>${it.info}</small>`));
        const b = h('button', 'btn primary', `🪙 ${it.price}`);
        b.disabled = P.coins < it.price;
        b.onclick = () => {
          if (P.coins < it.price) return;
          const r = it.f();
          if (r === true) { this.pay(it.price); Sfx.pickup(); this.rerender(); }
        };
        row.appendChild(b);
        body.appendChild(row);
      }
    });
  },
  pay(n) { P.coins = Math.max(0, P.coins - n); saveGame(); },
  pickColorThen(f) {
    const box = h('div', 'colorPick');
    for (const c of ELEMS) { const b = h('button', 'cbtn', `${colorDot(c)}${COLORS[c].name}`); b.onclick = () => { this.closeModal(); f(c); }; box.appendChild(b); }
    this.modal('どの 色？', box, [{ t: 'やめる' }]);
  },
  pickPartThen(f) {
    const box = h('div', 'colorPick');
    for (const t of PART_IDS) { const b = h('button', 'cbtn', `${PARTS[t].icon}${PARTS[t].name}`); b.onclick = () => { this.closeModal(); f(t); }; box.appendChild(b); }
    this.modal('どの パーツ？', box, [{ t: 'やめる' }]);
  },
  pickSlimeThen(title, bad, f) {
    const g = h('div', 'sgrid');
    for (const s of P.slimes) {
      const c = this.slimeCard(s, { px: 60 });
      const why = bad(s);
      if (why) c.classList.add('used');
      c.onclick = () => { if (why) { toast(why); return; } this.closeModal(); f(s); Sfx.pickup(); if (G.mode === 'screen') this.rerender(); };
      g.appendChild(c);
    }
    this.modal(title, g, [{ t: 'やめる' }]);
  },

  /* ------------------------------ ずかん ------------------------------ */
  dex() {
    this.screen('ずかん', (body) => {
      body.innerHTML = '';
      const n = Object.keys(P.seen).length;
      body.appendChild(h('p', '', `<b>${n}</b> / ${DEX.length} しゅるい みつけた！`));
      const g = h('div', 'dexGrid');
      DEX.forEach((id, i) => {
        const sp = SP[id];
        const seen = P.seen[id];
        const c = h('button', 'dcell' + (seen ? '' : ' unk'));
        c.appendChild(slimeCanvas(sampleOf(id), 58, { silhouette: !seen, fixed: true }));
        c.appendChild(h('div', 'nm', seen ? sp.name : `No.${i + 1} ？？？`));
        c.onclick = () => {
          const els = sp.el.filter((e) => e !== 'plain');
          const how = sp.special ? `ヒント: ${sp.hint}` : sp.line ? (sp.tier === 1 ? 'ただのスライム どうしの ルーレット' : `${LINE[sp.line].names[sp.tier - 2]} どうしを ごうせい`) : sp.hyb ? (sp.tier === 2 ? `${els.map((e) => COLORS[e].name).join('と')}の スライムを ごうせい` : `${els.map((e) => COLORS[e].name).join('と')}の つよい スライム (3だんかい いじょう) を ごうせい。または ${HYBRID_NAMES[sp.hyb][0]} どうし`) : 'さいしょから いる';
          this.modal(seen ? sp.name : '？？？', `<div class="dexBig"></div><p>${els.length ? '色: ' + els.map((e) => colorDot(e) + COLORS[e].name).join(' ') : '色: ただ'}　とくせい: ${seen ? TRAITS[sp.trait].name : '？'}</p><p class="dim">${how}</p>`, [{ t: 'とじる' }]);
          el('mBody').querySelector('.dexBig').appendChild(slimeCanvas(sampleOf(id), 140, { silhouette: !seen, fixed: true }));
        };
        g.appendChild(c);
      });
      body.appendChild(g);
    });
  },

  /* ------------------------------ メニュー / あそびかた ------------------------------ */
  menu() {
    this.modal('メニュー', '<p class="dim">セーブは じどう。データは この たんまつの ブラウザにだけ のこります。</p>', [
      { t: `おと: ${Sfx.on ? 'オン' : 'オフ'}`, f: () => { Sfx.on = !Sfx.on; P.sound = Sfx.on; saveGame(); this.menu(); }, keep: true },
      { t: 'あそびかた', f: () => this.help(), keep: true },
      { t: 'タイトルへ', f: () => this.title() },
      { t: 'とじる' },
    ]);
  },
  help() {
    this.modal('あそびかた', `
      <p><b>🧪 ごうせいだい</b>　2ひきを いれて 1ぴきに する。ただのスライム どうしは ルーレットで 大きくなるか しんかするか きまる。同じ スライム どうしは しんか、ちがう 色どうしは まざった スライムに なる。</p>
      <p><b>🦄 パーツ</b>　ごうせいすると つの・トゲ・はね・しっぽ・ツメ・みみ・ほうせき の どれかを つけられるように なる。スライムの ふちを タップして すきな ばしょに つけよう。トゲの ある スライムと ない スライムを くっつけても、トゲの とくちょうは のこるよ。</p>
      <p><b>✨ ひみつのレシピ</b>　色と パーツの くみあわせで とくべつな スライムが うまれる。ずかんの ヒントを 見てね。</p>
      <p><b>⚔ バトル</b>　わざは「パワー」を つかう。パワーは まいターン 1 たまる。<b>色チェンジ</b>は 1ターンに 1かい タダで できて、いろわざ・ほうせきビームの 色と、うける ダメージが かわる。</p>
      <p><b>🎨 あいしょう</b>　あか→みどり・しろ　あお→あか・ちゃいろ　みどり→あお・ちゃいろ　きいろ→あお　しろ→みどり　ちゃいろ→あか・きいろ　くろ⇔ピンク (やじるしの さきに ばつぐん)</p>
      <p><b>🎯 くんれんじょう</b>　かかしで れんしゅう、きょうかんと しあい。</p>`, [{ t: 'とじる' }]);
  },

  /* ------------------------------ まど ------------------------------ */
  modal(title, body, btns) {
    el('mTitle').textContent = title;
    const mb = el('mBody');
    mb.innerHTML = '';
    if (typeof body === 'string') mb.innerHTML = body; else mb.appendChild(body);
    const foot = el('mFoot');
    foot.innerHTML = '';
    for (const b of btns) {
      const e = h('button', 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), b.t);
      e.onclick = () => { Sfx.ui(); if (!b.keep) this.closeModal(); if (b.f) b.f(); };
      foot.appendChild(e);
    }
    el('modal').classList.remove('hidden');
    mb.scrollTop = 0;
  },
  closeModal() { el('modal').classList.add('hidden'); },
  modalOpen() { return !el('modal').classList.contains('hidden'); },
  confirm(title, text, yes, no) { this.modal(title, `<p>${text}</p>`, [{ t: 'はい', danger: true, f: yes }, { t: 'いいえ', f: no }]); },

  /* ------------------------------ バトルの コマンド ------------------------------ */
  showBattle(title) {
    this.hideAll();
    el('battleUI').classList.remove('hidden');
    el('bTitle').textContent = title;
    el('bFast').classList.toggle('on', Battle.fast);
  },
  battleLog(t) { el('bLog').textContent = t; },
  cmdHeight() { const c = el('cmd'); return G.mode === 'battle' && c ? c.offsetHeight : 0; },

  battleCommand() {
    const box = el('cmd');
    box.innerHTML = '';
    Battle.targeting = null;
    if (Battle.phase !== 'command' || !Battle.pick) {
      box.appendChild(h('div', 'waiting', Battle.phase === 'end' ? '' : '…'));
      return;
    }
    const u = Battle.pick;
    const foes = Battle.live('foe');
    const head = h('div', 'chead');
    head.innerHTML = `<b>${u.name}</b> の ばん　<span class="pips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < u.sp ? 'on' : ''}"></i>`).join('')}</span><small>パワー ${u.sp}</small>`;
    box.appendChild(head);
    /* 色チェンジ */
    const cr = h('div', 'crow');
    cr.appendChild(h('span', 'lbl', u.changed ? '色チェンジ ずみ' : '色チェンジ'));
    for (const c of u.colors) {
      const good = foes.some((f) => affinity(c, f.color) > 1);
      const b = h('button', 'colbtn' + (u.color === c ? ' cur' : ''), `${colorDot(c)}${COLORS[c].name}${good ? '<em>◎</em>' : ''}`);
      b.disabled = u.changed && u.color !== c;
      b.title = good ? 'てきに ばつぐん' : '';
      b.onclick = () => { if (Battle.changeColor(u, c)) this.battleCommand(); };
      cr.appendChild(b);
    }
    if (u.colors.length <= 1) cr.appendChild(h('small', 'dim', 'いろのみ や ごうせいで 色が ふえるよ'));
    box.appendChild(cr);
    /* わざ */
    const mg = h('div', 'mgrid');
    for (const m of movesOf(u.s, u.color)) {
      const eff = !m.heal && foes.length === 1 ? affinity(m.el, foes[0].color) : 1;
      const b = h('button', 'mbtn' + (m.sig ? ' sig' : ''), `<span class="mn">${colorDot(m.el)}${m.name}</span><small><b class="cost">パワー${m.cost}</b>　${m.heal ? 'かいふく' : 'いりょく' + m.pow + (m.hits ? '×2' : '') + (m.all ? ' ぜんたい' : '')}${eff > 1 ? ' ◎' : eff < 1 ? ' △' : ''}</small>`);
      b.disabled = m.cost > u.sp;
      b.onclick = () => {
        Sfx.ui();
        if (m.heal || m.all || foes.length === 1) Battle.setCommand(u, { type: 'move', move: m, target: foes[0] });
        else this.askTarget(u, m);
      };
      mg.appendChild(b);
    }
    const g = h('button', 'mbtn guard', '<span class="mn">🛡 ガード</span><small><b class="cost">パワー0</b>　ダメージ はんぶん</small>');
    g.onclick = () => { Sfx.ui(); Battle.setCommand(u, { type: 'guard' }); };
    mg.appendChild(g);
    box.appendChild(mg);
    const live = Battle.live('ally');
    if (live.indexOf(u) > 0) {
      const bk = h('button', 'btn small ghost', '← まえの なかま');
      bk.onclick = () => { Sfx.ui(); Battle.back(); };
      box.appendChild(bk);
    }
  },
  askTarget(u, m) {
    const box = el('cmd');
    box.innerHTML = '';
    Battle.targeting = { u, m };
    box.appendChild(h('div', 'chead', `<b>${m.name}</b>　だれを ねらう？ (てきを タップしても いいよ)`));
    const row = h('div', 'mgrid');
    for (const f of Battle.live('foe')) {
      const eff = affinity(m.el, f.color);
      const b = h('button', 'mbtn', `<span class="mn">${colorDot(f.color)}${f.name}</span><small>HP ${Math.round((f.hp / f.max) * 100)}%${eff > 1 ? '　◎ばつぐん' : eff < 1 ? '　△いまひとつ' : ''}</small>`);
      b.onclick = () => this.chooseTarget(f);
      row.appendChild(b);
    }
    const c = h('button', 'mbtn guard', '<span class="mn">やめる</span>');
    c.onclick = () => { Sfx.ui(); this.battleCommand(); };
    row.appendChild(c);
    box.appendChild(row);
  },
  chooseTarget(f) {
    const t = Battle.targeting;
    if (!t) return;
    Sfx.ui();
    Battle.targeting = null;
    Battle.setCommand(t.u, { type: 'move', move: t.m, target: f });
  },

  battleResult(res) {
    const def = Battle.def;
    const body = h('div', 'result');
    if (res.win) {
      body.innerHTML = `<p class="big">🪙 ${res.coins} コイン　✨ けいけんち ${res.exp}</p>` + res.ups.map((u) => `<p>⬆ ${spName(u.s)} が Lv ${u.to} に あがった！</p>`).join('');
    } else {
      body.innerHTML = '<p>まけちゃった… でも なにも なくならないよ。</p><p class="dim">くんれんじょうで レベルを あげたり、ごうせいで つよい スライムを つくったり、あいての 色に ばつぐんの 色へ チェンジしてみよう。</p>';
    }
    const done = () => { Battle.leave(); (def.back || (() => this.home()))(); };
    if (res.win && res.recruit) {
      const r = res.recruit;
      const box = h('div', 'recruit');
      box.appendChild(slimeCanvas(r, 90));
      box.appendChild(h('p', '', res.recruitForce ? `<b>${spName(r)}</b> が みとめて ついてきた！` : `<b>${spName(r)}</b> (Lv${r.lv}) が ついてきたがっている！`));
      body.appendChild(box);
      const take = () => {
        /* ボスは いっぱいでも つれてかえれる (はじめての ごほうびを なくさない) */
        if (P.slimes.length >= BOX_MAX && !res.recruitForce) { toast('ぼくじょうが いっぱい。だれかを にがしてね'); return; }
        const s = makeSlime(r.sp, r.lv, { size: r.size, colors: r.colors, parts: r.parts, traits: r.traits });
        P.slimes.push(s); P.seen[s.sp] = true;
        if (P.party.length < PARTY_MAX) P.party.push(s.id);
        saveGame(); Sfx.recruit(); toast(`${spName(s)}が なかまに なった！`);
      };
      this.modal(res.win ? 'しょうり！' : 'まけ…', body, [{ t: 'つれてかえる', primary: true, f: () => { take(); done(); } }, { t: 'さようなら', f: done }]);
      return;
    }
    this.modal(res.win ? 'しょうり！' : 'まけ…', body, [{ t: 'もどる', primary: true, f: done }]);
  },
};

/* =========================================================================
   ぼくじょうの スライムたち (ホームの え)
   ========================================================================= */
const Ranch = {
  mobs: [],
  sync() {
    const keep = new Map(this.mobs.map((m) => [m.s.id, m]));
    this.mobs = P.slimes.slice(0, 18).map((s) => keep.get(s.id) || { s, x: rand(0.1, 0.9), y: rand(0.55, 0.9), tx: rand(0.1, 0.9), ty: rand(0.55, 0.9), wait: rand(2), ph: rand(6), face: 1 });
    for (const m of this.mobs) m.s = slimeById(m.s.id) || m.s;
  },
  update(dt) {
    for (const m of this.mobs) {
      if (m.wait > 0) { m.wait -= dt; continue; }
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d < 0.01) { m.wait = rand(1, 4); m.tx = rand(0.08, 0.92); m.ty = rand(0.55, 0.92); continue; }
      m.x += (dx / d) * dt * 0.06; m.y += (dy / d) * dt * 0.04;
      m.face = dx > 0 ? 1 : -1;
    }
  },
  pos(m) {
    const nav = el('nav');
    const H = G.H - (nav && nav.offsetHeight ? nav.offsetHeight + 10 : 80);
    const r = slimeR(m.s, Math.min(G.W, G.H) * 0.065);
    return { x: clamp(m.x * G.W, r * 1.6, G.W - r * 1.6), y: m.y * H, r };
  },
  draw(ctx) {
    drawRanch(ctx, G.W, G.H, G.time);
    const list = this.mobs.slice().sort((a, b) => a.y - b.y);
    for (const m of list) {
      const { x, y, r } = this.pos(m);
      const moving = m.wait <= 0;
      const hop = moving ? Math.abs(Math.sin(G.time * 7 + m.ph)) * r * 0.25 : 0;
      ctx.save();
      ctx.translate(x, y - hop);
      ctx.scale(m.face, 1);
      drawSlime(ctx, m.s, { r, t: G.time + m.ph, sq: moving ? Math.cos(G.time * 14 + m.ph) * 0.06 : Math.sin(G.time * 2 + m.ph) * 0.03, look: 0.3, mood: P.party.includes(m.s.id) ? null : 'happy' });
      ctx.restore();
      if (P.party.includes(m.s.id)) {
        ctx.fillStyle = '#ffd23a'; ctx.font = `900 13px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText('★', x, y - r * 1.3 - hop);
      }
    }
  },
  tap(x, y) {
    let best = null, bd = 1e9;
    for (const m of this.mobs) {
      const p = this.pos(m);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < p.r * 1.3 && d < bd) { bd = d; best = m; }
    }
    if (best) { Sfx.pop(); best.wait = 0.6; UI.detail(best.s, () => UI.home()); }
  },
};
