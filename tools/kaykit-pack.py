#!/usr/bin/env python3
"""glTF / GLB ファイルをいくつか束ねて、1 つの GLB にする。

KayKit の素材は 1 モデル = 1 ファイル (.gltf + .bin) で配られている。ブラウザで 1 つずつ読むと
通信が数百回になるので、パックごとに 1 つの GLB へまとめる。同じ画像と同じマテリアルは 1 つに寄せる。

使いかた:
  python3 -I tools/kaykit-pack.py out.glb a.gltf b.gltf ...        # 見た目だけ束ねる (アニメは捨てる)
  python3 -I tools/kaykit-pack.py --anims-only --keep Idle,Walking_A out.glb Knight.glb
                                                                   # 骨とアニメだけを取り出す

束ねたあとの各モデルは、元のファイル名 (拡張子なし) の名前のノードになる。three.js では
gltf.scene.getObjectByName('bench') で取り出せる。外部ライブラリは使わない。
"""
import argparse
import base64
import copy
import hashlib
import json
import os
import struct
import urllib.parse

COMP_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}


def read_doc(path: str) -> tuple[dict, list[bytes], str]:
    base = os.path.dirname(path)
    if path.lower().endswith('.glb'):
        b = open(path, 'rb').read()
        off, j, bins = 12, None, []
        while off < len(b):
            ln, typ = struct.unpack('<II', b[off:off + 8])
            data = b[off + 8:off + 8 + ln]
            if typ == 0x4E4F534A:
                j = json.loads(data)
            elif typ == 0x004E4942:
                bins.append(data)
            off += 8 + ln
        return j, bins, base
    j = json.load(open(path, encoding='utf-8'))
    bufs = []
    for bf in j.get('buffers', []):
        uri = bf['uri']
        if uri.startswith('data:'):
            bufs.append(base64.b64decode(uri.split(',', 1)[1]))
        else:
            bufs.append(open(os.path.join(base, urllib.parse.unquote(uri)), 'rb').read())
    return j, bufs, base


