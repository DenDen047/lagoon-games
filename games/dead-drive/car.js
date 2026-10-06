/* =========================================================================
   DEAD DRIVE ― 車
   マスに置いた部品から性能を割り出し、走らせ、壊し、描く。
   車のローカル座標は x が前、y が右。マス (c, r) は r=0 が先頭の行。
   ========================================================================= */
'use strict';

/* 部品1つを描く。(0,0) がマスの中心、+x が車の前。
   open は外にむき出しの辺（1=前 2=右 4=後ろ 8=左）、aim は砲身の向き（ローカル角）。
   タイヤは spin（0〜1）で溝が流れ、steer の角度だけ向きを変える。lv は強化の印。 */
function drawPart(ctx, t, rot, s, o = {}) {
  const d = PARTS[t];
  const hs = s / 2;
  const base = d.col;
  const dmg = o.hpRatio === undefined ? 1 : o.hpRatio;
  const plate = (col, inset = 0.5, rad = 3) => {
    ctx.fillStyle = col;
    roundRect(ctx, -hs + inset, -hs + inset, s - inset * 2, s - inset * 2, rad); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(-hs + inset + 1, -hs + inset + 1, s - inset * 2 - 2, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    roundRect(ctx, -hs + inset, -hs + inset, s - inset * 2, s - inset * 2, rad); ctx.stroke();
  };
  const rivets = (col = 'rgba(255,255,255,0.35)') => {
    ctx.fillStyle = col;
    const k = hs * 0.62;
    for (const [x, y] of [[-k, -k], [k, -k], [-k, k], [k, k]]) { ctx.beginPath(); ctx.arc(x, y, s * 0.06, 0, TAU); ctx.fill(); }
  };
  const barrelTo = (aim, len, w, col = '#22262b') => {
    ctx.save(); ctx.rotate(aim);
    ctx.fillStyle = col; ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, -w / 2, len, 1);
    ctx.restore();
  };
  const aim = o.aim === undefined ? rot * Math.PI / 2 : o.aim;
  const open = o.open === undefined ? 15 : o.open;

  switch (t) {
    case 'cabin': {
      plate(base, 0, 4);
      ctx.fillStyle = '#243a52';
      roundRect(ctx, hs * 0.05, -hs * 0.72, hs * 0.72, hs * 1.44, 2); ctx.fill();
      ctx.fillStyle = 'rgba(160,210,255,0.35)';
      ctx.fillRect(hs * 0.18, -hs * 0.6, hs * 0.18, hs * 0.8);
      ctx.fillStyle = '#f0c9a0';
      ctx.beginPath(); ctx.arc(-hs * 0.25, 0, s * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a22';
      ctx.beginPath(); ctx.arc(-hs * 0.33, 0, s * 0.16, 0, TAU); ctx.fill();
      break;
    }
    case 'frame': {
      ctx.fillStyle = shade(base, -0.35);
      roundRect(ctx, -hs + 1, -hs + 1, s - 2, s - 2, 2); ctx.fill();
      ctx.strokeStyle = base; ctx.lineWidth = s * 0.16;
      ctx.strokeRect(-hs + 2, -hs + 2, s - 4, s - 4);
      ctx.beginPath(); ctx.moveTo(-hs + 2, -hs + 2); ctx.lineTo(hs - 2, hs - 2); ctx.moveTo(hs - 2, -hs + 2); ctx.lineTo(-hs + 2, hs - 2); ctx.stroke();
      break;
    }
    case 'armor': plate(base, 0, 2); rivets(); break;
    case 'heavy': {
      plate(base, 0, 2);
      ctx.save(); ctx.beginPath(); ctx.rect(-hs, -hs, s, s); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * hs * 0.6 - hs, -hs); ctx.lineTo(i * hs * 0.6 + hs, hs); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-hs + 2.5, -hs + 2.5, s - 5, s - 5);
      rivets('rgba(255,255,255,0.45)');
      break;
    }
    case 'ram': {
      plate(shade(base, -0.3), 0, 2);
      ctx.save(); ctx.rotate(rot * Math.PI / 2);
      const g = ctx.createLinearGradient(-hs, 0, hs * 1.6, 0);
      g.addColorStop(0, shade(base, -0.2)); g.addColorStop(1, shade(base, 0.25));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-hs * 0.4, -hs - 1); ctx.lineTo(hs * 0.9, -hs - 1);
      ctx.lineTo(hs * 1.55, 0); ctx.lineTo(hs * 0.9, hs + 1); ctx.lineTo(-hs * 0.4, hs + 1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(hs * 0.9, -hs); ctx.lineTo(hs * 1.5, 0); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'spikes': {
      /* トゲトゲの壁。向けた側の縁に厚い板が立ち、そこから長いトゲが外へ並ぶ。
         となりと同じ向きに並べると、ひとつながりの壁になる */
      plate(shade(base, -0.4), 0, 2);
      ctx.save(); ctx.rotate(rot * Math.PI / 2);
      if (open & (1 << rot)) {
        for (let i = 0; i < 5; i++) {
          const y = -hs + s * (i + 0.5) / 5, len = i % 2 ? s * 0.42 : s * 0.72;
          ctx.fillStyle = i % 2 ? '#aab2ba' : '#e1e6eb';
          ctx.beginPath(); ctx.moveTo(hs * 0.3, y - s * 0.09); ctx.lineTo(hs + len, y); ctx.lineTo(hs * 0.3, y + s * 0.09); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
      ctx.fillStyle = shade(base, -0.08);
      ctx.fillRect(hs * 0.05, -hs, hs * 0.8, s);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(hs * 0.05, -hs, hs * 0.14, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(hs * 0.05, -hs + 0.5, hs * 0.8, s - 1);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (const y of [-hs * 0.6, 0, hs * 0.6]) { ctx.beginPath(); ctx.arc(hs * 0.45, y, s * 0.06, 0, TAU); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'saw': {
      plate(shade(base, -0.45), 0, 2);
      ctx.save(); ctx.rotate(o.spin || 0);
      ctx.fillStyle = '#d7dde3';
      ctx.beginPath();
      const n = 12, R1 = s * 0.78, R0 = s * 0.6;
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU; const rr = i % 2 ? R0 : R1; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a939c'; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#50575e'; ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'wheel': case 'bikewheel': case 'bigwheel': case 'spikewheel': {
      /* となりの部品へ軸をのばし、その上にタイヤを前後に長く描く */
      const wd = d.wheel, len = s * (t === 'bigwheel' ? 1.1 : 0.98), wid = s * wd.w, sp = o.spin || 0;
      ctx.fillStyle = '#5d656d';
      for (let side = 0; side < 4; side++) {
        if (open & (1 << side)) continue;
        ctx.save(); ctx.rotate(side * Math.PI / 2); ctx.fillRect(0, -s * 0.09, hs + 0.5, s * 0.18); ctx.restore();
      }
      ctx.save(); ctx.rotate(o.steer || 0);
      if (t === 'spikewheel') {
        ctx.fillStyle = '#d5dbe1';
        for (const sy of [-1, 1]) for (let i = 0; i < 4; i++) {
          const x = (((i + 0.5) / 4 + sp) % 1) * len - len / 2;
          ctx.beginPath(); ctx.moveTo(x - s * 0.08, sy * wid * 0.4); ctx.lineTo(x, sy * (wid / 2 + s * 0.24)); ctx.lineTo(x + s * 0.08, sy * wid * 0.4); ctx.closePath(); ctx.fill();
        }
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * len * 0.4, -s * 0.08); ctx.lineTo(sx * (len / 2 + s * 0.2), 0); ctx.lineTo(sx * len * 0.4, s * 0.08); ctx.closePath(); ctx.fill(); }
      }
      ctx.fillStyle = '#16181b';
      roundRect(ctx, -len / 2, -wid / 2, len, wid, wid * 0.4); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#3a3e44';
      for (let i = 0; i < 5; i++) { const x = ((i / 5 + sp) % 1) * len - len / 2; ctx.fillRect(x, -wid / 2, s * 0.11, wid); }
      ctx.restore();
      ctx.fillStyle = t === 'spikewheel' ? '#c9453b' : '#8a929b';
      ctx.fillRect(-s * 0.1, -wid * 0.22, s * 0.2, wid * 0.44);
      ctx.restore();
      break;
    }
    case 'engine': {
      plate(base, 0, 2);
      ctx.fillStyle = shade(base, -0.4);
      ctx.fillRect(-hs * 0.7, -hs * 0.55, hs * 1.4, hs * 1.1);
      ctx.fillStyle = '#c9cfd6';
      for (let i = -1; i <= 1; i++) ctx.fillRect(-hs * 0.6, i * hs * 0.34 - 1, hs * 1.2, 2);
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath(); ctx.arc(-hs * 0.72, -hs * 0.72, s * 0.1, 0, TAU); ctx.arc(-hs * 0.72, hs * 0.72, s * 0.1, 0, TAU); ctx.fill();
      break;
    }
    case 'nitro': {
      plate(shade(base, -0.45), 0, 2);
      for (const y of [-hs * 0.42, hs * 0.42]) {
        const g = ctx.createLinearGradient(0, y - hs * 0.34, 0, y + hs * 0.34);
        g.addColorStop(0, '#9fd2ff'); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.4));
        ctx.fillStyle = g;
        roundRect(ctx, -hs * 0.8, y - hs * 0.34, hs * 1.6, hs * 0.68, hs * 0.3); ctx.fill();
      }
      break;
    }
    case 'cargo': {
      plate(base, 0, 1);
      ctx.strokeStyle = shade(base, -0.4); ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-hs + 1, i * hs * 0.5); ctx.lineTo(hs - 1, i * hs * 0.5); ctx.stroke(); }
      if (o.fill) {
        ctx.fillStyle = o.fillCol || '#e7c86a';
        const n = Math.ceil(o.fill * 4);
        for (let i = 0; i < n; i++) ctx.fillRect(-hs * 0.6 + (i % 2) * hs * 0.65, -hs * 0.6 + Math.floor(i / 2) * hs * 0.65, hs * 0.5, hs * 0.5);
      }
      break;
    }
    case 'seat': {
      plate(shade(base, -0.4), 0, 2);
      for (const y of [-hs * 0.45, hs * 0.45]) {
        ctx.fillStyle = base;
        roundRect(ctx, -hs * 0.7, y - hs * 0.36, hs * 1.3, hs * 0.72, 2); ctx.fill();
        ctx.fillStyle = shade(base, 0.25);
        ctx.fillRect(-hs * 0.72, y - hs * 0.36, hs * 0.3, hs * 0.72);
      }
      if (o.riders) {
        const heads = [[-0.05, -0.45], [-0.05, 0.45]];
        for (let i = 0; i < Math.min(2, o.riders); i++) {
          ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(heads[i][0] * s, heads[i][1] * s, s * 0.17, 0, TAU); ctx.fill();
          ctx.fillStyle = ['#553322', '#222', '#8a5a2a'][i % 3]; ctx.beginPath(); ctx.arc(heads[i][0] * s - s * 0.06, heads[i][1] * s, s * 0.13, 0, TAU); ctx.fill();
        }
      }
      break;
    }
    case 'magnet': {
      plate(shade('#5a6068', -0.1), 0, 2);
      ctx.strokeStyle = base; ctx.lineWidth = s * 0.2;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.26, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
      ctx.strokeStyle = '#d8dde2';
      ctx.beginPath(); ctx.moveTo(0, -s * 0.26); ctx.lineTo(s * 0.26, -s * 0.26); ctx.moveTo(0, s * 0.26); ctx.lineTo(s * 0.26, s * 0.26); ctx.stroke();
      break;
    }
    case 'repair': {
      plate(shade(base, -0.35), 0, 2);
      ctx.strokeStyle = base; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
      const sw = Math.sin((o.time || 0) * 4) * 0.5;
      ctx.save(); ctx.rotate(sw);
      ctx.beginPath(); ctx.moveTo(-hs * 0.4, 0); ctx.lineTo(hs * 0.55, 0); ctx.stroke();
      ctx.strokeStyle = '#d8dde2'; ctx.lineWidth = s * 0.1;
      ctx.beginPath(); ctx.arc(hs * 0.62, 0, s * 0.13, -1.1, 1.1); ctx.stroke();
      ctx.restore(); ctx.lineCap = 'butt';
      break;
    }
    case 'mg': {
      plate(shade('#6b737b', -0.2), 0, 2);
      ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, TAU); ctx.fill();
      barrelTo(aim, s * 0.95, s * 0.12);
      ctx.save(); ctx.rotate(aim); ctx.fillStyle = '#22262b'; ctx.fillRect(0, s * 0.1, s * 0.85, s * 0.1); ctx.restore();
      ctx.fillStyle = shade(base, 0.2); ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, TAU); ctx.fill();
      break;
    }
    case 'shotgun': {
      plate(shade('#6b737b', -0.2), 0, 2);
      ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, TAU); ctx.fill();
      barrelTo(aim, s * 0.75, s * 0.3, '#2b2521');
      ctx.save(); ctx.rotate(aim); ctx.fillStyle = '#111'; ctx.fillRect(s * 0.68, -s * 0.1, s * 0.08, s * 0.2); ctx.restore();
      break;
    }
    case 'flamer': {
      plate(shade('#6b737b', -0.25), 0, 2);
      ctx.fillStyle = '#d8a13a'; roundRect(ctx, -hs * 0.8, -hs * 0.7, hs * 0.9, hs * 1.4, 3); ctx.fill();
      barrelTo(aim, s * 0.85, s * 0.18, '#3b3632');
      ctx.save(); ctx.rotate(aim); ctx.fillStyle = base; ctx.fillRect(s * 0.72, -s * 0.13, s * 0.14, s * 0.26); ctx.restore();
      break;
    }
    case 'rocket': {
      plate(shade('#6b737b', -0.25), 0, 2);
      ctx.save(); ctx.rotate(aim);
      ctx.fillStyle = base; roundRect(ctx, -s * 0.36, -s * 0.38, s * 0.95, s * 0.76, 3); ctx.fill();
      ctx.fillStyle = '#1d1f22';
      for (const [x, y] of [[0.5, -0.18], [0.5, 0.18]]) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.13, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#d24a3a';
      for (const [x, y] of [[0.5, -0.18], [0.5, 0.18]]) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.06, 0, TAU); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'turret': {
      plate(shade('#6b737b', -0.2), 0, 2);
      ctx.fillStyle = shade(base, 0.15); ctx.beginPath(); ctx.arc(0, 0, s * 0.44, 0, TAU); ctx.fill();
      barrelTo(aim, s * 1.0, s * 0.16);
      ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.08, s * 0.1, 0, TAU); ctx.fill();
      break;
    }
    case 'tesla': {
      plate(shade('#3a414a', 0), 0, 2);
      ctx.strokeStyle = '#c28a3a'; ctx.lineWidth = s * 0.08;
      for (const rr of [0.36, 0.26, 0.16]) { ctx.beginPath(); ctx.arc(0, 0, s * rr, 0, TAU); ctx.stroke(); }
      const gl = 0.5 + 0.5 * Math.sin((o.time || 0) * 9);
      ctx.fillStyle = `rgba(140,200,255,${0.5 + gl * 0.5})`;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, TAU); ctx.fill();
      break;
    }
    case 'mines': {
      plate(base, 0, 2);
      ctx.save(); ctx.beginPath(); ctx.rect(-hs + 2, -hs + 2, s - 4, s - 4); ctx.clip();
      ctx.fillStyle = '#e2c23a';
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.3, -hs); ctx.lineTo(i * s * 0.3 + s * 0.15, -hs); ctx.lineTo(i * s * 0.3 + s * 0.15 - s, hs); ctx.lineTo(i * s * 0.3 - s, hs); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-hs * 0.9, -hs * 0.5, hs * 0.6, hs);
      break;
    }
  }
  if (dmg < 0.55 && !d.wheel) {
    ctx.fillStyle = `rgba(20,12,8,${(0.55 - dmg) * 0.9})`;
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-hs * 0.6, -hs * 0.2); ctx.lineTo(-hs * 0.1, hs * 0.1); ctx.lineTo(hs * 0.3, -hs * 0.3); ctx.lineTo(hs * 0.6, hs * 0.4); ctx.stroke();
  }
  /* 強化した部品には、前の左すみに金の印を Lv-1 個 */
  for (let i = 1; i < (o.lv || 1); i++) {
    ctx.fillStyle = '#ffd35a'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.rect(hs - s * 0.24, -hs + s * 0.06 + (i - 1) * s * 0.22, s * 0.17, s * 0.17); ctx.fill(); ctx.stroke();
  }
  if (o.flash) { ctx.fillStyle = `rgba(255,255,255,${o.flash})`; ctx.fillRect(-hs, -hs, s, s); }
}

