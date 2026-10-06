/* =========================================================================
   DEAD DRIVE ― 画面
   タイトル / 基地（出撃・ガレージ・施設・仲間・夜）/ 走行中の表示 / 各種の窓
   ========================================================================= */
'use strict';

const RES_ICON = { scrap: '🔩', food: '🥫', fuel: '⛽', crew: '👥', bp: '📘', lv: '⭐' };
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

const UI = {
  tab: 'deploy',
  sel: 0,
  hudOn: false,
  hudT: 0,

  init() {
    el('btnNew').onclick = () => { Sfx.unlock(); Sfx.ui(); this.newRunDialog(); };
    el('btnContinue').onclick = () => { Sfx.unlock(); Sfx.ui(); if (Run.load()) this.showBase(Run.state.phase === 'evening' ? 'night' : 'deploy'); };
    el('btnMeta').onclick = () => { Sfx.unlock(); Sfx.ui(); this.metaShop(); };
    el('btnHelp').onclick = () => { Sfx.unlock(); Sfx.ui(); this.help(); };
    el('btnPause').onclick = () => this.pause();
    document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => { Sfx.ui(); this.tab = b.dataset.tab; this.renderTab(); }; });
    el('btnMenu').onclick = () => this.pause();
    /* ひみつのコードは、どの画面でもキーボードで続けて打てば効く。入力欄の中の文字は数えない */
    let typed = '';
    addEventListener('keydown', (ev) => {
      if (!ev.key || ev.key.length !== 1 || (ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName))) return;
      typed = (typed + ev.key.toLowerCase()).slice(-CHEAT_CODE.length);
      if (typed === CHEAT_CODE) { typed = ''; this.cheat(); }
    });
  },

  /* ひみつのコードを効かせる。ランが始まっていなければ何もしない。
     出撃中はセーブしない決まりなので、基地にいるときだけすぐ保存する */
  cheat() {
    if (!Run.state) { toast('ゲームを始めてから入力しよう', 'bad'); return; }
    Run.cheat();
    Sfx.level();
    toast('ひみつのコード！ すべての部品が使えるようになり、スクラップが無限になった', 'good');
    if (G.mode === 'base') { Run.save(); this.renderTab(); }
  },

  /* ------------------------------ タイトル ------------------------------ */
  title() {
    G.mode = 'title';
    S = null;
    Sfx.setEngine(false);
    this.hud(false);
    el('screen').classList.add('hidden');
    el('titleScreen').classList.remove('hidden');
    const m = Run.loadMeta();
    const has = !!Save.read(Save.RUN);
    el('btnContinue').style.display = has ? '' : 'none';
    el('btnMeta').innerHTML = `遺産 <small>🎖️ ${m.medals}</small>`;
    el('records').innerHTML = m.runs
      ? `挑戦 ${m.runs}回 ・ 生還 ${m.wins}回 ・ いちばん長く生きた日 ${m.best > MAX_DAY ? '救助まで' : m.best + '日目'} ・ 倒したゾンビ ${m.kills}`
      : 'はじめての挑戦';
  },

  newRunDialog() {
    const body = h('div', 'choiceCol');
    const mk = (title, sub, easy) => {
      const b = h('button', 'bigChoice', `<b>${title}</b><small>${sub}</small>`);
      b.onclick = () => {
        Sfx.good();
        Run.newRun(easy);
        this.closeModal();
        this.showBase('deploy');
        this.intro();
      };
      body.appendChild(b);
    };
    mk('ふつう', 'ゾンビも夜の群れも手加減しない。', false);
    mk('かんたん', '車も基地も壊れにくく、ゾンビが少し弱い。はじめてならこちら。', true);
    if (Save.read(Save.RUN)) body.appendChild(h('p', 'warn', 'いまのランのセーブは消えます。'));
    this.modal('新しく始める', body, [{ label: 'もどる', ghost: true, fn: () => this.closeModal() }]);
  },

  intro() {
    const b = h('div', 'story',
      `<p>街はゾンビであふれた。あなたは町はずれの基地で、わずかな仲間と暮らしている。</p><p>無線によると、<b>${MAX_DAY}日後</b>に救助のヘリが来る。それまで生きのびること。</p><p><b>昼</b>は改造した車で街へ出て、ゾンビを轢き、撃ち、食料や仲間を集めて帰る。<br><b>夜</b>は食料を食べる。<b>2日ごと</b>に群れが基地を襲うので、砲台と防壁で本部を守る。</p><p>車の運転席が壊れるか、本部が落ちたら終わり。そのときもらえる勲章で、次の挑戦が少し楽になる。</p>`);
    this.modal('DEAD DRIVE', b, [{ label: 'わかった', fn: () => this.closeModal() }]);
  },

  help(onClose) {
    const b = h('div', 'help',
      `<div class="kgrid">
        <div><b>W / ↑</b><span>アクセル</span></div>
        <div><b>S / ↓</b><span>ブレーキ・バック</span></div>
        <div><b>A D / ← →</b><span>ハンドル</span></div>
        <div><b>Shift / Space</b><span>ニトロ（ニトロ部品が要る）</span></div>
        <div><b>マウス長押し</b><span>武器がカーソルのあたりを狙う</span></div>
        <div><b>Esc / P</b><span>一時停止</span></div>
        <div><b>ガレージで R</b><span>部品の向きを変える</span></div>
        <div><b>右クリック</b><span>ガレージで部品を外す</span></div>
        <div><b>ドラッグ</b><span>ガレージで部品を別のマスへ動かす</span></div>
      </div>
      <p>武器は自分で狙って撃つ。向けた方向の射界にゾンビが入れば撃ちはじめる。スピードを出してぶつかれば轢ける。衝角（しょうかく）を付けた向きでぶつかると、ほとんど傷つかずに轢ける。</p>
      <p>タイヤも部品のひとつで、置いた場所につく。いちばん前の列のタイヤが向きを変える。バイクのタイヤを前と後ろに1つずつ付ければバイクになる。重い車にはタイヤを多めに。置いた部品を押して選ぶと「強化」でき、硬く強くなる。</p>
      <p>スマートフォンでは、左のスティックを進みたい方向に倒す。右のボタンでニトロとバック。</p>`);
    this.modal('遊びかた', b, [{ label: 'とじる', fn: () => { this.closeModal(); if (onClose) onClose(); } }]);
  },

  metaShop() {
    const m = Run.loadMeta();
    const body = h('div', 'metaList');
    const draw = () => {
      body.innerHTML = `<p class="lead">ランが終わるたびに勲章がもらえる。ここで使うと、次からの挑戦がずっと楽になる。<br>持っている勲章 <b>🎖️ ${m.medals}</b></p>`;
      for (const it of META) {
        const lv = m.up[it.id] || 0;
        const row = h('div', 'metaRow');
        row.innerHTML = `<div><b>${it.name}</b> <small>Lv ${lv} / ${it.max}</small><p>${it.desc}</p></div>`;
        const b = h('button', 'btn small', lv >= it.max ? '最大' : `🎖️ ${it.cost[lv]}`);
        b.disabled = lv >= it.max || m.medals < it.cost[lv];
        b.onclick = () => { m.medals -= it.cost[lv]; m.up[it.id] = lv + 1; Run.saveMeta(); Sfx.good(); draw(); };
        row.appendChild(b);
        body.appendChild(row);
      }
    };
    draw();
    this.modal('遺産', body, [{ label: 'とじる', fn: () => { this.closeModal(); if (G.mode === 'title') this.title(); } }]);
  },

  /* ------------------------------ 基地 ------------------------------ */
  showBase(tab) {
    G.mode = 'base';
    S = null;
    Garage.pick = null; Garage.sel = null;
    Sfx.setEngine(false);
    this.hud(false);
    el('titleScreen').classList.add('hidden');
    el('screen').classList.remove('hidden');
    const ev = Run.state.phase === 'evening';
    this.tab = tab || (ev ? 'night' : 'deploy');
    if (ev && this.tab === 'deploy') this.tab = 'night';
    if (!ev && this.tab === 'night') this.tab = 'deploy';
    this.renderTab();
  },

  refreshHead() {
    const s = Run.state;
    if (!s) return;
    const ev = s.phase === 'evening';
    el('sDay').textContent = `${s.day}日目`;
    el('sPhase').textContent = ev ? '夕方' : '朝';
    const nr = Run.nextRaid();
    el('sRaid').textContent = s.day === nr ? (ev ? '今夜、群れが来る' : '今夜は襲撃の夜') : `次の襲撃まであと${nr - s.day}日`;
    el('sRaid').className = s.day === nr ? 'raid hot' : 'raid';
    const need = Run.foodNeed();
    el('resBox').innerHTML =
      `<span class="chip" title="スクラップ">${RES_ICON.scrap}<b>${s.cheat ? '∞' : s.scrap}</b></span>` +
      `<span class="chip ${s.food < need ? 'bad' : ''}" title="食料（1日に食べる量）">${RES_ICON.food}<b>${s.food}</b><small>/日 ${need}</small></span>` +
      `<span class="chip" title="燃料">${RES_ICON.fuel}<b>${s.fuel}</b></span>` +
      `<span class="chip" title="仲間">${RES_ICON.crew}<b>${s.survivors.length}</b></span>` +
      `<span class="chip" title="設計図">${RES_ICON.bp}<b>${s.bps.length}</b></span>` +
      `<span class="chip" title="レベル">${RES_ICON.lv}<b>Lv${s.level}</b></span>`;
    document.querySelectorAll('#tabs button').forEach((b) => {
      const t = b.dataset.tab;
      b.classList.toggle('on', t === this.tab);
      if (t === 'deploy') b.style.display = ev ? 'none' : '';
      if (t === 'night') b.style.display = ev ? '' : 'none';
    });
  },

  renderTab() {
    this.refreshHead();
    const root = el('scrBody');
    const foot = el('scrFoot');
    foot.innerHTML = '';
    root.scrollTop = 0;
    switch (this.tab) {
      case 'deploy': this.tabDeploy(root, foot); break;
      case 'garage': Garage.render(root); this.footBack(foot); break;
      case 'base': this.tabBase(root); this.footBack(foot); break;
      case 'crew': this.tabCrew(root); this.footBack(foot); break;
      case 'night': this.tabNight(root, foot); break;
    }
  },

  footBack(foot) {
    const ev = Run.state.phase === 'evening';
    const b = h('button', 'btn primary', ev ? '🌙 夜の支度へ' : '🚗 出撃の準備へ');
    b.onclick = () => { Sfx.ui(); this.tab = ev ? 'night' : 'deploy'; this.renderTab(); };
    foot.appendChild(b);
  },

  tabDeploy(root, foot) {
    const s = Run.state;
    root.innerHTML = '';
    root.appendChild(h('h3', 'secHead', `今日の行き先 <small>燃料 ⛽${s.fuel}。遠いほど燃料を使うが、見返りも大きい。</small>`));
    const grid = h('div', 'destGrid');
    s.dests.forEach((d, i) => {
      const t = DEST_TYPES[d.type];
      const can = s.fuel >= d.fuel;
      const card = h('button', 'dest' + (i === this.sel ? ' on' : '') + (can ? '' : ' off'));
      card.style.setProperty('--c', t.col);
      const mods = d.mods.map((id) => `<span class="mod">${MODS.find((m) => m.id === id).name}</span>`).join('');
      card.innerHTML =
        `<div class="dTop"><span class="dIcon">${t.icon}</span><div><b>${d.sos ? '無線の避難所' : t.name}</b><small>${AREAS[d.area].name}</small></div></div>` +
        `<div class="dRow"><span>${d.fuel ? '⛽'.repeat(d.fuel) : '燃料なし'}</span><span class="danger">危険 ${stars(d.danger)}</span></div>` +
        `<div class="dReward">${Run.destReward(d)}</div>` +
        `<p>${t.desc}</p>` + (mods ? `<div class="mods">${mods}</div>` : '');
      card.onclick = () => { Sfx.ui(); this.sel = i; this.renderTab(); };
      grid.appendChild(card);
    });
    root.appendChild(grid);
    if (this.sel >= s.dests.length) this.sel = 0;

    /* いまの車 */
    const carBox = h('div', 'carBox');
    const cv = document.createElement('canvas'); cv.width = 180; cv.height = 180; cv.className = 'carThumb';
    carBox.appendChild(cv);
    const cells = s.design.map((c) => ({ c: c.c, r: c.r, t: c.t, lv: c.lv, hp: Run.cellHp(c) }));
    const st = carStats(cells, s.perks, s.meta);
    const cab = s.design.find((c) => c.t === 'cabin');
    const cabK = Run.cellHp(cab) / Run.cellMax(cab);
    const broken = s.design.filter((c) => Run.cellHp(c) <= 0).length;
    const info = h('div', 'carInfo',
      `<h4>いまの車</h4>` +
      `<div class="chips"><span>耐久 ${Math.round(st.hp)} / ${st.maxhp}</span><span>運転席 ${Math.round(cabK * 100)}%</span><span>最高速 ${Math.round(st.top / 3.6)} km/h</span>` +
      `<span>火力 ${st.dps}</span><span>📦 ${st.cargo}</span><span>💺 ${st.seats}</span></div>` +
      (cabK < 0.6 || broken ? `<p class="warn">${broken ? `壊れた部品が ${broken} 個ある。` : ''}${cabK < 0.6 ? '運転席が傷んでいる。' : ''}ガレージで修理しよう。</p>` : '') +
      (!st.wheels ? '<p class="warn">タイヤがない。ガレージでタイヤを付けよう。</p>' : '') +
      this.loadWarn(s.dests[this.sel], st));
    carBox.appendChild(info);
    root.appendChild(carBox);
    drawDesignThumb(cv, s.design);

    const d = s.dests[this.sel];
    const go = h('button', 'btn primary big', `出撃する：${d.sos ? '無線の避難所' : DEST_TYPES[d.type].name}${d.fuel ? `（⛽-${d.fuel}）` : ''}`);
    go.disabled = s.fuel < d.fuel;
    go.onclick = () => {
      if (s.fuel < d.fuel) return;
      Sfx.good();
      /* 出撃中はセーブしない。途中でやめたら、この朝からやり直せる */
      s.fuel -= d.fuel;
      for (const c of s.design) delete c.fresh;
      el('screen').classList.add('hidden');
      G.mode = 'drive';
      startExpedition(d);
    };
    foot.appendChild(go);
  },

  loadWarn(d, st) {
    if (!d) return '';
    if (['rescue', 'hospital'].includes(d.type) && st.seats < d.stock) return `<p class="warn">座席は ${st.seats} 人ぶん。${d.stock} 人は乗せきれない。ガレージで座席を足せる。</p>`;
    const slot = d.type === 'gas' ? 2 : 1;
    if (['market', 'gas', 'hardware'].includes(d.type) && st.cargo < d.stock * slot) return `<p class="warn">荷台に積めるのは ${st.cargo}。全部は持ち帰れない。ガレージで荷台を足せる。</p>`;
    return '';
  },

  tabBase(root) {
    const s = Run.state, b = s.base;
    root.innerHTML = '';
    root.appendChild(h('h3', 'secHead', '施設 <small>スクラップで強くする。効果はすぐに出る。</small>'));
    const grid = h('div', 'facGrid');
    for (const id of FAC_ORDER) {
      const f = FACILITIES[id], lv = b[id];
      const card = h('div', 'fac');
      const next = lv < f.max ? f.cost[lv + 1] : 0;
      card.innerHTML = `<div class="fTop"><span class="fIcon">${f.icon}</span><b>${f.name}</b><small>Lv ${lv} / ${f.max}</small></div>` +
        `<p>${lv > 0 ? f.effect(lv) : 'まだない'}</p>` + (lv < f.max ? `<p class="next">次：${f.effect(lv + 1)}</p>` : '<p class="next">これ以上は強くできない</p>');
      if (lv < f.max) {
        const btn = h('button', 'btn small', `${lv === 0 ? '建てる' : '強化'}（🔩${next}）`);
        btn.disabled = s.scrap < next;
        btn.onclick = () => {
          if (s.scrap < next) return;
          s.scrap -= next; b[id]++;
          if (id === 'garage') {
            /* マス目が広がったぶん、車をまんなかへずらす */
            const [c0, r0] = GARAGE_GRID[lv], [c1, r1] = GARAGE_GRID[lv + 1];
            const dc = Math.floor((c1 - c0) / 2), dr = Math.floor((r1 - r0) / 2);
            for (const c of s.design) { c.c += dc; c.r += dr; }
          }
          if (id === 'radio' && s.phase === 'morning') { const keep = s.dests; Run.genDestinations(); if (keep.some((x) => x.sos)) s.dests[0] = keep.find((x) => x.sos); }
          Sfx.good(); toast(`${f.name}を強化した`, 'good');
          Run.save(); this.renderTab();
        };
        card.appendChild(btn);
      }
      grid.appendChild(card);
    }
    root.appendChild(grid);

    const slots = TURRET_SLOTS[b.wall];
    const crew = s.survivors.filter((x) => x.trait !== 'dog').length;
    root.appendChild(h('h3', 'secHead', `砲台 <small>防壁の内側に置く。1基に仲間が1人つく（仲間 ${crew}人 / 砲台 ${b.towers.length}基）。人がいない砲台は撃つのが遅くなる。</small>`));
    const tl = h('div', 'towerGrid');
    for (let i = 0; i < TOWER_SLOTS.length; i++) {
      const t = b.towers.find((x) => x.slot === i);
      const card = h('div', 'tower' + (i >= slots ? ' locked' : ''));
      if (i >= slots) {
        const need = TURRET_SLOTS.findIndex((n) => n > i);
        card.innerHTML = `<b>枠 ${i + 1}</b><p>防壁 Lv${need} で使える</p>`;
      } else if (t) {
        const d = TOWERS[t.type];
        card.innerHTML = `<b>${d.name} <small>Lv ${t.lv}</small></b><p>${d.desc}</p>`;
        const row = h('div', 'btnRow');
        if (t.lv < 3) {
          const c = towerUpCost(t.type, t.lv);
          const up = h('button', 'btn small', `強化（🔩${c}）`);
          up.disabled = s.scrap < c;
          up.onclick = () => { s.scrap -= c; t.lv++; Sfx.good(); Run.save(); this.renderTab(); };
          row.appendChild(up);
        }
        const sell = h('button', 'btn small ghost', '撤去');
        sell.onclick = () => { s.scrap += Math.floor(d.cost * 0.5); b.towers.splice(b.towers.indexOf(t), 1); Sfx.ui(); Run.save(); this.renderTab(); };
        row.appendChild(sell);
        card.appendChild(row);
      } else {
        card.innerHTML = `<b>枠 ${i + 1} <small>空き</small></b>`;
        const row = h('div', 'btnRow wrap');
        for (const id of TOWER_ORDER) {
          const d = TOWERS[id];
          const lockWs = d.ws && b.workshop < d.ws;
          const btn = h('button', 'btn small', lockWs ? `${d.name} 🔒作業場Lv${d.ws}` : `${d.name}（🔩${d.cost}）`);
          btn.title = d.desc;
          btn.disabled = lockWs || s.scrap < d.cost;
          btn.onclick = () => { s.scrap -= d.cost; b.towers.push({ slot: i, type: id, lv: 1 }); Sfx.good(); Run.save(); this.renderTab(); };
          row.appendChild(btn);
        }
        card.appendChild(row);
      }
      tl.appendChild(card);
    }
    root.appendChild(tl);
    root.appendChild(this.baseMap());
  },

  /* 基地の見取り図（砲台の位置がわかるように） */
  baseMap() {
    const b = Run.state.base;
    const cv = document.createElement('canvas');
    cv.width = 360 * G.dpr; cv.height = 320 * G.dpr; cv.style.width = '360px'; cv.style.height = '320px';
    cv.className = 'baseMap';
    const ctx = cv.getContext('2d');
    ctx.scale(G.dpr, G.dpr);
    const B = BASE_BOX, k = 300 / B.w, ox = 30 - B.x * k, oy = 20 - B.y * k;
    ctx.fillStyle = '#2f2e22'; ctx.fillRect(0, 0, 360, 320);
    ctx.fillStyle = '#5a5646'; ctx.fillRect(B.x * k + ox, B.y * k + oy, B.w * k, B.h * k);
    ctx.strokeStyle = '#a89878'; ctx.lineWidth = 3 + b.wall;
    ctx.strokeRect(B.x * k + ox, B.y * k + oy, B.w * k, B.h * k);
    ctx.fillStyle = '#5a5646'; ctx.fillRect((1200 - 60) * k + ox, (B.y + B.h - 8) * k + oy, 120 * k, 16 * k);
    ctx.fillStyle = '#6f6a5a'; ctx.fillRect(1120 * k + ox, 1120 * k + oy, 160 * k, 110 * k);
    ctx.fillStyle = '#ffd28a'; ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('本部', 1200 * k + ox, 1180 * k + oy);
    ctx.fillStyle = '#9aa6c4'; ctx.fillText('門', 1200 * k + ox, (B.y + B.h) * k + oy + 16);
    TOWER_SLOTS.forEach((p, i) => {
      const x = p.x * k + ox, y = p.y * k + oy;
      const t = b.towers.find((q) => q.slot === i);
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU);
      if (i >= TURRET_SLOTS[b.wall]) { ctx.fillStyle = '#333'; ctx.fill(); }
      else if (t) { ctx.fillStyle = TOWERS[t.type].col; ctx.fill(); ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.strokeStyle = 'rgba(255,210,120,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = '#fff'; ctx.font = `800 10px ${FONT}`; ctx.fillText(String(i + 1), x, y + 3.5);
    });
    return cv;
  },

  tabCrew(root) {
    const s = Run.state;
    root.innerHTML = '';
    const prod = Run.production();
    root.appendChild(h('div', 'crewSum',
      `<span>🥫 1日に食べる量 <b>${Run.foodNeed()}</b>（あなたをふくむ）</span>` +
      `<span>🌱 畑などで増える食料 <b>+${prod.food}</b> / 日</span>` +
      `<span>🔩 作業場と仲間の廃材あつめ <b>+${prod.scrap}</b> / 日</span>`));
    root.appendChild(h('p', 'lead', '仲間は1人につき毎日スクラップを2つ拾ってくる。食料が足りない夜には、仲間が去っていく。'));
    const list = h('div', 'crewGrid');
    if (!s.survivors.length) list.appendChild(h('p', 'lead', 'まだ誰もいない。避難所や病院で助けよう。'));
    for (const x of s.survivors) {
      const t = TRAITS[x.trait];
      list.appendChild(h('div', 'crew', `<b>${x.name}</b><span class="trait t-${x.trait}">${t.name}</span><p>${t.desc}</p><small>${x.since}日目から</small>`));
    }
    root.appendChild(list);
    const pk = Object.entries(s.perks).filter(([, n]) => n > 0);
    root.appendChild(h('h3', 'secHead', `このランの強化 <small>Lv ${s.level}・次まで ${xpNeed(s.level) - Math.floor(s.xp)}</small>`));
    const pl = h('div', 'perkList');
    if (!pk.length) pl.appendChild(h('p', 'lead', 'ゾンビを倒してレベルが上がると、強化を選べる。'));
    for (const [id, n] of pk) { const p = PERK_BY_ID[id]; pl.appendChild(h('span', 'perkChip', `${p.icon} ${p.name} ×${n}`)); }
    root.appendChild(pl);
  },

  tabNight(root, foot) {
    const s = Run.state, e = s.eve || { need: 0, prod: { food: 0, scrap: 0 }, left: [], short: 0 };
    root.innerHTML = '';
    const raid = Run.isRaidNight();
    const box = h('div', 'nightBox');
    box.innerHTML =
      `<h3>${s.day}日目の夕方</h3>` +
      `<ul class="sumList"><li>🌱 畑などから 食料 +${e.prod.food}</li><li>🔩 作業場と廃材あつめ スクラップ +${e.prod.scrap}</li>` +
      `<li>🥫 みんなで 食料 -${e.need - e.short}</li>` +
      (e.short ? `<li class="bad">食料が ${e.short} 足りなかった。${e.left.length ? e.left.map((x) => x.name).join('、') + ' が基地を出ていった。' : '医者のおかげで、誰も去らなかった。'}</li>` : '') + '</ul>' +
      (raid
        ? `<div class="raidWarn"><b>今夜、群れが基地を襲う。</b><p>防壁 Lv${s.base.wall}・砲台 ${s.base.towers.filter((t) => t.slot < TURRET_SLOTS[s.base.wall]).length}基。車で出て、門の外の群れを轢いてもいい。本部が壊されたら終わり。${s.day >= MAX_DAY ? '<br>これが最後の夜。夜明けに救助のヘリが来る。' : ''}</p></div>`
        : '<div class="calm"><b>今夜は襲撃がない。</b><p>何かが起きるかもしれない。</p></div>') +
      '<p class="lead">夜を迎える前に、ガレージで修理したり、基地に砲台を建てたりできる。</p>';
    root.appendChild(box);
    const go = h('button', 'btn primary big', raid ? '⚔️ 夜を迎える（襲撃）' : '🌙 夜を迎える');
    go.onclick = () => {
      Sfx.ui();
      for (const c of s.design) delete c.fresh;
      if (raid) { el('screen').classList.add('hidden'); G.mode = 'drive'; startRaid(); }
      else this.eventCard();
    };
    foot.appendChild(go);
  },

  /* ------------------------------ 夜の出来事 ------------------------------ */
  eventCard() {
    const ev = Run.pickEvent();
    const s = Run.state;
    const body = h('div', 'story', `<p>${ev.text}</p>`);
    const buttons = ev.choices.map((c) => ({
      label: c.label,
      disabled: c.ok && !c.ok(s),
      fn: () => {
        const msg = c.apply(s);
        Run.nextMorning();
        Sfx.ui();
        this.modal(ev.title, h('div', 'story', `<p>${msg}</p>`), [{ label: '朝を待つ', fn: () => { this.closeModal(); this.showBase('deploy'); this.morningNote(); } }]);
      },
    }));
    this.modal(ev.title, body, buttons);
  },

  morningNote() {
    const s = Run.state;
    toast(`${s.day}日目の朝。${Run.isRaidNight() ? '今夜は襲撃がある。' : ''}`, s.day === Run.nextRaid() ? 'bad' : '');
  },

  /* ------------------------------ 走行中の表示 ------------------------------ */
  hud(on) {
    this.hudOn = on;
    el('hud').classList.toggle('hidden', !on);
    if (on) this.updateHud(1);
  },

  objective() {
    if (!S) return;
    let icon = '', txt = '';
    if (S.mode === 'raid') {
      const R = S.raid;
      icon = '🌙';
      txt = S.t < R.dur ? `夜明けまで ${mmss(R.dur - S.t)}　本部を守れ` : `残りのゾンビ ${S.zombies.length}体を片づけろ`;
    } else if (S.goalDone) {
      icon = '✅'; txt = S.goal ? '入口の撤収地点へ戻って、止まる' : '拾えるだけ拾って、入口の撤収地点で止まる';
    } else {
      const g = S.goal, t = DEST_TYPES[S.dest.type];
      icon = t.icon;
      if (g.kind === 'load') txt = `${t.name}：${g.label.replace('（止まって積む）', '')}で止まって積む（${g.initial - g.stock} / ${g.initial}）${S.surge ? '　積んでいる…群れが来る！' : ''}`;
      else if (g.kind === 'rescue') {
        const all = S.people.filter((p) => p.goal && !p.dead), on = all.filter((p) => p.state === 'aboard').length;
        txt = `避難所の前で止まって、みんなを乗せる（${on} / ${all.length}）`;
      } else if (g.kind === 'collect') txt = `スクラップの山を轢いて回収（${g.got} / ${g.need}）`;
      else if (g.kind === 'crates') txt = `証拠品の木箱を壊す（${g.got} / ${g.need}）`;
    }
    el('objIcon').textContent = icon;
    el('objText').textContent = txt;
  },

  updateHud(dt) {
    if (!this.hudOn || !S) return;
    this.hudT -= dt;
    this.drawMini();
    if (this.hudT > 0) return;
    this.hudT = 0.1;
    const s = Run.state || S.run, car = S.car;
    el('hDay').textContent = `${s.day}日目`;
    el('hPhase').textContent = S.mode === 'raid' ? '夜・襲撃' : AREAS[S.dest.area].name;
    this.objective();
    const cab = car.cabin;
    let hp = 0, max = 0;
    for (const c of car.cells) { max += c.max; if (c.alive) hp += c.hp; }
    el('barCab').style.width = clamp(cab.hp / cab.max, 0, 1) * 100 + '%';
    el('barBody').style.width = clamp(hp / max, 0, 1) * 100 + '%';
    el('barNitro').style.width = car.st.nitro ? clamp(car.nitroT / car.st.nitro, 0, 1) * 100 + '%' : '0%';
    el('nitroRow').style.opacity = car.st.nitro ? 1 : 0.35;
    el('spd').textContent = Math.round(car.speed / 3.6);
    el('cargo').textContent = `${car.cargo} / ${car.st.cargo}`;
    el('seats').textContent = `${car.riders.length} / ${car.st.seats}`;
    el('cabRow').classList.toggle('danger', cab.hp / cab.max < 0.3);
    const L = S.loot;
    el('lootBox').innerHTML =
      `<span>🔩 +${L.scrap}</span>` + (S.mode === 'exp' ? `<span>🥫 +${L.food}</span><span>⛽ +${L.fuel}</span><span>👥 ${car.riders.length}</span>` : '') + `<span>🧟 ${S.kills}</span>`;
    el('lvNum').textContent = 'Lv ' + s.level;
    el('xpFill').style.width = clamp(s.xp / xpNeed(s.level), 0, 1) * 100 + '%';
    if (S.mode === 'raid') {
      const hq = S.world.hq;
      el('hqRow').classList.remove('hidden');
      el('barHq').style.width = clamp(hq.hp / hq.maxhp, 0, 1) * 100 + '%';
    } else el('hqRow').classList.add('hidden');
    const ex = S.world.exit;
    const pr = el('prompt');
    let msg = '';
    if (S.mode === 'exp' && ex && S.leftStart && dist(car.x, car.y, ex.x, ex.y) < ex.r) msg = car.speed < 60 ? (S.goalDone ? '撤収中…' : '目的を果たさずに帰る…') : '止まると撤収する';
    else if (S.mode === 'exp' && S.goal && S.goal.kind === 'load' && !S.goalDone && dist(car.x, car.y, S.goal.x, S.goal.y) < S.goal.r) msg = car.speed < 50 ? '積みこみ中…' : '止まると積みこむ';
    else if (S.mode === 'exp' && S.goal && S.goal.kind === 'rescue' && !S.goalDone && dist(car.x, car.y, S.goal.x, S.goal.y) < S.goal.r + 40) msg = car.st.seats - car.riders.length > 0 ? 'ゆっくり止まって、乗ってもらう' : '座席がいっぱい';
    pr.textContent = msg;
    pr.classList.toggle('on', !!msg);
  },

  drawMini() {
    const cv = el('mini');
    if (!S || !S.world.mini) return;
    const ctx = cv.getContext('2d');
    const w = S.world, k = w.miniK, size = w.mini.width;
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    ctx.drawImage(w.mini, 0, 0);
    ctx.fillStyle = 'rgba(255,90,80,0.8)';
    for (let i = 0; i < S.zombies.length; i += 2) { const z = S.zombies[i]; ctx.fillRect(z.x * k - 1, z.y * k - 1, z.def.boss ? 4 : 2, z.def.boss ? 4 : 2); }
    const dot = (x, y, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x * k, y * k, r, 0, TAU); ctx.fill(); };
    if (S.mode === 'exp') {
      dot(w.exit.x, w.exit.y, '#7ee39b', 4);
      if (S.goal && !S.goalDone) dot(S.goal.x, S.goal.y, S.goal.col, 5 + Math.sin(G.time * 6));
      for (const p of S.pickups) if (p.kind === 'pile' || p.kind === 'bp') dot(p.x, p.y, LOOT_COL[p.kind], 2.5);
      for (const p of S.people) if (!p.dead && p.state !== 'aboard') dot(p.x, p.y, '#ffe9a8', 2.5);
    } else {
      for (const t of S.towers) if (!t.dead) dot(t.x, t.y, '#ffd35a', 2.5);
    }
    const car = S.car;
    ctx.save(); ctx.translate(car.x * k, car.y * k); ctx.rotate(car.a);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  /* ------------------------------ 窓 ------------------------------ */
  modal(title, body, buttons = []) {
    const m = el('modal');
    m.classList.remove('hidden');
    el('mTitle').textContent = title;
    const mb = el('mBody'); mb.innerHTML = '';
    if (typeof body === 'string') mb.innerHTML = body; else mb.appendChild(body);
    const mf = el('mFoot'); mf.innerHTML = '';
    for (const b of buttons) {
      const btn = h('button', 'btn ' + (b.ghost ? 'ghost' : 'primary'), b.label);
      btn.disabled = !!b.disabled;
      btn.onclick = () => { Sfx.unlock(); b.fn(); };
      mf.appendChild(btn);
    }
  },
  closeModal() { el('modal').classList.add('hidden'); },

  showPerks() {
    if (G.mode !== 'drive' || !S || S.over) return;
    G.mode = 'perk';
    Input.clear();
    Sfx.setEngine(false);
    Sfx.level();
    const s = Run.state;
    const draw = () => {
      const choices = Run.perkChoices();
      const box = h('div', 'perkPick');
      for (const p of choices) {
        const n = s.perks[p.id] || 0;
        const b = h('button', 'perkCard', `<span class="pIcon">${p.icon}</span><b>${p.name}</b><small>${p.once ? '1回きり' : `Lv ${n} → ${n + 1}`}</small><p>${p.desc}</p>`);
        b.onclick = () => {
          Run.takePerk(p.id);
          Sfx.good();
          if (Run.pendingLevels > 0) { draw(); return; }
          this.closeModal();
          G.mode = 'drive';
        };
        box.appendChild(b);
      }
      const btns = [];
      if (s.rerolls > 0) btns.push({ label: `選び直す（のこり ${s.rerolls}）`, ghost: true, fn: () => { s.rerolls--; draw(); } });
      this.modal(`レベル ${s.level - Run.pendingLevels + 1}！ 強化を1つ選ぶ`, box, btns);
    };
    draw();
  },

  expeditionResult(r) {
    G.mode = 'result';
    const L = r.loot;
    const t = DEST_TYPES[r.dest.type];
    const rows = [
      `<li>🔩 スクラップ +${L.scrap}</li>`,
      L.food ? `<li>🥫 食料 +${L.food}</li>` : '',
      L.fuel ? `<li>⛽ 燃料 +${L.fuel}</li>` : '',
      ...r.riders.map((x) => `<li>👥 ${x.name}（${TRAITS[x.trait].name}）が仲間になった</li>`),
      ...L.bp.map((m) => `<li>📘 ${m}</li>`),
      L.kits ? `<li>🩹 修理キット ${L.kits}個を使った</li>` : '',
      `<li>🧟 倒したゾンビ ${r.kills}体</li>`,
    ].join('');
    const body = h('div', 'story', `<p>${r.goalDone || r.dest.type === 'patrol' ? `${t.name}から無事に戻った。` : `${t.name}での用事は果たせなかったが、生きて戻った。`}</p><ul class="sumList">${rows}</ul>`);
    this.modal('基地に帰還', body, [{ label: '夕方へ', fn: () => {
      this.closeModal();
      Run.state.eve = Run.evening();
      Run.save();
      this.showBase('night');
    } }]);
  },

  raidResult(r) {
    G.mode = 'result';
    const s = Run.state;
    const last = s.day >= MAX_DAY;
    const body = h('div', 'story',
      `<p>${last ? '空が白んできた。遠くからローターの音が近づいてくる。' : '夜が明けた。群れは去った。'}</p>` +
      `<ul class="sumList"><li>🧟 倒したゾンビ ${r.kills}体</li><li>🏠 本部の残り ${Math.round(r.hq * 100)}%</li>` +
      (r.towersLost ? `<li>壊された砲台 ${r.towersLost}基（朝には直す）</li>` : '') + (r.scrap ? `<li>🔩 スクラップ +${r.scrap}</li>` : '') + '</ul>');
    this.modal(last ? '最後の夜を越えた' : '夜を越えた', body, [{ label: last ? '救助のヘリへ' : '朝を迎える', fn: () => {
      this.closeModal();
      if (last) { const sum = Run.finish(true, ''); this.win(sum); return; }
      Run.nextMorning();
      this.showBase('deploy');
      this.morningNote();
    } }]);
  },

  gameOver(sum) {
    G.mode = 'result';
    this.hud(false);
    const body = h('div', 'story',
      `<p class="big bad">${sum.reason}</p>` +
      `<p>${sum.day}日目で力つきた。</p>` +
      `<ul class="sumList"><li>🧟 倒したゾンビ ${sum.stats.kills}体</li><li>👥 助けた人 ${sum.stats.rescued}人</li><li>🥫 集めた食料 ${sum.stats.food}</li><li>⭐ レベル ${sum.level}</li></ul>` +
      `<p class="medal">🎖️ 勲章 +${sum.medals}（持っている勲章 ${Run.meta.medals}）</p><p class="lead">タイトルの「遺産」で使うと、次の挑戦が楽になる。</p>`);
    this.modal('GAME OVER', body, [
      { label: '遺産を見る', ghost: true, fn: () => { this.closeModal(); this.title(); this.metaShop(); } },
      { label: 'タイトルへ', fn: () => { this.closeModal(); this.title(); } },
    ]);
  },

  win(sum) {
    G.mode = 'result';
    const body = h('div', 'story',
      `<p class="big good">救助のヘリが基地に降りた。</p>` +
      `<p>${sum.survivors}人の仲間といっしょに、あなたは死者の街をあとにした。</p>` +
      `<ul class="sumList"><li>🧟 倒したゾンビ ${sum.stats.kills}体</li><li>👥 助けた人 ${sum.stats.rescued}人</li><li>🥫 集めた食料 ${sum.stats.food}</li><li>⭐ レベル ${sum.level}</li></ul>` +
      `<p class="medal">🎖️ 勲章 +${sum.medals}（持っている勲章 ${Run.meta.medals}）</p>`);
    this.modal('生還', body, [{ label: 'タイトルへ', fn: () => { this.closeModal(); this.title(); } }]);
  },

  pause() {
    if (G.mode !== 'drive' && G.mode !== 'base') return;
    if (!el('modal').classList.contains('hidden')) return;
    if (S && S.over) return;
    const was = G.mode;
    if (was === 'drive') { G.mode = 'pause'; Sfx.setEngine(false); Input.clear(); }
    this.pauseMenu(was);
  },

  pauseMenu(was) {
    const body = h('div', 'choiceCol');
    const snd = h('button', 'bigChoice', `<b>音：${Sfx.on ? 'あり' : 'なし'}</b>`);
    snd.onclick = () => { Sfx.on = !Sfx.on; if (!Sfx.on) Sfx.setEngine(false); snd.innerHTML = `<b>音：${Sfx.on ? 'あり' : 'なし'}</b>`; };
    body.appendChild(snd);
    const hlp = h('button', 'bigChoice', '<b>操作を見る</b>');
    hlp.onclick = () => { this.help(() => this.pauseMenu(was)); };
    body.appendChild(hlp);
    const quit = h('button', 'bigChoice', `<b>タイトルへ戻る</b><small>${was === 'drive' ? 'この出撃（夜）はなかったことになり、その前から再開できる。' : 'セーブは残る。'}</small>`);
    quit.onclick = () => { this.closeModal(); Run.state = null; this.title(); };
    body.appendChild(quit);
    /* キーボードのないスマホでも、ここからひみつのコードを入れられる */
    const code = h('form', 'codeRow', '<input type="text" placeholder="ひみつのコード" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn small">入力</button>');
    const msg = h('small', 'codeMsg');   // トーストはこの窓の裏に隠れるので、結果は窓の中に出す
    code.onsubmit = (ev) => {
      ev.preventDefault();
      const inp = code.querySelector('input');
      const ok = inp.value.trim().toLowerCase() === CHEAT_CODE;
      if (ok) this.cheat();
      msg.textContent = ok ? 'すべての部品が使えるようになり、スクラップが無限になった' : 'コードがちがう';
      msg.className = 'codeMsg ' + (ok ? 'good' : 'bad');
      inp.value = '';
    };
    body.appendChild(code);
    body.appendChild(msg);
    this.modal('一時停止', body, [{ label: 'つづける', fn: () => { this.closeModal(); if (was === 'drive') G.mode = 'drive'; } }]);
  },
};
