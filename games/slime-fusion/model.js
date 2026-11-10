/* =========================================================================
   SLIME FUSION ― スライムの なかみ
   1ぴきの データ / のうりょく / わざ / ごうせいの けいさん / セーブ
   ========================================================================= */
'use strict';

/* プレイヤーの データ。P.slimes の 1ぴきは
   { id, sp, lv, exp, size, colors:[色], parts:[{t, a}], unlocked:[パーツ], traits:[とくせい] }
   parts の a は からだの まんなかから見た 角度 (0 が まうえ、時計まわり) */
let P = null;

function freshProfile() {
  const p = {
    v: 1, coins: 60, nextId: 1, slimes: [], party: [], cleared: {}, coaches: {},
    seen: {}, fusions: 0, wins: 0, sound: true, tut: {},
  };
  P = p;
  const a = makeSlime('plain', 1), b = makeSlime('plain', 1);
  p.slimes.push(a, b);
  p.party = [a.id, b.id];
  p.seen.plain = true;
  return p;
}

function makeSlime(spId, lv = 1, opt = {}) {
  const sp = SP[spId];
  const s = {
    id: P ? P.nextId++ : 0, sp: spId, lv, exp: 0, size: opt.size || 1,
    colors: opt.colors ? opt.colors.slice() : sp.el.filter((e) => e !== 'plain').slice(0, 8),
    parts: opt.parts ? opt.parts.map((x) => ({ ...x })) : [],
    unlocked: opt.unlocked ? opt.unlocked.slice() : [],
    traits: opt.traits ? opt.traits.slice() : [sp.trait],
  };
  for (const pt of s.parts) if (!s.unlocked.includes(pt.t)) s.unlocked.push(pt.t);
  return s;
}

/* パーツを からだに ならべる (てきや ボス用)。同じ しゅるいは 左右に ちらす */
function autoParts(types) {
  const out = [];
  const count = {};
  const base = { horn: 0, ears: 0, wing: Math.PI / 2, tail: Math.PI * 0.75, claw: Math.PI * 0.8, gem: 0, spike: 0 };
  for (const t of types) {
    const k = (count[t] = (count[t] || 0) + 1) - 1;
    let a;
    if (t === 'spike') a = -Math.PI * 0.55 + k * 0.42;
    else if (t === 'gem') a = k * 0.6 - 0.3;
    else {
      const side = k % 2 ? -1 : 1;
      const b = base[t];
      a = t === 'horn' || t === 'ears' ? side * (0.42 + Math.floor(k / 2) * 0.3) : side * (b + Math.floor(k / 2) * 0.25);
      if (t === 'horn' && types.filter((x) => x === 'horn').length === 1) a = 0;
    }
    out.push({ t, a });
  }
  return out;
}

const spOf = (s) => SP[s.sp];
const spName = (s) => spOf(s).name;
const partCount = (s, t) => s.parts.filter((p) => p.t === t).length;

/* そのスライムの とくせい (トゲが 4こ いじょう なら トゲトゲが つく) */
function traitsOf(s) {
  const t = s.traits.slice();
  if (partCount(s, 'spike') >= 4 && !t.includes('thorny')) t.push('thorny');
  return t;
}

function calcStats(s) {
  const sp = spOf(s);
  const b = speciesBase(sp);
  const lvM = 1 + 0.08 * (s.lv - 1);
  const szM = 1 + 0.12 * (s.size - 1);
  const add = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const p of s.parts) for (const k in PARTS[p.t].stat) add[k] += PARTS[p.t].stat[k];
  const tr = traitsOf(s);
  const st = {
    hp: Math.round(b.hp * 3 * lvM * szM * (1 + add.hp) * (tr.includes('big') ? 1.4 : 1) + 10),
    atk: Math.round(b.atk * lvM * szM * (1 + add.atk) * (tr.includes('strong') ? 1.2 : 1)),
    def: Math.round(b.def * lvM * szM * (1 + add.def) * (tr.includes('hard') ? 1.3 : 1)),
    spd: Math.round(b.spd * lvM * (1 + add.spd) * (tr.includes('swift') ? 1.3 : 1)),
  };
  return st;
}
const powerOf = (s) => { const st = calcStats(s); return Math.round(st.hp / 3 + st.atk + st.def + st.spd); };

