/* =========================================================================
   SKYDROP ROYALE ― メニュー画面
   ロビー / ロッカー / スキンづくり / ぶきずかん / けっか / いちじていし
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const DIFF_NAMES = ['やさしい', 'ふつう', 'つよい'];

const UI = {
  init() {
    $('btnPlay').onclick = () => this.play();
    $('btnLocker').onclick = () => this.locker('skin');
    $('btnDex').onclick = () => this.dex();
    $('btnHelp').onclick = () => this.help();
    $('btnSound').onclick = () => { Save.d.opt.sound = !Save.d.opt.sound; Sfx.on = Save.d.opt.sound; Save.write(); this.refreshLobby(); };
    $('btnBack').onclick = () => this.closeScreen();
    document.querySelectorAll('[data-players]').forEach((b) => (b.onclick = () => { Save.d.opt.players = +b.dataset.players; Save.write(); this.refreshLobby(); Sfx.play('ui'); }));
    document.querySelectorAll('[data-diff]').forEach((b) => (b.onclick = () => { Save.d.opt.diff = +b.dataset.diff; Save.write(); this.refreshLobby(); Sfx.play('ui'); }));
    document.addEventListener('click', () => Sfx.unlock(), { once: true });
    this.refreshLobby();
  },

  refreshLobby() {
    const d = Save.d;
    $('coins').textContent = d.coins;
    $('stats').textContent = `ビクトリー ${d.wins}かい ・ たおした かず ${d.kills} ・ あそんだ かいすう ${d.games}`;
    document.querySelectorAll('[data-players]').forEach((b) => b.classList.toggle('on', +b.dataset.players === d.opt.players));
    document.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('on', +b.dataset.diff === d.opt.diff));
    $('btnSound').textContent = d.opt.sound ? '🔊 おと ON' : '🔇 おと OFF';
    const sk = currentSkin();
    $('skinName').textContent = sk.name;
  },

  showLobby() {
    G.mode = 'lobby'; G.paused = false;
    $('lobby').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('modal').classList.add('hidden');
    this.refreshLobby();
  },
  play(opts = {}) {
    Sfx.unlock();
    $('lobby').classList.add('hidden');
    $('screen').classList.add('hidden');
    $('modal').classList.add('hidden');
    $('hud').classList.remove('hidden');
    G.mode = 'match'; G.paused = false;
    Render.bigMap = false;
    const d = Save.d;
    Game.start(Object.assign({ players: d.opt.players, diff: d.opt.diff }, opts));
    Cam.x = Game.training ? Game.me.x : Game.bus.x; Cam.y = Game.training ? Game.me.y : Game.bus.y; Cam.z = Render.baseZoom() * 0.5;
  },

  /* ロビーの はいけい（canvas） */
  drawLobby() {
    const d = G.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, '#5ab8ff'); g.addColorStop(0.6, '#bfe8ff'); g.addColorStop(1, '#ffe8c0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H);
    // くも
    for (let i = 0; i < 6; i++) {
      const x = ((G.time * (12 + i * 4) + i * 300) % (G.W + 400)) - 200, y = 60 + i * 55;
      ctx.globalAlpha = 0.8;
      for (let k = 0; k < 4; k++) circle(ctx, x + k * 34, y + Math.sin(k) * 8, 30 - Math.abs(k - 1.5) * 6, '#ffffff', null);
      ctx.globalAlpha = 1;
    }
    // しま
    const iy = G.H * 0.78;
    ellipse(ctx, G.W * 0.3, iy + 30, G.W * 0.45, 70, '#3a9ad8', null);
    ellipse(ctx, G.W * 0.3, iy, G.W * 0.38, 46, '#6cbf4a', OUT, 3);
    ctx.fillStyle = '#e8d38a'; ctx.beginPath(); ctx.ellipse(G.W * 0.3, iy + 18, G.W * 0.38, 28, 0, 0, Math.PI); ctx.fill();
    // ひこうせん
    drawAirship(ctx, ((G.time * 40) % (G.W + 600)) - 300, G.H * 0.16, 0, G.time);
    // じぶんの キャラ
    const mobile = G.W < 720;
    const sx = mobile ? G.W * 0.5 : G.W * 0.3, sy = mobile ? G.H * 0.33 : G.H * 0.58;
    const sc = mobile ? Math.min(G.W, G.H) / 120 : Math.min(G.W, G.H) / 95;
    drawGlider(ctx, Save.d.glider, sx, sy - 10 * sc + Math.sin(G.time * 2) * 6, sc * 0.8, G.time);
    drawChar(ctx, currentSkin(), sx, sy + Math.sin(G.time * 2) * 6, sc, 1, { t: G.time });
  },

  /* ------------------------------ がめんの わく ------------------------------ */
  openScreen(title) {
    $('scrTitle').textContent = title;
    $('scrCoins').textContent = Save.d.coins;
    $('scrBody').innerHTML = '';
    $('screen').classList.remove('hidden');
    $('lobby').classList.add('hidden');
    return $('scrBody');
  },
  closeScreen() {
    $('screen').classList.add('hidden');
    if (G.mode === 'match') { $('modal').classList.add('hidden'); G.paused = false; return; }
    this.showLobby();
  },
  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; },
  thumb(w, h, draw) {
    const c = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
    const x = c.getContext('2d'); x.scale(dpr, dpr); draw(x);
    return c;
  },

  /* ------------------------------ ロッカー ------------------------------ */
  locker(tab) {
    const body = this.openScreen('ロッカー');
    const tabs = this.el('div', 'tabs');
    [['skin', '👕 スキン'], ['glider', '🪂 グライダー'], ['custom', '🎨 じぶんで つくる']].forEach(([k, n]) => {
      const b = this.el('button', 'btn' + (tab === k ? ' on' : ''), n);
      b.onclick = () => { Sfx.play('ui'); this.locker(k); };
      tabs.appendChild(b);
    });
    body.appendChild(tabs);
    const d = Save.d;
    const grid = this.el('div', 'grid');
    body.appendChild(grid);
    if (tab === 'skin') {
      body.insertBefore(this.el('p', 'dim', `スキンは ${SKINS.length}しゅるい。コインは しあいで もらえるよ（1い 300・たおすごとに 15）。`), grid);
      for (const s of SKINS) {
        const owned = s.price === 0 || d.owned.includes(s.id);
        const card = this.el('div', 'card rar' + s.rar + (d.skin === s.id ? ' eq' : ''));
        card.appendChild(this.thumb(96, 112, (x) => drawChar(x, s, 48, 76, 1.95, 1, { t: 1 })));
        card.appendChild(this.el('b', '', s.name));
        card.appendChild(this.el('small', '', d.skin === s.id ? 'そうびちゅう' : owned ? 'もっている' : `🪙 ${s.price}`));
        card.onclick = () => {
          if (owned) { d.skin = s.id; Save.write(); Sfx.play('ui'); this.locker('skin'); return; }
          if (d.coins < s.price) { this.toast('コインが たりないよ'); return; }
          d.coins -= s.price; d.owned.push(s.id); d.skin = s.id; Save.write(); Sfx.play('chest'); this.locker('skin');
        };
        grid.appendChild(card);
      }
    } else if (tab === 'glider') {
      for (const gl of GLIDERS) {
        const owned = gl.price === 0 || d.owned.includes('g:' + gl.id);
        const card = this.el('div', 'card' + (d.glider === gl.id ? ' eq' : ''));
        card.appendChild(this.thumb(96, 104, (x) => { drawGlider(x, gl.id, 48, 70, 1.2, 1); drawChar(x, currentSkin(), 48, 80, 1.2, 1, { t: 1, noShadow: true }); }));
        card.appendChild(this.el('b', '', gl.name));
        card.appendChild(this.el('small', '', d.glider === gl.id ? 'そうびちゅう' : owned ? 'もっている' : `🪙 ${gl.price}`));
        card.onclick = () => {
          if (owned) { d.glider = gl.id; Save.write(); Sfx.play('ui'); this.locker('glider'); return; }
          if (d.coins < gl.price) { this.toast('コインが たりないよ'); return; }
          d.coins -= gl.price; d.owned.push('g:' + gl.id); d.glider = gl.id; Save.write(); Sfx.play('chest'); this.locker('glider');
        };
        grid.appendChild(card);
      }
    } else {
      body.insertBefore(this.el('p', 'dim', 'かぶりもの・かみがた・め・ふくの もよう・せなか・オーラと 色を くみあわせて、じぶんだけの スキンを 3つまで つくれる。'), grid);
      for (let i = 0; i < 3; i++) {
        const c = d.custom[i];
        const card = this.el('div', 'card' + (d.skin === 'custom' + i ? ' eq' : ''));
        if (c) card.appendChild(this.thumb(96, 112, (x) => drawChar(x, c, 48, 76, 1.95, 1, { t: 1 })));
        else card.appendChild(this.el('div', 'empty', '＋'));
        card.appendChild(this.el('b', '', c ? c.name : `スロット ${i + 1}`));
        const row = this.el('div', 'row');
        const eb = this.el('button', 'btn small', c ? 'へんしゅう' : 'つくる');
        eb.onclick = (e) => { e.stopPropagation(); this.editor(i); };
        row.appendChild(eb);
        if (c) { const ub = this.el('button', 'btn small primary', d.skin === 'custom' + i ? 'そうびちゅう' : 'きる'); ub.onclick = (e) => { e.stopPropagation(); d.skin = 'custom' + i; Save.write(); this.locker('custom'); }; row.appendChild(ub); }
        card.appendChild(row);
        grid.appendChild(card);
      }
    }
  },

  /* ------------------------------ スキンづくり ------------------------------ */
  editor(slot) {
    const d = Save.d;
    const sk = Object.assign({}, d.custom[slot] || randomSkin());
    sk.id = 'custom' + slot; sk.rar = 2;
    if (!sk.name || sk.name === 'ランダム') sk.name = `マイスキン ${slot + 1}`;
    const body = this.openScreen('スキンを つくる');
    const wrap = this.el('div', 'editor');
    const left = this.el('div', 'edLeft');
    const prev = document.createElement('canvas');
    prev.className = 'edPrev';
    left.appendChild(prev);
    const name = this.el('input', 'nameIn'); name.value = sk.name; name.maxLength = 12;
    name.oninput = () => (sk.name = name.value || 'マイスキン');
    left.appendChild(name);
    const btns = this.el('div', 'row');
    const rnd = this.el('button', 'btn', '🎲 おまかせ');
    rnd.onclick = () => { Object.assign(sk, randomSkin(), { id: sk.id, name: sk.name, rar: 2 }); build(); };
    const save = this.el('button', 'btn primary big', 'できた！');
    save.onclick = () => { d.custom[slot] = sk; d.skin = sk.id; Save.write(); Sfx.play('chest'); this.locker('custom'); };
    btns.appendChild(rnd); btns.appendChild(save);
    left.appendChild(btns);
    const right = this.el('div', 'edRight');
    wrap.appendChild(left); wrap.appendChild(right);
    body.appendChild(wrap);

    const drawPrev = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = 220, H = 250;
      prev.width = W * dpr; prev.height = H * dpr; prev.style.width = W + 'px'; prev.style.height = H + 'px';
      const x = prev.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = '#2a2450'; x.fillRect(0, 0, W, H);
      drawChar(x, sk, W / 2, H * 0.62, 5, 1, { t: G.time });
    };
    const anim = () => { if (!prev.isConnected) return; drawPrev(); requestAnimationFrame(anim); };
    const partRow = (label, key) => {
      const r = this.el('div', 'edRow');
      r.appendChild(this.el('span', 'lab', label));
      const L = PART_LISTS[key];
      const minus = this.el('button', 'btn small', '◀'), plus = this.el('button', 'btn small', '▶');
      const val = this.el('b', 'val', PART_NAMES[key][sk[key]]);
      const step = (k) => { const i = (L.indexOf(sk[key]) + k + L.length) % L.length; sk[key] = L[i]; val.textContent = PART_NAMES[key][sk[key]]; Sfx.play('ui'); };
      minus.onclick = () => step(-1); plus.onclick = () => step(1);
      r.append(minus, val, plus);
      right.appendChild(r);
    };
    const colorRow = (label, key, list = COLOR_SWATCH) => {
      const r = this.el('div', 'edRow');
      r.appendChild(this.el('span', 'lab', label));
      const sw = this.el('div', 'swatches');
      for (const c of list) {
        const b = this.el('button', 'sw' + (sk[key] === c ? ' on' : ''));
        b.style.background = c;
        b.onclick = () => { sk[key] = c; sw.querySelectorAll('.sw').forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
        sw.appendChild(b);
      }
      r.appendChild(sw);
      right.appendChild(r);
    };
    const build = () => {
      right.innerHTML = '';
      name.value = sk.name;
      partRow('かぶりもの', 'head'); colorRow('かぶりものの 色', 'headC');
      partRow('かみがた', 'hair'); colorRow('かみの 色', 'hairC');
      partRow('め', 'eyes');
      colorRow('はだの 色', 'tone', SKIN_TONES);
      partRow('ふくの もよう', 'pat'); colorRow('ふくの 色', 'c1'); colorRow('もようの 色', 'c2');
      colorRow('ズボン', 'legs'); colorRow('くつ', 'shoes');
      partRow('せなか', 'back'); colorRow('せなかの 色', 'backC');
      partRow('オーラ', 'fx');
    };
    build();
    anim();
  },

  /* ------------------------------ ぶきずかん ------------------------------ */
  dex() {
    const body = this.openScreen('ぶきずかん');
    const d = Save.d;
    const seen = new Set(d.seen);
    body.appendChild(this.el('p', '', `ぜんぶで <b>${WEAPON_LIST.length}しゅるい</b> × レア度 5だんかい（ノーマル〜レジェンド）＝ <b>${WEAPON_LIST.length * 5}とおり</b>。しあいで ひろった ぶきに ★ が つくよ。<br>みつけた かず: <b>${WEAPON_LIST.filter((w) => seen.has(w.id)).length} / ${WEAPON_LIST.length}</b>　・　ぶきを タップすると ためしうち できる。`));
    for (const cat of Object.keys(CATS)) {
      const list = WEAPON_LIST.filter((w) => w.cat === cat);
      body.appendChild(this.el('h3', 'catHead', `${CATS[cat].name}（${list.length}）`));
      const grid = this.el('div', 'grid dexGrid');
      for (const w of list) {
        const card = this.el('div', 'card wcard');
        const r = Math.max(w.minR, 2);
        card.appendChild(this.thumb(120, 60, (x) => { const k = this.wScale(w, 84, 2.8); x.translate(60 - this.wLen(w) * k / 2, 32); drawWeapon(x, w, r, k); }));
        card.appendChild(this.el('b', '', (seen.has(w.id) ? '★ ' : '') + w.name));
        card.appendChild(this.el('small', '', this.wDesc(w)));
        card.onclick = () => this.weaponDetail(w);
        grid.appendChild(card);
      }
      body.appendChild(grid);
    }
  },
  wScale(w, px, max) { return Math.min(max, px / (this.wLen(w) + 10)); },
  wLen(w) { return ({ pistol: 15, smg: 22, ar: 30, shotgun: 31, sniper: 42, lmg: 32, launcher: 36, energy: 30, element: 28, melee: 30, bow: 18, throw: 14, toy: 22, utility: 22 }[w.cat] || 24); },
  wDesc(w) {
    const tags = [];
    if (w.ex) tags.push('💥ばくはつ'); if (w.burn) tags.push('🔥やける'); if (w.freeze) tags.push('❄こおる'); if (w.poison) tags.push('☠どく');
    if (w.stun) tags.push('💫しびれ'); if (w.chain) tags.push('⚡れんさ'); if (w.homing || w.guided) tags.push('🎯ついび'); if (w.pierce) tags.push('➶つらぬく');
    if (w.wallP) tags.push('🧱かべぬけ'); if (w.knock && w.knock > 200) tags.push('💨ふきとばし'); if (w.knock < 0) tags.push('🪝ひきよせ'); if (w.hole) tags.push('🌀すいこみ');
    if (w.charge) tags.push('⏳ためうち'); if (w.scope) tags.push('🔭スコープ'); if (w.silent) tags.push('🤫しずか'); if (w.split) tags.push('✨ぶんれつ');
    if (w.area === 'heal') tags.push('💗かいふく'); if (w.area === 'smoke') tags.push('☁けむり'); if (w.area === 'sleep') tags.push('😴ねむり');
    if (w.dep) tags.push('📦せっち'); if (w.proj === 'grapple') tags.push('🪝いどう'); if (w.proj === 'dash') tags.push('👟ダッシュ'); if (w.bounce) tags.push('↩はねかえる');
    const dps = weaponDps(w);
    return (dps > 0 && !w.dep ? `つよさ ${dps}` : '') + (tags.length ? ' ' + tags.slice(0, 3).join(' ') : '');
  },
  weaponDetail(w) {
    const m = $('modal');
    $('mTitle').textContent = w.name;
    const b = $('mBody'); b.innerHTML = '';
    let rar = Math.max(w.minR, 0);
    const pic = this.el('div', 'wpic');
    const info = this.el('div', 'winfo');
    const draw = () => {
      pic.innerHTML = '';
      pic.appendChild(this.thumb(240, 110, (x) => { const k = this.wScale(w, 180, 6); x.translate(120 - this.wLen(w) * k / 2, 58); drawWeapon(x, w, rar, k); }));
      const st = wstat(w, rar);
      const rows = [
        ['しゅるい', CATS[w.cat].name],
        ['レア度', `<span style="color:${RARITY[rar].color}">${RARITY[rar].name}</span>`],
        w.d ? ['ダメージ', Math.round(st.dmg) + (w.p > 1 ? ` × ${w.p}` : '')] : null,
        w.d ? ['1びょうの つよさ', weaponDps(w, rar)] : null,
        w.m ? ['マガジン', st.mag] : null,
        w.m ? ['リロード', st.rl.toFixed(1) + 'びょう'] : null,
        w.ammo ? ['たま', AMMO[w.ammo].name] : w.stack ? ['もてる かず', w.stack] : null,
        ['とくちょう', this.wDesc(w).replace(/つよさ \d+ ?/, '') || 'ふつう'],
      ].filter(Boolean);
      info.innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    };
    const rrow = this.el('div', 'row');
    RARITY.forEach((R, i) => {
      if (i < w.minR) return;
      const bt = this.el('button', 'btn small', R.name);
      bt.style.borderColor = R.color;
      bt.onclick = () => { rar = i; draw(); };
      rrow.appendChild(bt);
    });
    draw();
    b.append(pic, rrow, info);
    const f = $('mFoot'); f.innerHTML = '';
    const tryB = this.el('button', 'btn primary big', '🎯 ためしうち');
    tryB.onclick = () => { $('modal').classList.add('hidden'); this.play({ training: true, weapon: w.id }); };
    const close = this.el('button', 'btn', 'とじる');
    close.onclick = () => m.classList.add('hidden');
    f.append(close, tryB);
    m.classList.remove('hidden');
  },

  /* ------------------------------ あそびかた ------------------------------ */
  help() {
    const body = this.openScreen('あそびかた');
    body.innerHTML = `
      <div class="help">
        <p><b>ルール</b>　ひこうせんから とびおりて しまに おり、ぶきを ひろって さいごの ひとりに なったら かち！ むらさきの ゾーンは どんどん ちいさく なる。そとに いると ダメージを うけるので、しろい てんせんの なかへ いどうしよう。</p>
        <h3>パソコン</h3>
        <ul>
          <li><b>W A S D</b> いどう　・　<b>マウス</b> ねらう　・　<b>クリック</b> うつ（おしっぱなしで れんしゃ）</li>
          <li><b>1〜6 / ホイール</b> もちものを えらぶ（1は ツルハシ）　・　<b>R</b> リロード</li>
          <li><b>E</b> ひろう・たからばこを あける・いれかえ　・　<b>G</b> すてる</li>
          <li><b>Q</b> けんちくモード（クリックで かべを おく・1/2/3で そざい・Xで 1マス/3れん）</li>
          <li><b>右クリック</b> スコープ（スナイパーなど）　・　<b>M</b> おおきい ちず</li>
          <li><b>スペース</b> ひこうせんから とびおりる・グライダーを ひらく</li>
        </ul>
        <h3>スマホ</h3>
        <ul>
          <li>がめんの <b>ひだり</b>を ドラッグで いどう、<b>みぎ</b>を ドラッグで ねらって うつ</li>
          <li>ゆみ・なげものは ゆびを はなしたときに とぶ　・　したの わくを タップで もちものを えらぶ</li>
          <li>🧱 で けんちく、✋ で ひろう、ミニマップを タップで おおきい ちず</li>
        </ul>
        <h3>コツ</h3>
        <ul>
          <li>ツルハシで 木・いし・車を たたくと そざいが たまる。うたれたら かべを たてて まもろう。</li>
          <li>ひかる たからばこには いい ぶきが はいっている。やぶの なかに かくれると みつかりにくい。</li>
          <li>ぶきの 色は レア度。グレー → みどり → あお → むらさき → きんいろ の じゅんに つよい。</li>
        </ul>
      </div>`;
  },

  /* ------------------------------ けっか ------------------------------ */
  showResult(r) {
    if (G.mode !== 'match') return;
    const m = $('modal');
    $('mTitle').innerHTML = r.win ? '🏆 さいごの ひとり！ ビクトリー！' : `${r.place}い / ${r.total}にん`;
    $('mBody').innerHTML = `
      <div class="result ${r.win ? 'win' : ''}">
        <div><span>じゅんい</span><b>${r.place}い</b></div>
        <div><span>たおした かず</span><b>${r.kills}</b></div>
        <div><span>もらった コイン</span><b>🪙 +${r.coins}</b></div>
        <div><span>もっている コイン</span><b>🪙 ${Save.d.coins}</b></div>
      </div>
      <p class="dim">${r.win ? 'すごい！ コインで あたらしい スキンを かおう。' : 'つぎは たからばこを さがして つよい ぶきを あつめよう。'}</p>`;
    const f = $('mFoot'); f.innerHTML = '';
    const again = this.el('button', 'btn primary big', 'もういちど');
    again.onclick = () => this.play();
    const lobby = this.el('button', 'btn', 'ロビーへ');
    lobby.onclick = () => this.showLobby();
    f.append(lobby, again);
    m.classList.remove('hidden');
  },

  pause() {
    if (G.mode !== 'match') return;
    G.paused = true;
    $('mTitle').textContent = 'いちじていし';
    $('mBody').innerHTML = Game.training ? '<p>れんしゅうモード。ほかの ぶきも ためせるよ。</p>' : '<p>ロビーに もどると この しあいは おわりに なるよ（コインは もらえない）。</p>';
    const f = $('mFoot'); f.innerHTML = '';
    const go = this.el('button', 'btn primary big', 'つづける');
    go.onclick = () => { $('modal').classList.add('hidden'); G.paused = false; };
    const snd = this.el('button', 'btn', Save.d.opt.sound ? '🔊 おと ON' : '🔇 おと OFF');
    snd.onclick = () => { Save.d.opt.sound = !Save.d.opt.sound; Sfx.on = Save.d.opt.sound; Save.write(); snd.textContent = Save.d.opt.sound ? '🔊 おと ON' : '🔇 おと OFF'; };
    const quit = this.el('button', 'btn danger', 'ロビーへ もどる');
    quit.onclick = () => this.showLobby();
    f.append(quit, snd);
    if (Game.training) { const dx = this.el('button', 'btn', '🔫 ぶきを かえる'); dx.onclick = () => { $('modal').classList.add('hidden'); this.trainingPicker(); }; f.append(dx); }
    f.append(go);
    $('modal').classList.remove('hidden');
  },
  trainingPicker() {
    const m = $('modal');
    $('mTitle').textContent = 'ためす ぶきを えらぶ';
    const b = $('mBody'); b.innerHTML = '';
    const grid = this.el('div', 'grid pickGrid');
    for (const w of WEAPON_LIST) {
      const c = this.el('button', 'pick');
      c.appendChild(this.thumb(70, 34, (x) => { const k = this.wScale(w, 50, 1.8); x.translate(35 - this.wLen(w) * k / 2, 18); drawWeapon(x, w, Math.max(2, w.minR), k); }));
      c.appendChild(this.el('small', '', w.name));
      c.onclick = () => { Game.trainGive(w.id); m.classList.add('hidden'); G.paused = false; };
      grid.appendChild(c);
    }
    b.appendChild(grid);
    const f = $('mFoot'); f.innerHTML = '';
    const close = this.el('button', 'btn', 'とじる');
    close.onclick = () => { m.classList.add('hidden'); G.paused = false; };
    f.append(close);
    m.classList.remove('hidden');
  },

  toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.add('hidden'), 1800);
  },
};

addEventListener('keydown', (e) => {
  if (G.mode !== 'match') return;
  if (e.key === 'Escape' || e.key === 'p') { if (G.paused) { $('modal').classList.add('hidden'); G.paused = false; } else UI.pause(); }
  if (e.key === 't' && Game.training && !G.paused) { G.paused = true; UI.trainingPicker(); }
});
