// 遠くの建物の代わりに描く「絵の板」(impostor)。
// 壁の部品を 1 つずつ正面から撮って 1 枚の絵 (atlas) に並べ、遠くではその絵を貼った四角形だけを描く。
// 窓のところは別の絵 (mask) に白で残し、昼は空を映すつや、夜は部屋の明かりに使う。
import * as THREE from 'three';

const PX = 40; // 1 m あたりの画素数
const PX_BIG = 14; // 既製の建物の面は大きいので粗く撮る
const SIZE = 2048;

export class Impostors {
  constructor(kit, renderer, uniforms) {
    this.kit = kit;
    this.renderer = renderer;
    this.uniforms = uniforms;
    this.rects = {}; // 名前 → { u0, v0, u1, v1, x0, x1, y0, y1 } (x, y は部品の中のメートル)
    this.list = []; // { m: Matrix4, rect, tint }
    this.group = null;
  }

  // 部品を正面から撮る。views: [{ key, piece, face: 'front'|'back'|'left'|'right'|'top', px }]
  bake(views) {
    const kit = this.kit;
    // 撮る範囲を決めて棚詰めする
    const items = views.map((v) => {
      const box = kit.pieces[v.piece].box;
      let w, h;
      if (v.face === 'front' || v.face === 'back') { w = box.max.x - box.min.x; h = box.max.y - box.min.y; }
      else if (v.face === 'top') { w = box.max.x - box.min.x; h = box.max.z - box.min.z; }
      else { w = box.max.z - box.min.z; h = box.max.y - box.min.y; }
      const px = v.px || PX;
      return { ...v, box, w, h, pw: Math.ceil(w * px) + 4, ph: Math.ceil(h * px) + 4 };
    });
    items.sort((a, b) => b.ph - a.ph);
    let x = 0, y = 0, rowH = 0;
    for (const it of items) {
      if (x + it.pw > SIZE) { x = 0; y += rowH; rowH = 0; }
      it.px0 = x; it.py0 = y;
      x += it.pw; rowH = Math.max(rowH, it.ph);
    }
    if (y + rowH > SIZE) console.warn('atlas からはみ出した', y + rowH);

    const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const rtMask = new THREE.WebGLRenderTarget(SIZE / 2, SIZE / 2, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    rt.texture.anisotropy = 8;
    const r = this.renderer;
    const prev = { target: r.getRenderTarget(), tone: r.toneMapping, color: r.getClearColor(new THREE.Color()), alpha: r.getClearAlpha(), shadow: r.shadowMap.enabled };
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = false;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, 0, 0.01, 200);
    const albedo = this.bakeMaterials(false), mask = this.bakeMaterials(true);
    for (const [target, mats, scale, clear] of [[rt, albedo, 1, 0x6b5a50], [rtMask, mask, 0.5, 0x000000]]) {
      target.scissorTest = false;
      target.viewport.set(0, 0, target.width, target.height);
      r.setRenderTarget(target);
      r.setClearColor(clear, 1);
      r.clear();
      for (const it of items) {
        const scene = new THREE.Scene();
        for (const part of kit.pieces[it.piece].parts) {
          const m = mats[part.mat.startsWith('FakeInterior') ? 'FakeInterior' : part.mat];
          if (m) scene.add(new THREE.Mesh(part.geo, m));
        }
        const b = it.box, c = b.getCenter(new THREE.Vector3());
        const far = 60;
        if (it.face === 'front') { cam.position.set(c.x, b.min.y, b.max.z + 30); cam.lookAt(c.x, b.min.y, 0); }
        else if (it.face === 'back') { cam.position.set(c.x, b.min.y, b.min.z - 30); cam.lookAt(c.x, b.min.y, 0); }
        else if (it.face === 'right') { cam.position.set(b.max.x + 30, b.min.y, c.z); cam.lookAt(0, b.min.y, c.z); }
        else if (it.face === 'left') { cam.position.set(b.min.x - 30, b.min.y, c.z); cam.lookAt(0, b.min.y, c.z); }
        else { cam.position.set(c.x, b.max.y + 30, b.max.z); cam.up.set(0, 0, -1); cam.lookAt(c.x, 0, b.max.z); }
        cam.left = -it.w / 2; cam.right = it.w / 2;
        cam.top = it.h; cam.bottom = 0;
        cam.near = 0.01; cam.far = far;
        cam.updateProjectionMatrix();
        cam.up.set(0, 1, 0);
        const vx = (it.px0 + 2) * scale, vy = (it.py0 + 2) * scale, vw = (it.pw - 4) * scale, vh = (it.ph - 4) * scale;
        // 描画先が render target のときは target 側の viewport / scissor が使われる
        target.viewport.set(vx, vy, vw, vh);
        target.scissor.set(vx - scale, vy - scale, vw + 2 * scale, vh + 2 * scale);
        target.scissorTest = true;
        r.setRenderTarget(target);
        r.render(scene, cam);
      }
    }
    rt.scissorTest = rtMask.scissorTest = false;
    r.setRenderTarget(prev.target);
    r.toneMapping = prev.tone;
    r.shadowMap.enabled = prev.shadow;
    r.setClearColor(prev.color, prev.alpha);
    for (const it of items) {
      // UV は左下が 0 (描画先の座標と同じ)
      const u0 = (it.px0 + 2) / SIZE, v0 = (it.py0 + 2) / SIZE, u1 = (it.px0 + it.pw - 2) / SIZE, v1 = (it.py0 + it.ph - 2) / SIZE;
      const b = it.box;
      let x0, x1, y0, y1;
      if (it.face === 'front' || it.face === 'back') { x0 = b.min.x; x1 = b.max.x; } else { x0 = b.min.z; x1 = b.max.z; }
      if (it.face === 'top') { y0 = b.min.z; y1 = b.max.z; } else { y0 = b.min.y; y1 = b.max.y; }
      this.rects[it.key] = { u0, v0, u1, v1, x0, x1, y0, y1, face: it.face, box: b };
    }
    this.atlas = rt.texture;
    this.mask = rtMask.texture;
  }

