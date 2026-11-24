// ゲーム全体で共有する状態と、セーブデータ。
import { HERO_CLASSES, HP_LV } from './data.js';

export const G = {
  mode: 'loading',   // loading | title | play
  area: 'town',      // town | house | diner
  menu: null,        // 開いているメニューの名前 (開いている間は時間が止まる)
  dt: 0, now: 0,
  player: null,
  enemies: [], npcs: [], projectiles: [], drops: [],
  focus: null,       // いま E で使える もの
  night: 0,          // 0=ひる 1=よる (なめらかに変わる)
  boss: null,
};

const KEY = 'lantern-town-v1';
export let SV = null;

export function freshSave(hero) {
  return {
    v: 1, hero, coins: 30, day: 1, time: 8, hp: HERO_CLASSES[hero].hp,
    weaponLv: 0, hpLv: 0, stew: 2, bones: 0,
    inv: { chair_A_wood: 1, pumpkin_orange: 1 },
    house: [{ id: 'bed_single_A', x: -4.5, z: -3, r: 0 }, { id: 'table_small', x: 3, z: -3.2, r: 0 }],
    quests: [], qShown: 0,
    stats: { walk: 0, sat: 0, talk: 0, served: 0, bought: 0, placed: 0, dummy: 0, nightVisit: 0, kills: 0, boss: 0 },
    opts: { quality: 'auto', sound: true },
  };
}

export function maxHp() { return HERO_CLASSES[SV.hero].hp + HP_LV[SV.hpLv].add; }

export function setSave(s) { SV = s; }
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1 && HERO_CLASSES[s.hero]) return s;
  } catch { /* こわれていたら 最初から */ }
  return null;
}
export function save() {
  if (!SV) return;
  try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch { /* 容量オーバーなどは あきらめる */ }
}
export function wipeSave() { localStorage.removeItem(KEY); }
