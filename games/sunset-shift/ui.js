/* =========================================================================
   SUNSET SHIFT ― 画面まわり
   文字が多いところだけ DOM。ゲーム本体は canvas。
   ========================================================================= */
'use strict';

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  onClose: null,

  init() {
    el('panelClose').addEventListener('click', () => this.close());
    el('panelWrap').addEventListener('click', (ev) => { if (ev.target === el('panelWrap')) this.close(); });
  },

  open(title, body, buttons = [], opt = {}) {
    el('panelTitle').textContent = title;
    el('panelBody').innerHTML = body;
    const foot = el('panelFoot');
    foot.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.label;
      if (b.disabled) btn.disabled = true;
      btn.addEventListener('click', () => { Sfx.ui(); b.on && b.on(); });
      foot.appendChild(btn);
    }
    el('panelClose').style.display = opt.noClose ? 'none' : '';
    this.onClose = opt.onClose || null;
    el('panelWrap').classList.remove('hidden');
    G.paused = true;
    Input.clear();
    if (opt.bind) opt.bind(el('panelBody'));
  },

  close() {
    el('panelWrap').classList.add('hidden');
    G.paused = false;
    const cb = this.onClose; this.onClose = null;
    if (cb) cb();
  },

  isOpen() { return !el('panelWrap').classList.contains('hidden'); },

  /* ------------------------------ HUD ------------------------------ */
  hud() {
    const h = G.hero;
    el('clock').textContent = hhmm(G.hour);
    el('dayLabel').textContent = `${G.day}日目 (${WEEK[(G.day - 1) % 7]})`;
    el('phase').textContent = G.mode === 'work' ? '勤務中' : G.hour >= 18.6 ? '夜' : G.hour >= 16.6 ? '夕方' : G.hour >= 9 ? '昼' : '朝';
    el('money').textContent = yen(G.money);
    el('peace').textContent = Math.round(G.peace);
    el('rating').textContent = Math.round(G.rating);
    if (!h) return;
    el('codename').textContent = h.def.code;
    el('realname').textContent = h.def.name;
    el('hpFill').style.width = clamp(h.hp / h.maxHp, 0, 1) * 100 + '%';
    el('gaFill').style.width = clamp(h.gauge / h.maxGauge, 0, 1) * 100 + '%';
    el('gaugeLbl').textContent = h.def.gauge.name;
    el('gaFill').style.background = `linear-gradient(90deg, ${shade(h.def.gauge.color, -0.2)}, ${h.def.gauge.color})`;
    for (const [id, slot] of [['sk1', 'skill1'], ['sk2', 'skill2']]) {
      const ab = h.slotAbility(slot);
      const box = el(id);
      const nm = box.querySelector('.nm'), cost = box.querySelector('.cost');
      if (!ab) { nm.textContent = '―'; cost.textContent = ''; box.classList.add('off'); continue; }
      nm.textContent = ab.name;
      const c = ab.cost !== undefined ? ab.cost : ab.energy || 0;
      cost.textContent = c ? c : '';
      box.classList.toggle('off', h.gauge < c || (h.cd[ab.id] || 0) > 0);
    }
  },

  prompt(text) {
    const p = el('prompt');
    if (text) { el('promptText').textContent = text; p.classList.add('on'); }
    else p.classList.remove('on');
  },

  mission(text, timer, icon) {
    const m = el('mission');
    if (!text) { m.classList.remove('on'); return; }
    m.classList.add('on');
    el('missionIcon').textContent = icon || '🚨';
    el('missionText').textContent = text;
    el('missionTimer').textContent = timer === null || timer === undefined ? '' : Math.ceil(timer) + '秒';
  },

  /* ---------------------------- 各パネル ---------------------------- */
  heroCard(def, extra = '') {
    return `<div class="row">
      <div class="icon">${def.id === 'grav' ? '🌀' : def.id === 'tech' ? '🛠' : '🧬'}</div>
      <div class="txt"><b>${esc(def.code)} <small style="display:inline;color:var(--dim)">／ ${esc(def.name)}</small></b>
      <small><span class="tag">${esc(def.kindLabel)}</span>${esc(def.origin)}</small>${extra}</div>
    </div>`;
  },

  abilityRow(ab, tagText, tagCls = '') {
    const c = ab.cost !== undefined ? ab.cost : ab.energy || 0;
    return `<div class="row"><div class="icon">${ab.icon || '✨'}</div>
      <div class="txt"><b>${esc(ab.name)}</b><small>${tagText ? `<span class="tag ${tagCls}">${esc(tagText)}</span>` : ''}${esc(ab.desc)}</small></div>
      <div class="side">${c ? c : '―'}</div></div>`;
  },

  /* 朝。ここから1日が始まる。 */
  showMorning() {
    const h = G.hero;
    const body = `
      <p class="lead2">${G.day}日目 (${WEEK[(G.day - 1) % 7]})。始業は9時。定時で上がって、日が落ちたら街に出る。</p>
      <div class="kv"><span>所持金</span><b>${yen(G.money)} 円</b></div>
      <div class="kv"><span>社内評価</span><b class="${G.rating < 30 ? 'down' : ''}">${Math.round(G.rating)} / 100</b></div>
      <div class="kv"><span>街の治安</span><b class="${G.peace < 30 ? 'down' : ''}">${Math.round(G.peace)} / 100</b></div>
      <h3 class="sec">今日出るのは</h3>
      ${this.heroCard(h.def)}
      <p class="lead2" style="margin-top:12px">評価が0になるとクビ。治安が0になると街は実証地区として取り壊される。どちらもゲームオーバー。</p>`;
    this.open(`${G.day}日目の朝`, body, [
      { label: '装備と能力', on: () => this.showRoster() },
      { label: '買い物', on: () => this.showShop() },
      { label: '今日は休む', cls: 'ghost', on: () => Game.skipWork() },
      { label: '出勤する', cls: 'primary', on: () => Game.startWork() },
    ], { noClose: true });
  },

  /* 3人の一覧。ここで今日出る人を選ぶ。 */
  showRoster(back = 'morning') {
    let body = '<p class="lead2">今日はこの三人のうち一人が出る。仕事も、その人が行く。</p>';
    for (const h of G.heroes) {
      const sel = h === G.hero ? ' sel' : '';
      body += `<div class="row${sel}" data-pick="${h.def.id}" style="cursor:pointer">
        <div class="icon">${h.def.id === 'grav' ? '🌀' : h.def.id === 'tech' ? '🛠' : '🧬'}</div>
        <div class="txt"><b>${esc(h.def.code)} <small style="display:inline;color:var(--dim)">／ ${esc(h.def.name)}</small></b>
          <small><span class="tag">${esc(h.def.kindLabel)}</span>体力 ${Math.round(h.maxHp)}／${esc(h.def.gauge.name)} ${h.maxGauge}
          ${h.def.id === 'bio' ? `／変異 ${h.def.mutations}回` : ''}</small></div>
        <div class="side">${h === G.hero ? '出撃' : '控え'}</div></div>`;
    }
    const h = G.hero;
    body += '<h3 class="sec">能力</h3>';
    if (h.def.id === 'grav') {
      body += `<p class="lead2">${esc(h.def.passive)}</p>`;
      body += this.abilityRow(h.def.skills.skill1, 'L');
      body += this.abilityRow(h.def.skills.skill2, 'U');
      body += `<p class="lead2" style="margin-top:10px">${esc(h.def.grab)}</p>`;
    } else if (h.def.id === 'tech') {
      body += `<p class="lead2">${esc(h.def.passive)} ${esc(h.def.weakness)}</p>`;
      body += '<h3 class="sec">頭のよさの中身</h3>';
      for (const b of BLUEPRINT.brains) body += `<div class="row"><div class="icon">🧠</div><div class="txt"><b>${esc(b.t)}</b><small>${esc(b.d)}</small></div></div>`;
      body += '<h3 class="sec">いま積んでいるもの</h3>';
      for (const [i, slot] of ['L', 'U'].entries()) {
        const m = MODULES.find((x) => x.id === h.modules.active[i]);
        body += m ? this.abilityRow(m, slot) : `<div class="row"><div class="txt"><b>${slot} 枠は空</b></div></div>`;
      }
      for (const p of h.modules.passive) {
        const m = MODULES.find((x) => x.id === p);
        if (m) body += `<div class="row"><div class="icon">${m.icon}</div><div class="txt"><b>${esc(m.name)}</b><small><span class="tag">常時</span>${esc(m.desc)}</small></div></div>`;
      }
    } else {
      body += `<div class="row"><div class="icon">🧬</div><div class="txt"><b>由来 ― ${esc(h.def.creature.name)}</b><small>${esc(h.def.creature.note)}。能力は選べない。</small></div></div>`;
      body += this.abilityRow(h.def.abil.move, 'L・抽選');
      body += this.abilityRow(h.def.abil.atk, 'U・抽選');
      body += `<div class="row"><div class="icon">${h.def.abil.util.icon}</div><div class="txt"><b>${esc(h.def.abil.util.name)}</b><small><span class="tag">常時・抽選</span>${esc(h.def.abil.util.desc)}</small></div></div>`;
      body += `<div class="row"><div class="icon">⚠️</div><div class="txt"><b>${esc(h.def.side.name)}</b><small><span class="tag warn">副作用</span>${esc(h.def.side.desc)}</small></div></div>`;
    }

    const btns = [{ label: '戻る', on: () => (back === 'morning' ? this.showMorning() : this.close()) }];
    if (h.def.id === 'tech') btns.unshift({ label: '設計ラボへ', cls: 'primary', on: () => this.showLab(back) });
    this.open('装備と能力', body, btns, {
      noClose: back === 'morning',
      bind: (root) => {
        root.querySelectorAll('[data-pick]').forEach((r) => r.addEventListener('click', () => {
          Sfx.ui();
          G.hero = G.heroes.find((x) => x.def.id === r.dataset.pick);
          this.showRoster(back);
        }));
      },
    });
  },

  /* 設計ラボ。頭脳派はここで能力を「選んで」作る。 */
  showLab(back = 'morning') {
    const h = G.heroes.find((x) => x.def.id === 'tech');
    let body = `<p class="lead2">灰崎の能力は生まれつきではない。作れるものを、作る順に選ぶ。素材は現場で拾う解析データと、会社の給料。</p>
      <div class="kv"><span>所持金</span><b>${yen(G.money)} 円</b></div>
      <div class="kv"><span>解析データ</span><b>${h.data} 個</b></div>
      <h3 class="sec">スキル枠（L / U に1つずつ）</h3>`;
    for (const m of MODULES.filter((x) => x.slot === 'active')) {
      const owned = h.owned.includes(m.id);
      const slot = h.modules.active.indexOf(m.id);
      body += `<div class="row${slot >= 0 ? ' sel' : ''}">
        <div class="icon">${m.icon}</div>
        <div class="txt"><b>${esc(m.name)}</b><small>${owned ? '' : `<span class="tag warn">未製作</span>`}${slot >= 0 ? `<span class="tag new">${slot === 0 ? 'L' : 'U'} に装備中</span>` : ''}${esc(m.desc)}</small></div>
        <div class="side">${owned
          ? `<button class="btn" data-eq="${m.id}" data-slot="0" style="padding:5px 10px;font-size:12px">L</button>
             <button class="btn" data-eq="${m.id}" data-slot="1" style="padding:5px 10px;font-size:12px">U</button>`
          : `<button class="btn" data-buy="${m.id}" style="padding:6px 12px;font-size:12px" ${G.money < m.price || h.data < m.data ? 'disabled' : ''}>${yen(m.price)}円 / データ${m.data}</button>`}
        </div></div>`;
    }
    body += '<h3 class="sec">常時はたらくもの</h3>';
    for (const m of MODULES.filter((x) => x.slot === 'passive')) {
      const owned = h.modules.passive.includes(m.id);
      body += `<div class="row${owned ? ' sel' : ''}">
        <div class="icon">${m.icon}</div>
        <div class="txt"><b>${esc(m.name)}</b><small>${owned ? '<span class="tag new">装着済み</span>' : ''}${esc(m.desc)}</small></div>
        <div class="side">${owned ? '―' : `<button class="btn" data-buy="${m.id}" style="padding:6px 12px;font-size:12px" ${G.money < m.price || h.data < m.data ? 'disabled' : ''}>${yen(m.price)}円 / データ${m.data}</button>`}</div>
      </div>`;
    }
    this.open('設計ラボ', body, [{ label: '戻る', on: () => this.showRoster(back) }], {
      noClose: back === 'morning',
      bind: (root) => {
        root.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
          const m = MODULES.find((x) => x.id === b.dataset.buy);
          if (G.money < m.price || h.data < m.data) return;
          G.money -= m.price; h.data -= m.data;
          if (m.slot === 'active') { h.owned.push(m.id); toast(`${m.name} を作った`, 'good'); }
          else { h.modules.passive.push(m.id); toast(`${m.name} を組みこんだ`, 'good'); }
          Sfx.good();
          Game.save();
          this.showLab(back);
        }));
        root.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.eq, slot = Number(b.dataset.slot);
          const other = slot === 0 ? 1 : 0;
          if (h.modules.active[other] === id) h.modules.active[other] = h.modules.active[slot];
          h.modules.active[slot] = id;
          Sfx.ui();
          Game.save();
          this.showLab(back);
        }));
      },
    });
  },

  showShop(back = 'morning') {
    let body = `<p class="lead2">帰り道のコンビニと、駅裏の情報屋。</p>
      <div class="kv"><span>所持金</span><b>${yen(G.money)} 円</b></div>`;
    for (const s of SHOP) {
      const have = G.items[s.id] || 0;
      body += `<div class="row"><div class="icon">${s.icon}</div>
        <div class="txt"><b>${esc(s.name)}</b><small>${esc(s.desc)}${have ? `　<span class="tag">所持 ${have}</span>` : ''}</small></div>
        <div class="side"><button class="btn" data-shop="${s.id}" style="padding:6px 12px;font-size:12px" ${G.money < s.cost ? 'disabled' : ''}>${yen(s.cost)}円</button></div></div>`;
    }
    this.open('買い物', body, [{ label: '戻る', on: () => (back === 'morning' ? this.showMorning() : this.close()) }], {
      noClose: back === 'morning',
      bind: (root) => {
        root.querySelectorAll('[data-shop]').forEach((b) => b.addEventListener('click', () => {
          const s = SHOP.find((x) => x.id === b.dataset.shop);
          if (G.money < s.cost) return;
          G.money -= s.cost;
          if (s.id === 'coffee') { G.rating = Math.min(100, G.rating + 5); toast('部署の空気がすこし良くなった', 'good'); }
          else G.items[s.id] = (G.items[s.id] || 0) + 1;
          Sfx.good();
          Game.save();
          this.showShop(back);
        }));
      },
    });
  },

  /* 生物系の解析レポート。ニューゲームと変異のときに出る。 */
  showBioReport(bio, kind = 'new') {
    const body = `
      <p class="lead2">${kind === 'new' ? '三雲ナギの血液から出た結果。何が身についたかは、本人にも選べない。' : '体が勝手に書き換わった。'}</p>
      <div class="row"><div class="icon">🧬</div><div class="txt">
        <b>由来 ― ${esc(bio.creature.name)}</b>
        <small>コードネーム <span style="color:${bio.creature.acc};font-weight:800">${esc(bio.code)}</span>。${esc(bio.creature.note)}。</small></div></div>
      <h3 class="sec">動き（L）</h3>${this.abilityRow(bio.abil.move, '抽選')}
      <h3 class="sec">攻め（U）</h3>${this.abilityRow(bio.abil.atk, '抽選')}
      <h3 class="sec">体質（常時）</h3>
      <div class="row"><div class="icon">${bio.abil.util.icon}</div><div class="txt"><b>${esc(bio.abil.util.name)}</b><small><span class="tag">抽選</span>${esc(bio.abil.util.desc)}</small></div></div>
      <h3 class="sec">副作用</h3>
      <div class="row"><div class="icon">⚠️</div><div class="txt"><b>${esc(bio.side.name)}</b><small><span class="tag warn">抽選</span>${esc(bio.side.desc)}</small></div></div>
      <div class="kv" style="margin-top:14px"><span>体力</span><b>${Math.round(bio.base.hp)}</b></div>
      <div class="kv"><span>${esc(bio.gauge.name)}</span><b>${bio.gauge.max}</b></div>
      <div class="kv"><span>攻撃の伸び</span><b>×${bio.base.atk.toFixed(2)}</b></div>
      <div class="kv"><span>身のこなし</span><b>×${bio.base.spd.toFixed(2)}</b></div>`;
    this.open(kind === 'new' ? '生体解析の結果' : '変異した', body,
      [{ label: kind === 'new' ? '受け入れる' : '閉じる', cls: 'primary', on: () => { this.close(); if (kind === 'new') Game.afterBioReport(); } }],
      { noClose: true });
  },

  showMutation(m, bio) {
    const label = { move: '動き', atk: '攻め', util: '体質' }[m.slot];
    const body = `<p class="lead2">${esc(bio.creature.name)}の遺伝子がまた動いた。どこが変わるかは選べない。</p>
      <div class="row"><div class="icon">↩️</div><div class="txt"><b>${esc(label)}：${esc(m.before.name)}</b><small>これは消えた。</small></div></div>
      <div class="row sel"><div class="icon">${m.after.icon}</div><div class="txt"><b>${esc(label)}：${esc(m.after.name)}</b><small><span class="tag new">抽選</span>${esc(m.after.desc)}</small></div></div>
      <div class="kv" style="margin-top:14px"><span>体力</span><b class="up">${Math.round(bio.base.hp)}</b></div>
      <div class="kv"><span>攻撃の伸び</span><b class="up">×${bio.base.atk.toFixed(2)}</b></div>`;
    this.open('変異', body, [{ label: '閉じる', cls: 'primary', on: () => this.close() }], { noClose: true });
  },

  showWorkResult(r) {
    const body = `
      <p class="lead2">18:00。定時で上がった。</p>
      <div class="kv"><span>さばいた伝票</span><b>${r.total} 件</b></div>
      <div class="kv"><span>正しく処理</span><b class="up">${r.ok} 件</b></div>
      <div class="kv"><span>まちがい</span><b class="${r.miss ? 'down' : ''}">${r.miss} 件</b></div>
      <div class="kv"><span>最長の連続</span><b>${r.best}</b></div>
      <div class="kv"><span>今日の給料</span><b class="up">+${yen(r.pay)} 円</b></div>
      <div class="kv"><span>社内評価</span><b class="${r.dRating >= 0 ? 'up' : 'down'}">${r.dRating >= 0 ? '+' : ''}${r.dRating}</b></div>`;
    this.open('勤務おわり', body, [{ label: '街へ出る', cls: 'primary', on: () => { this.close(); Game.startPatrol(); } }], { noClose: true });
  },

  showNight(sum) {
    const body = `
      <p class="lead2">日付が変わる。明日も9時に出社。</p>
      <div class="kv"><span>解決した事件</span><b>${sum.solved} 件</b></div>
      <div class="kv"><span>逃した事件</span><b class="${sum.failed ? 'down' : ''}">${sum.failed} 件</b></div>
      <div class="kv"><span>倒した相手</span><b>${sum.kills}</b></div>
      <div class="kv"><span>受け取った謝礼</span><b class="up">+${yen(sum.pay)} 円</b></div>
      <div class="kv"><span>街の治安</span><b class="${sum.dPeace >= 0 ? 'up' : 'down'}">${sum.dPeace >= 0 ? '+' : ''}${Math.round(sum.dPeace)}</b></div>
      ${sum.rent ? `<div class="kv"><span>家賃</span><b class="down">-${yen(sum.rent)} 円</b></div>` : ''}
      ${sum.note ? `<p class="lead2" style="margin-top:14px">${esc(sum.note)}</p>` : ''}`;
    this.open(`${G.day}日目の夜`, body, [{ label: '眠る', cls: 'primary', on: () => { this.close(); Game.nextDay(); } }], { noClose: true });
  },

  showOver(reason, detail) {
    this.open(reason, `<p class="lead2">${esc(detail)}</p>
      <div class="kv"><span>続いた日数</span><b>${G.day} 日</b></div>
      <div class="kv"><span>解決した事件</span><b>${G.totalSolved} 件</b></div>
      <div class="kv"><span>最後の所持金</span><b>${yen(G.money)} 円</b></div>`,
      [{ label: 'タイトルへ', cls: 'primary', on: () => { this.close(); Game.toTitle(); } }], { noClose: true });
  },

  showClear() {
    this.open('MODEL-9 停止', `
      <p class="lead2">実証地区の計画は白紙になった。三人は翌朝も9時に出社した。誰も正体を明かさないまま、また伝票が流れてくる。</p>
      <div class="kv"><span>かかった日数</span><b>${G.day} 日</b></div>
      <div class="kv"><span>解決した事件</span><b>${G.totalSolved} 件</b></div>
      <div class="kv"><span>最終評価</span><b>社内 ${Math.round(G.rating)} ／ 治安 ${Math.round(G.peace)}</b></div>`,
      [{ label: 'タイトルへ', cls: 'primary', on: () => { this.close(); Game.toTitle(); } }], { noClose: true });
  },

  showSpot(spot) {
    if (spot.id === 'home') {
      this.open('自宅アパート', '<p class="lead2">まだ夜は終わっていない。ここで切り上げると、残っている事件は逃したことになる。</p>',
        [{ label: 'まだ回る', on: () => this.close() }, { label: '今夜は上がる', cls: 'primary', on: () => { this.close(); Game.endNight(); } }]);
    } else {
      this.showShop('patrol');
    }
  },

  showPause() {
    const h = G.hero;
    let body = `<div class="kv"><span>今日</span><b>${G.day}日目 ${hhmm(G.hour)}</b></div>
      <div class="kv"><span>所持金</span><b>${yen(G.money)} 円</b></div>`;
    body += '<h3 class="sec">持ち物</h3>';
    let any = false;
    for (const s of SHOP) {
      const n = G.items[s.id] || 0;
      if (!n || s.id === 'coffee') continue;
      any = true;
      body += `<div class="row"><div class="icon">${s.icon}</div><div class="txt"><b>${esc(s.name)} ×${n}</b><small>${esc(s.desc)}</small></div>
        <div class="side">${s.id === 'drink' ? `<button class="btn" data-use="drink" style="padding:6px 12px;font-size:12px">使う</button>` : '―'}</div></div>`;
    }
    if (!any) body += '<p class="lead2">なにも持っていない。</p>';
    body += `<h3 class="sec">操作</h3>
      <div class="kgrid">
        <div><b>WASD / 矢印</b><span>8方向に歩く</span></div>
        <div><b>マウス</b><span>向きを合わせる</span></div>
        <div><b>Space</b><span>跳ぶ</span></div>
        <div><b>J / K</b><span>弱攻撃 / 強攻撃</span></div>
        <div><b>L / U</b><span>${esc(h.slotAbility('skill1') ? h.slotAbility('skill1').name : '―')} / ${esc(h.slotAbility('skill2') ? h.slotAbility('skill2').name : '―')}</span></div>
        <div><b>Shift</b><span>ダッシュ</span></div>
        <div><b>Q</b><span>ガード</span></div>
        <div><b>E</b><span>調べる・つかむ</span></div>
      </div>`;
    this.open('ひと息', body, [{ label: '戻る', cls: 'primary', on: () => this.close() }], {
      bind: (root) => {
        root.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
          if ((G.items.drink || 0) <= 0) return;
          G.items.drink--; G.hero.heal(60); Sfx.good();
          this.close();
        }));
      },
    });
  },
};
