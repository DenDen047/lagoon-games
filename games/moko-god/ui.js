/* =========================================================================
   MOKO GOD ― 画面まわり
   HUD / 会話 / 持ちもの / 店 / 地図 / メニュー
   ========================================================================= */
'use strict';

const UI = {
  panelOpen: null,
  talkQueue: [], talkOn: false, talkCb: null, talkName: '',

  init() {
    document.getElementById('panelClose').addEventListener('click', () => this.close());
    document.getElementById('panelWrap').addEventListener('click', (e) => {
      if (e.target.id === 'panelWrap') this.close();
    });
    document.getElementById('btnMap').addEventListener('click', () => this.openMap());
    document.getElementById('btnBag').addEventListener('click', () => this.openBag());
    document.getElementById('btnMenu').addEventListener('click', () => this.openMenu());
    document.getElementById('btnAct').addEventListener('click', () => Game.act());
    document.getElementById('btnRoll').addEventListener('click', () => {
      const p = Game.G.p;
      if (p.roll > 0) return;
      p.roll = 0.34; p.iframe = Math.max(p.iframe, 0.4);
      p.rdx = Math.cos(p.aim); p.rdy = Math.sin(p.aim);
    });
    document.getElementById('btnHerb').addEventListener('click', () => Game.useItem('herb'));
    document.getElementById('talkWrap').addEventListener('click', () => this.talkNext());
    document.getElementById('skillBar').addEventListener('click', (e) => {
      const b = e.target.closest('.skl');
      if (b) Game.cast(+b.dataset.i);
    });

    /* パネルや会話が出ているあいだはゲームが止まるので、
       閉じるためのキーだけは画面ぜんたいで受けとる。 */
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (this.panelOpen && (k === 'Escape' || k === 'i' || k === 'I' || k === 'm' || k === 'M')) {
        e.preventDefault(); this.close(); return;
      }
      if (this.talkOn && (k === 'Enter' || k === ' ' || k === 'e' || k === 'E' || k === 'Escape')) {
        e.preventDefault(); this.talkNext();
      }
    });
  },

  close() {
    document.getElementById('panelWrap').classList.add('hidden');
    this.panelOpen = null;
  },

  open(title, bodyHTML, footHTML = '') {
    document.getElementById('panelTitle').textContent = title;
    document.getElementById('panelBody').innerHTML = bodyHTML;
    document.getElementById('panelFoot').innerHTML = footHTML;
    document.getElementById('panelWrap').classList.remove('hidden');
  },

  /* =============================== HUD =============================== */
  refreshHUD(G) {
    const p = G.p, st = Game.stats();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const bar = (id, k) => { const el = document.getElementById(id); if (el) el.style.width = clamp(k * 100, 0, 100) + '%'; };

    set('lvNum', p.lv);
    set('hpNum', `${Math.ceil(p.hp)} / ${st.maxhp}`);
    set('mpNum', `${Math.floor(p.mp)} / ${st.maxmp}`);
    set('coinNum', p.coin);
    bar('hpFill', p.hp / st.maxhp);
    bar('mpFill', p.mp / st.maxmp);
    const need = p.lv >= LEVEL_MAX ? 1 : expToNext(p.lv);
    bar('expFill', p.lv >= LEVEL_MAX ? 1 : p.exp / need);
    set('expNum', p.lv >= LEVEL_MAX ? 'MAX' : `${p.exp} / ${need}`);

    const zone = World.zonePx(p.x, p.y);
    const v = World.villageAt(p.x, p.y, 170);
    set('zoneLabel', v ? v.name : (zone ? ZONE_DEF[zone].name : '―'));
    set('questText', G.quest);
    set('herbNum', p.bag.herb || 0);

    /* ボスのバー */
    const boss = G.mobs.find((m) => m.boss);
    const bb = document.getElementById('bossBar');
    bb.classList.toggle('on', !!boss);
    if (boss) {
      document.getElementById('bossName').textContent = boss.def.name;
      document.getElementById('bossFill').style.width = clamp(boss.hp / boss.maxhp * 100, 0, 100) + '%';
    }
  },

  refreshSkills(G) {
    const p = G.p;
    const bar = document.getElementById('skillBar');
    bar.innerHTML = SKILLS.map((s, i) => {
      const locked = p.lv < s.lv;
      return `<button class="skl${locked ? ' locked' : ''}" data-i="${i}" title="${s.name}（MP${s.mp}）">
        <span class="ico">${locked ? '🔒' : s.icon}</span>
        <span class="num">${i + 1}</span>
        <span class="cd" id="cd${i}"></span>
      </button>`;
    }).join('');
  },

  /* =============================== 会話 =============================== */
  talk(name, lines, cb) {
    this.talkQueue = Array.isArray(lines) ? lines.slice() : [lines];
    this.talkName = name;
    this.talkCb = cb || null;
    this.talkOn = true;
    document.getElementById('talkWrap').classList.remove('hidden');
    this.talkShow();
  },

  talkShow() {
    document.getElementById('talkName').textContent = this.talkName;
    document.getElementById('talkName').style.display = this.talkName ? '' : 'none';
    document.getElementById('talkText').textContent = this.talkQueue[0] || '';
  },

  talkNext() {
    this.talkQueue.shift();
    if (!this.talkQueue.length) {
      this.talkOn = false;
      document.getElementById('talkWrap').classList.add('hidden');
      const cb = this.talkCb; this.talkCb = null;
      if (cb) cb();
      return;
    }
    this.talkShow();
  },

  /* ============================== 地図 ============================== */
  openMap() {
    const G = Game.G;
    const size = Math.min(480, Math.floor(Math.min(window.innerWidth - 120, window.innerHeight - 250)));
    this.open('この土地の地図',
      `<canvas id="mapCv" width="${size}" height="${size}" class="mapCv"></canvas>
       <div class="legend">
         <span><i style="background:#ffe08a"></i>村</span>
         <span><i style="background:#c88aff"></i>土地の主</span>
         <span><i style="background:#ff5a7a"></i>黒い城</span>
         <span><i style="background:#fff"></i>いまここ</span>
       </div>`,
      `<div class="dim">中心の村から外へ行くほど、魔物は強くなる。</div>`);
    this.panelOpen = 'map';
    R.drawFullMap(document.getElementById('mapCv'), G);
  },

  /* そうびの数値。武器は攻撃と速さ、防具は守り、お守りはその効果。 */
  spec(kind, it) {
    if (kind === 'w') return `攻撃 ${it.atk} ／ ${it.spd <= 0.34 ? 'はやい' : it.spd >= 0.5 ? 'おそい' : 'ふつう'}`;
    if (kind === 'a') return `守り ${it.def}${it.spd < 1 ? ' ／ 足がおそくなる' : it.spd > 1 ? ' ／ 足がはやくなる' : ''}`;
    return [it.hp ? `HP+${it.hp}` : '', it.mp ? `MP+${it.mp}` : '', it.atk ? `攻撃+${it.atk}` : '',
            it.def ? `守り+${it.def}` : '', it.spd ? `速さ+${Math.round((it.spd - 1) * 100)}%` : ''].filter(Boolean).join(' / ') || '―';
  },

  /* ============================ 持ちもの ============================ */
  openBag() {
    const G = Game.G, p = G.p, st = Game.stats();
    const row = (kind, list, own, cur) => list.map((it, i) => {
      if (!own.includes(i)) return '';
      const on = cur === i;
      return `<div class="gear${on ? ' on' : ''}">
        <span class="gi">${it.icon}</span>
        <span class="gn">${it.name} <i class="spec">${this.spec(kind, it)}</i><em>${it.desc || ''}</em></span>
        ${on ? '<span class="tag">そうび中</span>' : `<button class="btn tiny" data-eq="${kind}:${i}">そうびする</button>`}
      </div>`;
    }).join('');

    const items = Object.keys(p.bag).filter((k) => p.bag[k] > 0).map((k) => {
      const it = ITEMS[k];
      return `<div class="gear">
        <span class="gi">${it.icon}</span>
        <span class="gn">${it.name} ×${p.bag[k]}<em>${it.desc}</em></span>
        ${it.quest ? '<span class="tag">たいせつ</span>' : `<button class="btn tiny" data-use="${k}">つかう</button>`}
      </div>`;
    }).join('') || '<p class="dim">なにも持っていない。</p>';

    this.open('もちもの',
      `<div class="statline">
         <span>レベル <b>${p.lv}</b></span><span>攻撃 <b>${st.atk}</b></span>
         <span>守り <b>${st.def}</b></span><span>所持金 <b>${p.coin}</b>🪙</span>
       </div>
       <h3>武器</h3>${row('w', WEAPONS, p.ownW, p.weapon)}
       <h3>防具</h3>${row('a', ARMORS, p.ownA, p.armor)}
       <h3>お守り</h3>${row('c', CHARMS, p.ownC, p.charm)}
       <h3>道具</h3>${items}`);
    this.panelOpen = 'bag';

    document.getElementById('panelBody').onclick = (e) => {
      const eq = e.target.dataset && e.target.dataset.eq;
      if (eq) {
        const [k, i] = eq.split(':');
        if (k === 'w') p.weapon = +i; else if (k === 'a') p.armor = +i; else p.charm = +i;
        toast('そうびした', 'good');
        this.openBag(); return;
      }
      const use = e.target.dataset && e.target.dataset.use;
      if (use) { Game.useItem(use); this.openBag(); }
    };
  },

  /* ============================== 店 ============================== */
  openShop(kind, who) {
    const G = Game.G, p = G.p;
    if (kind === 'inn') {
      const st = Game.stats();
      const price = 10 + p.lv * 6;
      const full = p.hp >= st.maxhp && p.mp >= st.maxmp;
      this.open('宿屋',
        `<p>ひと晩とまっていくかい？　HPもMPも、すっかりもどるよ。</p>
         <p class="statline"><span>いっぱく <b>${price}</b>🪙</span><span>所持金 <b>${p.coin}</b>🪙</span></p>`,
        full ? '<div class="dim">いまは元気そのものだ。</div>'
             : `<button class="btn primary" id="doInn"${p.coin < price ? ' disabled' : ''}>とまる（${price}🪙）</button>`);
      this.panelOpen = 'inn';
      const b = document.getElementById('doInn');
      if (b) b.onclick = () => {
        p.coin -= price;
        const s2 = Game.stats();
        p.hp = s2.maxhp; p.mp = s2.maxmp;
        G.tod = 0.3;
        toast('ぐっすり眠った。すっかり元気だ。', 'good');
        this.close();
      };
      return;
    }

    const buyRow = (list, own, kindKey) => list.map((it, i) => {
      if (it.price <= 0 && i === 0) return '';
      const has = own.includes(i);
      const can = p.coin >= it.price;
      return `<div class="gear">
        <span class="gi">${it.icon}</span>
        <span class="gn">${it.name} <i class="spec">${this.spec(kindKey, it)}</i><em>${it.desc}</em></span>
        ${has ? '<span class="tag">もっている</span>'
              : `<button class="btn tiny${can ? ' primary' : ''}" data-buy="${kindKey}:${i}"${can ? '' : ' disabled'}>${it.price}🪙</button>`}
      </div>`;
    }).join('');

    let body;
    if (kind === 'gear') {
      body = `<h3>武器</h3>${buyRow(WEAPONS, p.ownW, 'w')}
              <h3>防具</h3>${buyRow(ARMORS, p.ownA, 'a')}
              <h3>お守り</h3>${buyRow(CHARMS, p.ownC, 'c')}`;
    } else {
      body = Object.keys(ITEMS).filter((k) => !ITEMS[k].quest).map((k) => {
        const it = ITEMS[k];
        const can = p.coin >= it.price;
        return `<div class="gear">
          <span class="gi">${it.icon}</span>
          <span class="gn">${it.name}<em>${it.desc}</em></span>
          <button class="btn tiny${can ? ' primary' : ''}" data-item="${k}"${can ? '' : ' disabled'}>${it.price}🪙</button>
        </div>`;
      }).join('');
    }

    this.open(who, `<p class="statline"><span>所持金 <b id="shopCoin">${p.coin}</b>🪙</span></p>${body}`);
    this.panelOpen = 'shop';
    document.getElementById('panelBody').onclick = (e) => {
      const buy = e.target.dataset && e.target.dataset.buy;
      if (buy) {
        const [k, i] = buy.split(':');
        const list = k === 'w' ? WEAPONS : k === 'a' ? ARMORS : CHARMS;
        const own = k === 'w' ? p.ownW : k === 'a' ? p.ownA : p.ownC;
        const it = list[+i];
        if (p.coin < it.price || own.includes(+i)) return;
        p.coin -= it.price; own.push(+i);
        if (k === 'w') p.weapon = +i; else if (k === 'a') p.armor = +i; else p.charm = +i;
        toast(`${it.name} を買って、そうびした`, 'good');
        this.openShop(kind, who);
        return;
      }
      const item = e.target.dataset && e.target.dataset.item;
      if (item) {
        const it = ITEMS[item];
        if (p.coin < it.price) return;
        p.coin -= it.price;
        p.bag[item] = (p.bag[item] || 0) + 1;
        toast(`${it.name} を買った`, 'good');
        this.openShop(kind, who);
      }
    };
  },

  /* ============================ メニュー ============================ */
  openMenu() {
    const G = Game.G;
    this.open('メニュー',
      `<div class="statline">
         <span>${G.name}</span><span>レベル <b>${G.p.lv}</b></span>
         <span>たおした魔物 <b>${G.kills}</b></span><span>印 <b>${sealCount(G)}/3</b></span>
       </div>
       <div class="kgrid small">
         <div><b>WASD / 矢印</b><span>歩く</span></div>
         <div><b>左クリック / スペース</b><span>剣をふる</span></div>
         <div><b>1〜6</b><span>魔法をつかう</span></div>
         <div><b>Shift</b><span>ころがってよける</span></div>
         <div><b>E</b><span>話す</span></div>
         <div><b>F</b><span>やくそうをつかう</span></div>
         <div><b>I</b><span>もちもの</span></div>
         <div><b>M</b><span>地図</span></div>
       </div>`,
      `<button class="btn" id="mSave">いま保存する</button>
       <button class="btn ghost" id="mTitle">タイトルへもどる</button>`);
    this.panelOpen = 'menu';
    document.getElementById('mSave').onclick = () => { Game.save(); toast('保存した', 'good'); };
    document.getElementById('mTitle').onclick = () => { Game.save(); this.close(); Game.toTitle(); };
  },
};