/* 部品の組み合わせから性能を計算する（ガレージの表示にも使う） */
function carStats(cells, perks = {}, meta = {}) {
  const alive = cells.filter((c) => c.hp > 0);
  let M = 0, P = 0, cargo = 0, seats = 0, nitro = 0, magnet = 36, hp = 0, maxhp = 0, dps = 0, contact = 0;
  let wheels = 0, load = 0, wgrip = 0, wspeed = 0, wturn = 0;
  let minR = 99, maxR = -99, minC = 99, maxC = -99;
  for (const c of cells) maxhp += partMaxHp(c.t, c.lv, meta.plate);
  for (const c of alive) {
    const d = PARTS[c.t], pw = partPowMul(c.lv);
    M += d.mass; hp += c.hp;
    if (c.t === 'cabin') P += 6;
    if (d.power) P += d.power * pw;
    if (d.cargo) cargo += d.cargo;
    if (d.seats) seats += d.seats;
    if (d.nitro) nitro += d.nitro;
    if (d.magnet) magnet += d.magnet;
    if (d.contact) contact += d.contact * pw;
    if (d.weapon) { const w = WEAPONS[d.weapon]; dps += w.dmg * (w.pellets || 1) * w.rate * (w.chain ? 2 : 1) * (w.radius ? 2.5 : 1) * pw; }
    if (d.wheel) { wheels++; load += d.wheel.load * pw; wgrip += d.wheel.grip; wspeed += d.wheel.speed; wturn += d.wheel.turn; }
    minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r); minC = Math.min(minC, c.c); maxC = Math.max(maxC, c.c);
  }
  const diag = Math.hypot(maxR - minR + 1, maxC - minC + 1) * CS;
  /* タイヤが重さを支えきれないと遅くなる。1つもなければ車体を引きずって這うだけ */
  const support = wheels ? clamp(load / M, 0.25, 1) : 0.12;
  const sp = (1 + 0.08 * (perks.speed || 0)) * (wheels ? wspeed / wheels : 1);
  const top = clamp(330 * Math.pow(P / (M * 0.45 + 3), 0.35), 170, 520) * sp * (0.25 + 0.75 * support);
  const accel = 720 * P / (M + 6) * (1 + 0.12 * (perks.speed || 0)) * support;
  const turn = 3.0 * clamp(1.25 - diag / 300 - M / 170, 0.45, 1.1) * (1 + 0.12 * (perks.grip || 0)) * (wheels ? wturn / wheels : 0.6);
  const dmgMul = (1 + 0.18 * (perks.dmg || 0)) * (1 + 0.15 * (perks.rate || 0));
  return {
    M, P, top, accel, turn, hp, maxhp,
    cargo: Math.round(cargo * (1 + 0.3 * (perks.cargo || 0))),
    seats,
    nitro: nitro * 1.6 * (1 + 0.3 * (perks.nitro || 0)),
    magnet: magnet * (1 + 0.6 * (perks.magnet || 0)),
    dps: Math.round(dps * dmgMul),
    contact,
    ramPow: Math.sqrt(M / 8),
    grip: (wheels ? wgrip / wheels : 3) + (perks.grip || 0) * 1.6,
    wheels, load, support,
  };
}

