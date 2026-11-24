// 町の人: ひるま 歩きまわり、ベンチで やすみ、はなしかけると ヒントを くれる。よるは いえに かえる。
import { Actor } from './actor.js';
import { G, SV } from './state.js';
import { NPC_LINES } from './data.js';
import { WAYPOINTS, SEATS, addInteract } from './world.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';

const NAMES = ['ポポ', 'ミント', 'ガルド', 'ルル', 'トト', 'ベル'];
const BODIES = ['Barbarian', 'Mage', 'Knight', 'Rogue_Hooded', 'Rogue', 'Barbarian'];
const SHOW = ['Knight_Helmet', 'Knight_Cape', 'Barbarian_Hat', 'Barbarian_Cape', 'Mage_Hat', 'Mage_Cape', 'Rogue_Cape', 'Mug', 'Spellbook'];
let lineIdx = 0;

export function spawnNpcs() {
  NAMES.forEach((name, i) => {
    const a = new Actor(BODIES[i], { show: SHOW });
    const w = WAYPOINTS[(i * 7) % WAYPOINTS.length];
    a.pos.set(w.x, 0, w.z);
    const n = { a, name, state: 'walk', t: 0, goal: pick(), seat: null, talkT: 0, speed: 1.6 + Math.random() * 0.6 };
    n.it = addInteract({ area: 'town', x: 0, z: 0, r: 2.2, label: () => (n.a.root.visible && n.state !== 'gone' ? name + 'と はなす' : null), act: () => talk(n) });
    G.npcs.push(n);
  });
}

function pick() { return WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)]; }

function talk(n) {
  n.talkT = 4.5;
  n.a.faceTo(G.player.pos.x - n.a.pos.x, G.player.pos.z - n.a.pos.z, 1, 1);
  n.a.play(Math.random() < 0.5 ? 'Cheer' : 'Interact', { once: true, restart: true });
  n.prev = n.state;
  if (n.seat) { n.seat.used = null; n.seat = null; }
  n.state = 'talk';
  const line = NPC_LINES[lineIdx++ % NPC_LINES.length];
  UI.tag('talk' + n.name, n.a.pos.clone().setY(3.2), `<div class="bubble"><b>${n.name}</b>${line}</div>`);
  SV.stats.talk++;
  sfx('ui');
}

export function updateNpcs(dt) {
  const day = SV.time >= 6.5 && SV.time < 19;
  for (const n of G.npcs) {
    n.t += dt;
    const a = n.a;
    if (!day && n.state !== 'gone') { n.state = 'gone'; a.root.visible = false; if (n.seat) { n.seat.used = null; n.seat = null; } UI.untag('talk' + n.name); }
    if (day && n.state === 'gone') { n.state = 'walk'; a.root.visible = true; const w = pick(); a.pos.set(w.x, 0, w.z); }
    if (n.state === 'gone') continue;
    if (G.area !== 'town') { a.root.visible = false; continue; }
    a.root.visible = true;
    if (n.state === 'talk') {
      n.talkT -= dt;
      if (n.talkT > 0) UI.tag('talk' + n.name, a.pos.clone().setY(3.2), null);
      if (a.progress() > 0.95) a.play('Idle');
      if (n.talkT <= 0) { UI.untag('talk' + n.name); n.state = 'walk'; n.goal = pick(); }
    } else if (n.state === 'walk') {
      const dx = n.goal.x - a.pos.x, dz = n.goal.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4) {
        // ときどき 近くの ベンチに すわる
        const seat = SEATS.find((s) => !s.used && Math.hypot(s.x - a.pos.x, s.z - a.pos.z) < 6);
        if (seat && Math.random() < 0.5) {
          n.seat = seat; seat.used = n; n.state = 'sit'; n.t = 0;
          a.pos.set(seat.x, 0, seat.z); a.yaw = seat.yaw; a.play('Sit_Chair_Down', { once: true });
        } else { n.state = 'rest'; n.t = 0; a.play('Idle'); }
      } else {
        const ox = a.pos.x, oz = a.pos.z;
        a.move(dx / d * n.speed * dt, dz / d * n.speed * dt);
        // 建物に ひっかかったら 行き先を かえる
        n.stuck = Math.hypot(a.pos.x - ox, a.pos.z - oz) < n.speed * dt * 0.4 ? (n.stuck || 0) + dt : 0;
        if (n.stuck > 0.8) { n.goal = pick(); n.stuck = 0; }
        a.faceTo(dx, dz, dt, 6);
        a.play('Walking_A', { speed: n.speed / 2.2 });
      }
    } else if (n.state === 'rest') {
      if (n.t > 2 + Math.random() * 3) { n.state = 'walk'; n.goal = pick(); }
    } else if (n.state === 'sit') {
      if (n.t > 1 && a.currentName === 'Sit_Chair_Down') a.play('Sit_Chair_Idle');
      if (n.t > 12 + Math.random() * 8) { a.play('Sit_Chair_StandUp', { once: true }); n.state = 'standing'; n.t = 0; }
    } else if (n.state === 'standing') {
      if (n.t > 0.9) { if (n.seat) n.seat.used = null; n.seat = null; n.state = 'walk'; n.goal = pick(); a.pos.x += Math.sin(a.yaw) * 0.8; a.pos.z += Math.cos(a.yaw) * 0.8; }
    }
    n.it.x = a.pos.x; n.it.z = a.pos.z;
    a.update(dt);
  }
}
