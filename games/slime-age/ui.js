/* =========================================================================
   SLIME AGE ― 画面
   タイトル / ぼうけん（時代えらび） / なかま（くっつける・武器を もたせる） / あそびかた / たたかいの表示 / けっか
   文字の多い画面は DOM、たたかいは canvas。
   ========================================================================= */
'use strict';

const TUT = [
  { key: 'WASD か やじるしキーで うごいてみよう', touch: 'がめんの ひだりがわを ゆびで なぞって うごいてみよう' },
  { key: 'ひかっている えだに さわって ひろおう', touch: 'ひかっている えだに さわって ひろおう' },
  { key: 'てきに ちかづいて スペースキーで こうげき！', touch: 'てきに ちかづいて「こうげき」ボタンを おそう' },
  { key: 'ハートが でている スライムに さわると なかまに なるよ', touch: 'ハートが でている スライムに さわると なかまに なるよ' },
  { key: 'なかまの そばで E キーを おすと くっつく！ 大きくなると 武器を 2つ もてる', touch: 'なかまの そばで「くっつく」ボタン！ 大きくなると 武器を 2つ もてる' },
  { key: 'てきを たおすと 💡ひらめきが たまる。いっぱいに なると 新しい 武器を はつめい！', touch: 'てきを たおすと 💡ひらめきが たまる。いっぱいに なると 新しい 武器を はつめい！' },
  { key: 'Q で うごかす スライムを かえる。X で わかれる。てきを ぜんぶ たおすと ボスが でるよ', touch: '「きりかえ」で うごかす スライムを かえる。「わかれる」で もとに もどる' },
];

function setText(id, s) { const e = el(id); if (e.textContent !== s) e.textContent = s; }
const iconImg = (id, locked, cls = 'wic') => `<img class="${cls}" src="${weaponIcon(id, locked)}" alt="">`;