class Car {
  /* design は [{c, r, t, rot, hp}]。hp は前の出撃から持ちこした傷。 */
  constructor(design, cols, rows, run) {
    this.cols = cols; this.rows = rows;
    this.perks = run.perks; this.meta = run.meta;
    this.dmgTaken = (1 - 0.1 * (this.perks.armor || 0)) * (run.easy ? 0.6 : 1);
    this.cells = design.map((d) => ({
      c: d.c, r: d.r, t: d.t, rot: d.rot || 0, lv: d.lv || 1, def: PARTS[d.t],
      max: partMaxHp(d.t, d.lv, this.meta.plate),
      hp: d.hp === undefined ? partMaxHp(d.t, d.lv, this.meta.plate) : d.hp,
      alive: true, cd: rand(0.3), aim: (d.rot || 0) * Math.PI / 2, flash: 0, open: 15, smoke: 0,
    }));
    for (const c of this.cells) { if (c.hp > c.max) c.hp = c.max; if (c.hp <= 0) c.alive = false; }
    this.grid = new Array(cols * rows).fill(null);
    for (const c of this.cells) this.grid[c.r * cols + c.c] = c;
    this.cabin = this.cells.find((c) => c.t === 'cabin');
    this.dropDisconnected(true);
    /* 回転の中心は組み上がったときの重心で固定する */
    let sx = 0, sy = 0, sm = 0;
    for (const c of this.cells) if (c.alive) { sx += c.c * c.def.mass; sy += c.r * c.def.mass; sm += c.def.mass; }
    this.cx = sx / sm; this.cy = sy / sm;
    for (const c of this.cells) { c.lf = (this.cy - c.r) * CS; c.lr = (c.c - this.cx) * CS; }
    this.x = 0; this.y = 0; this.a = -Math.PI / 2; this.vx = 0; this.vy = 0; this.av = 0;
    this.cosA = Math.cos(this.a); this.sinA = Math.sin(this.a);
    this.steerVis = 0; this.boosting = false; this.nitroT = 0;
    this.speed = 0; this.vf = 0;
    this.cargo = 0; this.cargoKind = null; this.riders = [];
    this.dead = false; this.hurtT = 0; this.kills = 0; this.roadkills = 0;
    this.derive();
    this.nitroT = this.st.nitro;
  }