/* つかえる わざの いちらん。{ id, name, el, pow, cost, ... } */
function movesOf(s, curColor) {
  const sp = spOf(s);
  const col = curColor || baseColor(s);
  const strong = sp.tier >= 3;
  const list = [];
  const mk = (id, extra = {}) => Object.assign({ id }, MOVES[id] || {}, extra);
  list.push(mk('tackle'));
  list.push(mk('color', { name: COLOR_MOVE[col][strong ? 1 : 0], el: col, pow: strong ? 75 : 55 }));
  const seen = new Set();
  for (const p of s.parts) {
    if (seen.has(p.t)) continue;
    seen.add(p.t);
    const m = mk(p.t);
    if (m.el === 'color') m.el = col;
    list.push(m);
  }
  if (sp.sig) {
    const e = sp.el[0];
    const base = SIG_BY_EL[e] || SIG_BY_EL.plain;
    const sig = Object.assign({ id: 'sig', cost: 3, el: e, sig: true }, base);
    if (sp.sigName) { sig.name = sp.sigName; sig.all = true; sig.pow = 74; }
    if (sp.special) { sig.name = SPECIAL_SIG[sp.id] || sig.name; }
    if (sp.id === 'rainbow' || sp.id === 'chaos') { sig.el = col; }
    list.push(sig);
  }
  return list;
}
const SPECIAL_SIG = {
  mini: 'ちびちびアタック', twin: 'ふたりでパンチ', triple: 'トリプルアタック', daiou: 'おうさまプレス', giant: 'ギガプレス',
  goldy: 'ゴールドラッシュ', silvery: 'シルバーミラー', dragon: 'ドラゴンブレス', devil: 'デビルクロー', spirit: 'いやしのかぜ',
  ninja: 'かげぶんしん', knight: 'ゼリースラッシュ', samurai: 'いあいぎり', wizard: 'マジカルボム', robo: 'ロケットパンチ',
  ghost: 'のろいのこえ', space: 'メテオシャワー', stardust: 'スターダスト', time: 'タイムストップ', princess: 'ロイヤルハート',
  cat: 'ねこパンチ', dog: 'わんわんタックル', rabbit: 'ジャンピングキック', bear: 'くまのいちげき', rainbow: 'レインボーバースト', chaos: 'カオスエンド',
};

const baseColor = (s) => (s.colors.length ? (s.colors.includes(spOf(s).el[0]) ? spOf(s).el[0] : s.colors[0]) : 'plain');
const expNeed = (lv) => 10 + lv * 7;

function gainExp(s, amt) {
  let ups = 0;
  if (s.lv >= MAX_LV) return 0;
  s.exp += amt;
  while (s.lv < MAX_LV && s.exp >= expNeed(s.lv)) { s.exp -= expNeed(s.lv); s.lv++; ups++; }
  if (s.lv >= MAX_LV) s.exp = 0;
  return ups;
}

