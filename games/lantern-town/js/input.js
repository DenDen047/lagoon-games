// キーボード・マウス・タッチの入力をまとめて、「何をしたいか」(いどう・こうげき など) に直す。
import { cam } from './engine.js';

const held = new Set();
const hit = new Set();           // このフレームで押された動作
export const I = {
  move: { x: 0, z: 0, mag: 0 },  // 画面の向き基準。z<0 が前
  touch: false,
  locked: false,
  pressed(a) { return hit.has(a); },
  held(a) { return held.has(a); },
  endFrame() { hit.clear(); },
  sens: 1,
};

const KEYMAP = {
  KeyE: 'interact', Enter: 'interact', Space: 'dodge', KeyQ: 'skill', Digit1: 'eat', KeyF: 'eat',
  Escape: 'menu', KeyB: 'deco', KeyR: 'rotate', KeyX: 'store', KeyJ: 'attack', KeyK: 'block', KeyM: 'mute',
  ShiftLeft: 'block', ShiftRight: 'block', Tab: 'quests',
};
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const moveKeys = new Set();
let stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
let lookTouch = { id: null, x: 0, y: 0 };

function press(a) { if (!held.has(a)) hit.add(a); held.add(a); }
function release(a) { held.delete(a); }

export function bindInput(canvas, opts) {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    if (MOVE[e.code]) moveKeys.add(e.code);
    const a = KEYMAP[e.code];
    if (a && !e.repeat) press(a);
  });
  window.addEventListener('keyup', (e) => {
    moveKeys.delete(e.code);
    const a = KEYMAP[e.code];
    if (a) release(a);
  });
  window.addEventListener('blur', () => { moveKeys.clear(); held.clear(); });

  // マウス: クリックで視点を固定 (ポインターロック)、固定中は 左=こうげき 右=ガード
  canvas.addEventListener('mousedown', (e) => {
    if (I.touch) return;
    if (!I.locked) { if (opts.canLock()) canvas.requestPointerLock?.(); return; }
    if (e.button === 0) press('attack');
    if (e.button === 2) press('block');
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) release('attack');
    if (e.button === 2) release('block');
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { I.locked = document.pointerLockElement === canvas; opts.onLock?.(I.locked); });
  window.addEventListener('mousemove', (e) => {
    if (!I.locked) return;
    cam.yaw -= e.movementX * 0.0032 * I.sens;
    cam.pitch = Math.min(1.25, Math.max(0.05, cam.pitch + e.movementY * 0.0026 * I.sens));
  });
  window.addEventListener('wheel', (e) => { cam.dist = Math.min(18, Math.max(6, cam.dist + Math.sign(e.deltaY) * 0.8)); }, { passive: true });

  // タッチ: 左半分=スティック、右半分=視点、ボタンは data-act を持つ要素
  const knob = document.querySelector('#stick i');
  const stickEl = document.getElementById('stick');
  canvas.addEventListener('touchstart', (e) => {
    I.touch = true;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && stick.id === null) {
        stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
        stickEl.style.left = t.clientX - 60 + 'px';
        stickEl.style.top = t.clientY - 60 + 'px';
        stickEl.classList.add('on');
      } else if (lookTouch.id === null) {
        lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) {
        let dx = t.clientX - stick.ox, dy = t.clientY - stick.oy;
        const d = Math.hypot(dx, dy), max = 55;
        if (d > max) { dx *= max / d; dy *= max / d; }
        stick.x = dx / max; stick.y = dy / max;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === lookTouch.id) {
        cam.yaw -= (t.clientX - lookTouch.x) * 0.006;
        cam.pitch = Math.min(1.25, Math.max(0.05, cam.pitch + (t.clientY - lookTouch.y) * 0.004));
        lookTouch.x = t.clientX; lookTouch.y = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick = { id: null, x: 0, y: 0 }; knob.style.transform = ''; stickEl.classList.remove('on'); }
      if (t.identifier === lookTouch.id) lookTouch.id = null;
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);
  for (const b of document.querySelectorAll('[data-act]')) {
    const a = b.dataset.act;
    b.addEventListener('touchstart', (e) => { I.touch = true; press(a); b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    b.addEventListener('touchend', (e) => { release(a); b.classList.remove('down'); e.preventDefault(); });
    b.addEventListener('mousedown', (e) => { press(a); e.stopPropagation(); });
    b.addEventListener('mouseup', () => release(a));
  }
}

export function updateInput() {
  let x = 0, z = 0;
  for (const k of moveKeys) { x += MOVE[k][0]; z += MOVE[k][1]; }
  if (stick.id !== null) { x = stick.x; z = stick.y; }
  const m = Math.hypot(x, z);
  if (m > 1) { x /= m; z /= m; }
  I.move.x = x; I.move.z = z; I.move.mag = Math.min(1, m);
}