  derive() {
    this.st = carStats(this.cells.filter((c) => c.alive), this.perks, this.meta);
    this.weapons = this.cells.filter((c) => c.alive && c.def.weapon);
    this.contacts = this.cells.filter((c) => c.alive && c.def.contact);
    /* いちばん前の列のタイヤが向きを変え、いちばん後ろの列のタイヤが横すべりの跡を残す */
    this.wheels = this.cells.filter((c) => c.alive && c.def.wheel);
    this.wheelR0 = Math.min(...this.wheels.map((c) => c.r));
    this.wheelR1 = Math.max(...this.wheels.map((c) => c.r));
    let R = 0;
    for (const c of this.cells) {
      if (!c.alive) continue;
      let open = 0;
      const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      nb.forEach(([dc, dr], i) => { const n = this.at(c.c + dc, c.r + dr); if (!n || !n.alive) open |= 1 << i; });
      c.open = open;
      /* スパイカーのトゲ先まで当たるので、そのぶん外側まで調べる */
      const spike = c.def.reach && (open & (1 << c.rot)) ? c.def.reach * CS : 0;
      R = Math.max(R, Math.hypot(c.lf, c.lr) + spike);
    }
    this.R = R + CS * 0.9;
    if (this.nitroT > this.st.nitro) this.nitroT = this.st.nitro;
    let minR = 99, maxR = -99, minC = 99, maxC = -99;
    for (const c of this.cells) if (c.alive) { minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r); minC = Math.min(minC, c.c); maxC = Math.max(maxC, c.c); }
    this.box = { minR, maxR, minC, maxC };
  }

  at(c, r) { return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? null : this.grid[r * this.cols + c]; }

  toLocal(wx, wy) {
    const dx = wx - this.x, dy = wy - this.y;
    return [dx * this.cosA + dy * this.sinA, -dx * this.sinA + dy * this.cosA];
  }
  cellWorld(c) {
    return [this.x + this.cosA * c.lf - this.sinA * c.lr, this.y + this.sinA * c.lf + this.cosA * c.lr];
  }

  /* 円 (wx, wy, r) と触れている生きたマスのうち、いちばん近いものを返す */
  contactCell(wx, wy, r) {
    const [lf, lr] = this.toLocal(wx, wy);
    const cf = lr / CS + this.cx, rf = this.cy - lf / CS;
    const c0 = Math.round(cf), r0 = Math.round(rf);
    const reach = Math.ceil(r / CS) + 1;
    const H = CS / 2;
    let best = null, bestD = 1e9;
    for (let rr = r0 - reach; rr <= r0 + reach; rr++) {
      for (let cc = c0 - reach; cc <= c0 + reach; cc++) {
        const cell = this.at(cc, rr);
        if (!cell || !cell.alive) continue;
        const dxf = lf - cell.lf, dxr = lr - cell.lr;
        /* スパイカーのトゲは向けた側へ突き出ているので、その側だけ当たる範囲を広げる */
        let f0 = -H, f1 = H, r0 = -H, r1 = H;
        if (cell.def.reach && (cell.open & (1 << cell.rot))) {
          const e = cell.def.reach * CS;
          if (cell.rot === 0) f1 += e; else if (cell.rot === 1) r1 += e; else if (cell.rot === 2) f0 -= e; else r0 -= e;
        }
        const qf = clamp(dxf, f0, f1), qr = clamp(dxr, r0, r1);
        const ex = dxf - qf, ey = dxr - qr;
        const d = Math.hypot(ex, ey);
        if (d < r && d < bestD) {
          bestD = d;
          let nf, nr;
          if (d > 0.001) { nf = ex / d; nr = ey / d; } else { const m = Math.hypot(lf, lr) || 1; nf = lf / m; nr = lr / m; }
          best = { cell, pen: r - d, nx: this.cosA * nf - this.sinA * nr, ny: this.sinA * nf + this.cosA * nr, nf, nr };
        }
      }
    }
    return best;
  }

  /* 向きのある部品に、向けた側から触れているか（hit は contactCell の結果） */
  facing(hit) {
    const a = hit.cell.rot * Math.PI / 2;
    return Math.cos(a) * hit.nf + Math.sin(a) * hit.nr > 0.3;
  }

  damageCell(cell, amt) {
    if (!cell || !cell.alive || this.dead) return;
    amt *= this.dmgTaken;
    cell.hp -= amt;
    cell.flash = 0.18;
    if (cell === this.cabin) { this.hurtT = 0.35; Sfx.hurt(); }
    if (cell.hp <= 0) this.breakCell(cell);
  }

  breakCell(cell) {
    cell.alive = false; cell.hp = 0;
    const [wx, wy] = this.cellWorld(cell);
    FX.burst(wx, wy, 10, { col: cell.def.col, kind: 'rect', r: 3, spMin: 60, spMax: 220, lifeMin: 0.4, lifeMax: 0.9 });
    FX.burst(wx, wy, 6, { col: '#555', kind: 'smoke', r: 8, grow: 20, spMin: 10, spMax: 50, lifeMin: 0.5, lifeMax: 1.1, alpha: 0.6, layer: 'low' });
    Sfx.crash();
    shakeCam(5);
    if (cell === this.cabin) { this.dead = true; return; }
    const lost = this.dropDisconnected(false);
    if (cell.def.weapon || lost > 0) toast(lost > 0 ? `${cell.def.name}が壊れ、部品が ${lost} 個はずれた` : `${cell.def.name}が壊れた`, 'bad');
    this.derive();
  }

  /* 運転席からつながっていない部品は外れる */
  dropDisconnected(silent) {
    const seen = new Set();
    if (this.cabin && this.cabin.alive) {
      const q = [this.cabin]; seen.add(this.cabin);
      while (q.length) {
        const c = q.pop();
        for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const n = this.at(c.c + dc, c.r + dr);
          if (n && n.alive && !seen.has(n)) { seen.add(n); q.push(n); }
        }
      }
    }
    let lost = 0;
    for (const c of this.cells) {
      if (c.alive && !seen.has(c)) {
        c.alive = false; lost++;
        if (!silent) c.hp = 0;
        if (!silent) {
          const [wx, wy] = this.cellWorld(c);
          FX.burst(wx, wy, 4, { col: c.def.col, kind: 'rect', r: 3, spMin: 40, spMax: 140, lifeMin: 0.5, lifeMax: 1 });
        }
      }
    }
    return lost;
  }

  healWorst(amount) {
    let worst = null, wr = 1;
    for (const c of this.cells) if (c.alive && c.hp / c.max < wr) { wr = c.hp / c.max; worst = c; }
    if (worst) worst.hp = Math.min(worst.max, worst.hp + amount);
  }
  healAll(frac) { for (const c of this.cells) if (c.alive) c.hp = Math.min(c.max, c.hp + c.max * frac); }

  /* ctl: { throttle, steer, nitro, dir, dirMag } */
  update(dt, ctl, world) {
    const st = this.st;
    const ca = this.cosA, sa = this.sinA;
    let vf = this.vx * ca + this.vy * sa;
    let vl = -this.vx * sa + this.vy * ca;
    let throttle = ctl.throttle, steer = ctl.steer;
    if (ctl.dir !== null && ctl.dir !== undefined) {
      const d = angDiff(this.a, ctl.dir);
      steer = clamp(d * 2.4, -1, 1);
      throttle = ctl.dirMag * (Math.abs(d) > 2.0 && vf < 80 ? 0.6 : 1);
    }
    if (this.dead) { throttle = 0; steer = 0; }

    /* ニトロ */
    const wantBoost = ctl.nitro && st.nitro > 0 && !this.dead && (this.boosting ? this.nitroT > 0 : this.nitroT > Math.min(0.4, st.nitro * 0.3));
    if (wantBoost && !this.boosting) this.onBoostStart();
    this.boosting = wantBoost;
    if (this.boosting) this.nitroT = Math.max(0, this.nitroT - dt);
    else this.nitroT = Math.min(st.nitro, this.nitroT + dt * 0.16 * (st.nitro / 1.6) * (1 + 0.4 * (this.perks.nitro || 0)));

    const accel = st.accel * (this.boosting ? 1.9 : 1);
    const top = st.top * (this.boosting ? 1.45 : 1);
    if (this.boosting) throttle = Math.max(throttle, 1);
    if (throttle > 0) {
      if (vf < 0) vf = Math.min(0, vf + 900 * dt);
      else if (vf < top) vf = Math.min(top, vf + accel * throttle * dt * (1 - 0.5 * vf / top));
    } else if (throttle < 0) {
      if (vf > 0) vf = Math.max(0, vf - 900 * dt);
      else vf = Math.max(-top * 0.45, vf + accel * 0.6 * throttle * dt);
    } else {
      vf = approach(vf, 0, 130 * dt);
    }
    if (vf > top) vf = approach(vf, top, 500 * dt);
    vl *= Math.exp(-st.grip * dt);

    const sp = Math.abs(vf);
    const turnK = clamp(sp / 110, 0, 1) * (1 - clamp((sp - st.top * 0.7) / st.top, 0, 0.3));
    const targetAv = steer * st.turn * turnK * (vf < -5 ? -1 : 1);
    this.av = approach(this.av, targetAv, st.turn * 7 * dt);
    this.steerVis = approach(this.steerVis, steer, dt * 6);

    this.vx = ca * vf - sa * vl;
    this.vy = sa * vf + ca * vl;
    this.a += this.av * dt;
    this.cosA = Math.cos(this.a); this.sinA = Math.sin(this.a);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vf = vf;
    this.speed = Math.hypot(this.vx, this.vy);

    this.collideWorld(world);

    /* 修理アーム・煙・点滅 */
    for (const c of this.cells) {
      if (c.flash > 0) c.flash = Math.max(0, c.flash - dt);
      if (!c.alive) continue;
      if (c.def.repair) {
        for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const n = this.at(c.c + dc, c.r + dr);
          if (n && n.alive && n.hp < n.max) n.hp = Math.min(n.max, n.hp + c.def.repair * dt);
        }
      }
      if (c.hp / c.max < 0.3) {
        c.smoke -= dt;
        if (c.smoke <= 0) {
          c.smoke = 0.12;
          const [wx, wy] = this.cellWorld(c);
          FX.add({ x: wx, y: wy, vx: rand(-20, 20) - this.vx * 0.2, vy: rand(-20, 20) - this.vy * 0.2, col: '#3a3a3a', kind: 'smoke', r: 4, grow: 18, life: 0.9, alpha: 0.5, layer: 'low' });
        }
      }
    }
    if (this.hurtT > 0) this.hurtT -= dt;

    /* 排気とニトロの炎 */
    if (this.boosting && Math.random() < 0.9) {
      const back = (this.cy - this.box.maxR - 0.8) * CS;
      FX.add({ x: this.x + ca * back, y: this.y + sa * back, vx: -ca * 200 + rand(-40, 40), vy: -sa * 200 + rand(-40, 40), col: pick(['#7fd0ff', '#ffffff', '#4aa3ff']), r: 5, life: 0.25, glow: 1, layer: 'low' });
    }
    /* 急な横すべりはタイヤ痕を残す */
    if (Math.abs(vl) > 110 && world.decal) {
      for (const c of this.wheels) {
        if (c.r !== this.wheelR1) continue;
        const [wx, wy] = this.cellWorld(c);
        world.decal.skid(wx, wy, Math.min(0.3, Math.abs(vl) / 900));
      }
    }
  }

  onBoostStart() {
    Sfx.rocket();
    if (this.perks.shock && this.scene && this.scene.t - (this.shockT ?? -9) > 1.5) {
      this.shockT = this.scene.t;
      const R = 150 + 60 * this.perks.shock;
      for (const z of this.scene.zombies) {
        const d = dist(z.x, z.y, this.x, this.y);
        if (d < R && d > 1) {
          const k = (1 - d / R) * 520;
          z.vx += (z.x - this.x) / d * k; z.vy += (z.y - this.y) / d * k; z.fling = 0.5;
          z.hurt(18 * this.perks.shock, 'shock');
        }
      }
      FX.add({ x: this.x, y: this.y, col: '#9fe0ff', kind: 'ring', r: 20, grow: R * 3, life: 0.3, alpha: 0.9 });
    }
  }

  collideWorld(world) {
    const cands = world.nearStatic(this.x, this.y, this.R + 10);
    if (!cands.length) return;
    let sx = 0, sy = 0, maxPen = 0, hits = null;
    const cr = CS * 0.62;
    for (const c of this.cells) {
      if (!c.alive) continue;
      const [wx, wy] = this.cellWorld(c);
      for (const s of cands) {
        let nx, ny, pen;
        if (s.r) {
          const dx = wx - s.x, dy = wy - s.y, d = Math.hypot(dx, dy);
          if (d >= cr + s.r || d < 0.001) continue;
          nx = dx / d; ny = dy / d; pen = cr + s.r - d;
        } else {
          const qx = clamp(wx, s.x, s.x + s.w), qy = clamp(wy, s.y, s.y + s.h);
          const dx = wx - qx, dy = wy - qy, d = Math.hypot(dx, dy);
          if (d >= cr) continue;
          if (d > 0.001) { nx = dx / d; ny = dy / d; pen = cr - d; } else {
            /* 中心が箱の中に入った。いちばん近い辺から押し出す */
            const l = wx - s.x, r = s.x + s.w - wx, t = wy - s.y, b = s.y + s.h - wy;
            const m = Math.min(l, r, t, b);
            if (m === l) { nx = -1; ny = 0; } else if (m === r) { nx = 1; ny = 0; } else if (m === t) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
            pen = m + cr;
          }
        }
        sx += nx * pen; sy += ny * pen; if (pen > maxPen) maxPen = pen;
        (hits || (hits = [])).push({ c, s, nx, ny, wx, wy });
      }
    }
    if (!hits) return;
    const m = Math.hypot(sx, sy);
    if (m < 0.001) return;
    const nx = sx / m, ny = sy / m;
    this.x += nx * maxPen; this.y += ny * maxPen;
    const vn = this.vx * nx + this.vy * ny;
    if (vn < 0) {
      const impact = -vn;
      this.vx -= 1.25 * vn * nx; this.vy -= 1.25 * vn * ny;
      this.vx *= 0.9; this.vy *= 0.9;
      const h0 = hits[0];
      const rx = h0.wx - this.x, ry = h0.wy - this.y;
      this.av += clamp((rx * ny - ry * nx) * impact * 0.00012, -2, 2);
      if (impact > 180) {
        const dmg = Math.min(60, (impact - 180) * 0.16);
        const seen = new Set();
        for (const hh of hits) { if (seen.has(hh.c)) continue; seen.add(hh.c); this.damageCell(hh.c, dmg / Math.max(1, seen.size * 0.5)); }
        Sfx.crash(); shakeCam(Math.min(12, impact / 40));
        FX.burst(h0.wx, h0.wy, 10, { col: '#ffd27a', kind: 'line', r: 1.5, spMin: 120, spMax: 320, lifeMin: 0.15, lifeMax: 0.35 });
        for (const hh of hits) if (hh.s.onHit) hh.s.onHit(impact);
      } else if (impact > 80) Sfx.thud();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.a);
    /* 影。タイヤはタイヤの幅だけ */
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const c of this.cells) {
      if (!c.alive) continue;
      const w = c.def.wheel ? c.def.wheel.w : 1;
      ctx.fillRect(c.lf - CS / 2 + 4, c.lr - CS * w / 2 + 5, CS, CS * w);
    }
    const b = this.box;
    const spin = (((G.time * this.vf * 0.08) % 1) + 1) % 1;
    /* 車体のつなぎ目を目立たなくする下地。タイヤの下には敷かない */
    ctx.fillStyle = '#2a2e33';
    for (const c of this.cells) if (c.alive && !c.def.wheel) ctx.fillRect(c.lf - CS / 2 - 0.5, c.lr - CS / 2 - 0.5, CS + 1, CS + 1);
    let riders = this.riders.length;
    let cargoLeft = this.cargo;
    for (const c of this.cells) {
      if (!c.alive) continue;
      ctx.save(); ctx.translate(c.lf, c.lr);
      const o = { open: c.open, hpRatio: c.hp / c.max, flash: c.flash > 0 ? c.flash * 3 : 0, time: G.time, lv: c.lv };
      if (c.def.wheel) { o.spin = spin; if (c.r === this.wheelR0 && this.wheelR0 !== this.wheelR1) o.steer = this.steerVis * 0.45; }
      if (c.def.weapon && c.def.weapon !== 'mines' && c.def.weapon !== 'tesla') o.aim = c.aim - this.a;
      if (c.t === 'saw') o.spin = G.time * 22;
      if (c.t === 'seat') { o.riders = Math.min(2, riders); riders -= o.riders; }
      if (c.t === 'cargo' && cargoLeft > 0) { o.fill = Math.min(1, cargoLeft / c.def.cargo); cargoLeft -= c.def.cargo; o.fillCol = this.cargoKind === 'fuel' ? '#d64a3a' : this.cargoKind === 'scrap' ? '#9aa3ad' : '#e7c86a'; }
      drawPart(ctx, c.t, c.rot, CS, o);
      ctx.restore();
    }
    /* 前照灯 */
    if (this.cabin.alive) {
      ctx.fillStyle = '#fff6c8';
      const f = (this.cy - b.minR + 0.5) * CS;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(f - 1, (side < 0 ? b.minC - this.cx : b.maxC - this.cx) * CS * 0.9 + (side < 0 ? 3 : -3), 2.2, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  /* 基地へ持ち帰るための形。壊れた部品も hp 0 のまま残す */
  toDesign() {
    return this.cells.map((c) => ({ c: c.c, r: c.r, t: c.t, rot: c.rot, lv: c.lv, hp: Math.max(0, Math.round(c.hp)) }));
  }
}
