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

  // ---------- 「きれい」がしつ 用のシェーダー ----------
  // aM = 面の番号 (0-5, 6=板) + 8×しつ (0=ふつう 1=みず 2=はっぱ 3=くさの下 4=くさの上 5=ひかる 6=すける 7=ようがん) + 64×みずの ふかさ
  const HI_HEAD = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
  const DECODE = `
vec3 faceN(float f){
  if (f < 0.5) return vec3(0.0, 0.0, 1.0);
  if (f < 1.5) return vec3(0.0, 0.0, -1.0);
  if (f < 2.5) return vec3(1.0, 0.0, 0.0);
  if (f < 3.5) return vec3(-1.0, 0.0, 0.0);
  if (f < 4.5) return vec3(0.0, 1.0, 0.0);
  if (f < 5.5) return vec3(0.0, -1.0, 0.0);
  return vec3(0.0, 1.0, 0.0);
}
float faceSh(float f){ return f < 1.5 ? 0.8 : f < 3.5 ? 0.64 : f < 4.5 ? 1.0 : f < 5.5 ? 0.5 : 1.0; }
float waveH(vec2 p, float t){ return (sin(p.x * 0.9 + t * 1.6) + sin(p.y * 1.1 - t * 1.3) + sin((p.x + p.y) * 0.6 + t)) * 0.022; }
// かぜで ゆれる・みずの なみ
vec3 sway(vec3 p, float mat, float t){
  if (mat > 1.5 && mat < 2.5) {
    p += vec3(sin(t * 1.7 + p.x * 0.9 + p.y * 0.6), sin(t * 1.3 + p.z * 0.8) * 0.4, sin(t * 1.5 + p.z * 0.7 + p.y * 0.5)) * 0.035;
  } else if (mat > 3.5 && mat < 4.5) {
    float g = sin(t * 0.6 + p.x * 0.05 + p.z * 0.04) * 0.5 + 0.7;
    p.x += (sin(t * 1.8 + p.x * 0.7 + p.z * 0.5) * 0.08 + sin(t * 3.1 + p.z) * 0.025) * g;
    p.z += sin(t * 1.5 + p.z * 0.8 + p.x * 0.3) * 0.06 * g;
  } else if ((mat > 0.5 && mat < 1.5) || mat > 6.5) {
    float fy = fract(p.y);
    if (fy > 0.8 && fy < 0.95) p.y += waveH(p.xz, t * (mat > 6.5 ? 0.35 : 1.0));
  }
  return p;
}`;
  const SKYFN = `
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGlow; uniform vec3 uGlowD;
vec3 skyCol(vec3 d){
  float h = max(d.y, 0.0);
  vec3 c = mix(uHor, uZen, pow(h, 0.55));
  c = mix(c, uHor * 0.85, clamp(-d.y * 1.5, 0.0, 1.0) * 0.35);
  float s = max(dot(d, uGlowD), 0.0);
  c += uGlow * (pow(s, 5.0) * (1.0 - h * 0.7) * 0.6 + pow(s, 48.0) * 0.5);
  return c;
}`;
  const GRADE = `
uniform vec2 uRes; uniform float uExpo;
vec3 grade(vec3 c){
  c *= uExpo;
  // 0.75 までは そのまま、明るいところは やわらかく まるめる
  c = mix(c, 0.75 + 0.25 * (1.0 - exp(-(c - 0.75) * 4.0)), step(0.75, c));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.1);
  c = c * vec3(1.02, 1.0, 0.97);
  vec2 q = gl_FragCoord.xy / uRes - 0.5;
  c *= 1.0 - dot(q, q) * 0.5;
  return clamp(c, 0.0, 1.0);
}`;
  // かげ (シャドウマップ)
  const SHADOWFN = `
uniform sampler2D uShadow; uniform float uShOn; uniform float uShTex;
float unpackD(vec4 c){ return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
float shadowAt(vec4 s){
  if (uShOn < 0.5) return 1.0;
  vec3 c = s.xyz * 0.5 + 0.5;
  vec2 e = abs(c.xy - 0.5) * 2.0;
  float edge = max(e.x, e.y);
  if (edge >= 1.0 || c.z >= 1.0) return 1.0;
  float d = c.z - 0.00025, sum = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    sum += step(d, SHDEPTH(texture2D(uShadow, c.xy + vec2(float(i), float(j)) * uShTex * 1.3)));
  }
  return mix(sum / 9.0, 1.0, smoothstep(0.82, 1.0, edge));
}`;
  const LIGHTU = `uniform vec3 uL; uniform vec3 uLCol; uniform vec3 uAmb; uniform vec3 uTorch; uniform float uTime;`;

  const HI_WORLD_VS = `
attribute vec3 aP; attribute vec2 aT; attribute vec3 aL; attribute float aM;
uniform mat4 uM; uniform mat4 uSM; uniform vec3 uC; uniform vec2 uFog; uniform vec3 uL; uniform float uTime;
varying vec2 vT; varying vec3 vW; varying vec3 vN; varying vec4 vS; varying vec3 vLt; varying float vF; varying float vMat; varying float vEx; varying float vSh;
${DECODE}
void main(){
  float face = mod(aM, 8.0), mat = mod(floor(aM / 8.0), 8.0);
  vEx = floor(aM / 64.0); vMat = mat;
  vec3 n = faceN(face);
  vSh = faceSh(face);
  vec3 p = sway(aP, mat, uTime);
  gl_Position = uM * vec4(p, 1.0);
  vT = aT; vW = p; vN = n;
  float s = aL.x < 0.5 ? 0.0 : pow(0.8, 15.0 - aL.x);
  float b = aL.y < 0.5 ? 0.0 : pow(0.8, 15.0 - aL.y);
  vLt = vec3(s, b, aL.z / vSh);
  vec3 off = face > 5.5 ? uL * 0.18 : n * 0.06;
  vS = uSM * vec4(p + off, 1.0);
  vF = clamp((length(p - uC) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
}`;
  const HI_WORLD_FS = HI_HEAD + `
uniform sampler2D uTex; uniform float uCut; uniform float uAlpha; uniform vec3 uC;
${LIGHTU}
varying vec2 vT; varying vec3 vW; varying vec3 vN; varying vec4 vS; varying vec3 vLt; varying float vF; varying float vMat; varying float vEx; varying float vSh;
${SKYFN}
${GRADE}
${SHADOWFN}
float waveH(vec2 p, float t){ return (sin(p.x * 0.9 + t * 1.6) + sin(p.y * 1.1 - t * 1.3) + sin((p.x + p.y) * 0.6 + t)) * 0.022; }
void main(){
  vec4 t = texture2D(uTex, vT);
  if (t.a < uCut) discard;
  vec3 V = normalize(vW - uC);
  vec3 n = vN;
  bool plant = vMat > 2.5 && vMat < 4.5;
  float ndl = plant ? 0.75 : dot(n, uL);
  float sky = vLt.x, blk = vLt.y, ao = vLt.z;
  float sh = ndl > 0.0 ? shadowAt(vS) : 0.0;
  float ambK = mix(1.0, vSh, 0.55);
  vec3 light = uAmb * sky * ambK * ao + uLCol * max(ndl, 0.0) * sh * sky * (0.55 + 0.45 * ao) + uTorch * blk * sqrt(blk) * (0.6 + 0.4 * ao);
  light = max(light, vec3(0.03, 0.03, 0.04) * ao);
  vec3 col = t.rgb * light;
  float a = t.a * uAlpha;
  if (vMat > 4.5 && vMat < 5.5) col = max(col, t.rgb * 1.15);
  if (vMat > 6.5) {
    // ようがん: じぶんで ひかって、ゆっくり うねる
    float tt = uTime;
    float f = sin(vW.x * 1.3 + tt * 0.7 + sin(vW.z * 0.9 + tt * 0.4) * 1.8) * sin(vW.z * 1.1 - tt * 0.5 + sin(vW.x * 0.7) * 1.4);
    col = mix(t.rgb, vec3(1.0, 0.88, 0.4), clamp(f * 0.7 + 0.25, 0.0, 1.0) * 0.6) * (1.15 + 0.12 * sin(tt * 1.7 + vW.x * 0.5 + vW.z * 0.3));
    a = 1.0;
  }
  if (vMat > 0.5 && vMat < 1.5) {
    // みず
    vec3 wn = n;
    if (n.y > 0.5) {
      vec2 p = vW.xz; float tt = uTime, e = 0.15;
      float h0 = waveH(p, tt);
      vec3 g = vec3(waveH(p + vec2(e, 0.0), tt) - h0, 0.0, waveH(p + vec2(0.0, e), tt) - h0) / e;
      float r1 = sin(p.x * 4.1 + p.y * 2.3 + tt * 2.7) * 0.05, r2 = sin(p.y * 3.7 - p.x * 1.9 + tt * 2.2) * 0.05;
      wn = normalize(vec3(-g.x * 2.5 + r1, 1.0, -g.z * 2.5 + r2));
    }
    float k = clamp(vEx / 7.0, 0.0, 1.0);
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(-V, wn), 0.0), 5.0);
    vec3 R = reflect(V, wn);
    vec3 refl = skyCol(R) * (0.25 + 0.75 * sky);
    vec3 base = mix(t.rgb, vec3(0.05, 0.2, 0.42), 0.35 + k * 0.4) * light * mix(1.0, 0.5, k);
    col = mix(base, refl, clamp(fres, 0.0, 1.0) * 0.9);
    col += uLCol * pow(max(dot(R, uL), 0.0), 140.0) * sh * sky * 3.0;
    a = mix(mix(0.62, 0.9, k), 1.0, fres * 0.7);
  }
  vec3 fc = skyCol(normalize(vec3(V.x, max(V.y, 0.0) * 0.5, V.z)));
  col = mix(col, fc, vF);
  gl_FragColor = vec4(grade(col), a);
}`;
  const HI_ENT_VS = `
attribute vec3 aP; attribute vec2 aT; attribute vec4 aC; attribute vec3 aN;
uniform mat4 uM; uniform mat4 uSM; uniform vec3 uC; uniform vec2 uFog; uniform vec3 uL;
varying vec2 vT; varying vec3 vCol; varying vec3 vN; varying vec4 vS; varying float vF; varying float vLv; varying vec3 vW;
void main(){
  gl_Position = uM * vec4(aP, 1.0);
  float sh = length(aN);
  vN = sh > 0.01 ? aN / sh : vec3(0.0, 1.0, 0.0);
  vCol = sh > 0.01 ? aC.rgb / sh : aC.rgb;
  vLv = sh > 0.01 ? aC.a : -1.0; vT = aT; vW = aP;
  vS = uSM * vec4(aP + vN * 0.05, 1.0);
  vF = clamp((length(aP - uC) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
}`;
  const HI_ENT_FS = HI_HEAD + `
uniform sampler2D uTex; uniform float uCut; uniform float uAlpha; uniform vec3 uC; uniform float uDay;
${LIGHTU}
varying vec2 vT; varying vec3 vCol; varying vec3 vN; varying vec4 vS; varying float vF; varying float vLv; varying vec3 vW;
${SKYFN}
${GRADE}
${SHADOWFN}
void main(){
  vec4 t = texture2D(uTex, vT);
  if (t.a < uCut) discard;
  float sv = clamp(min(vLv, uDay) / uDay, 0.0, 1.0);
  float bl = max(vLv - uDay, 0.0) / max(1.0 - uDay, 0.2);
  float ndl = dot(vN, uL);
  float sh = ndl > 0.0 ? shadowAt(vS) : 0.0;
  float ambK = 0.75 + 0.25 * vN.y;
  vec3 light = uAmb * sv * ambK + uLCol * max(ndl, 0.0) * sh * sv + uTorch * bl;
  light = max(light, vec3(0.06));
  if (vLv < 0.0) light = vec3(1.0);
  vec3 col = t.rgb * vCol * light;
  vec3 V = normalize(vW - uC);
  col = mix(col, skyCol(normalize(vec3(V.x, max(V.y, 0.0) * 0.5, V.z))), vF);
  gl_FragColor = vec4(grade(col), t.a * uAlpha);
}`;
  const SKY_VS = `
attribute vec2 aP; varying vec2 vP;
void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
  const SKY_FS = HI_HEAD + `
