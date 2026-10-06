/* =========================================================================
   NEKO MART ― きせかえ
   店長ねこの毛の色・目の色 (オッドアイ)・服と小物をえらぶ。
   お店づくりの画面と、遊んでいる間の「きせかえ」の両方で使う
   ========================================================================= */
'use strict';

const Closet = {
  imgs: new Map(),

  /* 見た目の小さな絵 (dataURL)。同じ見た目は使いまわす */
  img(look, dir = 'd') {
    const key = JSON.stringify(look) + dir;
    let u = this.imgs.get(key);
    if (u) return u;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    drawAnimal(cv.getContext('2d'), 32, 60, { ...look, size: 1.12 }, { dir, t: 0.4 });
    u = cv.toDataURL();
    if (this.imgs.size > 400) this.imgs.clear();
    this.imgs.set(key, u);
    return u;
  },
  owned(slot, it) { return it.cost === 0 || (G && G.closet.includes(slot + ':' + it.id)); },

  /* st = { tab, mode: 'setup' | 'game', dir } */
  html(look, st, preview) {
    const tabs = [['base', 'け・め'], ...SLOTS]
      .map(([k, l]) => `<button data-cl="tab" data-k="${k}" class="${st.tab === k ? 'on' : ''}">${l}</button>`).join('');
    const eyeRow = (key) => EYES.map((e) => `<button class="sw ${look[key] === e ? 'on' : ''}" data-cl="${key}" data-id="${e}" style="background:${e}"></button>`).join('');
    let body;
    if (st.tab === 'base') {
      body = `<div class="csec"><b>毛の色</b><div class="pickrow coats">${COATS.map((c) =>
        `<button class="pk ${look.coat === c.id ? 'on' : ''}" data-cl="coat" data-id="${c.id}"><img src="${this.img({ sp: 'cat', coat: c.id, eye: look.eye, eye2: look.eye2 })}"><small>${c.name}</small></button>`).join('')}</div></div>
        <div class="csec"><b>${look.eye2 ? '右目' : '目の色'}</b><div class="pickrow">${eyeRow('eye')}</div></div>
        <div class="csec"><button class="chip2 ${look.eye2 ? 'on' : ''}" data-cl="odd">オッドアイ: ${look.eye2 ? 'オン' : 'オフ'}</button><span class="mini">左右の目の色を変える</span></div>
        ${look.eye2 ? `<div class="csec"><b>左目</b><div class="pickrow">${eyeRow('eye2')}</div></div>` : ''}`;
    } else {
      const slot = st.tab, cur = look[slot] || 'none';
      body = `<div class="citems">${FASHION[slot].map((it) => {
        const own = this.owned(slot, it);
        return `<button class="citem ${cur === it.id ? 'on' : ''} ${own ? '' : 'lock'}" data-cl="item" data-slot="${slot}" data-id="${it.id}">
          <img src="${this.img({ ...look, [slot]: it.id })}"><small>${it.name}</small>${own ? '' : `<b>${st.mode === 'setup' ? '🔒' : ''}${yen(it.cost)}</b>`}</button>`;
      }).join('')}</div>`;
      if (fashionOf(slot, cur).col) {
        body += `<div class="csec"><b>色</b><div class="pickrow">${CLOTH_COLORS.map((c) =>
          `<button class="sw ${wearCol(look, slot) === c ? 'on' : ''}" data-cl="col" data-slot="${slot}" data-id="${c}" style="background:${c}"></button>`).join('')}</div></div>`;
      }
      if (st.mode === 'setup') body += '<p class="mini">🔒 の物は、お店をはじめてから「きせかえ」で買える。</p>';
    }
    const prev = preview
      ? `<div class="cprev"><canvas id="closetPrev" width="200" height="200"></canvas><div class="cdirs">${[['d', '前'], ['r', '横'], ['u', 'うしろ']]
        .map(([k, l]) => `<button data-cl="dir" data-k="${k}" class="${st.dir === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`
      : '';
    return `<div class="closet">${prev}<div class="cmain"><div class="ctabs">${tabs}</div>${body}</div></div>`;
  },

  /* ボタンを押したとき。見た目が変わったら true */
  act(look, el, st) {
    const d = el.dataset;
    switch (d.cl) {
      case 'tab': st.tab = d.k; return true;
      case 'dir': st.dir = d.k; return true;
      case 'coat': look.coat = d.id; break;
      case 'eye': look.eye = d.id; break;
      case 'eye2': look.eye2 = d.id; break;
      case 'odd': look.eye2 = look.eye2 ? null : EYES.find((e) => e !== look.eye && e !== EYES[0]) || EYES[0]; break;
      case 'col': look[d.slot + 'Col'] = d.id; break;
      case 'item': {
        const it = fashionOf(d.slot, d.id);
        if (!this.owned(d.slot, it)) {
          if (st.mode === 'setup') { Toast.show('お店をはじめてから「きせかえ」で買えるよ'); return false; }
          if (G.money < it.cost) { Sound.play('error'); Toast.show('お金が足りないよ', 'bad'); return false; }
          G.money -= it.cost;
          G.closet.push(d.slot + ':' + it.id);
          Sound.play('buy');
          Toast.show(`「${it.name}」を買った!`, 'good');
          Missions.check();
        }
        look[d.slot] = it.id;
        break;
      }
      default: return false;
    }
    Sound.play('click');
    return true;
  },

  drawPreview(cv, look, t, dir) {
    if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.scale(cv.width / 100, cv.width / 100);
    c.fillStyle = '#f6ead3'; ellipse(c, 50, 90, 36, 8); c.fill();
    drawAnimal(c, 50, 90, { ...look, sp: 'cat', size: 1.75, seed: 1 }, { dir, t });
    c.restore();
  },
};
