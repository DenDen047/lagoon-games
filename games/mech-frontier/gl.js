/* MECH FRONTIER の描画エンジン (WebGL2)。
   軽くする工夫:
   - 箱・球・円柱・円すいを「インスタンス描画」でまとめて描く (描画命令は 1 フレーム 10 回ほど)
   - 動かない街は区画ごとに 1 本のバッファへ焼き、視界の外の区画は描かない
   - 影は 1 枚の深度テクスチャ。質 (2048 / 1024 / なし) を切りかえられる
   - 画面の解像度を フレーム時間に合わせて 自動で上げ下げする */
'use strict';
const R = (() => {
  const MAXI = 8192, FL = 20;
  let gl, cv, prog, shProg, skyProg, U, SU, KU;
  const prims = [];                 // 形ごとの頂点バッファ
  const bat = [[], []];             // [ふつう, 光るもの][形] = {arr,n,buf,vao}
  let glow = 0;
  const stack = new Float32Array(16 * 64); let sp = 0;
  const chunks = [];                // 動かない地形
  let shFbo = null, shTex = null, shN = 0;
  const VP = new Float32Array(16), IVP = new Float32Array(16), LVP = new Float32Array(16);
  const tmpA = new Float32Array(16), tmpB = new Float32Array(16);
  const api = { flash: 0, res: 1, shadowQ: 2, stats: { draws: 0, inst: 0, chunks: 0 }, ok: false };

  // ---------- 行列 ----------
  function persp(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    o.fill(0); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
  }
  function ortho(o, l, r, b, t, n, f) {
    o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1;
  }
  function lookAt(o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
    let zx = ex - cx, zy = ey - cy, zz = ez - cz; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1;
  }
  function mul(o, a, b) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  function invert(o, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return; d = 1 / d;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  }

  // ---------- 行列スタック (モデルを組み立てる) ----------
  function reset() { sp = 0; stack.fill(0, 0, 16); stack[0] = stack[5] = stack[10] = stack[15] = 1; }
  api.push = () => { stack.copyWithin(sp + 16, sp, sp + 16); sp += 16; };
  api.pop = () => { sp -= 16; };
  api.translate = (x, y, z) => {
    const m = stack, o = sp;
    m[o + 12] += m[o] * x + m[o + 4] * y + m[o + 8] * z;
    m[o + 13] += m[o + 1] * x + m[o + 5] * y + m[o + 9] * z;
    m[o + 14] += m[o + 2] * x + m[o + 6] * y + m[o + 10] * z;
  };
  api.scale = (x, y, z) => {
    const m = stack, o = sp;
    m[o] *= x; m[o + 1] *= x; m[o + 2] *= x; m[o + 4] *= y; m[o + 5] *= y; m[o + 6] *= y; m[o + 8] *= z; m[o + 9] *= z; m[o + 10] *= z;
  };
  function rot(a, i, j, sg) {   // 列 i と列 j を回す
    const m = stack, c = Math.cos(a), s = Math.sin(a) * sg;
    for (let k = 0; k < 3; k++) {
      const p = m[sp + i + k], q = m[sp + j + k];
      m[sp + i + k] = p * c + q * s; m[sp + j + k] = q * c - p * s;
    }
  }
  api.rotY = (a) => rot(a, 0, 8, -1);
  api.rotX = (a) => rot(a, 4, 8, 1);
  api.rotZ = (a) => rot(a, 0, 4, 1);
  api.glow = (g) => { glow = g ? 1 : 0; };

  /* 形を 1 こ おく。type: 0 箱 / 1 球 / 2 円柱 / 3 円すい。(x,y,z) は中心、(sx,sy,sz) は大きさ。
     col は 0xRRGGBB、em は 光る強さ (0〜1)。 */
  api.prim = (type, x, y, z, sx, sy, sz, col, em) => {
    const b = bat[glow][type]; if (b.n >= MAXI) return;
    const a = b.arr, o = b.n * FL, m = stack, s = sp;
    a[o] = m[s] * sx; a[o + 1] = m[s + 1] * sx; a[o + 2] = m[s + 2] * sx; a[o + 3] = 0;
    a[o + 4] = m[s + 4] * sy; a[o + 5] = m[s + 5] * sy; a[o + 6] = m[s + 6] * sy; a[o + 7] = 0;
    a[o + 8] = m[s + 8] * sz; a[o + 9] = m[s + 9] * sz; a[o + 10] = m[s + 10] * sz; a[o + 11] = 0;
    a[o + 12] = m[s + 12] + m[s] * x + m[s + 4] * y + m[s + 8] * z;
    a[o + 13] = m[s + 13] + m[s + 1] * x + m[s + 5] * y + m[s + 9] * z;
    a[o + 14] = m[s + 14] + m[s + 2] * x + m[s + 6] * y + m[s + 10] * z; a[o + 15] = 1;
    let r = (col >> 16 & 255) / 255, g = (col >> 8 & 255) / 255, bl = (col & 255) / 255;
    const f = api.flash;
    if (f > 0) { r += (1 - r) * f; g += (1 - g) * f; bl += (1 - bl) * f; }
    a[o + 16] = r; a[o + 17] = g; a[o + 18] = bl; a[o + 19] = em || 0;
    b.n++;
  };

  // ---------- 形の頂点 ----------
  function boxMesh() {
    const v = [], N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const n of N) {
      const u = n[1] ? [1, 0, 0] : [0, 1, 0];
      const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      const c = (a, b) => [n[0] * .5 + u[0] * a + w[0] * b, n[1] * .5 + u[1] * a + w[1] * b, n[2] * .5 + u[2] * a + w[2] * b];
      for (const [a, b] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, -.5], [.5, .5], [-.5, .5]]) v.push(...c(a, b), ...n);
    }
    return v;
  }
  function sphMesh() {
    const v = [], LA = 8, LO = 12;
    const p = (i, j) => { const t = i / LA * Math.PI, f = j / LO * Math.PI * 2; return [Math.sin(t) * Math.cos(f), Math.cos(t), Math.sin(t) * Math.sin(f)]; };
    const put = (q) => v.push(q[0] * .5, q[1] * .5, q[2] * .5, q[0], q[1], q[2]);
    for (let i = 0; i < LA; i++) for (let j = 0; j < LO; j++) {
      const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1);
      put(a); put(b); put(c); put(a); put(c); put(d);
    }
    return v;
  }
  function cylMesh(top) {   // top: 上の半径 (1 = 円柱, 0 = 円すい)
    const v = [], S = 12, sl = (1 - top) * .5;
    for (let j = 0; j < S; j++) {
      const f0 = j / S * Math.PI * 2, f1 = (j + 1) / S * Math.PI * 2;
      const c0 = Math.cos(f0), s0 = Math.sin(f0), c1 = Math.cos(f1), s1 = Math.sin(f1);
      const P = (c, s, y) => { const r = y > 0 ? top * .5 : .5; v.push(c * r, y, s * r, c, sl, s); };
      P(c0, s0, -.5); P(c1, s1, -.5); P(c1, s1, .5); P(c0, s0, -.5); P(c1, s1, .5); P(c0, s0, .5);
      v.push(0, -.5, 0, 0, -1, 0, c0 * .5, -.5, s0 * .5, 0, -1, 0, c1 * .5, -.5, s1 * .5, 0, -1, 0);
      if (top) v.push(0, .5, 0, 0, 1, 0, c0 * .5 * top, .5, s0 * .5 * top, 0, 1, 0, c1 * .5 * top, .5, s1 * .5 * top, 0, 1, 0);
    }
    return v;
  }

  // ---------- シェーダー ----------
  const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNorm; layout(location=2) in vec3 aVCol;
