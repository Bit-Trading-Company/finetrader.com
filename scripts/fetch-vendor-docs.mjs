/**
 * Mirror the Satflow and UniSat docs we depend on, as Markdown.
 *
 * Both sites publish an llms.txt index and serve a .md variant of every page,
 * so unlike ord.net there is no HTML conversion to do — the pages are fetched
 * as-is.
 *
 * UniSat's index covers their whole product (335 pages of wallet guides and
 * roadmaps). Only the indexer and collection endpoints this app calls are
 * mirrored; the filter below is the list of what we actually use.
 *
 *   node scripts/fetch-vendor-docs.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_ROOT = 'docs/reference';

/** Pull "- [Title](url.md): summary" entries out of an llms.txt. */
const parseIndex = (text) =>
  [...text.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+\.md)\)/g)].map((m) => ({
    title: m[1],
    url: m[2],
  }));

const slugFor = (url) =>
  new URL(url).pathname.replace(/^\/|\.md$/g, '').replace(/\//g, '__') + '.md';

const mirror = async ({ name, indexUrl, dir, keep }) => {
  const index = await (await fetch(indexUrl)).text();
  const all = parseIndex(index);
  const pages = keep ? all.filter((p) => keep(p.url)) : all;

  const outDir = path.join(OUT_ROOT, dir);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'llms.txt'), index, 'utf8');

  let ok = 0;
  let failed = 0;
  for (const page of pages) {
    const res = await fetch(page.url, { headers: { accept: 'text/markdown' } });
    const body = res.ok ? await res.text() : '';
    // These sites answer 200 with a "Page Not Found" body, so check content.
    if (!res.ok || /^#\s*Page Not Found/m.test(body)) {
      failed += 1;
      console.log(`  MISS ${page.url}`);
      continue;
    }
    const header = `<!--\n${name} docs — ${page.title}\nSource: ${page.url}\nRetrieved: ${new Date().toISOString().slice(0, 10)}\nMirrored for offline reference; the vendor is the source of truth.\n-->\n\n`;
    await writeFile(
      path.join(outDir, slugFor(page.url)),
      header + body,
      'utf8'
    );
    ok += 1;
  }
  console.log(
    `${name}: ${ok} pages mirrored, ${failed} missing (of ${all.length} indexed)`
  );
};

await mirror({
  name: 'Satflow',
  indexUrl: 'https://docs.satflow.com/llms.txt',
  dir: 'satflow',
});

/** The UniSat surfaces this app calls: address/UTXO/inscription + collections. */
const UNISAT_KEEP =
  /\/(open-api-documentation\.md|how-to-acquire-a-unisat-api-key\.md|api-terms-of-use\.md|api-for-bitcoin\/general[a-z0-9/-]*\.md|api-for-bitcoin\/unisat-collection[a-z0-9/-]*\.md)$/;

await mirror({
  name: 'UniSat',
  indexUrl: 'https://docs.unisat.io/llms.txt',
  dir: 'unisat',
  keep: (url) => UNISAT_KEEP.test(url),
});