class Packer:
    def __init__(self) -> None:
        self.j = {'asset': {'version': '2.0', 'generator': 'lagoon-games tools/kaykit-pack.py'},
                  'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'accessors': [],
                  'bufferViews': [], 'materials': [], 'textures': [], 'images': [], 'samplers': [],
                  'skins': [], 'animations': []}
        self.bin = bytearray()
        self.cache: dict[str, int] = {}

    def _view(self, data: bytes, stride: int | None = None, target: int | None = None) -> int:
        self.bin += b'\0' * ((-len(self.bin)) % 4)
        bv = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if stride:
            bv['byteStride'] = stride
        if target:
            bv['target'] = target
        self.bin += data
        self.j['bufferViews'].append(bv)
        return len(self.j['bufferViews']) - 1

    def _dedupe(self, kind: str, obj: dict) -> int:
        key = kind + json.dumps({k: v for k, v in obj.items() if k != 'name'}, sort_keys=True)
        if key not in self.cache:
            self.j[kind].append(obj)
            self.cache[key] = len(self.j[kind]) - 1
        return self.cache[key]

    def add_file(self, path: str, name: str, keep_anims: set[str] | None, anims_only: bool) -> None:
        j, bufs, base = read_doc(path)
        amap: dict[int, int] = {}
        tmap: dict[int, int] = {}

        def acc(i: int, target: int | None = None) -> int:
            if i in amap:
                return amap[i]
            a = copy.deepcopy(j['accessors'][i])
            assert 'sparse' not in a, 'sparse accessor には対応していない'
            bv = j['bufferViews'][a['bufferView']]
            esize = COMP_SIZE[a['componentType']] * TYPE_N[a['type']]
            stride = bv.get('byteStride') or esize
            start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
            length = stride * (a['count'] - 1) + esize
            data = bufs[bv.get('buffer', 0)][start:start + length]
            a['bufferView'] = self._view(data, stride if stride != esize else None, target)
            a.pop('byteOffset', None)
            self.j['accessors'].append(a)
            amap[i] = len(self.j['accessors']) - 1
            return amap[i]

        def image(i: int) -> int:
            im = j['images'][i]
            if 'bufferView' in im:
                bv = j['bufferViews'][im['bufferView']]
                s = bv.get('byteOffset', 0)
                data, mime = bufs[bv.get('buffer', 0)][s:s + bv['byteLength']], im['mimeType']
            else:
                data = open(os.path.join(base, urllib.parse.unquote(im['uri'])), 'rb').read()
                mime = 'image/png' if im['uri'].lower().endswith('.png') else 'image/jpeg'
            key = 'img' + hashlib.sha1(data).hexdigest()
            if key not in self.cache:
                self.j['images'].append({'name': im.get('name', ''), 'mimeType': mime, 'bufferView': self._view(data)})
                self.cache[key] = len(self.j['images']) - 1
            return self.cache[key]

        def texture(i: int) -> int:
            if i in tmap:
                return tmap[i]
            t = j['textures'][i]
            out = {'source': image(t['source'])}
            if 'sampler' in t:
                out['sampler'] = self._dedupe('samplers', copy.deepcopy(j['samplers'][t['sampler']]))
            tmap[i] = self._dedupe('textures', out)
            return tmap[i]

        def material(i: int) -> int:
            m = copy.deepcopy(j['materials'][i])
            for holder in (m, m.get('pbrMetallicRoughness', {})):
                for k, v in holder.items():
                    if k.endswith('Texture') and isinstance(v, dict) and 'index' in v:
                        v['index'] = texture(v['index'])
            return self._dedupe('materials', m)

        def mesh(i: int) -> int:
            m = copy.deepcopy(j['meshes'][i])
            for p in m['primitives']:
                p['attributes'] = {k: acc(v, 34962) for k, v in p['attributes'].items()}
                if 'indices' in p:
                    p['indices'] = acc(p['indices'], 34963)
                if 'material' in p:
                    p['material'] = material(p['material'])
                if 'targets' in p:
                    p['targets'] = [{k: acc(v, 34962) for k, v in t.items()} for t in p['targets']]
            self.j['meshes'].append(m)
            return len(self.j['meshes']) - 1

        # ノードは先に番号だけ割り当てる (skin の joints が前方参照するため)
        roots = j['scenes'][j.get('scene', 0)]['nodes']
        order: list[int] = []

        def walk(n: int) -> None:
            order.append(n)
            for c in j['nodes'][n].get('children', []):
                walk(c)
        for r in roots:
            walk(r)
        first = len(self.j['nodes'])
        nmap = {n: first + k for k, n in enumerate(order)}
        self.j['nodes'].extend({} for _ in order)
        smap: dict[int, int] = {}
        for n in order:
            src = j['nodes'][n]
            out = {k: copy.deepcopy(v) for k, v in src.items() if k in ('name', 'translation', 'rotation', 'scale', 'matrix', 'extras')}
            if src.get('children'):
                out['children'] = [nmap[c] for c in src['children']]
            if not anims_only and 'mesh' in src:
                out['mesh'] = mesh(src['mesh'])
                if 'skin' in src:
                    si = src['skin']
                    if si not in smap:
                        sk = copy.deepcopy(j['skins'][si])
                        sk['joints'] = [nmap[x] for x in sk['joints']]
                        if 'skeleton' in sk:
                            sk['skeleton'] = nmap[sk['skeleton']]
                        if 'inverseBindMatrices' in sk:
                            sk['inverseBindMatrices'] = acc(sk['inverseBindMatrices'])
                        self.j['skins'].append(sk)
                        smap[si] = len(self.j['skins']) - 1
                    out['skin'] = smap[si]
            self.j['nodes'][nmap[n]] = out

        for an in j.get('animations', []):
            if keep_anims is None or an.get('name') not in keep_anims:
                continue
            if any(a.get('name') == an['name'] for a in self.j['animations']):
                continue
            o = {'name': an['name'], 'samplers': [], 'channels': []}
            for s in an['samplers']:
                o['samplers'].append({'input': acc(s['input']), 'output': acc(s['output']),
                                      'interpolation': s.get('interpolation', 'LINEAR')})
            for c in an['channels']:
                if c['target'].get('node') in nmap:
                    o['channels'].append({'sampler': c['sampler'], 'target': {'node': nmap[c['target']['node']], 'path': c['target']['path']}})
            self.j['animations'].append(o)

        if len(roots) == 1 and not anims_only:
            self.j['nodes'][nmap[roots[0]]]['name'] = name
            self.j['scenes'][0]['nodes'].append(nmap[roots[0]])
        else:
            self.j['nodes'].append({'name': name, 'children': [nmap[r] for r in roots]})
            self.j['scenes'][0]['nodes'].append(len(self.j['nodes']) - 1)

    def write(self, path: str) -> None:
        for k in [k for k, v in self.j.items() if isinstance(v, list) and not v]:
            del self.j[k]
        self.bin += b'\0' * ((-len(self.bin)) % 4)
        self.j['buffers'] = [{'byteLength': len(self.bin)}]
        js = json.dumps(self.j, separators=(',', ':')).encode()
        js += b' ' * ((-len(js)) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942) + self.bin)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('out')
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--keep', help='残すアニメの名前 (カンマ区切り)。省くとアニメは捨てる')
    ap.add_argument('--anims-only', action='store_true', help='メッシュを捨て、骨とアニメだけを残す')
    a = ap.parse_args()
    keep = set(a.keep.split(',')) if a.keep else None
    p = Packer()
    for path in a.inputs:
        p.add_file(path, os.path.splitext(os.path.basename(path))[0], keep, a.anims_only)
    p.write(a.out)
    print(f'{a.out}: {len(a.inputs)} files, {os.path.getsize(a.out) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