uniform vec3 uFwd; uniform vec3 uRight; uniform vec3 uUp; uniform vec2 uTan; uniform float uStars; uniform float uTime;
varying vec2 vP;
${SKYFN}
${GRADE}
float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main(){
  vec3 d = normalize(uFwd + uRight * vP.x * uTan.x + uUp * vP.y * uTan.y);
  vec3 c = skyCol(d);
  if (uStars > 0.01 && d.y > 0.0) {
    vec3 q = d * 110.0, cell = floor(q);
    float h = hash(cell);
    if (h > 0.988) {
      vec3 f = abs(fract(q) - 0.5);
      float m = step(max(f.x, max(f.y, f.z)), 0.3);
      float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 60.0);
      c += m * uStars * tw * smoothstep(0.0, 0.25, d.y) * mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.9, 0.7), fract(h * 91.0)) * 0.9;
    }
  }
  gl_FragColor = vec4(grade(c), 1.0);
}`;
  const SHADOW_VS = `
attribute vec3 aP; attribute vec2 aT; attribute vec3 aL; attribute float aM;
uniform mat4 uSM; uniform float uTime;
varying vec2 vT;
${DECODE}
void main(){
  vec3 p = sway(aP, mod(floor(aM / 8.0), 8.0), uTime);
  gl_Position = uSM * vec4(p, 1.0);
  vT = aT;
}`;
  const SHADOW_FS = HI_HEAD + `
