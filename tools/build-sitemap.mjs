// games.js の一覧から sitemap.xml を作り直す。ゲームを足したら実行する。
//   node tools/build-sitemap.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const BASE = 'https://denden047.github.io/lagoon-games/';
const root = fileURLToPath(new URL('..', import.meta.url));

const ctx = {};
vm.runInNewContext(readFileSync(root + 'games.js', 'utf8') + '\nthis.GAMES = GAMES;', ctx);

const newest = ctx.GAMES.map((g) => g.date).sort().at(-1);
const urls = [
  { loc: BASE, lastmod: newest },
  ...ctx.GAMES.map((g) => ({ loc: `${BASE}games/${g.slug}/`, lastmod: g.date })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
writeFileSync(root + 'sitemap.xml', xml);
console.log(`sitemap.xml: ${urls.length} URLs`);