/* ------------------------------ ごうせい ------------------------------ */
/* 2ひきから 何が うまれるかを きめる。ルーレットが いるときは wheel を かえす */
function fusionPlan(A, B) {
  const sa = spOf(A), sb = spOf(B);
  const colors = new Set([...A.colors, ...B.colors]);
  const parts = new Set([...A.parts, ...B.parts].map((p) => p.t));
  const plan = { colors, grow: false, sp: null, wheel: null, recipe: false };

  if (colors.size >= 8 && A.sp !== 'rainbow' && B.sp !== 'rainbow') { plan.sp = 'rainbow'; plan.recipe = true; return plan; }
  if (A.sp === 'plain' && B.sp === 'plain') {
    if (A.size >= 5 && B.size >= 5) { plan.sp = 'daiou'; plan.recipe = true; return plan; }
    plan.wheel = PLAIN_WHEEL.map((w) => ({ ...w }));
    return plan;
  }
  for (const r of RECIPES) {
    if (A.sp === r.id || B.sp === r.id) continue;
    if (r.test(colors, parts, A, B)) { plan.sp = r.id; plan.recipe = true; return plan; }
  }
  if (A.size >= 5 && B.size >= 5 && A.sp !== 'giant' && B.sp !== 'giant') { plan.sp = 'giant'; plan.recipe = true; return plan; }
  if (A.sp === 'plain' || B.sp === 'plain') { plan.sp = A.sp === 'plain' ? B.sp : A.sp; plan.grow = true; return plan; }
  if (sa.line && sb.line) {
    if (sa.line === sb.line) {
      const t = Math.max(sa.tier, sb.tier);
      if (sa.tier === sb.tier && t < 5) plan.sp = sa.line + (t + 1);
      else { plan.sp = sa.line + t; plan.grow = true; }
      return plan;
    }
    plan.sp = hybridId(sa.line, sb.line, Math.max(sa.tier, sb.tier) >= 3);
    return plan;
  }
  if (sa.hyb && A.sp === B.sp) {
    if (A.sp.endsWith('_a')) plan.sp = A.sp.replace(/_a$/, '_b');
    else { plan.sp = A.sp; plan.grow = true; }
    return plan;
  }
  /* きまりが ないときは ルーレットで どちらに なるか きめる。まれに とつぜんへんい */
  const mut = mutationCandidates(A, B);
  plan.wheel = [
    { kind: 'keep', sp: A.sp, w: 45 },
    { kind: 'keep', sp: B.sp, w: 45 },
  ];
  if (A.sp === B.sp) plan.wheel = [{ kind: 'keep', sp: A.sp, w: 80 }];
  if (mut.length) plan.wheel.push({ kind: 'sp', sp: pick(mut), w: 14, label: 'とつぜんへんい' });
  return plan;
}

function mutationCandidates(A, B) {
  const cols = new Set([...A.colors, ...B.colors]);
  const maxT = Math.max(spOf(A).tier, spOf(B).tier);
  return SPECIES.filter((s) => !s.special && s.tier > 0 && s.tier <= maxT + 1 && s.tier >= maxT && s.el.some((e) => cols.has(e)) && s.id !== A.sp && s.id !== B.sp).map((s) => s.id);
}

/* ルーレットの けっかを うけて、あたらしい 1ぴきを つくる */
function performFusion(A, B, plan, wheelHit) {
  let spId = plan.sp, grow = plan.grow;
  if (wheelHit) {
    if (wheelHit.kind === 'grow') { spId = 'plain'; grow = true; }
    else if (wheelHit.kind === 'keep') { spId = wheelHit.sp; grow = true; }
    else spId = wheelHit.sp;
  }
  const sp = SP[spId];
  const size = clamp(Math.max(A.size, B.size) + (grow ? 1 : 0), 1, 5);
  const colors = new Set([...A.colors, ...B.colors, ...sp.el.filter((e) => e !== 'plain')]);
  const unlockedBefore = new Set([...A.unlocked, ...B.unlocked]);
  const fromA = new Set(A.unlocked), fromB = new Set(B.unlocked);
  const inherited = [...unlockedBefore].filter((t) => !(fromA.has(t) && fromB.has(t)));

  /* あたらしく つけられるように なる パーツを 1つ */
  let gained = null;
  if (P.fusions === 0 && !unlockedBefore.has('horn')) gained = 'horn';
  else if (sp.grant && !unlockedBefore.has(sp.grant)) gained = sp.grant;
  else {
    const rest = PART_IDS.filter((t) => !unlockedBefore.has(t));
    if (rest.length) gained = pick(rest);
  }
  if (gained && unlockedBefore.has(gained)) gained = null;
  const unlocked = [...unlockedBefore];
  if (gained) unlocked.push(gained);

  /* パーツは 2ひきぶんを そのまま のこす。つけすぎた ぶんは けずる */
  const parts = [];
  for (const p of [...A.parts, ...B.parts]) {
    if (parts.filter((x) => x.t === p.t).length < PARTS[p.t].cap(size)) parts.push({ ...p });
  }
  /* とくせい: その しゅるいの とくせい ＋ 親の とくせいを 1つ うけつぐ ことが ある */
  const traits = [sp.trait];
  const parentTraits = [...new Set([...A.traits, ...B.traits])].filter((t) => t !== sp.trait);
  let newTrait = null;
  if (parentTraits.length && Math.random() < 0.65) { newTrait = pick(parentTraits); traits.push(newTrait); }

  const child = makeSlime(spId, Math.max(A.lv, B.lv), { size, colors: [...colors].filter((e) => e !== 'plain'), parts, unlocked, traits });
  const firstSeen = !P.seen[spId];
  P.seen[spId] = true;
  P.fusions++;
  return { child, gained, inherited, newTrait, grow, firstSeen, newColors: [...colors].filter((c) => !A.colors.includes(c) || !B.colors.includes(c)) };
}

