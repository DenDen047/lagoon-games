/* 描画: チャンクのメッシュ化と WebGL での表示 */
'use strict';
(function () {
  const CS = window.CS;
  const { B, OPAQUE, RENDER, EMIT, BLOCKS } = CS;

  const WORLD_VS = `
attribute vec3 aP; attribute vec2 aT; attribute vec3 aL;
uniform mat4 uM; uniform vec3 uC; uniform float uDay; uniform vec2 uFog;
varying vec2 vT; varying vec3 vCol; varying float vF;
void main(){
  gl_Position = uM * vec4(aP, 1.0);
  vT = aT;
  float s = aL.x < 0.5 ? 0.0 : pow(0.8, 15.0 - aL.x) * uDay;
  float b = aL.y < 0.5 ? 0.0 : pow(0.8, 15.0 - aL.y);
  vec3 c = max(vec3(s), vec3(b, b * 0.86, b * 0.68));
  vCol = max(c, vec3(0.05)) * aL.z;
  vF = clamp((length(aP - uC) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
}`;
  const ENT_VS = `
attribute vec3 aP; attribute vec2 aT; attribute vec4 aC;
uniform mat4 uM; uniform vec3 uC; uniform vec2 uFog;
varying vec2 vT; varying vec3 vCol; varying float vF;
void main(){
  gl_Position = uM * vec4(aP, 1.0);
  vT = aT; vCol = aC.rgb * aC.a;
  vF = clamp((length(aP - uC) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
}`;
  const FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec3 uFogC; uniform float uCut; uniform float uAlpha;
varying vec2 vT; varying vec3 vCol; varying float vF;
void main(){
  vec4 t = texture2D(uTex, vT);
  if (t.a < uCut) discard;
  gl_FragColor = vec4(mix(t.rgb * vCol, uFogC, vF), t.a * uAlpha);
}`;

  function compile(gl, vs, fs, attrs) {
    const p = gl.createProgram();
    for (const [src, type] of [[vs, gl.VERTEX_SHADER], [fs, gl.FRAGMENT_SHADER]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function texture(gl, canvas) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // 伸びる Float32 配列
  class FBuf {
    constructor(n) { this.a = new Float32Array(n || 4096); this.n = 0; }
    need(k) { if (this.n + k > this.a.length) { const b = new Float32Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } }
    view() { return this.a.subarray(0, this.n); }
  }

  // ================= チャンクのメッシュ =================
  // 頂点: x y z u v 空の光 ブロックの光 かげ
  const FACES = [
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], sh: 0.8, t: 'side' },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], sh: 0.8, t: 'side' },
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], sh: 0.64, t: 'side' },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], sh: 0.64, t: 'side' },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], sh: 1, t: 'top' },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], sh: 0.5, t: 'bottom' },
  ];
  const AO = [0.45, 0.65, 0.83, 1];
  const EPS = 0.0008, TS = 1 / 16;
  const LEAFY = new Set([B.leaves, B.heroLeaves, B.cycadLeaves]);
  const TRANS = new Set(['liquid', 'glassy', 'portal']);

  function buildChunk(w, cx, cz) {
    const op = new FBuf(16384), tr = new FBuf(1024);
    const W = w.W, D = w.D, H = w.H, wb = w.b, sky = w.sky, bl = w.bl;
    const x0 = cx * 16, z0 = cz * 16;
    const get = (x, y, z) => (y < 0 ? B.bedrock : y >= H || x < 0 || z < 0 || x >= W || z >= D ? 0 : wb[(y * D + z) * W + x]);
    const lightAt = (x, y, z) => {
      if (y >= H || x < 0 || z < 0 || x >= W || z >= D) return [15, 0];
      if (y < 0) return [0, 0];
      const i = (y * D + z) * W + x; return [sky[i], bl[i]];
    };
    const occ = (x, y, z) => OPAQUE[get(x, y, z)];
    const quad = (buf, P, U, L, ao) => {
      buf.need(48);
      const a = buf.a;
      const order = ao && ao[0] + ao[2] < ao[1] + ao[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      for (const k of order) {
        let o = buf.n;
        a[o++] = P[k][0]; a[o++] = P[k][1]; a[o++] = P[k][2];
        a[o++] = U[k][0]; a[o++] = U[k][1];
        a[o++] = L[0]; a[o++] = L[1]; a[o++] = L[2] * (ao ? AO[ao[k]] : 1);
        buf.n = o;
      }
    };
    const tileUV = (t, ua, va, ub, vb) => {
      const u0 = (t % 16) * TS, v0 = (t >> 4) * TS;
      ua = ua === undefined ? 0 : ua; va = va === undefined ? 0 : va; ub = ub === undefined ? 1 : ub; vb = vb === undefined ? 1 : vb;
      const A = u0 + ua * TS + EPS, Bu = u0 + ub * TS - EPS, C = v0 + va * TS + EPS, Dv = v0 + vb * TS - EPS;
      return [[A, Dv], [Bu, Dv], [Bu, C], [A, C]];
    };
    for (let y = 0; y < H; y++) for (let z = z0; z < z0 + 16; z++) for (let x = x0; x < x0 + 16; x++) {
      const id = wb[(y * D + z) * W + x];
      if (!id) continue;
      const rend = RENDER[id], def = BLOCKS[id];
      if (rend === 'cross') {
        const [s, b] = lightAt(x, y, z);
        const U = tileUV(def.tx.side);
        const L = [s, b, 0.92];
        const i = 0.15;
        quad(op, [[x + i, y, z + i], [x + 1 - i, y, z + 1 - i], [x + 1 - i, y + 1, z + 1 - i], [x + i, y + 1, z + i]], U, L);
        quad(op, [[x + 1 - i, y, z + i], [x + i, y, z + 1 - i], [x + i, y + 1, z + 1 - i], [x + 1 - i, y + 1, z + i]], U, L);
        continue;
      }
      if (rend === 'torch') {
        const L = [lightAt(x, y, z)[0], 15, 1];
        const a = x + 7 / 16, b2 = x + 9 / 16, c = z + 7 / 16, d = z + 9 / 16, top = y + 10 / 16;
        const US = tileUV(def.tx.side, 7 / 16, 6 / 16, 9 / 16, 1), UT = tileUV(def.tx.side, 7 / 16, 6 / 16, 9 / 16, 8 / 16);
        quad(op, [[a, y, d], [b2, y, d], [b2, top, d], [a, top, d]], US, L);
        quad(op, [[b2, y, c], [a, y, c], [a, top, c], [b2, top, c]], US, L);
        quad(op, [[b2, y, d], [b2, y, c], [b2, top, c], [b2, top, d]], US, L);
        quad(op, [[a, y, c], [a, y, d], [a, top, d], [a, top, c]], US, L);
        quad(op, [[a, top, d], [b2, top, d], [b2, top, c], [a, top, c]], UT, L);
        continue;
      }
      const isLiquid = rend === 'liquid';
      const buf = TRANS.has(rend) ? tr : op;
      const useAO = rend === 'cube' || rend === 'cutout';
      const topH = isLiquid && get(x, y + 1, z) !== id ? 0.875 : 1;
      const emit = EMIT[id];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], n = F.n;
        const nx = x + n[0], ny = y + n[1], nz = z + n[2];
        const nid = get(nx, ny, nz);
        if (OPAQUE[nid]) continue;
        if (nid === id && !LEAFY.has(id)) continue;
        if (isLiquid && nid !== 0 && !TRANS.has(RENDER[nid]) && RENDER[nid] !== 'cross' && RENDER[nid] !== 'torch' && f !== 4) continue;
        const [s, b] = lightAt(nx, ny, nz);
        const L = [s, Math.max(b, emit), F.sh];
        const P = [], ao = useAO ? [] : null;
        for (let k = 0; k < 4; k++) {
          const c = F.c[k];
          P.push([x + c[0], y + (c[1] ? topH : 0), z + c[2]]);
          if (ao) {
            // 角のまわりの3ブロックで暗さを決める
            const d = [c[0] * 2 - 1, c[1] * 2 - 1, c[2] * 2 - 1];
            const ax = [0, 1, 2].filter((q) => n[q] === 0);
            const o1 = [nx, ny, nz], o2 = [nx, ny, nz], o3 = [nx, ny, nz];
            o1[ax[0]] += d[ax[0]]; o2[ax[1]] += d[ax[1]]; o3[ax[0]] += d[ax[0]]; o3[ax[1]] += d[ax[1]];
            const s1 = occ(o1[0], o1[1], o1[2]), s2 = occ(o2[0], o2[1], o2[2]), s3 = occ(o3[0], o3[1], o3[2]);
            ao.push(s1 && s2 ? 0 : 3 - s1 - s2 - s3);
          }
        }
        const t = def.tx[F.t];
        const U = tileUV(t, 0, F.t === 'side' ? 1 - topH : 0, 1, 1);
        quad(buf, P, U, L, ao);
      }
    }
    return { op: op.view(), tr: tr.view() };
  }

  // ================= 箱モデル用の行列 (4×4, 列優先) =================
  const X = {
    id() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    t(m, x, y, z) { return CS.mat4.mul(m, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1])); },
    s(m, k, ky, kz) { return CS.mat4.mul(m, new Float32Array([k, 0, 0, 0, 0, ky === undefined ? k : ky, 0, 0, 0, 0, kz === undefined ? k : kz, 0, 0, 0, 0, 1])); },
    rx(m, a) { const c = Math.cos(a), s = Math.sin(a); return CS.mat4.mul(m, new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1])); },
    ry(m, a) { const c = Math.cos(a), s = Math.sin(a); return CS.mat4.mul(m, new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1])); },
    rz(m, a) { const c = Math.cos(a), s = Math.sin(a); return CS.mat4.mul(m, new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])); },
    ap(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
  };
  // エンティティの向き (yaw) を行列にする。モデルの +Z が前。
  X.entity = function (x, y, z, yaw, scale) {
    let m = X.t(X.id(), x, y, z);
    m = X.ry(m, Math.PI - yaw);
    return X.s(m, scale / 16);
  };

  // 色つきの箱・テクスチャつきの箱・板 (ビルボード) をためる
  class Batch {
    constructor() { this.b = new FBuf(1 << 16); }
    clear() { this.b.n = 0; }
    v(p, u, v, c, l) {
      const a = this.b.a; let o = this.b.n;
      a[o++] = p[0]; a[o++] = p[1]; a[o++] = p[2]; a[o++] = u; a[o++] = v; a[o++] = c[0]; a[o++] = c[1]; a[o++] = c[2]; a[o++] = l;
      this.b.n = o;
    }
    quad(P, UV, c, l) {
      this.b.need(54);
      for (const k of [0, 1, 2, 0, 2, 3]) this.v(P[k], UV[k][0], UV[k][1], c, l);
    }
    // m: 行列, box: [x0,y0,z0,x1,y1,z1], col: [r,g,b] (0..1), uv: 面ごとの [u0,v0,u1,v1] か null
    box(m, bx, col, light, uv, white) {
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const P = F.c.map((c) => X.ap(m, c[0] ? bx[3] : bx[0], c[1] ? bx[4] : bx[1], c[2] ? bx[5] : bx[2]));
        let UV;
        if (uv) { const r = uv[f]; UV = [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]]; }
        else UV = [white, white, white, white];
        const sh = F.sh;
        this.quad(P, UV, [col[0] * sh, col[1] * sh, col[2] * sh], light);
      }
    }
  }

  // ================= レンダラー =================
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl');
      if (!gl) throw new Error('WebGL が使えません');
      this.gl = gl;
      this.pw = compile(gl, WORLD_VS, FS, ['aP', 'aT', 'aL']);
      this.pe = compile(gl, ENT_VS, FS, ['aP', 'aT', 'aC']);
      this.texAtlas = texture(gl, CS.ATLAS);
      this.texIcons = texture(gl, CS.ICONS);
      this.texSkin = null;
      this.chunks = new Map();
      this.ebuf = gl.createBuffer();
      this.skinBatch = new Batch();
      this.iconBatch = new Batch();
      this.lineBatch = new Batch();
      this.skyBatch = new Batch();
      this.white = [575.5 / 576, 575.5 / 576];
      this.world = null;
      this.renderDist = 6;
    }
    setSkinAtlas(canvas) {
      const gl = this.gl;
      if (this.texSkin) gl.deleteTexture(this.texSkin);
      this.texSkin = texture(gl, canvas);
    }
    setWorld(w) {
      const gl = this.gl;
      for (const c of this.chunks.values()) { if (c.op) gl.deleteBuffer(c.op); if (c.tr) gl.deleteBuffer(c.tr); }
      this.chunks.clear();
      this.world = w;
    }
    upload(cx, cz) {
      const gl = this.gl, w = this.world;
      const key = cz * w.CX + cx;
      const m = buildChunk(w, cx, cz);
      let c = this.chunks.get(key);
      if (!c) { c = { cx, cz, op: null, tr: null, opN: 0, trN: 0 }; this.chunks.set(key, c); }
      for (const k of ['op', 'tr']) {
        const data = m[k];
        if (!c[k]) c[k] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, c[k]);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        c[k + 'N'] = data.length / 8;
      }
      w.dirty[key] = 0;
    }
    // 近いチャンクから順に、時間の許すかぎりメッシュを作る
    updateChunks(px, pz, budgetMs) {
      const w = this.world; if (!w) return 0;
      const t0 = performance.now();
      const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16), R = this.renderDist;
      const list = [];
      for (let cz = Math.max(0, pcz - R); cz <= Math.min(w.CZ - 1, pcz + R); cz++) for (let cx = Math.max(0, pcx - R); cx <= Math.min(w.CX - 1, pcx + R); cx++) {
        const key = cz * w.CX + cx;
        if (w.dirty[key] || !this.chunks.has(key)) list.push([(cx - pcx) ** 2 + (cz - pcz) ** 2, cx, cz]);
      }
      list.sort((a, b) => a[0] - b[0]);
      let n = 0;
      for (const [, cx, cz] of list) {
        this.upload(cx, cz); n++;
        if (performance.now() - t0 > budgetMs) break;
      }
      return list.length - n;
    }
    resize() {
      const c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(c.clientWidth * dpr), h = Math.floor(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }
    // cam: {x,y,z,yaw,pitch}, env: {day, sky:[r,g,b], fog:[near,far]}
    begin(cam, env) {
      const gl = this.gl;
      this.resize();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(env.sky[0], env.sky[1], env.sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      const cp = Math.cos(cam.pitch);
      const f = [Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp];
      this.fwd = f;
      // 板を描くための右と上
      this.right = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];
      this.up = [-Math.sin(cam.pitch) * Math.sin(cam.yaw), cp, Math.sin(cam.pitch) * Math.cos(cam.yaw)];
      const proj = CS.mat4.perspective((cam.fov || 70) * Math.PI / 180, this.canvas.width / this.canvas.height, 0.06, 400);
      const view = CS.mat4.look(cam.x, cam.y, cam.z, f[0], f[1], f[2]);
      this.mvp = CS.mat4.mul(proj, view);
      this.cam = cam; this.env = env;
      this.skinBatch.clear(); this.iconBatch.clear(); this.lineBatch.clear(); this.skyBatch.clear();
    }
    visible(cx, cz) {
      const m = this.mvp, H = this.world.H;
      let out = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 8; i++) {
        const x = cx * 16 + (i & 1 ? 16 : 0), y = i & 2 ? H : 0, z = cz * 16 + (i & 4 ? 16 : 0);
        const cxp = m[0] * x + m[4] * y + m[8] * z + m[12], cyp = m[1] * x + m[5] * y + m[9] * z + m[13];
        const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (cxp < -cw) out[0]++; if (cxp > cw) out[1]++; if (cyp < -cw) out[2]++; if (cyp > cw) out[3]++; if (cw < 0) out[4]++;
      }
      return !out.some((v) => v === 8);
    }
    setWorldUniforms(prog) {
      const gl = this.gl, u = prog.u, e = this.env, c = this.cam;
      gl.useProgram(prog.p);
      gl.uniformMatrix4fv(u.uM, false, this.mvp);
      gl.uniform3f(u.uC, c.x, c.y, c.z);
      if (u.uDay) gl.uniform1f(u.uDay, e.day);
      gl.uniform2f(u.uFog, e.fog[0], e.fog[1]);
      gl.uniform3f(u.uFogC, e.sky[0], e.sky[1], e.sky[2]);
      gl.uniform1i(u.uTex, 0);
      gl.uniform1f(u.uAlpha, 1);
    }
    drawChunks(pass) {
      const gl = this.gl, w = this.world;
      if (!w) return;
      this.setWorldUniforms(this.pw);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texAtlas);
      gl.uniform1f(this.pw.u.uCut, pass === 'op' ? 0.5 : 0.02);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
      const pcx = Math.floor(this.cam.x / 16), pcz = Math.floor(this.cam.z / 16), R = this.renderDist + 0.5;
      for (const c of this.chunks.values()) {
        const n = c[pass + 'N'];
        if (!n) continue;
        if ((c.cx - pcx) ** 2 + (c.cz - pcz) ** 2 > R * R) continue;
        if (!this.visible(c.cx, c.cz)) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, c[pass]);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20);
        gl.drawArrays(gl.TRIANGLES, 0, n);
      }
    }
    drawBatch(batch, tex, mode, cut) {
      const gl = this.gl, n = batch.b.n / 9;
      if (!n) return;
      this.setWorldUniforms(this.pe);
      gl.uniform1f(this.pe.u.uCut, cut === undefined ? 0.1 : cut);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ebuf);
      gl.bufferData(gl.ARRAY_BUFFER, batch.b.view(), gl.STREAM_DRAW);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
      gl.drawArrays(mode === 'lines' ? gl.LINES : gl.TRIANGLES, 0, n);
    }
    finish() {
      const gl = this.gl;
      if (this.skyBatch.b.n) { gl.disable(gl.DEPTH_TEST); this.drawBatch(this.skyBatch, this.texIcons); gl.enable(gl.DEPTH_TEST); }
      this.drawChunks('op');
      if (this.texSkin) this.drawBatch(this.skinBatch, this.texSkin);
      this.drawBatch(this.iconBatch, this.texIcons);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      this.drawChunks('tr');
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      if (this.lineBatch.b.n) this.drawBatch(this.lineBatch, this.texIcons, 'lines', 0);
    }

    // ---------- 描くものを足す道具 ----------
    // 世界の光からエンティティの明るさを出す
    lightAt(x, y, z) {
      const w = this.world;
      if (!w) return 1;
      x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
      if (!w.inside(x, y, z)) return this.env.day;
      const i = w.idx(x, y, z);
      const s = w.sky[i] ? Math.pow(0.8, 15 - w.sky[i]) * this.env.day : 0;
      const b = w.bl[i] ? Math.pow(0.8, 15 - w.bl[i]) : 0;
      return Math.max(0.12, s, b);
    }
    colorBox(m, bx, col, light) { this.iconBatch.box(m, bx, col, light, null, this.white); }
    skinBox(m, bx, uv, light, tint) { this.skinBatch.box(m, bx, tint || [1, 1, 1], light, uv); }
    billboard(x, y, z, size, iconIdx, col, light, onlyYaw) {
      const r = this.right, u = onlyYaw ? [0, 1, 0] : this.up, s = size / 2;
      const P = [
        [x - r[0] * s - u[0] * s, y - r[1] * s - u[1] * s, z - r[2] * s - u[2] * s],
        [x + r[0] * s - u[0] * s, y + r[1] * s - u[1] * s, z + r[2] * s - u[2] * s],
        [x + r[0] * s + u[0] * s, y + r[1] * s + u[1] * s, z + r[2] * s + u[2] * s],
        [x - r[0] * s + u[0] * s, y - r[1] * s + u[1] * s, z - r[2] * s + u[2] * s],
      ];
      let UV;
      if (iconIdx < 0) UV = [this.white, this.white, this.white, this.white];
      else {
        const u0 = ((iconIdx % 16) * 36 + 2.01) / 576, v0 = ((iconIdx >> 4) * 36 + 2.01) / 576, d = 31.98 / 576;
        UV = [[u0, v0 + d], [u0 + d, v0 + d], [u0 + d, v0], [u0, v0]];
      }
      this.iconBatch.quad(P, UV, col || [1, 1, 1], light === undefined ? 1 : light);
    }
    // 空の太陽や月 (地形より先に、奥行きなしで描く)
    skyQuad(dir, dist, size, col) {
      const c = this.cam, save = this.iconBatch;
      this.iconBatch = this.skyBatch;
      this.billboard(c.x + dir[0] * dist, c.y + dir[1] * dist, c.z + dir[2] * dist, size, -1, col, 1);
      this.iconBatch = save;
    }
    outline(x, y, z, sx, sy, sz, col) {
      const e = 0.003, a = [x - e, y - e, z - e], b = [x + sx + e, y + sy + e, z + sz + e];
      const C = [];
      for (let i = 0; i < 8; i++) C.push([i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]);
      const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      this.lineBatch.b.need(E.length * 18);
      for (const [i, j] of E) { this.lineBatch.v(C[i], this.white[0], this.white[1], col, 1); this.lineBatch.v(C[j], this.white[0], this.white[1], col, 1); }
    }
  }

  CS.Renderer = Renderer;
  CS.X = X;
  CS.buildChunk = buildChunk;
})();
