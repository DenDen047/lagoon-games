/* =========================================================================
   KAIJU CLASH ― CPU
   一定の間隔で「何をするか」を決め、決めたことを数フレーム続ける。
   難易度で反応の速さ・攻めの濃さ・ガードの丁寧さが変わる。
   ========================================================================= */
'use strict';

const AI_LEVELS = [
  { react: 24, decide: 26, aggr: 0.42, guard: 0.28, punish: 0.35, useSpecial: 0.25, antiAir: 0.3 },
  { react: 13, decide: 18, aggr: 0.66, guard: 0.52, punish: 0.6, useSpecial: 0.5, antiAir: 0.55 },
  { react: 6, decide: 12, aggr: 0.85, guard: 0.76, punish: 0.85, useSpecial: 0.72, antiAir: 0.8 },
];

function makeAI(f, diff, boss) {
  const lv = AI_LEVELS[clamp(diff | 0, 0, 2)];
  const p = Object.assign({}, lv);
  if (boss) {
    p.react = Math.max(4, p.react - 4);
    p.aggr = Math.min(0.95, p.aggr + 0.12);
    p.guard = Math.min(0.9, p.guard + 0.1);
    p.useSpecial = Math.min(0.9, p.useSpecial + 0.15);
  }
  return {
    f, p, plan: 'approach', planT: 0, react: 0, press: {},

    reset() { this.plan = 'approach'; this.planT = 0; this.react = this.p.react; this.press = {}; },

    /** 近接技が届く距離のめやす */
    reach() {
      const m = this.f.k.moves;
      return Math.max(m.light.box.x + m.light.box.w / 2, m.heavy.box.x + m.heavy.box.w / 2);
    },

    hasRanged() {
      const t = this.f.k.moves.special.type;
      return t === 'shot' || t === 'beam' || t === 'pillar' || t === 'cloud';
    },

    think(B) {
      const f = this.f;
      const foe = B.foeOf(f);
      const inp = emptyInput();
      const dx = foe.x - f.x;
      const adx = Math.abs(dx);
      const dir = dx > 0 ? 1 : -1;
      const reach = this.reach() * 0.92;

      if (this.react > 0) { this.react--; return inp; }

      this.planT--;
      if (this.planT <= 0) this.decide(B, foe, adx, reach);

      /* 相手の技が出かかっていたらガードを混ぜる */
      const threatened = foe.act && adx < reach * 1.7 && foe.act.frame <= foe.act.def.startup + 4;
      if (threatened && f.onGround && Math.random() < this.p.guard * 0.4) {
        inp.down = true;
        return inp;
      }

      switch (this.plan) {
        case 'approach':
          if (adx > reach * 0.7) inp[dir > 0 ? 'right' : 'left'] = true;
          break;
        case 'back':
          inp[dir > 0 ? 'left' : 'right'] = true;
          break;
        case 'guard':
          inp.down = true;
          break;
        case 'jumpin':
          if (adx > reach * 0.6) inp[dir > 0 ? 'right' : 'left'] = true;
          if (f.onGround && this.planT > 6) inp.up = true;
          if (!f.onGround && adx < reach * 1.4) this.press.heavy = 2;
          break;
        case 'poke':
          if (adx > reach) inp[dir > 0 ? 'right' : 'left'] = true;
          else this.press.light = 2;
          break;
        case 'smash':
          if (adx > reach * 0.9) inp[dir > 0 ? 'right' : 'left'] = true;
          else this.press.heavy = 2;
          break;
        case 'special':
          this.press.special = 2;
          this.plan = 'approach'; this.planT = 14;
          break;
        case 'super':
          this.press.super = 2;
          this.plan = 'approach'; this.planT = 18;
          break;
        default:
          break;
      }

      /* ボタンは 2 フレームだけ押す */
      for (const k in this.press) {
        if (this.press[k] > 0) { inp[k] = true; this.press[k]--; }
      }
      return inp;
    },

    decide(B, foe, adx, reach) {
      const f = this.f;
      const p = this.p;
      this.planT = p.decide + randInt(-4, 8);
      const r = Math.random();
      const hpRatio = f.hp / f.maxHp;

      if (f.gauge >= 100 && adx < reach * 2.2 && r < 0.7) { this.plan = 'super'; return; }

      /* 相手が技を出しきったところに差し込む */
      if (foe.act && foe.act.frame > foe.act.def.startup + foe.act.def.active
        && adx < reach * 1.2 && Math.random() < p.punish) {
        this.plan = 'smash'; return;
      }
      if (!foe.onGround && adx < reach * 1.6 && Math.random() < p.antiAir) {
        this.plan = Math.random() < 0.5 ? 'smash' : 'special'; return;
      }
      if (foe.state === 'hurt' && adx < reach * 1.4) { this.plan = 'poke'; return; }

      if (adx < reach * 0.85) {
        if (r < p.aggr * 0.55) this.plan = 'poke';
        else if (r < p.aggr * 0.85) this.plan = 'smash';
        else if (r < p.aggr * 0.85 + p.guard * 0.2) this.plan = 'guard';
        else this.plan = 'back';
      } else if (adx < reach * 2.4) {
        if (r < p.useSpecial * 0.45 && f.cool <= 0) this.plan = 'special';
        else if (r < 0.55 + p.aggr * 0.25) this.plan = 'approach';
        else if (r < 0.72) this.plan = 'jumpin';
        else this.plan = 'poke';
      } else {
        if (r < p.useSpecial * 0.55 && f.cool <= 0 && this.hasRanged()) this.plan = 'special';
        else if (r < 0.86) this.plan = 'approach';
        else this.plan = hpRatio < 0.3 ? 'back' : 'jumpin';
      }
    },
  };
}
