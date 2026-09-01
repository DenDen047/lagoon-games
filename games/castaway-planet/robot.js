/* =========================================================================
   CASTAWAY PLANET ― ロボット
   組み立て / 搭乗 / 左右のアーム / バッテリーと水タンク / 見た目の色
   ロボットは自分で働かない。乗り込んで、こちらが動かす。
   ========================================================================= */
'use strict';

const ROBOT_PRESETS = [
  { name: 'サンド',   body: '#e0d2b4', accent: '#c87f4a', arm: '#a89478', glow: '#ffd88a' },
  { name: 'マリン',   body: '#d2e4ee', accent: '#3f8ac8', arm: '#8fa8bc', glow: '#7fe8ff' },
  { name: 'フォレスト', body: '#cfe0c2', accent: '#4f9a52', arm: '#8fa88a', glow: '#b4ff8a' },
  { name: 'ルビー',   body: '#f0d2d2', accent: '#c8404a', arm: '#b08a8a', glow: '#ff8a8a' },
  { name: 'ナイト',   body: '#4a4f5f', accent: '#8a5fd8', arm: '#3a3f4a', glow: '#c8a2ff' },
  { name: 'レモン',   body: '#f4ecc0', accent: '#e0b02a', arm: '#bcae7a', glow: '#fff28a' },
];

let robotSeq = 0;

class Robot {
  constructor(x, y, colors) {
    this.id = ++robotSeq;
    this.name = 'ロボ' + this.id;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 14;
    this.hp = 140; this.maxhp = 140;
    this.batt = 100; this.maxbatt = 100;
    this.water = 20; this.maxwater = 60;
    this.arms = { left: 'arm_grab', right: 'arm_drill1' };
    this.colors = colors ? { ...colors } : { ...ROBOT_PRESETS[1] };
    delete this.colors.name;
    this.aim = 0;
    this.face = 1;
    this.walk = 0;
    this.swing = { left: 0, right: 0 };
    this.cd = { left: 0, right: 0 };
    this.hurt = 0;
    this.ridden = false;
  }

  armDef(side) { return ARMS[this.arms[side]] || null; }

  update(dt, world) {
    this.cd.left = Math.max(0, this.cd.left - dt);
    this.cd.right = Math.max(0, this.cd.right - dt);
    this.swing.left = Math.max(0, this.swing.left - dt * 3.2);
    this.swing.right = Math.max(0, this.swing.right - dt * 3.2);
    this.hurt = Math.max(0, this.hurt - dt);
    if (this.ridden) {
      const sp = Math.hypot(this.vx, this.vy);
      this.walk += dt * (sp > 8 ? 7 : 1.6);
      /* 動いているだけでも少しずつ電気を食う */
      this.batt = Math.max(0, this.batt - dt * (sp > 8 ? 0.55 : 0.18));
    } else {
      this.walk += dt * 0.8;
    }
  }

  charge(amount) { this.batt = Math.min(this.maxbatt, this.batt + amount); }
  fill(amount) {
    const before = this.water;
    this.water = Math.min(this.maxwater, this.water + amount);
    return this.water - before;
  }
  damage(n) {
    this.hp = Math.max(0, this.hp - n);
    this.hurt = 0.25;
    FX.burst(this.x, this.y - 6, '#ffd28a', 7, 90, 0.4);
  }