layout(location=3) in float aMat; layout(location=4) in mat4 iM; layout(location=8) in vec4 iCol;
uniform mat4 uVP; out vec3 vW; out vec3 vN; out vec4 vC; out float vMat;
void main(){ vec4 w=iM*vec4(aPos,1.); vW=w.xyz; mat3 m=mat3(iM);
  vec3 s2=vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2])); vN=m*(aNorm/s2);
  vC=vec4(aVCol*iCol.rgb,iCol.a); vMat=aMat; gl_Position=uVP*w; }`;
  const FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vW; in vec3 vN; in vec4 vC; in float vMat;
uniform vec3 uCam,uLight,uLightCol,uAmbS,uAmbG,uFog; uniform mat4 uLVP; uniform sampler2DShadow uSh;
uniform float uNight,uGlow,uShOn,uShTex; out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float shadow(vec3 n){
  if(uShOn<.5) return 1.;
  vec4 p=uLVP*vec4(vW+n*.18,1.); vec3 q=p.xyz*.5+.5;
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.||q.z>1.) return 1.;
  q.z-=.0012; float t=uShTex*.7;
  float s=texture(uSh,q+vec3(-t,-t,0.))+texture(uSh,q+vec3(t,-t,0.))+texture(uSh,q+vec3(-t,t,0.))+texture(uSh,q+vec3(t,t,0.));
  vec2 e=min(q.xy,1.-q.xy); float fade=clamp(min(e.x,e.y)*12.,0.,1.);
  return mix(1.,s*.25,fade);
}
vec3 ground(vec2 p){
  float n1=hash(floor(p*.6)), n2=hash(floor(p/7.))*.45+.27; vec2 q=p+(n2-.5)*5.;
  if(abs(p.x)<203.&&abs(p.y)<203.){
    vec3 c=vec3(.19,.2,.23)+n1*.02; vec2 d=abs(mod(p,56.)-28.);
    if((d.x<.22&&fract(p.y/7.)<.5)||(d.y<.22&&fract(p.x/7.)<.5)) c=vec3(.8,.78,.6);
    return c; }
  if(p.x>226.&&p.x<660.&&abs(p.y)<82.){
    if(abs(p.y)<15.&&p.x>236.&&p.x<650.){ vec3 c=vec3(.16,.17,.19)+n1*.02;
      if(abs(p.y)<.4&&fract(p.x/14.)<.55) c=vec3(.9); if(abs(abs(p.y)-13.5)<.3) c=vec3(.9,.8,.3); return c; }
    return vec3(.52,.54,.56)+n1*.03; }
  if(q.y>232.) return vec3(.62,.51,.35)*(.9+n1*.12+n2*.1);
  if(q.y<-232.&&abs(q.x)<150.) return vec3(.36,.3,.25)*(.85+n1*.2);
  if(q.x<-232.) return vec3(.42,.46,.42)*(.85+n1*.15+n2*.1);
  return vec3(.3,.52,.27)*(.85+n1*.14+n2*.12);
}
void main(){
  vec3 n=normalize(vN); vec3 base=vC.rgb; float em=vC.a; float dist=length(vW-uCam);
  float fog=1.-exp(-dist*.0021);
  if(uGlow>.5){ o=vec4(base*em*(1.-fog),1.); return; }
  if(vMat>.5&&vMat<1.5){
    if(abs(n.y)<.5&&vW.y>2.6){
      float u=abs(n.x)>.5?vW.z:vW.x; vec2 g=vec2(u/3.,vW.y/3.2); vec2 f=fract(g); vec2 cell=floor(g)+floor(n.xz*3.)*17.;
      if(f.x>.16&&f.x<.84&&f.y>.28&&f.y<.8){ float h=hash(cell);
        float lit=step(.5,h)*uNight; vec3 glass=mix(vec3(.1,.16,.26),uAmbS*.9,.35+.25*f.y);
        base=mix(glass,vec3(1.,.86,.55)*(.7+.3*hash(cell+3.)),lit); em=lit*.95; }
    }
  } else if(vMat>1.5&&vMat<2.5){ em=.45+.55*uNight; }
  else if(vMat>2.5){ base=ground(vW.xz); }
  float ndl=max(dot(n,uLight),0.);
  vec3 amb=mix(uAmbG,uAmbS,n.y*.5+.5);
  vec3 c=base*(amb+uLightCol*ndl*shadow(n));
  c=mix(c,base*(1.+em*.6),clamp(em,0.,1.));
  o=vec4(mix(c,uFog,fog),1.);
}`;
  const SVS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=4) in mat4 iM; uniform mat4 uVP;
