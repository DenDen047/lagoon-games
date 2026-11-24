// 視点の操作。fly = 空から見下ろす (回す・動かす・近づく)、walk = 人の目の高さで歩く、follow = 車を追う
import * as THREE from 'three';

export class Controls {
  constructor(camera, dom, { lots }) {
    this.camera = camera;
    this.dom = dom;
    this.lots = lots;
    this.mode = 'fly';
    this.target = new THREE.Vector3();
    this.dist = 200; this.yaw = 0; this.pitch = 0.5;
    this.pos = new THREE.Vector3(); // walk の位置
    this.look = { yaw: 0, pitch: 0 };
    this.keys = new Set();
    this.follow = null; // { get(): { pos, dir } }
    this.drag = null;
    this.pointers = new Map();

    addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT') this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => this.onDown(e));
    addEventListener('pointermove', (e) => this.onMove(e));
    addEventListener('pointerup', (e) => this.onUp(e));
    addEventListener('pointercancel', (e) => this.onUp(e));
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.mode === 'fly') this.dist = THREE.MathUtils.clamp(this.dist * Math.exp(e.deltaY * 0.0012), 8, 700);
      if (this.mode === 'follow') this.followDist = THREE.MathUtils.clamp((this.followDist || 12) * Math.exp(e.deltaY * 0.001), 5, 60);
    }, { passive: false });
    dom.addEventListener('click', () => { if (this.mode === 'walk' && !matchMedia('(pointer: coarse)').matches) dom.requestPointerLock?.(); });
    document.addEventListener('mousemove', (e) => {
      if (this.mode === 'walk' && document.pointerLockElement === dom) this.turn(e.movementX, e.movementY);
    });
  }

  setView(eye, target) {
    this.target.copy(target);
    const d = eye.clone().sub(target);
    this.dist = d.length();
    this.yaw = Math.atan2(d.x, d.z);
    this.pitch = Math.asin(d.y / this.dist);
    this.pos.copy(eye);
  }

  setMode(m) {
    if (m === this.mode) return;
    if (m === 'walk') {
      // 今見ているあたりの歩道に降りる
      const p = this.findSidewalk(this.target);
      this.pos.set(p.x, 1.65, p.z);
      this.look.yaw = this.yaw + Math.PI; this.look.pitch = 0.05;
    }
    if (m === 'fly' && this.mode === 'walk') {
      this.target.set(this.pos.x, 0, this.pos.z);
      this.dist = 120; this.pitch = 0.6; this.yaw = this.look.yaw + Math.PI;
    }
    if (m !== 'walk' && document.pointerLockElement) document.exitPointerLock();
    this.mode = m;
  }

  findSidewalk(p) {
    // いちばん近い建物の正面から 1.5 m 外 (歩道の上)
    let best = null, bd = Infinity;
    for (const l of this.lots) {
      const z = l.facing > 0 ? l.z1 + 1.5 : l.z0 - 1.5;
      const x = THREE.MathUtils.clamp(p.x, l.x0, l.x1);
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best || { x: p.x, z: p.z };
  }

  focus() { return this.mode === 'fly' ? this.target : this.camera.position; }

  turn(dx, dy) {
    this.look.yaw -= dx * 0.0025;
    this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * 0.0025, -1.4, 1.4);
  }

  onDown(e) {
    this.dom.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, button: e.button };
    if (this.pointers.size === 2) this.pinch = this.pinchInfo();
  }
  pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  onMove(e) {
    if (!this.drag || !this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.pinch) {
      const p = this.pinchInfo();
      if (this.mode === 'fly') {
        this.dist = THREE.MathUtils.clamp(this.dist * this.pinch.d / Math.max(p.d, 1), 8, 700);
        this.pan(p.x - this.pinch.x, p.y - this.pinch.y);
      }
      this.pinch = p;
      return;
    }
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    if (this.mode === 'fly') {
      if (this.drag.pan) this.pan(dx, dy);
      else { this.yaw -= dx * 0.005; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.05, 1.5); }
    } else if (this.mode === 'walk' && document.pointerLockElement !== this.dom) this.turn(-dx * 1.2, -dy * 1.2);
    else if (this.mode === 'follow') { this.followYaw = (this.followYaw || 0) - dx * 0.005; }
  }
  onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) this.drag = null;
  }
  pan(dx, dy) {
    const s = this.dist * 0.0016;
    // 前 = カメラから注視点へ (水平)、右 = 前を右に 90 度
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    this.target.x += (-rx * dx + fx * dy) * s;
    this.target.z += (-rz * dx + fz * dy) * s;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -400, 400);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -400, 400);
  }

  update(dt) {
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const cam = this.camera;
    if (this.mode === 'fly') {
      if (f || r) {
        const s = this.dist * 0.9 * dt;
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        this.target.x += (fx * f - fz * r) * s;
        this.target.z += (fz * f + fx * r) * s; // 右 = (-fz, fx)
      }
      if (k.has('KeyQ')) this.yaw += dt;
      if (k.has('KeyE')) this.yaw -= dt;
      const cp = Math.cos(this.pitch);
      cam.position.set(
        this.target.x + Math.sin(this.yaw) * cp * this.dist,
        this.target.y + Math.sin(this.pitch) * this.dist,
        this.target.z + Math.cos(this.yaw) * cp * this.dist,
      );
      if (cam.position.y < 2) cam.position.y = 2;
      cam.lookAt(this.target);
    } else if (this.mode === 'walk') {
      const run = k.has('ShiftLeft') || k.has('ShiftRight');
      const sp = (run ? 9 : 3.2) * dt;
      const fx = -Math.sin(this.look.yaw), fz = -Math.cos(this.look.yaw);
      const nx = this.pos.x + (fx * f - fz * r) * sp, nz = this.pos.z + (fz * f + fx * r) * sp;
      if (!this.blocked(nx, this.pos.z)) this.pos.x = nx;
      if (!this.blocked(this.pos.x, nz)) this.pos.z = nz;
      this.pos.y = 1.65 + (f || r ? Math.sin(performance.now() * (run ? 0.018 : 0.011)) * (run ? 0.05 : 0.025) : 0);
      cam.position.copy(this.pos);
      const cp = Math.cos(this.look.pitch);
      cam.lookAt(this.pos.x - Math.sin(this.look.yaw) * cp, this.pos.y + Math.sin(this.look.pitch), this.pos.z - Math.cos(this.look.yaw) * cp);
    } else if (this.mode === 'follow' && this.follow) {
      const { pos, dir } = this.follow.get();
      const yaw = Math.atan2(-dir.x, -dir.z) + (this.followYaw || 0);
      const d = this.followDist || 12;
      const want = new THREE.Vector3(pos.x + Math.sin(yaw) * d, pos.y + 2.2 + d * 0.22, pos.z + Math.cos(yaw) * d);
      cam.position.lerp(want, 1 - Math.exp(-dt * 4));
      cam.lookAt(pos.x, pos.y + 1.4, pos.z);
    }
  }

  blocked(x, z) {
    for (const l of this.lots) if (x > l.x0 + 0.3 && x < l.x1 - 0.3 && z > l.z0 + 0.3 && z < l.z1 - 0.3) return true;
    return false;
  }
}