const UI = {
  live: [],
  back: null,
  hudSig: '',
  sel: [],

  init() {
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    el('btnPlay').onclick = () => { Sfx.ui(); this.adventure(); };
    el('btnTeam').onclick = () => { Sfx.ui(); this.camp(); };
    el('btnHelp').onclick = () => { Sfx.ui(); this.help(); };
    el('btnSound').onclick = () => { P.sound = !P.sound; Sfx.on = P.sound; Prof.save(); this.title(); Sfx.ui(); };
    el('btnReset').onclick = () => this.confirmReset();
    el('btnBack').onclick = () => { Sfx.ui(); (this.back || (() => this.title()))(); };
    el('btnPause').onclick = () => this.pause();
    el('btnAuto').onclick = () => { P.auto = !P.auto; Prof.save(); Sfx.ui(); this.hudSig = ''; el('btnAuto').blur(); };
    Input.bindButton(el('pbAtk'), 'attack');
    Input.bindButton(el('pbMerge'), 'merge');
    Input.bindButton(el('pbSplit'), 'split');
    Input.bindButton(el('pbSwitch'), 'switch');
  },

  /* ------------------------------ 共通 ------------------------------ */
  hideAll() {
    if (Field.phase !== 'off') Field.stop();
    el('titleScreen').classList.add('hidden');
    el('screen').classList.add('hidden');
    el('hud').classList.add('hidden');
    el('banner').classList.add('hidden');
    this.closeModal();
    this.live = [];
    Input.clear();
  },
  screen(title, back) {
    this.hideAll();
    G.mode = 'menu';
    el('screen').classList.remove('hidden');
    el('scrTitle').textContent = title;
    this.back = back;
    const body = el('scrBody');
    body.innerHTML = '';
    body.scrollTop = 0;
    return body;
  },
  modal(title, body, buttons = [], opt = {}) {
    this.pausing = false;
    el('modal').classList.remove('hidden');
    el('modal').classList.toggle('wide', !!opt.wide);
    el('mTitle').innerHTML = title;
    const mb = el('mBody');
    mb.innerHTML = '';
    if (typeof body === 'string') mb.innerHTML = body; else if (body) mb.appendChild(body);
    const foot = el('mFoot');
    foot.innerHTML = '';
    for (const b of buttons) {
      const btn = h('button', 'btn ' + (b.cls || ''), b.text);
      btn.onclick = () => { Sfx.ui(); b.fn(); };
      foot.appendChild(btn);
    }
    Input.clear();
  },
  closeModal() { el('modal').classList.add('hidden'); this.pausing = false; },
  modalOpen() { return !el('modal').classList.contains('hidden'); },
  liveCanvas(cv, fn) { this.live.push({ cv, fn }); fn(cv, G.time); },
  tick() {
    if (G.mode === 'field') this.hud();
    this.live = this.live.filter((l) => l.cv.isConnected);
    for (const l of this.live) l.fn(l.cv, G.time);
  },

  /* ------------------------------ タイトル ------------------------------ */
  title() {
    this.hideAll();
    G.mode = 'title';
    el('titleScreen').classList.remove('hidden');
    const era = Math.min(P.era, LAST_ERA);
    const done = P.era > LAST_ERA;
    el('titleInfo').innerHTML = `${done ? '<b>スライム文明 かんせい！</b>' : `いまの時代 <b>${ERAS[era].name}</b>`}　はつめいした 武器 <b>${P.tech}</b>/${WEAPON_ORDER.length}　なかま <b>${Prof.members()}</b>ひき`;
    el('btnSound').textContent = 'おと: ' + (P.sound ? 'オン' : 'オフ');
  },
  confirmReset() {
    this.modal('データを 消す？', '<p>なかま・武器・すすんだ時代が ぜんぶ さいしょに もどります。もとには もどせません。</p>', [
      { text: 'やめる', cls: 'ghost', fn: () => this.closeModal() },
      { text: '消す', cls: 'danger', fn: () => { Prof.reset(); Prof.save(); this.title(); toast('データを 消した'); } },
    ]);
  },

  /* ------------------------------ ぼうけん（時代えらび） ------------------------------ */
  adventure() {
    const body = this.screen('ぼうけん ― 文明の ねんぴょう', () => this.title());
    const top = h('div', 'advTop');
    top.innerHTML = `<p>時代を クリアすると 文明が すすみ、つぎの 時代の 武器を はつめいできる ように なる。はつめいした 武器 <b>${P.tech}</b>/${WEAPON_ORDER.length}</p>`;
    const tb = h('button', 'btn', 'なかまを へんせい');
    tb.onclick = () => { Sfx.ui(); this.camp(); };
    top.appendChild(tb);
    body.appendChild(top);
    const list = h('div', 'eraList');
    ERAS.forEach((E, i) => {
      const open = i <= P.era;
      const card = h('div', `eraCard t-${E.id}${open ? '' : ' locked'}${P.cleared[i] ? ' done' : ''}`);
      const wps = WEAPON_ORDER.filter((id) => WEAPONS[id].era === i).map((id) => {
        const got = Prof.invented(id);
        return `<span class="ewp${got ? '' : ' lock'}">${iconImg(id, !got)}<small>${got ? WEAPONS[id].name : '？？？'}</small></span>`;
      }).join('');
      const state = P.cleared[i] ? '<span class="estate ok">クリア</span>' : open ? '<span class="estate now">いまここ</span>' : '<span class="estate">🔒</span>';
      card.innerHTML = `
        <div class="ehead"><span class="eno">${i + 1}</span><b>${E.name}</b><small>${E.place}</small>${state}</div>
        <p class="edesc">${open ? E.desc : 'まえの 時代を クリアすると いける。'}</p>
        <div class="ewps">${wps}</div>
        <div class="efoot"><span class="eboss">${open ? 'ボス: ' + E.boss.name : ''}</span></div>`;
      if (open) {
        const go = h('button', 'btn primary', 'しゅつげき');
        go.onclick = () => { Sfx.ui(); this.startStage(i); };
        card.querySelector('.efoot').appendChild(go);
      }
      list.appendChild(card);
    });
    body.appendChild(list);
    const cur = list.children[Math.min(P.era, LAST_ERA)];
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 0);
  },

  /* ------------------------------ なかま（へんせい） ------------------------------ */
  camp() {
    const body = this.screen('なかま ― へんせい', () => this.title());
    this.sel = this.sel.filter((i) => i < P.team.length);
    const wrap = h('div', 'camp');
    const info = h('div', 'campTop');
    info.innerHTML = `<p>スライムを 2ひき えらんで「くっつける」と、大きく なって もてる 武器が ふえる（1ぴきに ${MAX_MEMBERS}ひき まで）。武器の わくを おすと、はつめいした 武器を もたせられる。</p>
      <p class="dim">スライム ${P.team.length}/${MAX_BODIES}　ぜんぶで ${Prof.members()}ひき</p>`;
    wrap.appendChild(info);
    const grid = h('div', 'teamGrid');
    P.team.forEach((t, i) => grid.appendChild(this.teamCard(t, i)));
    wrap.appendChild(grid);
    const foot = h('div', 'campFoot');
    const mb = h('button', 'btn big', this.sel.length === 2 ? 'えらんだ 2ひきを くっつける' : 'くっつける 2ひきを えらんでね');
    mb.disabled = this.sel.length !== 2;
    if (this.sel.length === 2) mb.classList.add('glow');
    mb.onclick = () => this.mergeTeam();
    const go = h('button', 'btn primary big', 'ぼうけんへ');
    go.onclick = () => { Sfx.ui(); this.adventure(); };
    foot.appendChild(mb); foot.appendChild(go);
    wrap.appendChild(foot);
    body.appendChild(wrap);
  },
  teamCard(t, i) {
    const n = t.members.length;
    const b = { members: t.members, ally: true, wpns: [] };
    calcStats(b);
    const picked = this.sel.indexOf(i);
    const c = h('div', 'scard' + (picked >= 0 ? ' sel' : ''));
    const cv = h('canvas', 'scv');
    c.appendChild(cv);
    if (picked >= 0) c.appendChild(h('span', 'pickNo', String(picked + 1)));
    if (i === 0) c.appendChild(h('span', 'leadTag', 'リーダー'));
    const traits = [...new Set(t.members)].map((m) => `<i class="cdot" style="background:${COLORS[m].col}"></i>${COLORS[m].trait}`).join('<br>');
    const dots = t.members.map((m) => `<i class="cdot" style="background:${COLORS[m].col}"></i>`).join('');
    const info = h('div', 'sinfo');
    info.innerHTML = `<b>${sizeName(n)} <small>${n}ひき</small></b><span class="dots">${dots}</span>
      <span class="stat">たいりょく ${b.maxHp}　こうげき ×${b.atk.toFixed(2).replace(/0$/, '')}　はやさ ${Math.round(b.spd)}</span>
      <span class="traits">${traits}</span>`;
    c.appendChild(info);
    const slots = h('div', 'slots');
    for (let s = 0; s < slotCount(n); s++) {
      const id = t.wpns[s];
      const sb = h('button', 'slot' + (id ? '' : ' empty'), id ? `${iconImg(id)}<span>${WEAPONS[id].name}</span>` : '<span>＋ 武器を もたせる</span>');
      sb.onclick = () => { Sfx.ui(); this.chooseWeapon(i, s); };
      slots.appendChild(sb);
    }
    c.appendChild(slots);
    const btns = h('div', 'sbtns');
    const pk = h('button', 'btn small' + (picked >= 0 ? ' on' : ''), picked >= 0 ? 'えらぶのを やめる' : 'えらぶ');
    pk.onclick = () => {
      Sfx.ui();
      if (picked >= 0) this.sel.splice(picked, 1);
      else { this.sel.push(i); if (this.sel.length > 2) this.sel.shift(); }
      this.camp();
    };
    btns.appendChild(pk);
    if (n > 1) {
      const sp = h('button', 'btn small', 'わける');
      sp.onclick = () => this.splitTeam(i);
      btns.appendChild(sp);
    }
    if (i > 0) {
      const ld = h('button', 'btn small ghost', 'リーダーにする');
      ld.onclick = () => { Sfx.ui(); P.team.unshift(P.team.splice(i, 1)[0]); this.sel = []; Prof.save(); this.camp(); };
      btns.appendChild(ld);
    }
    c.appendChild(btns);
    setTimeout(() => this.liveCanvas(cv, (cv2, tt) => paintSlimeCard(cv2, t, tt + i * 0.7)), 0);
    return c;
  },
  mergeTeam() {
    if (this.sel.length !== 2) return;
    const [i, j] = this.sel.slice().sort((a, b) => a - b);
    const a = P.team[i], b = P.team[j];
    if (a.members.length + b.members.length > MAX_MEMBERS) { Sfx.bad(); toast(`くっつけられるのは ${MAX_MEMBERS}ひき まで`, 'bad'); return; }
    const members = a.members.concat(b.members);
    const wpns = a.wpns.concat(b.wpns).sort((p, q) => rankOf(q) - rankOf(p)).slice(0, slotCount(members.length));
    P.team[i] = { members, wpns };
    P.team.splice(j, 1);
    this.sel = [];
    Prof.save();
    Sfx.merge();
    toast(`${sizeName(members.length)}に なった！`);
    this.camp();
  },
  splitTeam(i) {
    const t = P.team[i];
    const k = Math.min(MAX_BODIES - P.team.length + 1, t.members.length);
    if (k < 2) { Sfx.bad(); toast('なかまが いっぱいで わけられない', 'bad'); return; }
    const groups = Array.from({ length: k }, () => []);
    t.members.forEach((m, n) => groups[n % k].push(m));
    const ws = t.wpns.slice().sort((p, q) => rankOf(q) - rankOf(p));
    const parts = groups.map((g) => ({ members: g, wpns: [] }));
    ws.forEach((w, n) => { const p = parts[n % k]; if (p.wpns.length < slotCount(p.members.length)) p.wpns.push(w); });
    P.team.splice(i, 1, ...parts);
    this.sel = [];
    Prof.save();
    Sfx.split();
    this.camp();
  },
  chooseWeapon(ti, si) {
    const t = P.team[ti];
    const box = h('div', 'wlist');
    const ids = WEAPON_ORDER.slice(0, P.tech).reverse();
    for (const id of ids) {
      const d = WEAPONS[id];
      const row = h('button', 'wrow' + (t.wpns[si] === id ? ' on' : ''));
      row.innerHTML = `${iconImg(id)}<span class="wtxt"><small>${ERAS[d.era].name}・${KIND_NAME[d.kind]}</small><b>${d.name}</b><span>${d.desc}</span></span><span class="wpow">こうげき<b>${d.dmg}</b></span>`;
      row.onclick = () => {
        Sfx.ui();
        if (si < t.wpns.length) t.wpns[si] = id; else t.wpns.push(id);
        Prof.save();
        this.closeModal();
        this.camp();
      };
      box.appendChild(row);
    }
    const lockedLeft = WEAPON_ORDER.length - P.tech;
    if (lockedLeft) box.appendChild(h('p', 'dim', `まだ はつめいしていない 武器が ${lockedLeft}こ ある。てきを たおして ひらめきを ためよう。`));
    const btns = [{ text: 'もどる', cls: 'ghost', fn: () => this.closeModal() }];
    if (t.wpns[si]) btns.unshift({ text: 'はずす', fn: () => { t.wpns.splice(si, 1); Prof.save(); this.closeModal(); this.camp(); } });
    this.modal('もたせる 武器を えらぶ', box, btns, { wide: true });
  },

  /* ------------------------------ あそびかた ------------------------------ */
  help() {
    const body = this.screen('あそびかた', () => this.title());
    body.innerHTML = `<div class="help">
      <section><h3>うごかす</h3>
        <p>パソコン: <b>WASD</b> か <b>やじるし</b>で うごく。<b>スペース</b>（または マウスを おす）で こうげき。<b>E</b> で くっつく、<b>X</b> で わかれる、<b>Q</b> で うごかす スライムを かえる。<b>Esc</b> で ひとやすみ。</p>
        <p>スマホ: がめんの ひだりがわを なぞると うごく。みぎしたの ボタンで こうげき・くっつく・わかれる・きりかえ。</p>
        <p>こうげきは いちばん ちかい てきを じどうで ねらう。うえの「オート」を オンにすると、ボタンを おさなくても こうげきする。</p></section>
      <section><h3>くっつける</h3>
        <p>なかまの スライムの そばで「くっつく」と 1ぴきの 大きな スライムに なる。たいりょくと こうげきが あがり、もてる 武器が ふえる（2ひきで 2こ、4ひきで 3こ、7ひきで 4こ）。8ひき くっつくと キングスライム！</p>
        <p>大きいと つよいけれど、すこし おそくなる。「わかれる」で いつでも 1ぴきずつに もどれる。</p></section>
      <section><h3>武器と 文明</h3>
        <p>さいしょは おちている <b>えだ</b>だけ。てきを たおすと 出てくる 💡<b>ひらめき</b>を ひろうと ゲージが たまり、いっぱいに なると つぎの 武器を はつめいする。</p>
        <p>えだ → 木のぼう → 木の剣 → 石のオノ → … → ビームソード と、時代が すすむほど つよい 武器が できる。その時代の ボスを たおすと、つぎの 時代へ すすめる。</p>
        <p>落ちている 武器に さわると ひろって もつ。もう いっぱいなら いちばん よわい 武器と とりかえる。「なかま」の がめんでは、はつめいした 武器を すきな スライムに もたせられる。</p></section>
      <section><h3>スライムの 色</h3>
        <p>${COLOR_IDS.map((c) => `<i class="cdot" style="background:${COLORS[c].col}"></i><b>${COLORS[c].name}</b>: ${COLORS[c].trait}`).join('<br>')}</p>
        <p>てきを たおすと、ハートを 出して なかまに なりたがる ことが ある。さわると なかまに なる。</p></section>
    </div>`;
  },

  /* ------------------------------ たたかい ------------------------------ */
  startStage(era) {
    this.hideAll();
    G.mode = 'field';
    this.lastEra = era;
    el('hud').classList.remove('hidden');
    this.hudSig = '';
    Field.start(era);
    this.banner(`${era + 1}. ${ERAS[era].name}`, ERAS[era].place);
  },
  pause() {
    if (G.mode !== 'field' || Field.phase === 'over' || this.modalOpen()) return;
    this.modal('ひとやすみ', `<p class="dim">WASD・やじるし いどう　スペース こうげき　E くっつく　X わかれる　Q きりかえ</p>
      <p>やめても、なかまに なった スライムや はつめいした 武器は のこる。</p>`, [
      { text: 'やめる', cls: 'ghost', fn: () => { Field.saveTeam(); Prof.save(); this.title(); } },
      { text: 'やりなおす', fn: () => { Field.saveTeam(); Prof.save(); this.startStage(this.lastEra); } },
      { text: 'つづける', cls: 'primary', fn: () => this.closeModal() },
    ]);
    this.pausing = true;
  },
  banner(title, sub, iconId, danger) {
    const b = el('banner');
    el('bnTitle').textContent = sub;
    el('bnSub').textContent = title;
    const ic = el('bnIcon');
    if (iconId) { ic.src = weaponIcon(iconId); ic.classList.remove('hidden'); } else ic.classList.add('hidden');
    b.classList.toggle('danger', !!danger);
    b.classList.remove('hidden');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bnTimer);
    this.bnTimer = setTimeout(() => b.classList.add('hidden'), 2200);
  },
  result(win, st, era) {
    const inv = st.invented.length ? `<div class="invRow">${st.invented.map((id) => `<span class="ewp">${iconImg(id)}<small>${WEAPONS[id].name}</small></span>`).join('')}</div>` : '';
    const line = `<p>たおした てき <b>${st.kills}</b>　なかまに なった <b>${st.recruits}</b>　くっついた <b>${st.merges}</b></p>`;
    if (!win) {
      this.modal('やられた…', `${line}${inv ? '<p>はつめいした 武器</p>' + inv : ''}
        <p>なかまと 武器と ひらめきは そのまま のこっている。くっつけかたや もたせる 武器を かえて、もういちど！</p>`, [
        { text: 'タイトル', cls: 'ghost', fn: () => this.title() },
        { text: 'なかまを へんせい', fn: () => this.camp() },
        { text: 'もういちど', cls: 'primary', fn: () => this.startStage(era) },
      ]);
      return;
    }
    if (era === LAST_ERA) {
      this.modal('スライム文明 かんせい！', `<p class="big">ギャラクシー スライムを たおした！</p>
        <p>えだ 1本から はじまった スライムたちの 文明は、ひかりの 武器を つくるまでに なった。</p>${line}
        <p class="dim">どの時代にも また いける。なかまを ふやして キングスライムを たくさん つくろう。</p>`, [
        { text: 'タイトル', cls: 'ghost', fn: () => this.title() },
        { text: 'なかまを みる', cls: 'primary', fn: () => this.camp() },
      ]);
      return;
    }
    const N = ERAS[era + 1];
    const nextW = WEAPON_ORDER.filter((id) => WEAPONS[id].era === era + 1).map((id) => WEAPONS[id].name).join('・');
    this.modal('クリア！', `<p class="big">文明が すすんだ！</p>${line}${inv ? '<p>この時代に はつめいした 武器</p>' + inv : ''}
      <p>つぎは <b>${N.name}</b>（${N.place}）。ひらめきを ためると <b>${nextW}</b> を はつめいできる。</p>`, [
      { text: 'タイトル', cls: 'ghost', fn: () => this.title() },
      { text: 'なかまを へんせい', fn: () => this.camp() },
      { text: 'つぎの時代へ', cls: 'primary', fn: () => this.startStage(era + 1) },
    ]);
  },

  /* たたかい中の表示。かわったところだけ 書きかえる */
  hud() {
    const F = Field;
    if (!F.def) return;
    const boss = F.bossBody && !F.bossBody.dead ? F.bossBody : null;
    setText('eraName', `${F.era + 1}. ${F.def.name}`);
    if (boss || F.phase === 'clear') {
      setText('eraInfo', boss ? 'ボス: ' + boss.boss.name : 'ボスを たおした！');
      el('eraBar').style.width = (boss ? clamp(boss.hp / boss.maxHp, 0, 1) * 100 : 0) + '%';
      el('eraBox').classList.add('boss');
    } else {
      const left = F.remaining();
      setText('eraInfo', `ボスまで ${left}ひき`);
      el('eraBar').style.width = (1 - left / F.def.total) * 100 + '%';
      el('eraBox').classList.remove('boss');
    }
    const next = Prof.next();
    let ratio = 1, name = 'ぜんぶ はつめいした！', icon = null, later = false;
    if (next) {
      ratio = clamp(P.ideas / inventCost(P.tech), 0, 1);
      later = WEAPONS[next].era > F.era;
      name = later ? 'つぎの時代で はつめい' : 'つぎ: ' + WEAPONS[next].name;
      icon = next;
    }
    setText('ideaName', name);
    el('ideaBar').style.width = ratio * 100 + '%';
    el('ideaBox').classList.toggle('full', ratio >= 1 && later);
    const ic = el('ideaIcon');
    if (icon) {
      const key = icon + (later ? ':l' : '');
      if (ic.dataset.id !== key) { ic.src = weaponIcon(icon, later); ic.dataset.id = key; }
      ic.classList.remove('hidden');
    } else ic.classList.add('hidden');

    /* チーム */
    const team = F.bodies.filter((b) => b.ally && !b.cand);
    const sig = team.map((b) => `${b.id}:${b.members.join('')}:${b.ko ? 1 : 0}:${b === F.ctrl ? 1 : 0}`).join('|') + '|' + P.auto;
    if (sig !== this.hudSig) {
      this.hudSig = sig;
      const bar = el('teamBar');
      bar.innerHTML = '';
      for (const b of team) {
        const chip = h('button', 'chip' + (b === F.ctrl ? ' on' : '') + (b.ko ? ' ko' : ''));
        chip.innerHTML = `<i class="blob" style="--c:${b.col}"></i><span>${b.members.length > 1 ? '×' + b.members.length : ''}</span><em><u></u></em>`;
        chip.onclick = () => F.setCtrl(b);
        chip._b = b;
        bar.appendChild(chip);
      }
      el('btnAuto').textContent = 'オート: ' + (P.auto ? 'オン' : 'オフ');
      el('btnAuto').classList.toggle('on', P.auto);
    }
    for (const chip of el('teamBar').children) {
      const b = chip._b;
      chip.querySelector('u').style.width = clamp(b.hp / b.maxHp, 0, 1) * 100 + '%';
    }
    const c = F.ctrl;
    el('pbMerge').classList.toggle('ready', !!F.mergeCand);
    el('pbSplit').disabled = !c || c.members.length < 2;

    /* ヒント */
    const hint = el('hint');
    if (F.tut >= 0 && F.phase !== 'over') {
      const tx = TUT[F.tut][document.body.classList.contains('touch') ? 'touch' : 'key'];
      if (hint.textContent !== tx) hint.textContent = tx;
      hint.classList.remove('hidden');
    } else hint.classList.add('hidden');
  },
};