void main(){ gl_Position=uVP*(iM*vec4(aPos,1.)); }`;
  const SFS = `#version 300 es
precision mediump float; void main(){}`;
  const KVS = `#version 300 es
out vec2 vP; void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.; vP=p; gl_Position=vec4(p,1.,1.); }`;
  const KFS = `#version 300 es
precision highp float; in vec2 vP; uniform mat4 uInv; uniform vec3 uCam,uSun,uMoon,uTop,uHor,uSunCol; uniform float uNight,uTime; out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec4 a=uInv*vec4(vP,1.,1.); vec3 d=normalize(a.xyz/a.w-uCam);
  float h=max(d.y,0.); vec3 c=mix(uHor,uTop,pow(h,.55));
  float s=max(dot(d,uSun),0.); c+=uSunCol*(pow(s,900.)*5.+pow(s,10.)*.22);
  float m=max(dot(d,uMoon),0.); c+=vec3(.8,.85,1.)*pow(m,2500.)*3.*uNight;
  if(d.y>0.){
    vec2 st=floor(d.xz/(d.y+.4)*160.); c+=step(.996,hash(st))*uNight*smoothstep(0.,.3,d.y)*.9;
    vec2 q=d.xz/(d.y+.08)*1.4+uTime*.006; float cl=noise(q)*.55+noise(q*2.3)*.3+noise(q*5.1)*.15;
    cl=smoothstep(.52,.78,cl)*smoothstep(.0,.22,d.y);
    c=mix(c,mix(vec3(1.),uHor,.35)*(1.-uNight*.82)+uSunCol*.08,cl*.85);
  }
  o=vec4(c,1.);
}`;
  function compile(vs, fs) {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return [p, u];
  }

  api.init = (canvas) => {
    cv = canvas;
    gl = cv.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    [prog, U] = compile(VS, FS); [shProg, SU] = compile(SVS, SFS); [skyProg, KU] = compile(KVS, KFS);
    const meshes = [boxMesh(), sphMesh(), cylMesh(1), cylMesh(0)];
    for (let t = 0; t < 4; t++) {
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(meshes[t]), gl.STATIC_DRAW);
      prims[t] = { vb, count: meshes[t].length / 6 };
      for (let g = 0; g < 2; g++) {
        const b = { arr: new Float32Array(MAXI * FL), n: 0, buf: gl.createBuffer(), vao: gl.createVertexArray() };
        gl.bindVertexArray(b.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferData(gl.ARRAY_BUFFER, b.arr.byteLength, gl.DYNAMIC_DRAW);
        for (let k = 0; k < 5; k++) {
          gl.enableVertexAttribArray(4 + k); gl.vertexAttribPointer(4 + k, 4, gl.FLOAT, false, FL * 4, k * 16);
          gl.vertexAttribDivisor(4 + k, 1);
        }
        bat[g][t] = b;
      }
    }
    gl.bindVertexArray(null);
    api.ok = true; reset();
    return true;
  };

  /* 動かない地形を 1 区画ぶん 登録する。data は [位置3, 法線3, 色3, 材質1] のならび。 */
  api.addStatic = (data, box) => {
    const vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const sizes = [3, 3, 3, 1]; let off = 0;
    for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, sizes[i], gl.FLOAT, false, 40, off); off += sizes[i] * 4; }
    gl.bindVertexArray(null);
    chunks.push({ vao, count: data.length / 10, box });
  };

  function setShadow(q) {
    const n = q === 2 ? 2048 : q === 1 ? 1024 : 0;
    if (n === shN) return; shN = n;
    if (shTex) { gl.deleteTexture(shTex); gl.deleteFramebuffer(shFbo); shTex = shFbo = null; }
    if (!n) return;
    shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, n, n, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    shFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function boxVisible(m, b) {   // 視すい台の 6 面で 箱を はじく
    for (let i = 0; i < 6; i++) {
      const r = i >> 1, sg = i & 1 ? -1 : 1;
      const a = m[3] + sg * m[r], bb = m[7] + sg * m[4 + r], c = m[11] + sg * m[8 + r], d = m[15] + sg * m[12 + r];
      if (a * (a > 0 ? b[3] : b[0]) + bb * (bb > 0 ? b[4] : b[1]) + c * (c > 0 ? b[5] : b[2]) + d < 0) return false;
    }
    return true;
  }
  function constAttribs() {
    gl.vertexAttrib3f(2, 1, 1, 1); gl.vertexAttrib1f(3, 0);
    gl.vertexAttrib4f(4, 1, 0, 0, 0); gl.vertexAttrib4f(5, 0, 1, 0, 0); gl.vertexAttrib4f(6, 0, 0, 1, 0); gl.vertexAttrib4f(7, 0, 0, 0, 1);
    gl.vertexAttrib4f(8, 1, 1, 1, 0);
  }
  function drawScene(mat, g, withStatic) {
    if (withStatic) for (const c of chunks) {
      if (!boxVisible(mat, c.box)) continue;
      gl.bindVertexArray(c.vao); gl.drawArrays(gl.TRIANGLES, 0, c.count); api.stats.draws++; api.stats.chunks++;
    }
    for (let t = 0; t < 4; t++) {
      const b = bat[g][t]; if (!b.n) continue;
      gl.bindVertexArray(b.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, prims[t].count, b.n); api.stats.draws++;
    }
  }

  api.begin = () => { reset(); glow = 0; api.flash = 0; for (const g of bat) for (const b of g) b.n = 0; };

  /* cam: {ex,ey,ez,tx,ty,tz,fov}  env: {lx,ly,lz, lightCol, ambS, ambG, fog, top, hor, sunCol, sun[3], moon[3], night, time} */
  api.render = (cam, env) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * api.res;
    const w = Math.max(2, Math.round(cv.clientWidth * dpr)), h = Math.max(2, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    api.stats.draws = 0; api.stats.chunks = 0; api.stats.inst = 0;
    for (const g of bat) for (const b of g) {
      if (!b.n) continue; api.stats.inst += b.n;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.arr, 0, b.n * FL);
    }
    persp(tmpA, cam.fov, w / h, .5, 1800);
    lookAt(tmpB, cam.ex, cam.ey, cam.ez, cam.tx, cam.ty, cam.tz, 0, 1, 0);
    mul(VP, tmpA, tmpB); invert(IVP, VP);
    constAttribs();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.depthMask(true);

    // --- 影 ---
    setShadow(api.shadowQ);
    const shOn = shN && env.lightCol[0] + env.lightCol[1] + env.lightCol[2] > .02;
    if (shOn) {
      const L = cam.shadowR || 90, lx = env.lx, ly = env.ly, lz = env.lz;
      let rx = lz, rz = -lx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;        // 光の右
      const ux = -rz * ly, uy = rz * lx - rx * lz, uz = rx * ly;                            // 光の上
      const tex = 2 * L / shN; let fx = cam.tx, fy = cam.ty, fz = cam.tz;
      const pr = fx * rx + fz * rz, pu = fx * ux + fy * uy + fz * uz;
      const dr = Math.round(pr / tex) * tex - pr, du = Math.round(pu / tex) * tex - pu;
      fx += rx * dr + ux * du; fy += uy * du; fz += rz * dr + uz * du;
      lookAt(tmpB, fx + lx * 400, fy + ly * 400, fz + lz * 400, fx, fy, fz, 0, 1, 0);
      ortho(tmpA, -L, L, -L, L, 1, 800); mul(LVP, tmpA, tmpB);
      gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo); gl.viewport(0, 0, shN, shN); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(shProg); gl.uniformMatrix4fv(SU.uVP, false, LVP);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      drawScene(LVP, 0, true);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // --- 空 ---
    gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(skyProg); gl.bindVertexArray(null);
    gl.uniformMatrix4fv(KU.uInv, false, IVP); gl.uniform3f(KU.uCam, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(KU.uSun, env.sun); gl.uniform3fv(KU.uMoon, env.moon); gl.uniform3fv(KU.uTop, env.top);
    gl.uniform3fv(KU.uHor, env.hor); gl.uniform3fv(KU.uSunCol, env.sunCol);
    gl.uniform1f(KU.uNight, env.night); gl.uniform1f(KU.uTime, env.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);

    // --- 本体 ---
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniformMatrix4fv(U.uLVP, false, LVP);
    gl.uniform3f(U.uCam, cam.ex, cam.ey, cam.ez); gl.uniform3f(U.uLight, env.lx, env.ly, env.lz);
    gl.uniform3fv(U.uLightCol, env.lightCol); gl.uniform3fv(U.uAmbS, env.ambS); gl.uniform3fv(U.uAmbG, env.ambG);
    gl.uniform3fv(U.uFog, env.hor); gl.uniform1f(U.uNight, env.night); gl.uniform1f(U.uGlow, 0);
    gl.uniform1f(U.uShOn, shOn ? 1 : 0); gl.uniform1f(U.uShTex, shN ? 1 / shN : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shOn ? shTex : null); gl.uniform1i(U.uSh, 0);
    drawScene(VP, 0, true);
    gl.uniform1f(U.uGlow, 1); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    drawScene(VP, 1, false);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
  };

  /* 世界の点を 画面の位置 (CSS ピクセル) に直す。うしろ側なら null。 */
  api.project = (x, y, z) => {
    const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15]; if (w <= .1) return null;
    const px = (VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w, py = (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w;
    return { x: (px * .5 + .5) * cv.clientWidth, y: (.5 - py * .5) * cv.clientHeight, w };
  };
  return api;
})();
