// 車と歩行者。車は車線に沿って走り、前の車との間をあけ、信号で止まり、ときどき交差点で曲がる。
// 歩行者は区画のまわりの歩道を歩き、角で信号を待って向かいの区画へ渡る。
import * as THREE from 'three';
import { L, avX, stZ, stDir, blockRect, BOUNDS } from './city.js';
import { signalState } from './street.js';
import * as P from './props.js';

const TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'taxi', 'suv', 'suv', 'van', 'truck', 'bus'];
const PAINT = [0xe8e8e8, 0x1a1a1a, 0x9a9da2, 0x2b3a55, 0x7a1515, 0x3c4a3a, 0xc9c2b0, 0x4a4f57, 0x1f4f8a, 0xb0b4b8, 0x5a3a2a];
const SKIN = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbac];
const CLOTH = [0x1d1d1d, 0x2b3a55, 0x6b6b6b, 0xa83232, 0xe8e2d0, 0x2f5d3a, 0x7a5c3a, 0x3d3d6b, 0xd9a441, 0x8a8a8a, 0x40658a, 0x111111];

export class Traffic {
  constructor(scene, rng, opts = {}) {
    this.scene = scene; this.rng = rng;
    this.lanes = this.makeLanes();
    this.cars = [];
    this.parked = [];
    this.makeMeshes(opts.carCount || 170, opts.parkedCount || 700);
    this.spawnParked();
    for (let k = 0; k < (opts.carCount || 170); k++) this.spawn(true);
    this.peds = [];
    this.makePeople(opts.pedCount || 320);
    this.t = 0;
  }

  // ------------------------------------------------------------ 車線
  makeLanes() {
    const lanes = [];
    const zr = [BOUNDS.z0 - 110, BOUNDS.z1 + 110], xr = [BOUNDS.x0 - 110, BOUNDS.x1 + 110];
    for (let i = 0; i < L.NI; i++) {
      const X = avX(i);
      const cross = []; for (let j = 0; j < L.NJ; j++) cross.push({ c: stZ(j), i, j });
      for (const [dir, offs] of [[-1, [1.85, 5.1]], [1, [-1.85, -5.1]]]) offs.forEach((o, k) => lanes.push({
        axis: 'av', idx: i, dir, pos: X + o, k, outer: k === 1, range: zr, cross, half: L.ST / 2 + L.SW, road: X, cars: [],
      }));
    }
    for (let j = 0; j < L.NJ; j++) {
      const Z = stZ(j), dir = stDir(j);
      const cross = []; for (let i = 0; i < L.NI; i++) cross.push({ c: avX(i), i, j });
      // 一方通行 2 車線。進む向きの右側が outer
      [-1.875, 1.875].forEach((o, k) => lanes.push({
        axis: 'st', idx: j, dir, pos: Z + o, k, outer: dir > 0 ? o > 0 : o < 0, range: xr, cross, half: L.AV / 2 + L.SW, road: Z, cars: [],
      }));
    }
    return lanes;
  }
  laneAt(axis, idx, dir, outer) { return this.lanes.find((l) => l.axis === axis && l.idx === idx && l.dir === dir && l.outer === outer); }

