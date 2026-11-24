// DOWNTOWN (games/downtown-city) の 3D 素材 assets/city.glb を、Quaternius の Downtown City MegaKit から作り直す。
//
// 1. https://quaternius.itch.io/downtown-city-megakit から無料版 `Downtown City MegaKit[Standard].zip` を落として展開する
// 2. 作業用のフォルダで部品を入れる (リポジトリには node_modules を置かない)
//      npm i @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 sharp meshoptimizer
// 3. そのフォルダにこのファイルを写して実行する
//      node downtown-city-assets.mjs "<展開先>/Exports/glTF (Godot)" <リポジトリ>/games/downtown-city/assets/city.glb
//
// 部品はシーン直下のノードとして、元のファイル名で並ぶ。テクスチャは 1024 px の WebP、形は meshopt で圧縮する。
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, unpartition, meshopt, weld } from '@gltf-transform/functions';
import { mergeDocuments } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [src, out, sizeArg] = process.argv.slice(2);
const size = Number(sizeArg || 1024); // テクスチャの最大辺 (3 つ目の引数で変えられる)
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const files = fs.readdirSync(src).filter((f) => f.endsWith('.gltf')).sort();
const doc = await io.read(path.join(src, files[0]));
const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
scene.listChildren()[0].setName(files[0].replace(/\.gltf$/, ''));

for (const f of files.slice(1)) {
  const part = await io.read(path.join(src, f));
  const map = mergeDocuments(doc, part);
  for (const s of part.getRoot().listScenes()) {
    const ts = map.get(s);
    const kids = ts.listChildren();
    if (kids.length !== 1) throw new Error(`${f}: root node が ${kids.length} 個`);
    kids[0].setName(f.replace(/\.gltf$/, ''));
    scene.addChild(kids[0]);
    ts.dispose();
  }
}

// 使わない頂点属性を落とす (three.js は uv1 を aoMap/lightMap にしか使わない。COLOR_0・COLOR_1 は元シェーダーの汚れの位置で、three.js では色として掛かって赤いしみになる)
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const sem of ['TEXCOORD_1', 'TEXCOORD_2', 'COLOR_0', 'COLOR_1']) {
      const a = prim.getAttribute(sem);
      if (a) prim.setAttribute(sem, null);
    }
  }
}

await doc.transform(
  unpartition(),
  // マテリアルは統合しない (Pale・Dark・Green は中身が同じでも名前で色を作り分けるため)
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  prune(),
  weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 85 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(out, doc);
console.log(out, (fs.statSync(out).size / 1e6).toFixed(1) + ' MB', files.length + ' parts');