  /* アームが届くタイルの一覧 */
  targetTiles(tx, ty, range) {
    const list = [];
    for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) list.push([tx + dx, ty + dy]);
    return list;
  }

  /* 左右どちらかのアームを使う。game 側で在庫と通知を扱う */
  useArm(side, game) {
    const armId = this.arms[side];
    if (!armId) { game.notify('その手には何も付いていない'); return false; }
    const arm = ARMS[armId];
    if (this.cd[side] > 0) return false;
    if (this.batt < arm.batt) { game.notify('バッテリーが足りない', 'warn'); return false; }

    const world = game.world;
    const aim = game.aimTile();
    const tx = aim.tx, ty = aim.ty;
    if (dist(this.x, this.y, (tx + 0.5) * TILE, (ty + 0.5) * TILE) > TILE * 3.6) {
      game.notify('アームが届かない'); return false;
    }
    const range = arm.range || 0;
    const tiles = this.targetTiles(tx, ty, range);
    let did = false;
    this.aim = Math.atan2((ty + 0.5) * TILE - this.y, (tx + 0.5) * TILE - this.x);

    switch (arm.act) {
      case 'gather': {
        for (const [x, y] of tiles) {
          const r = world.gather(x, y, { canChop: true });
          if (r && r.drops) { game.collect(r.drops, x, y); did = true; }
          else if (r && r.hit) did = true;
        }
        if (!did) game.notify('掴めるものがない');
        break;
      }
      case 'mine': {
        let hardBlock = null;
        for (const [x, y] of tiles) {
          const r = world.mine(x, y, arm.hardness, 3);
          if (!r) continue;
          if (r.fail === 'hard') { hardBlock = r; continue; }
          did = true;
          if (r.drops) game.collect(r.drops, x, y);
        }
        if (!did) game.notify(hardBlock ? `${hardBlock.name}にはもっと強いドリルが要る` : '掘れる鉱脈がない', hardBlock ? 'warn' : '');
        break;
      }
      case 'till': {
        for (const [x, y] of tiles) if (world.till(x, y)) did = true;
        if (!did) game.notify('ここは耕せない');
        break;
      }
      case 'water': {
        for (const [x, y] of tiles) {
          if (this.water < (arm.water || 1)) break;
          if (world.water(x, y)) { this.water -= arm.water || 1; did = true; }
        }
        if (!did) game.notify(this.water <= 0 ? 'タンクが空。水辺か貯水タンクで補給する' : '水をやる畑がない', this.water <= 0 ? 'warn' : '');
        break;
      }
      case 'seed': {
        const seed = game.selectedSeed();
        if (!seed) { game.notify('蒔く種を持ち物から選ぶ', 'warn'); break; }
        for (const [x, y] of tiles) {
          if (!game.hasItem(seed, 1)) break;
          if (world.sow(x, y, seed)) { game.takeItem(seed, 1); did = true; }
        }
        if (!did) game.notify('種を蒔ける畑がない');
        break;
      }
      case 'harvest': {
        for (const [x, y] of tiles) {
          const r = world.harvest(x, y);
          if (r && r.drops) { game.collect(r.drops, x, y); did = true; }
        }
        if (!did) game.notify('刈れる作物がない');
        break;
      }
      case 'shoot': {
        const a = this.aim;
        const ox = this.x + Math.cos(a) * 20, oy = this.y - 4 + Math.sin(a) * 20;
        world.shots.push({ x: ox, y: oy, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg: arm.dmg, life: 1.1, foe: false, c: this.colors.glow });
        did = true;
        break;
      }
      default: break;
    }

    if (did) {
      this.batt = Math.max(0, this.batt - arm.batt);
      this.cd[side] = arm.act === 'mine' ? 0.42 : arm.act === 'shoot' ? 0.28 : 0.34;
      this.swing[side] = 1;
    }
    return did;
  }

  toJSON() {
    return {
      id: this.id, name: this.name, x: Math.round(this.x), y: Math.round(this.y),
      hp: this.hp, batt: Math.round(this.batt), water: Math.round(this.water),
      arms: { ...this.arms }, colors: { ...this.colors },
    };
  }

  static fromJSON(d) {
    const r = new Robot(d.x, d.y, d.colors);
    r.id = d.id; robotSeq = Math.max(robotSeq, d.id);
    r.name = d.name; r.hp = d.hp; r.batt = d.batt; r.water = d.water;
    r.arms = { ...d.arms };
    return r;
  }
}