/* ------------------------------ てき ------------------------------ */
function makeEnemy(spId, lv, opt = {}) {
  const sp = SP[spId];
  let types = opt.parts;
  if (!types) {
    types = [];
    const line = sp.line ? LINE[sp.line].grants.slice(0, Math.max(0, sp.tier - 1)) : [];
    for (const g of line) types.push(g);
    if (sp.grant && !types.includes(sp.grant)) types.push(sp.grant);
    if (Math.random() < 0.35) types.push(pick(PART_IDS));
    if (types.includes('spike')) types.push('spike', 'spike');
  }
  const s = makeSlime(spId, lv, { size: opt.size || 1, colors: opt.colors, parts: autoParts(types) });
  s.id = 'e' + Math.random().toString(36).slice(2, 7);
  if (opt.name) s.nick = opt.name;
  return s;
}

/* ------------------------------ セーブ ------------------------------ */
function saveGame() { if (P) Save.write(P); }
function loadGame() {
  const d = Save.read();
  if (!d || typeof d !== 'object' || !Array.isArray(d.slimes)) return false;
  /* こわれた データは すてる */
  d.slimes = d.slimes.filter((s) => s && SP[s.sp] && Array.isArray(s.parts) && Array.isArray(s.colors));
  for (const s of d.slimes) {
    s.parts = s.parts.filter((p) => p && PARTS[p.t] && Number.isFinite(p.a));
    s.colors = s.colors.filter((c) => COLORS[c] && c !== 'plain');
    s.unlocked = (s.unlocked || []).filter((t) => PARTS[t]);
    s.traits = (s.traits || [SP[s.sp].trait]).filter((t) => TRAITS[t]);
    if (!s.traits.length) s.traits = [SP[s.sp].trait];
    s.lv = clamp(s.lv | 0 || 1, 1, MAX_LV); s.size = clamp(s.size | 0 || 1, 1, 5); s.exp = Math.max(0, s.exp | 0);
  }
  if (!d.slimes.length) return false;
  d.party = (d.party || []).filter((id) => d.slimes.some((s) => s.id === id)).slice(0, PARTY_MAX);
  if (!d.party.length) d.party = [d.slimes[0].id];
  d.coins = Math.max(0, d.coins | 0);
  d.nextId = Math.max(d.nextId | 0, ...d.slimes.map((s) => s.id + 1));
  d.cleared = d.cleared || {}; d.coaches = d.coaches || {}; d.seen = d.seen || {}; d.tut = d.tut || {};
  d.fusions = d.fusions | 0; d.wins = d.wins | 0;
  P = d;
  return true;
}
const slimeById = (id) => P.slimes.find((s) => s.id === id);
const partySlimes = () => P.party.map(slimeById).filter(Boolean);