uniform sampler2D uTex; uniform float uCut;
varying vec2 vT;
void main(){
  if (texture2D(uTex, vT).a < uCut) discard;
#ifdef PACK
  vec4 e = fract(gl_FragCoord.z * vec4(1.0, 255.0, 65025.0, 16581375.0));
  gl_FragColor = e - e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
#else
  gl_FragColor = vec4(1.0);
#endif
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
  // 頂点: x y z u v 空の光 ブロックの光 かげ しつ (面 + 8×しつ + 64×ふかさ)
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

  // ---------- MOD の ブロックの かたち (はこを ならべて つくる) ----------
  // はこは 0〜16 の ドットの ざひょう。面の UV は はこの おおきさに あわせて タイルの 一部を つかう
  function faceRect(f, b) {
    const x0 = b[0], y0 = b[1], z0 = b[2], x1 = b[3], y1 = b[4], z1 = b[5];
    let r;
    if (f === 0) r = [x0, 16 - y1, x1, 16 - y0];
    else if (f === 1) r = [16 - x1, 16 - y1, 16 - x0, 16 - y0];
    else if (f === 2) r = [16 - z1, 16 - y1, 16 - z0, 16 - y0];
    else if (f === 3) r = [z0, 16 - y1, z1, 16 - y0];
    else if (f === 4) r = [x0, z0, x1, z1];
    else r = [x0, 16 - z1, x1, 16 - z0];
    return r.map((v) => Math.min(16, Math.max(0, v)) / 16);
  }
  // tex: タイル番号 / {top, bottom, side} / 面ごとの 配列 (FACES の じゅん)
  function texOf(tex, f) {
    if (typeof tex === 'number') return tex;
    if (!tex) return -1;
    if (Array.isArray(tex)) return tex[f];
    if (tex[f] !== undefined) return tex[f];
    const k = f === 4 ? 'top' : f === 5 ? 'bottom' : 'side';
    return tex[k] !== undefined ? tex[k] : tex.side;
  }
  function subUV(t, r, rot) {
    const u0 = (t % 16) * (1 / 16), v0 = (t >> 4) * (1 / 16), e = 0.0008, k = 1 / 16;
    const A = u0 + r[0] * k + e, Bu = u0 + r[2] * k - e, C = v0 + r[1] * k + e, Dv = v0 + r[3] * k - e;
    const U = [[A, Dv], [Bu, Dv], [Bu, C], [A, C]];
    return rot ? [U[rot % 4], U[(1 + rot) % 4], U[(2 + rot) % 4], U[(3 + rot) % 4]] : U;
  }
  function nearestFace(x, y, z) {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    if (ay >= ax && ay >= az) return y > 0 ? 4 : 5;
    if (ax >= az) return x > 0 ? 2 : 3;
    return z > 0 ? 0 : 1;
  }

  function buildChunk(w, cx, cz) {
    const op = new FBuf(18432), tr = new FBuf(1152), glow = [];
    const W = w.W, D = w.D, H = w.H, wb = w.b, sky = w.sky, bl = w.bl;
    const x0 = cx * 16, z0 = cz * 16;
    const get = (x, y, z) => (y < 0 ? B.bedrock : y >= H || x < 0 || z < 0 || x >= W || z >= D ? 0 : wb[(y * D + z) * W + x]);
    const lightAt = (x, y, z) => {
      if (y >= H || x < 0 || z < 0 || x >= W || z >= D) return [15, 0];
      if (y < 0) return [0, 0];
      const i = (y * D + z) * W + x; return [sky[i], bl[i]];
    };
    const occ = (x, y, z) => OPAQUE[get(x, y, z)];
    const quad = (buf, P, U, L, ao, m) => {
      buf.need(54);
      const a = buf.a;
      const order = ao && ao[0] + ao[2] < ao[1] + ao[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      for (const k of order) {
        let o = buf.n;
        a[o++] = P[k][0]; a[o++] = P[k][1]; a[o++] = P[k][2];
        a[o++] = U[k][0]; a[o++] = U[k][1];
        a[o++] = L[0]; a[o++] = L[1]; a[o++] = L[2] * (ao ? AO[ao[k]] : 1);
        a[o++] = typeof m === 'number' ? m : m[k];
        buf.n = o;
      }
    };
    const tileUV = (t, ua, va, ub, vb) => {
      const u0 = (t % 16) * TS, v0 = (t >> 4) * TS;
      ua = ua === undefined ? 0 : ua; va = va === undefined ? 0 : va; ub = ub === undefined ? 1 : ub; vb = vb === undefined ? 1 : vb;
      const A = u0 + ua * TS + EPS, Bu = u0 + ub * TS - EPS, C = v0 + va * TS + EPS, Dv = v0 + vb * TS - EPS;
      return [[A, Dv], [Bu, Dv], [Bu, C], [A, C]];
    };
    // MOD の model(): box(x0,y0,z0,x1,y1,z1, tex, {tf, rot, glow}) で はこを たす
    const MC = {
      x: 0, y: 0, z: 0,
      box(bx0, by0, bz0, bx1, by1, bz1, tex, o) {
        const x = this.x, y = this.y, z = this.z, tf = o && o.tf, B6 = [bx0, by0, bz0, bx1, by1, bz1];
        const [s0, b0] = lightAt(x, y, z), emit = EMIT[wb[(y * D + z) * W + x]];
        for (let f = 0; f < 6; f++) {
          const t = texOf(tex, f);
          if (t === undefined || t === null || t < 0) continue;
          const F = FACES[f];
          let P = F.c.map((c) => [c[0] ? bx1 : bx0, c[1] ? by1 : by0, c[2] ? bz1 : bz0]);
          let g = f;
          if (tf) {
            P = P.map(tf);
            const a = tf([8, 8, 8]), n = tf([8 + F.n[0], 8 + F.n[1], 8 + F.n[2]]);
            g = nearestFace(n[0] - a[0], n[1] - a[1], n[2] - a[2]);
          }
          const G = FACES[g].n, ax = G[0] ? 0 : G[1] ? 1 : 2, edge = (G[ax] > 0 ? 16 : 0);
          const nx = x + G[0], ny = y + G[1], nz = z + G[2];
          if (P.every((p) => Math.abs(p[ax] - edge) < 0.01) && OPAQUE[get(nx, ny, nz)]) continue;
          const [s1, b1] = lightAt(nx, ny, nz);
          const L = [Math.max(s0, s1), Math.max(b0, b1, emit), FACES[g].sh];
          const rot = o && o.rot ? (Array.isArray(o.rot) ? o.rot[f] || 0 : o.rot) : 0;
          const U = subUV(t, faceRect(f, B6), rot);
          quad(op, P.map((p) => [x + p[0] / 16, y + p[1] / 16, z + p[2] / 16]), U, L, null, g + 8 * (o && o.glow ? 5 : 0));
        }
      },
    };
    for (let y = 0; y < H; y++) for (let z = z0; z < z0 + 16; z++) for (let x = x0; x < x0 + 16; x++) {
      const id = wb[(y * D + z) * W + x];
      if (!id) continue;
      const rend = RENDER[id], def = BLOCKS[id];
      if (rend === 'model' || rend === 'custom') {
        if (rend === 'model' && def.model) {
          MC.x = x; MC.y = y; MC.z = z;
          try { def.model(MC, w, x, y, z); } catch (e) { if (!def.modelErr) { def.modelErr = 1; console.error(e); } }
        }
        continue;
      }
      if (rend === 'cross') {
        const [s, b] = lightAt(x, y, z);
        const U = tileUV(def.tx.side);
        const L = [s, b, 0.92];
        const i = 0.15, M = [6 + 8 * 3, 6 + 8 * 3, 6 + 8 * 4, 6 + 8 * 4];
        quad(op, [[x + i, y, z + i], [x + 1 - i, y, z + 1 - i], [x + 1 - i, y + 1, z + 1 - i], [x + i, y + 1, z + i]], U, L, null, M);
        quad(op, [[x + 1 - i, y, z + i], [x + i, y, z + 1 - i], [x + i, y + 1, z + 1 - i], [x + 1 - i, y + 1, z + i]], U, L, null, M);
        continue;
      }
      if (rend === 'torch') {
        glow.push(x + 0.5, y + 0.65, z + 0.5, 0);
        const L = [lightAt(x, y, z)[0], 15, 1];
        const a = x + 7 / 16, b2 = x + 9 / 16, c = z + 7 / 16, d = z + 9 / 16, top = y + 10 / 16;
        const US = tileUV(def.tx.side, 7 / 16, 6 / 16, 9 / 16, 1), UT = tileUV(def.tx.side, 7 / 16, 6 / 16, 9 / 16, 8 / 16);
        const M = 6 + 8 * 5;
        quad(op, [[a, y, d], [b2, y, d], [b2, top, d], [a, top, d]], US, L, null, M);
        quad(op, [[b2, y, c], [a, y, c], [a, top, c], [b2, top, c]], US, L, null, M);
        quad(op, [[b2, y, d], [b2, y, c], [b2, top, c], [b2, top, d]], US, L, null, M);
        quad(op, [[a, y, c], [a, y, d], [a, top, d], [a, top, c]], US, L, null, M);
        quad(op, [[a, top, d], [b2, top, d], [b2, top, c], [a, top, c]], UT, L, null, M);
        continue;
      }
      const isLava = rend === 'lava', isLiquid = rend === 'liquid' || isLava;
      const buf = TRANS.has(rend) ? tr : op;
      const useAO = rend === 'cube' || rend === 'cutout';
      const topH = isLiquid && get(x, y + 1, z) !== id ? 0.875 : 1;
      const emit = EMIT[id];
      if (emit >= 15 && !isLava) glow.push(x + 0.5, y + 0.5, z + 0.5, 1);
      // しつ: みず・はっぱ・ひかる・すける・ようがん
      const mat = isLava ? 7 : isLiquid ? 1 : LEAFY.has(id) ? 2 : emit >= 13 ? 5 : buf === tr ? 6 : 0;
      // みずの ふかさ (角ごとに まわり4つの 平均)
      let wd = null;
      if (isLiquid && !isLava) {
        const col = (cx2, cz2) => { let k = 0; while (k < 8 && get(cx2, y - k, cz2) === id) k++; return k; };
        const d00 = col(x - 1, z - 1), d10 = col(x, z - 1), d20 = col(x + 1, z - 1), d01 = col(x - 1, z), d11 = col(x, z), d21 = col(x + 1, z);
        const d02 = col(x - 1, z + 1), d12 = col(x, z + 1), d22 = col(x + 1, z + 1);
        const c4 = (a, b, c, d) => Math.min(7, Math.round((a + b + c + d) / 4));
        wd = [[c4(d00, d10, d01, d11), c4(d10, d20, d11, d21)], [c4(d01, d11, d02, d12), c4(d11, d21, d12, d22)]];
      }
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], n = F.n;
        const nx = x + n[0], ny = y + n[1], nz = z + n[2];
        const nid = get(nx, ny, nz);
        if (OPAQUE[nid]) continue;
        if (nid === id && !LEAFY.has(id)) continue;
        // うみの みずは 空気と ガラスの がわだけ (サンゴや こんぶを みずの はこで かこまない)
        if (id === B.seaWater) { if (nid !== 0 && RENDER[nid] !== 'cutout') continue; }
        else if (isLiquid && nid !== 0 && !TRANS.has(RENDER[nid]) && RENDER[nid] !== 'cross' && RENDER[nid] !== 'torch' && RENDER[nid] !== 'model' && RENDER[nid] !== 'custom' && f !== 4) continue;
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
        quad(buf, P, U, L, ao, wd ? F.c.map((c) => f + 8 + 64 * wd[c[2]][c[0]]) : f + 8 * mat);
      }
    }
    return { op: op.view(), tr: tr.view(), glow };
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
  // 頂点: x y z u v r g b 明るさ 法線×かげ (3)
  const NO_N = [0, 0, 0];
  class Batch {
    constructor() { this.b = new FBuf(1 << 16); this.glb = null; }
    clear() { this.b.n = 0; }
    v(p, u, v, c, l, n) {
      const a = this.b.a; let o = this.b.n;
      n = n || NO_N;
      a[o++] = p[0]; a[o++] = p[1]; a[o++] = p[2]; a[o++] = u; a[o++] = v; a[o++] = c[0]; a[o++] = c[1]; a[o++] = c[2]; a[o++] = l;
      a[o++] = n[0]; a[o++] = n[1]; a[o++] = n[2];
      this.b.n = o;
    }
    quad(P, UV, c, l, n) {
      this.b.need(72);
      for (const k of [0, 1, 2, 0, 2, 3]) this.v(P[k], UV[k][0], UV[k][1], c, l, n);
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
        // 法線を世界の向きにして、長さに かげ を入れる (きれい がしつ で使う)
        const o = X.ap(m, 0, 0, 0), q = X.ap(m, F.n[0], F.n[1], F.n[2]);
        const nx = q[0] - o[0], ny = q[1] - o[1], nz = q[2] - o[2], nl = sh / (Math.hypot(nx, ny, nz) || 1);
        this.quad(P, UV, [col[0] * sh, col[1] * sh, col[2] * sh], light, [nx * nl, ny * nl, nz * nl]);
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
      this.skinBatch = new Batch();
      this.iconBatch = new Batch();
      this.lineBatch = new Batch();
      this.skyBatch = new Batch();
      this.atlasBatch = new Batch(); // MOD の うごく ぶひん (ブロックの テクスチャで かく)
      this.white = [575.5 / 576, 575.5 / 576];
      this.world = null;
      this.renderDist = 6;
      this.gfx = 'low'; this.hi = null;
    }
    // MOD が タイルや アイコンを かいたあと よびだす
    refreshAtlas() { this.gl.deleteTexture(this.texAtlas); this.texAtlas = texture(this.gl, CS.ATLAS); }
    refreshIcons() { this.gl.deleteTexture(this.texIcons); this.texIcons = texture(this.gl, CS.ICONS); }
    // m: 0〜16 の ドットの ざひょうを せかいへ うつす 行列, bx: [x0,y0,z0,x1,y1,z1], tex: texOf と おなじ
    atlasBox(m, bx, tex, light, rot) {
      const b = this.atlasBatch;
      const o = X.ap(m, 0, 0, 0);
      for (let f = 0; f < 6; f++) {
        const t = texOf(tex, f);
        if (t === undefined || t === null || t < 0) continue;
        const F = FACES[f];
        const P = F.c.map((c) => X.ap(m, c[0] ? bx[3] : bx[0], c[1] ? bx[4] : bx[1], c[2] ? bx[5] : bx[2]));
        const q = X.ap(m, F.n[0], F.n[1], F.n[2]);
        const nx = q[0] - o[0], ny = q[1] - o[1], nz = q[2] - o[2];
        const sh = FACES[nearestFace(nx, ny, nz)].sh, nl = sh / (Math.hypot(nx, ny, nz) || 1);
        const r = rot ? (Array.isArray(rot) ? rot[f] || 0 : rot) : 0;
        b.quad(P, subUV(t, faceRect(f, bx), r), [sh, sh, sh], light, [nx * nl, ny * nl, nz * nl]);
      }
    }
    // タイルの 一部 (r = [u0,v0,u1,v1], 0〜1) を はった 四角
    atlasQuad(P, t, r, light, n) { this.atlasBatch.quad(P, subUV(t, r), [1, 1, 1], light, n || [0, 1, 0]); }
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
      c.glow = m.glow;
      for (const k of ['op', 'tr']) {
        const data = m[k];
        if (!c[k]) c[k] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, c[k]);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        c[k + 'N'] = data.length / 9;
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
    // cam: {x,y,z,yaw,pitch}, env: {day, sky:[r,g,b], fog:[near,far], sun, flat}
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
      this.skinBatch.clear(); this.iconBatch.clear(); this.lineBatch.clear(); this.skyBatch.clear(); this.atlasBatch.clear();
      if (this.gfx === 'high') this.lightSetup(cam, env);
    }
    // ---------- 「きれい」がしつ ----------
    setGfx(g) {
      if (g === 'high' && !this.hi) {
        try { this.initHigh(); } catch (e) { console.warn('きれい がしつ が つかえません', e); this.hi = null; g = 'low'; }
      }
      this.gfx = g;
      return g;
    }
    initHigh() {
      const gl = this.gl, hi = {};
      const size = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096 ? 2048 : 1024;
      hi.size = size;
      const ext = gl.getExtension('WEBGL_depth_texture') || gl.getExtension('WEBKIT_WEBGL_depth_texture');
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      const mkTex = (fmt, type) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, size, size, 0, fmt, type, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      let ok = false;
      if (ext) {
        // 奥行きテクスチャに そのまま かく
        hi.shTex = mkTex(gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, hi.shTex, 0);
        ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        if (!ok) {
          const rb = gl.createRenderbuffer();
          gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, size, size);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
          ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        }
        if (!ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(hi.shTex); }
      }
      hi.pack = !ok;
      if (hi.pack) {
        // 奥行きを RGBA に つめて かく
        hi.fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, hi.fb);
        hi.shTex = mkTex(gl.RGBA, gl.UNSIGNED_BYTE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hi.shTex, 0);
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); throw new Error('shadow fbo'); }
      } else hi.fb = fb;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const def = hi.pack ? '#define PACK\n#define SHDEPTH(t) unpackD(t)\n' : '#define SHDEPTH(t) (t).r\n';
      hi.pw = compile(gl, HI_WORLD_VS, def + HI_WORLD_FS, ['aP', 'aT', 'aL', 'aM']);
      hi.pe = compile(gl, HI_ENT_VS, def + HI_ENT_FS, ['aP', 'aT', 'aC', 'aN']);
      hi.ps = compile(gl, SKY_VS, SKY_FS, ['aP']);
      hi.psh = compile(gl, SHADOW_VS, def + SHADOW_FS, ['aP', 'aT', 'aL', 'aM']);
      // たいまつ・ランプの まわりの ひかり
      const gc = document.createElement('canvas'); gc.width = gc.height = 64;
      const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
      hi.glowTex = texture(gl, gc);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      hi.glowBatch = new Batch();
      hi.tri = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, hi.tri);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.hi = hi;
    }
    // 光の向き・色、空の色、かげの行列を決める
    lightSetup(cam, env) {
      const hi = this.hi, sm = CS.smooth, mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const k = CS.clamp((env.day - 0.24) / 0.76, 0, 1);
      let L, lcol, glow = [0, 0, 0], glowD = [0, 1, 0], stars = 0;
      let hor = mix(env.sky, [1, 1, 1], 0.18 * k), zen = [env.sky[0] * 0.55, env.sky[1] * 0.74, env.sky[2] * 0.97];
      if (env.sun) {
        const l = Math.hypot(env.sun[0], env.sun[1], env.sun[2]), sun = [env.sun[0] / l, env.sun[1] / l, env.sun[2] / l], h = sun[1];
        const dusk = Math.max(0, 1 - Math.abs(h) * 3.5);
        if (h >= 0) {
          L = sun; glowD = sun;
          lcol = mix([1, 0.5, 0.25], [1, 0.95, 0.86], sm(h / 0.45)).map((v) => v * 0.72 * sm(h / 0.18));
          glow = mix([1, 0.92, 0.75], [1, 0.42, 0.18], dusk).map((v) => v * (0.25 + dusk * 0.9));
        } else {
          L = [-sun[0], -sun[1], -sun[2]]; glowD = L;
          lcol = [0.3, 0.4, 0.66].map((v) => v * 0.75 * sm(-h / 0.18));
          glow = [0.25, 0.3, 0.45].map((v) => v * 0.25 * sm(-h / 0.2));
          if (dusk > 0) glow = mix(glow, [0.9, 0.35, 0.25], dusk * 0.7);
        }
        hor = mix(hor, [1, 0.58, 0.4], dusk * 0.55);
        stars = CS.clamp((0.5 - env.day) / 0.2, 0, 1);
      } else if (env.mood) {
        // マグマ・ほし など せかいごとの 空と 光
        const m = env.mood, l = Math.hypot(m.L[0], m.L[1], m.L[2]);
        L = [m.L[0] / l, m.L[1] / l, m.L[2] / l]; glowD = m.glowD || L;
        lcol = m.lcol; glow = m.glow || [0, 0, 0]; hor = m.hor; zen = m.zen; stars = m.stars || 0;
      } else {
        // てんくうの せかい: いつも ひる
        const l = Math.hypot(0.45, 0.8, 0.35);
        L = [0.45 / l, 0.8 / l, 0.35 / l]; glowD = L;
        lcol = [0.72, 0.68, 0.62]; glow = [1, 0.95, 0.8].map((v) => v * 0.3);
        hor = mix(env.sky, [1, 1, 1], 0.35); zen = [env.sky[0] * 0.55, env.sky[1] * 0.72, env.sky[2] * 0.98];
      }
      if (env.flat) { hor = zen = env.sky.slice(); glow = [0, 0, 0]; stars = 0; lcol = lcol.map((v) => v * 0.5); }
      let amb = mix(zen, hor, 0.5);
      const al = amb[0] * 0.3 + amb[1] * 0.59 + amb[2] * 0.11;
      amb = mix([al, al, al], amb, 0.45).map((v) => v * 0.72);
      amb = [Math.max(amb[0], 0.12), Math.max(amb[1], 0.135), Math.max(amb[2], 0.2)];
      if (env.amb) amb = env.amb;
      Object.assign(hi, { L, lcol, glow, glowD, hor, zen, amb, stars });
      // かげ: プレイヤーの まわり (すこし まえ) を 太陽から みる
      hi.shOn = !!this.world && (lcol[0] + lcol[1] + lcol[2]) > 0.02;
      if (hi.shOn) {
        const S = 96, size = hi.size, f = this.fwd, fl = Math.hypot(f[0], f[2]) || 1;
        const cx = cam.x + f[0] / fl * 22, cy = cam.y, cz = cam.z + f[2] / fl * 22;
        const v = CS.mat4.look(0, 0, 0, -L[0], -L[1], -L[2]);
        const step = S / size;
        const lx = Math.round((v[0] * cx + v[4] * cy + v[8] * cz) / step) * step;
        const ly = Math.round((v[1] * cx + v[5] * cy + v[9] * cz) / step) * step;
        const d = -(v[2] * cx + v[6] * cy + v[10] * cz);
        const l = lx - S / 2, r = lx + S / 2, b = ly - S / 2, t = ly + S / 2, n = d - 140, fa = d + 140;
        const o = new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (fa - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(fa + n) / (fa - n), 1]);
        hi.sm = CS.mat4.mul(o, v);
      } else if (!hi.sm) hi.sm = new Float32Array(16);
    }
    visible(cx, cz, m) {
      m = m || this.mvp;
      const H = this.world.H;
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
      if (u.uFogC) gl.uniform3f(u.uFogC, e.sky[0], e.sky[1], e.sky[2]);
      gl.uniform1i(u.uTex, 0);
      gl.uniform1f(u.uAlpha, 1);
      if (u.uL) this.setHiUniforms(prog);
    }
    setHiUniforms(prog) {
      const gl = this.gl, u = prog.u, h = this.hi;
      const v3 = (k, a) => { if (u[k]) gl.uniform3f(u[k], a[0], a[1], a[2]); };
      v3('uL', h.L); v3('uLCol', h.lcol); v3('uAmb', h.amb); v3('uTorch', [1.25, 0.82, 0.45]);
      v3('uZen', h.zen); v3('uHor', h.hor); v3('uGlow', h.glow); v3('uGlowD', h.glowD);
      if (u.uTime) gl.uniform1f(u.uTime, (performance.now() / 1000) % 3600);
      if (u.uRes) gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      if (u.uExpo) gl.uniform1f(u.uExpo, 1);
      if (u.uSM) gl.uniformMatrix4fv(u.uSM, false, h.sm);
      if (u.uShadow) {
        gl.uniform1i(u.uShadow, 1);
        gl.uniform1f(u.uShOn, h.shOn ? 1 : 0);
        gl.uniform1f(u.uShTex, 1 / h.size);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, h.shTex); gl.activeTexture(gl.TEXTURE0);
      }
    }
    attribs(stride, sizes) {
      const gl = this.gl;
      let off = 0;
      sizes.forEach((n, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off); off += n * 4; });
    }
    drawChunks(pass, prog, m) {
      const gl = this.gl, w = this.world;
      if (!w) return;
      if (!prog) {
        prog = this.gfx === 'high' ? this.hi.pw : this.pw;
        this.setWorldUniforms(prog);
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texAtlas);
      gl.uniform1f(prog.u.uCut, pass === 'op' ? 0.5 : 0.02);
      const pcx = Math.floor(this.cam.x / 16), pcz = Math.floor(this.cam.z / 16), R = this.renderDist + 0.5;
      for (const c of this.chunks.values()) {
        const n = c[pass + 'N'];
        if (!n) continue;
        if ((c.cx - pcx) ** 2 + (c.cz - pcz) ** 2 > R * R) continue;
        if (!this.visible(c.cx, c.cz, m)) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, c[pass]);
        this.attribs(36, [3, 2, 3, 1]);
        gl.drawArrays(gl.TRIANGLES, 0, n);
      }
    }
    drawBatch(batch, tex, mode, cut, prog) {
      const gl = this.gl, n = batch.b.n / 12;
      if (!n) return;
      prog = prog || (this.gfx === 'high' && mode !== 'lines' ? this.hi.pe : this.pe);
      this.setWorldUniforms(prog);
      gl.uniform1f(prog.u.uCut, cut === undefined ? 0.1 : cut);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      this.bindBatch(batch);
      gl.drawArrays(mode === 'lines' ? gl.LINES : gl.TRIANGLES, 0, n);
    }
    bindBatch(batch) {
      const gl = this.gl;
      if (!batch.glb) batch.glb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.glb);
      if (batch.up !== this.frameNo) { gl.bufferData(gl.ARRAY_BUFFER, batch.b.view(), gl.STREAM_DRAW); batch.up = this.frameNo; }
      this.attribs(48, [3, 2, 4, 3]);
    }
    // 太陽から みた 奥行きを かく
    shadowPass() {
      const gl = this.gl, hi = this.hi, prog = hi.psh;
      gl.bindFramebuffer(gl.FRAMEBUFFER, hi.fb);
      gl.viewport(0, 0, hi.size, hi.size);
      if (!hi.pack) gl.colorMask(false, false, false, false);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog.p);
      gl.uniformMatrix4fv(prog.u.uSM, false, hi.sm);
      gl.uniform1f(prog.u.uTime, (performance.now() / 1000) % 3600);
      gl.uniform1i(prog.u.uTex, 0);
      const save = this.renderDist;
      this.renderDist = Math.min(save, 5);
      this.drawChunks('op', prog, hi.sm);
      this.renderDist = save;
      // いきものの かげ
      gl.uniform1f(prog.u.uCut, 0.5);
      for (const [b, tex] of [[this.skinBatch, this.texSkin], [this.iconBatch, this.texIcons], [this.atlasBatch, this.texAtlas]]) {
        if (!b.b.n || !tex) continue;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        this.bindBatch(b);
        gl.disableVertexAttribArray(3); gl.vertexAttrib1f(3, 0);
        gl.drawArrays(gl.TRIANGLES, 0, b.b.n / 12);
      }
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    // 空のグラデーションと ほし
    drawSky() {
      const gl = this.gl, hi = this.hi, prog = hi.ps, u = prog.u, c = this.cam;
      gl.useProgram(prog.p);
      this.setHiUniforms(prog);
      const ty = Math.tan((c.fov || 70) * Math.PI / 360);
      gl.uniform3f(u.uFwd, this.fwd[0], this.fwd[1], this.fwd[2]);
      gl.uniform3f(u.uRight, this.right[0], this.right[1], this.right[2]);
      gl.uniform3f(u.uUp, this.up[0], this.up[1], this.up[2]);
      gl.uniform2f(u.uTan, ty * this.canvas.width / this.canvas.height, ty);
      gl.uniform1f(u.uStars, hi.stars);
      gl.bindBuffer(gl.ARRAY_BUFFER, hi.tri);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    }
    // ちかくの たいまつ・ランプに ふんわり ひかりを たす (よる ほど つよい)
    drawGlow() {
      const gl = this.gl, hi = this.hi, b = hi.glowBatch, c = this.cam, e = this.env, w = this.world;
      if (!w || e.flat) return;
      b.clear();
      const maxD = Math.min(40, e.fog[0]), r = this.right, u = this.up;
      const pcx = Math.floor(c.x / 16), pcz = Math.floor(c.z / 16);
      for (const ch of this.chunks.values()) {
        if (!ch.glow || !ch.glow.length || Math.abs(ch.cx - pcx) > 3 || Math.abs(ch.cz - pcz) > 3) continue;
        const g = ch.glow;
        for (let i = 0; i < g.length; i += 4) {
          let dx = g[i] - c.x, dy = g[i + 1] - c.y, dz = g[i + 2] - c.z;
          const d = Math.hypot(dx, dy, dz);
          if (d > maxD || d < 0.8) continue;
          // まわりが くらい ほど つよく
          const gx = Math.floor(g[i]), gy = Math.floor(g[i + 1] + 0.6), gz = Math.floor(g[i + 2]);
          const sl = w.inside(gx, gy, gz) ? w.sky[w.idx(gx, gy, gz)] : 15;
          const k = 1 - (sl ? Math.pow(0.8, 15 - sl) : 0) * e.day * 0.8;
          const lamp = g[i + 3] === 1, a = k * (1 - d / maxD) * (lamp ? 0.5 : 0.6), s = lamp ? 1.5 : 0.9;
          dx /= d; dy /= d; dz /= d;
          const x = g[i] - dx * 0.75, y = g[i + 1] - dy * 0.75, z = g[i + 2] - dz * 0.75;
          const col = lamp ? [a, a * 0.85, a * 0.6] : [a, a * 0.62, a * 0.3];
          b.quad([[x - r[0] * s - u[0] * s, y - r[1] * s - u[1] * s, z - r[2] * s - u[2] * s], [x + r[0] * s - u[0] * s, y + r[1] * s - u[1] * s, z + r[2] * s - u[2] * s],
            [x + r[0] * s + u[0] * s, y + r[1] * s + u[1] * s, z + r[2] * s + u[2] * s], [x - r[0] * s + u[0] * s, y - r[1] * s + u[1] * s, z - r[2] * s + u[2] * s]],
          [[0, 1], [1, 1], [1, 0], [0, 0]], col, 1);
        }
      }
      if (!b.b.n) return;
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      this.drawBatch(b, hi.glowTex, null, 0, this.pe);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    finish() {
      const gl = this.gl, high = this.gfx === 'high' && this.hi;
      this.frameNo = (this.frameNo || 0) + 1;
      if (high) {
        if (this.hi.shOn) this.shadowPass();
        this.drawSky();
      }
      if (this.skyBatch.b.n) { gl.disable(gl.DEPTH_TEST); this.drawBatch(this.skyBatch, this.texIcons, null, undefined, this.pe); gl.enable(gl.DEPTH_TEST); }
      this.drawChunks('op');
      if (this.atlasBatch.b.n) this.drawBatch(this.atlasBatch, this.texAtlas, null, 0.5);
      if (this.texSkin) this.drawBatch(this.skinBatch, this.texSkin);
      this.drawBatch(this.iconBatch, this.texIcons);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      this.drawChunks('tr');
      if (high) this.drawGlow();
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
      // 明るさ 1 の 板 (つぶ・や など) は かげを つけない
      const f = this.fwd, l = light === undefined ? 1 : light;
      this.iconBatch.quad(P, UV, col || [1, 1, 1], l, l === 1 ? NO_N : [-f[0], -f[1], -f[2]]);
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
      this.lineBatch.b.need(E.length * 24);
      for (const [i, j] of E) { this.lineBatch.v(C[i], this.white[0], this.white[1], col, 1); this.lineBatch.v(C[j], this.white[0], this.white[1], col, 1); }
    }
  }

  CS.Renderer = Renderer;
  CS.X = X;
  CS.buildChunk = buildChunk;
})();