  // ------------------------------------------------------------ 形
  makeMeshes(nMove, nPark) {
    this.meshes = {};
    const total = nMove + nPark;
    this.headMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
    // 車の下の影 (ぼかした黒い板)
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    const g2 = cv.getContext('2d');
    const gr = g2.createRadialGradient(32, 64, 4, 32, 64, 60);
    gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 128);
    const st = new THREE.CanvasTexture(cv);
    this.shadow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -3 }), nMove + nPark + 10);
    this.shadow.count = 0; this.shadow.frustumCulled = false; this.shadow.renderOrder = 2;
    this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.shadow);
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    for (const type of Object.keys(P.CAR_TYPES)) {
      const g = P.carGeometries(type);
      const cap = total + 20; // 種類ごとの台数は偏るので、どれも全台ぶん用意しておく
      const mk = (geo, mat, color) => {
        const m = new THREE.InstancedMesh(geo, mat, cap);
        m.count = 0; m.castShadow = mat !== this.headMat && mat !== this.tailMat; m.receiveShadow = true; m.frustumCulled = false;
        if (color) m.setColorAt(0, new THREE.Color(1, 1, 1));
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(m);
        return m;
      };
      this.meshes[type] = {
        cap, n: 0, len: P.CAR_TYPES[type].len,
        paint: mk(g.paint, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15 }), true),
        trim: mk(g.trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.2, envMapIntensity: 1.5 })),
        head: mk(g.head, this.headMat),
        tail: mk(g.tail, this.tailMat, true),
      };
    }
  }
  alloc(type, color) {
    const M = this.meshes[type];
    if (M.n >= M.cap) return null;
    const id = M.n++;
    for (const k of ['paint', 'trim', 'head', 'tail']) M[k].count = M.n;
    M.paint.setColorAt(id, new THREE.Color(color));
    M.tail.setColorAt(id, new THREE.Color(0.5, 0.03, 0.02));
    return id;
  }
  newCar(type, color) {
    if (this.shadow.count >= this.shadow.instanceMatrix.count) return null;
    const id = this.alloc(type, color);
    if (id === null) return null;
    return { type, id, sid: this.shadow.count++, len: P.CAR_TYPES[type].len, w: P.CAR_TYPES[type].w };
  }
  setCarMatrix(c, x, z, hx, hz) {
    const M = this.meshes[c.type];
    const m = new THREE.Matrix4().makeRotationY(Math.atan2(-hz, hx)).setPosition(x, 0, z);
    for (const k of ['paint', 'trim', 'head', 'tail']) M[k].setMatrixAt(c.id, m);
    m.scale(new THREE.Vector3(c.len * 1.15, 1, c.w * 1.5)).setPosition(x, 0.015, z);
    this.shadow.setMatrixAt(c.sid, m);
  }

  // ------------------------------------------------------------ 駐車中の車
  spawnParked() {
    const r = this.rng;
    for (let j = 0; j < L.NJ; j++) {
      const Z = stZ(j), dir = stDir(j);
      for (let i = -1; i < L.NI; i++) {
        const b = blockRect(i, 0);
        for (const side of [-1, 1]) {
          let x = b.x0 + 6 + r() * 4;
          while (x < b.x1 - 6) {
            const type = r() < 0.08 ? 'van' : r() < 0.25 ? 'suv' : r() < 0.06 ? 'taxi' : 'sedan';
            const len = P.CAR_TYPES[type].len;
            if (x + len > b.x1 - 4) break;
            if (r() < 0.82) {
              const c = this.newCar(type, P.CAR_TYPES[type].color || PAINT[Math.floor(r() * PAINT.length)]);
              if (!c) return;
              this.setCarMatrix(c, x + len / 2, Z + side * 4.85, dir, 0);
              this.parked.push(c);
            }
            x += len + 1.2 + r() * 2.5;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ 走る車
  spawn(anywhere) {
    const r = this.rng;
    for (let tries = 0; tries < 20; tries++) {
      const lane = this.lanes[Math.floor(r() * this.lanes.length)];
      let type = TYPES[Math.floor(r() * TYPES.length)];
      if (type === 'bus' && lane.axis === 'st') type = 'sedan';
      const len = P.CAR_TYPES[type].len;
      const [a, b] = lane.range;
      const s = anywhere ? a + 30 + r() * (b - a - 60) : lane.dir > 0 ? a + 5 : b - 5;
      if (lane.cars.some((c) => Math.abs(c.s - s) < (c.len + len) / 2 + 6)) continue;
      // 交差点の中には置かない
      if (anywhere && lane.cross.some((x) => Math.abs(x.c - s) < lane.half + 2)) continue;
      const color = P.CAR_TYPES[type].color || PAINT[Math.floor(r() * PAINT.length)];
      const c = this.newCar(type, color);
      if (!c) return null;
      Object.assign(c, { lane, s, v: 6 + r() * 4, v0: (type === 'bus' || type === 'truck' ? 9 : 11) + r() * 3.5, turn: null, brake: false });
      lane.cars.push(c);
      this.cars.push(c);
      return c;
    }
    return null;
  }
  respawn(c) {
    const r = this.rng;
    for (let tries = 0; tries < 12; tries++) {
      const lane = this.lanes[Math.floor(r() * this.lanes.length)];
      if (c.type === 'bus' && lane.axis === 'st') continue;
      const [a, b] = lane.range;
      const s = lane.dir > 0 ? a + 3 : b - 3;
      if (lane.cars.some((o) => Math.abs(o.s - s) < 18)) continue;
      c.lane = lane; c.s = s; c.v = 8; c.turn = null;
      lane.cars.push(c);
      return;
    }
    c.lane = null; // 入れる場所が空くまで待つ
  }

  carPos(c) {
    if (c.turn) return c.turn.pos;
    const l = c.lane;
    return l.axis === 'av' ? { x: l.pos, z: c.s, hx: 0, hz: l.dir } : { x: c.s, z: l.pos, hx: l.dir, hz: 0 };
  }

  update(dt, t) {
    this.t = t;
    // 車線ごとに前から順に並べる
    for (const l of this.lanes) l.cars.sort((a, b) => l.dir * (b.s - a.s));
    for (const c of this.cars) {
      if (!c.lane && !c.turn) { this.respawn(c); if (!c.lane) continue; }
      if (c.turn) { this.stepTurn(c, dt); continue; }
      const l = c.lane, dir = l.dir;
      const front = c.s + dir * c.len / 2;
      // 前の車
      const k = l.cars.indexOf(c);
      let gap = 1e9, vL = 0;
      if (k > 0) { const o = l.cars[k - 1]; gap = dir * (o.s - c.s) - (o.len + c.len) / 2; vL = o.v; }
      // 曲がっている途中の車が同じ車線に入ってくる
      for (const o of this.cars) if (o.turn && o.turn.to === l) {
        const g = dir * (o.turn.exitS - c.s) - (o.len + c.len) / 2 - o.turn.remain;
        if (g > -2 && g < gap) { gap = Math.max(g, 0.1); vL = o.v; }
      }
      // 次の交差点
      let next = null, dStop = 1e9;
      for (const x of l.cross) {
        const stop = x.c - dir * (l.half + 0.6);
        const d = dir * (stop - front);
        if (d > -0.8 && d < dStop) { dStop = d; next = x; }
      }
      if (next && dStop < 45) {
        const light = signalState(next.i, next.j, t)[l.axis];
        const canStop = dStop > c.v * c.v / (2 * 3.5) + 0.5;
        if (light === 'R' || (light === 'Y' && canStop)) {
          if (dStop < gap) { gap = Math.max(dStop, 0.05); vL = 0; }
        } else if (dStop < 1.2 && !c.decided) {
          c.decided = next;
          const turn = this.chooseTurn(c, next);
          if (turn) { this.startTurn(c, next, turn); continue; }
        }
      }
      if (c.decided && (!next || next !== c.decided)) c.decided = null;
      // IDM (前の車との間合いで加速・減速)
      const A = 1.6, B = 3.2, s0 = 2.2, T = 1.15;
      const ss = s0 + Math.max(0, c.v * T + c.v * (c.v - vL) / (2 * Math.sqrt(A * B)));
      let acc = A * (1 - (c.v / c.v0) ** 4 - (ss / Math.max(gap, 0.1)) ** 2);
      acc = Math.max(acc, -8);
      c.v = Math.max(0, c.v + acc * dt);
      c.brake = acc < -0.8 || c.v < 0.3;
      c.s += dir * c.v * dt;
      // 道の端まで来たら別の入口から入り直す
      if (c.s < l.range[0] || c.s > l.range[1]) {
        l.cars.splice(l.cars.indexOf(c), 1);
        this.respawn(c);
      }
    }
    // 形を動かす
    for (const c of this.cars) {
      if (!c.lane && !c.turn) { this.setCarMatrix(c, 0, -9999, 1, 0); continue; }
      const p = this.carPos(c);
      this.setCarMatrix(c, p.x, p.z, p.hx, p.hz);
      const M = this.meshes[c.type];
      M.tail.setColorAt(c.id, c.brake ? BRAKE : this.night > 0.3 ? TAIL_N : TAIL);
    }
    for (const M of Object.values(this.meshes)) {
      for (const k of ['paint', 'trim', 'head', 'tail']) M[k].instanceMatrix.needsUpdate = true;
      M.tail.instanceColor.needsUpdate = true;
    }
    this.shadow.instanceMatrix.needsUpdate = true;
    this.headMat.color.setScalar(0.45 + (this.night || 0) * 3);
    this.updatePeople(dt, t);
  }

  chooseTurn(c, x) {
    const r = this.rng(), l = c.lane;
    if (c.type === 'bus' || c.type === 'truck') return null;
    if (l.axis === 'av') {
      // 大通りから通りへ: 通りの向きに合わせて右か左。左折は対向車があるので内側の車線だけ・少なめ
      const sd = stDir(x.j);
      // 北行き (dir -1) の右は +x、南行き (dir +1) の右は -x
      const rightDir = l.dir < 0 ? 1 : -1;
      if (l.outer && sd === rightDir && r < 0.25) return 'right';
      if (!l.outer && sd === -rightDir && r < 0.12) return 'left';
    } else {
      // 通りから大通りへ。向きの右側の車線なら右折、左側なら左折
      if (r < 0.28) return l.outer ? 'right' : 'left';
    }
    return null;
  }

  startTurn(c, x, kind) {
    const l = c.lane;
    let to;
    if (l.axis === 'av') {
      to = this.laneAt('st', x.j, stDir(x.j), kind === 'right');
    } else {
      // 東行き (dir +1) の右は +z = 南行き (dir +1)、左は北行き
      const avDir = (kind === 'right' ? 1 : -1) * l.dir;
      to = this.laneAt('av', x.i, avDir, kind === 'right');
    }
    if (!to) return;
    // 曲がった先の入口
    const exitS = (l.axis === 'av' ? avX(x.i) : stZ(x.j)) + to.dir * (to.half + 0.5);
    // 曲がった先の入口の前後に車がいたら曲がらない
    if (to.cars.some((o) => to.dir * (o.s - exitS) > -9 && to.dir * (o.s - exitS) < 10)) { c.decided = x; return; }
    const p0 = this.carPos(c);
    const P0 = new THREE.Vector3(p0.x, 0, p0.z);
    const P2 = to.axis === 'av' ? new THREE.Vector3(to.pos, 0, exitS) : new THREE.Vector3(exitS, 0, to.pos);
    const P1 = l.axis === 'av' ? new THREE.Vector3(l.pos, 0, to.pos) : new THREE.Vector3(to.pos, 0, l.pos);
    const curve = new THREE.QuadraticBezierCurve3(P0, P1, P2);
    l.cars.splice(l.cars.indexOf(c), 1);
    c.turn = { curve, len: curve.getLength(), u: 0, to, exitS, remain: 0, pos: { x: P0.x, z: P0.z, hx: p0.hx, hz: p0.hz } };
    c.lane = null;
  }
  stepTurn(c, dt) {
    const T = c.turn;
    c.v = Math.min(c.v + 1.2 * dt, 6.5);
    T.u += (c.v * dt) / T.len;
    if (T.u >= 1) {
      c.lane = T.to; c.s = T.exitS; c.turn = null; c.decided = null;
      T.to.cars.push(c);
      return;
    }
    T.remain = (1 - T.u) * T.len;
    const p = T.curve.getPointAt(T.u), d = T.curve.getTangentAt(T.u);
    T.pos = { x: p.x, z: p.z, hx: d.x, hz: d.z };
  }

  // ------------------------------------------------------------ 歩行者
  makePeople(n) {
    const g = P.personGeometries();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const mk = (geo, cnt) => {
      const m = new THREE.InstancedMesh(geo, mat, cnt);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(m);
      return m;
    };
    this.pm = { torso: mk(g.torso, n), head: mk(g.head, n), leg: mk(g.leg, n * 2), arm: mk(g.arm, n * 2) };
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const i = Math.floor(r() * L.NI) - (r() < 0.15 ? 1 : 0), j = Math.floor(r() * L.NJ) - (r() < 0.15 ? 1 : 0);
      const p = {
        i, j, off: 0.9 + r() * 1.3, cw: r() < 0.5 ? 1 : -1, u: r(), speed: 1.15 + r() * 0.5, phase: r() * 6.28,
        h: 0.92 + r() * 0.16, state: 'walk', x: 0, z: 0, hx: 1, hz: 0,
      };
      const shirt = new THREE.Color(CLOTH[Math.floor(r() * CLOTH.length)]), pants = new THREE.Color(CLOTH[Math.floor(r() * CLOTH.length)]).multiplyScalar(0.7);
      this.pm.torso.setColorAt(k, shirt);
      this.pm.head.setColorAt(k, new THREE.Color(SKIN[Math.floor(r() * SKIN.length)]));
      this.pm.leg.setColorAt(k * 2, pants); this.pm.leg.setColorAt(k * 2 + 1, pants);
      this.pm.arm.setColorAt(k * 2, shirt); this.pm.arm.setColorAt(k * 2 + 1, shirt);
      this.peds.push(p);
    }
  }
  // 区画のまわりの歩道の四角 (角 0 = 北西、時計回り)
  pedRect(p) {
    const b = blockRect(p.i, p.j), o = p.off;
    return [[b.x0 - o, b.z0 - o], [b.x1 + o, b.z0 - o], [b.x1 + o, b.z1 + o], [b.x0 - o, b.z1 + o]];
  }
  updatePeople(dt, t) {
    const r = this.rng;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    this.peds.forEach((p, k) => {
      let moving = true;
      if (p.state === 'walk') {
        const R = this.pedRect(p);
        const lens = [R[1][0] - R[0][0], R[2][1] - R[1][1], R[2][0] - R[3][0], R[3][1] - R[0][1]];
        const per = lens.reduce((a, b) => a + b, 0);
        const before = p.u * per;
        p.u = (p.u + (p.cw * p.speed * dt) / per + 1) % 1;
        let d = p.u * per;
        // 角を通り過ぎたら、ときどき道を渡る
        let acc = 0;
        for (let c = 0; c < 4; c++) {
          const cornerD = acc + lens[c];
          const corner = (c + 1) % 4;
          const passed = p.cw > 0 ? before < cornerD && d >= cornerD : before > cornerD && d <= cornerD;
          if (passed && r() < 0.35) { this.startCross(p, corner, R); break; }
          acc += lens[c];
        }
        if (p.state === 'walk') {
          d = p.u * per;
          let c = 0;
          while (c < 3 && d > lens[c]) { d -= lens[c]; c++; }
          const a = R[c], b = R[(c + 1) % 4];
          const L2 = lens[c] || 1;
          p.x = a[0] + (b[0] - a[0]) * (d / L2); p.z = a[1] + (b[1] - a[1]) * (d / L2);
          const sgn = p.cw;
          p.hx = Math.sign(b[0] - a[0]) * sgn; p.hz = Math.sign(b[1] - a[1]) * sgn;
        }
      }
      if (p.state === 'wait' || p.state === 'cross') {
        const st = signalState(p.ci, p.cj, t);
        // 大通りを渡るのは通りが青のとき、通りを渡るのは大通りが青のとき
        const ok = p.axis === 'av' ? st.st === 'G' : st.av === 'G';
        if (p.state === 'wait') { moving = false; if (ok) p.state = 'cross'; }
        if (p.state === 'cross') {
          const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz);
          if (dd < 0.1) { Object.assign(p, p.after); p.state = 'walk'; } else {
            const sp = Math.min(dd, p.speed * 1.15 * dt);
            p.x += (dx / dd) * sp; p.z += (dz / dd) * sp; p.hx = dx / dd; p.hz = dz / dd;
          }
        }
      }
      if (moving) p.phase += dt * p.speed * 5.2;
      const sw = moving ? Math.sin(p.phase) : 0;
      const ry = Math.atan2(p.hx, p.hz);
      q.setFromEuler(e.set(0, ry, 0));
      s.set(p.h, p.h, p.h);
      const bob = moving ? Math.abs(Math.cos(p.phase)) * 0.03 : 0;
      v.set(p.x, bob, p.z);
      m.compose(v, q, s);
      this.pm.torso.setMatrixAt(k, m);
      this.pm.head.setMatrixAt(k, m);
      // 脚と腕を振る
      for (const side of [-1, 1]) {
        const lx = side * 0.1 * p.h, hip = 0.9 * p.h;
        const ox = Math.cos(ry) * lx, oz = -Math.sin(ry) * lx;
        v.set(p.x + ox, hip + bob, p.z + oz);
        q.setFromEuler(e.set(sw * 0.45 * side, ry, 0, 'YXZ'));
        m.compose(v, q, s);
        this.pm.leg.setMatrixAt(k * 2 + (side > 0 ? 1 : 0), m);
        const ax = side * 0.25 * p.h;
        v.set(p.x + Math.cos(ry) * ax, 1.48 * p.h + bob, p.z - Math.sin(ry) * ax);
        q.setFromEuler(e.set(-sw * 0.4 * side, ry, side * 0.06, 'YXZ'));
        m.compose(v, q, s);
        this.pm.arm.setMatrixAt(k * 2 + (side > 0 ? 1 : 0), m);
      }
    });
    for (const k of ['torso', 'head', 'leg', 'arm']) this.pm[k].instanceMatrix.needsUpdate = true;
  }
  startCross(p, corner, R) {
    // corner: 0 北西 1 北東 2 南東 3 南西。渡る先は、横 (大通りの向こう) か縦 (通りの向こう)
    const [cx, cz] = R[corner];
    const east = corner === 1 || corner === 2, south = corner === 2 || corner === 3;
    const goAv = this.rng() < 0.5;
    let ni = p.i, nj = p.j, axis, ci, cj;
    if (goAv) { ni += east ? 1 : -1; axis = 'av'; ci = east ? p.i + 1 : p.i; cj = south ? p.j + 1 : p.j; } else { nj += south ? 1 : -1; axis = 'st'; ci = east ? p.i + 1 : p.i; cj = south ? p.j + 1 : p.j; }
    // 街の中の道だけ渡る
    if (ni < -1 || nj < -1 || ni >= L.NI || nj >= L.NJ || ci < 0 || cj < 0 || ci >= L.NI || cj >= L.NJ) return;
    const nb = blockRect(ni, nj), o = p.off;
    let tx = cx, tz = cz, nc;
    if (goAv) { tx = east ? nb.x0 - o : nb.x1 + o; nc = east ? (south ? 3 : 0) : (south ? 2 : 1); } else { tz = south ? nb.z0 - o : nb.z1 + o; nc = south ? (east ? 1 : 0) : (east ? 2 : 3); }
    // 渡った先の区画で、その角から歩き出す
    const b2 = { i: ni, j: nj, off: o };
    const R2 = this.pedRect(b2);
    const lens = [R2[1][0] - R2[0][0], R2[2][1] - R2[1][1], R2[2][0] - R2[3][0], R2[3][1] - R2[0][1]];
    const per = lens.reduce((a, b) => a + b, 0);
    let acc = 0; for (let c = 0; c < nc; c++) acc += lens[c];
    p.state = 'wait'; p.axis = axis; p.ci = ci; p.cj = cj;
    p.x = cx; p.z = cz; p.tx = tx; p.tz = tz;
    p.after = { i: ni, j: nj, u: acc / per };
  }

  followTarget() {
    // 追いかける車 (曲がらない大型以外で、いま走っているもの)
    if (!this.followed || (!this.followed.lane && !this.followed.turn)) {
      const cand = this.cars.filter((c) => c.lane && c.type !== 'bus');
      this.followed = cand[Math.floor(this.rng() * cand.length)];
    }
    return this.followed;
  }
  nextFollow() { this.followed = null; return this.followTarget(); }
}
const BRAKE = new THREE.Color(3, 0.1, 0.05), TAIL = new THREE.Color(0.45, 0.03, 0.02), TAIL_N = new THREE.Color(1.6, 0.06, 0.03);