  bakeMaterials(isMask) {
    const out = {};
    const k = this.kit.materials;
    for (const [name, m] of Object.entries(k)) {
      if (name === 'StreetDecals') continue;
      if (isMask) {
        if (name !== 'Glass') out[name] = new THREE.MeshBasicMaterial({ color: name === 'FakeInterior' ? 0xffffff : 0x000000 });
        continue;
      }
      if (name === 'FakeInterior') { out[name] = m; continue; }
      if (name === 'Glass') { out[name] = new THREE.MeshBasicMaterial({ color: 0x10151a, transparent: true, opacity: 0.35, depthWrite: false }); continue; }
      const b = new THREE.MeshBasicMaterial({ map: m.map, color: m.color });
      if (m.onBeforeCompile && m.customProgramCacheKey) { b.onBeforeCompile = m.onBeforeCompile; b.customProgramCacheKey = () => 'bake' + m.customProgramCacheKey(); }
      out[name] = b;
    }
    return out;
  }

  beginGroup(g) { this.group = g; }
  endGroup() { this.group = null; }

  // 部品 name の正面の絵を、部品の置き場所 m に貼る
  add(name, m, tint) {
    const r = this.rects[name];
    if (!r) return;
    const q = m.clone().multiply(new THREE.Matrix4().compose(
      new THREE.Vector3((r.x0 + r.x1) / 2, r.y0, 0.04), new THREE.Quaternion(), new THREE.Vector3(r.x1 - r.x0, r.y1 - r.y0, 1)));
    this.push(q, r, tint);
  }
  // 任意の四角形 (m の原点が下辺の中央、幅 w 高さ h、+z 向き)
  addQuad(key, m, w, h, tint) {
    const r = this.rects[key];
    const q = m.clone().multiply(new THREE.Matrix4().makeScale(w, h, 1));
    this.push(q, r, tint);
  }
  push(q, r, tint) {
    const g = this.group;
    const idx = this.list.length;
    if (g) { if (g.imp0 === undefined) g.imp0 = idx; g.imp1 = idx + 1; }
    this.list.push({ m: q, r, tint });
  }

  build(scene) {
    const n = this.list.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const rect = new Float32Array(n * 4), tint = new Float32Array(n * 3), info = new Float32Array(n * 2);
    const c = new THREE.Color();
    this.list.forEach((it, i) => {
      rect.set([it.r.u0, it.r.v0, it.r.u1, it.r.v1], i * 4);
      c.copy(it.tint || new THREE.Color(1, 1, 1));
      tint.set([c.r, c.g, c.b], i * 3);
      info.set([0, Math.random()], i * 2);
    });
    geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    this.info = new THREE.InstancedBufferAttribute(info, 2);
    this.info.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aInfo', this.info);
    const mat = new THREE.MeshStandardMaterial({ map: this.atlas, roughness: 0.9, metalness: 0, shadowSide: THREE.DoubleSide });
    const U = this.uniforms;
    const maskTex = this.mask;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMask = { value: maskTex };
      sh.uniforms.uNight = U.uNight;
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'attribute vec4 aRect; attribute vec3 aTint; attribute vec2 aInfo; varying vec3 vTint; varying float vSeed;\nvoid main() {')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = mix(aRect.xy, aRect.zw, uv); vTint = aTint; vSeed = aInfo.y;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n if (aInfo.x < 0.5) transformed = vec3(0.0);');
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform sampler2D uMask; uniform float uNight; varying vec3 vTint; varying float vSeed; float gMask; vec3 gEmis;\nvoid main() {')
        .replace('#include <map_fragment>', `
          vec4 al = texture2D(map, vMapUv);
          gMask = texture2D(uMask, vMapUv).r;
          diffuseColor.rgb = al.rgb * mix(vTint, vec3(1.0), gMask) * (1.0 - 0.85 * gMask);
          float lit = step(0.45, fract(vSeed * 13.7)); // 板 1 枚 = 窓 1 つなので、板ごとに点ける
          vec3 warm = mix(vec3(1.0, 0.86, 0.66), vec3(0.85, 0.92, 1.0), step(0.7, fract(vSeed * 7.3)));
          gEmis = al.rgb * gMask * ((1.0 - uNight) * 0.6 + uNight * lit * 5.0 * warm);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.12, gMask);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += gEmis;');
    };
    mat.customProgramCacheKey = () => 'impostor1';
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    this.list.forEach((it, i) => mesh.setMatrixAt(i, it.m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    this.mesh = mesh;
    this.list = null;
  }

  setVisible(g, v) {
    if (g.imp0 === undefined) return;
    const a = this.info.array;
    for (let i = g.imp0; i < g.imp1; i++) a[i * 2] = v ? 1 : 0;
    this.info.addUpdateRange(g.imp0 * 2, (g.imp1 - g.imp0) * 2);
    this.info.needsUpdate = true;
  }
}
