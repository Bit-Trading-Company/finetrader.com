/**
 * Download the ord.net developer docs and save each page as Markdown.
 *
 * The site is Astro/Starlight and serves no .md variants, so each page's
 * article body is extracted and converted. Tables matter here — the auth and
 * endpoint field tables are most of the content — so the GFM plugin is on.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const OUT = process.argv[2];
const PAGES = [
  ['index', 'https://developers.ord.net/', 'Overview'],
  ['authentication', 'https://developers.ord.net/reference/authentication/', 'Authentication'],
  ['collections', 'https://developers.ord.net/reference/collections/', 'Collections'],
  ['listings', 'https://developers.ord.net/reference/listings/', 'Listings'],
  ['buying', 'https://developers.ord.net/reference/buying/', 'Buying'],
  ['offers', 'https://developers.ord.net/reference/offers/', 'Offers'],
  ['sales', 'https://developers.ord.net/reference/sales/', 'Sales'],
  ['errors-rate-limits', 'https://developers.ord.net/reference/errors-rate-limits/', 'Errors and rate limits'],
];

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
td.use(gfm);
// Starlight wraps code samples in tab widgets; keep the code, drop the chrome.
td.remove(['script', 'style', 'nav', 'starlight-theme-select']);

/*
 * Starlight renders each source line as its own inline <span class="line">.
 * Turndown treats those as inline and runs the whole sample onto one line,
 * which destroys the JSON examples — so rebuild the line breaks here.
 */
td.addRule('starlightCode', {
  filter: (node) =>
    node.nodeName === 'PRE' && node.querySelector('code') !== null,
  replacement: (_content, node) => {
    const code = node.querySelector('code');
    const lines = code.querySelectorAll('.line');
    const text = lines.length
      ? Array.from(lines)
          .map((line) => line.textContent.replace(/\s+$/, ''))
          .join('\n')
      : code.textContent;
    const lang = (node.getAttribute('data-language') || '').trim();
    return `\n\n\`\`\`${lang}\n${text.replace(/\n+$/, '')}\n\`\`\`\n\n`;
  },
});

/** Pull the article body out of the Starlight shell. */
const extractBody = (html) => {
  const main = html.match(/<div class="sl-markdown-content">([\s\S]*?)<\/main>/);
  if (main) return main[1];
  const article = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return article ? article[1] : html;
};

const title = (html) =>
  (html.match(/<title>([^<]*)<\/title>/)?.[1] || '').replace(/\s*\|.*$/, '').trim();

await mkdir(OUT, { recursive: true });
const report = [];

for (const [slug, url, label] of PAGES) {
  const res = await fetch(url, { headers: { accept: 'text/html' } });
  if (!res.ok) {
    report.push({ slug, url, ok: false, status: res.status });
    continue;
  }
  const html = await res.text();
  const md = td
    .turndown(extractBody(html))
    // Starlight puts a self-link under every heading; it is pure noise here.
    .replace(/^\[Section titled [^\]]*\]\([^)]*\)\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const front = `<!--\nord.net API docs — ${label}\nSource: ${url}\nRetrieved: ${new Date().toISOString().slice(0, 10)}\nMirrored for offline reference; ord.net is the source of truth.\n-->\n\n# ${title(html) || label}\n\n`;
  const file = path.join(OUT, `${slug}.md`);
  await writeFile(file, front + md + '\n', 'utf8');
  report.push({ slug, url, ok: true, bytes: (front + md).length, headings: (md.match(/^#{2,3} /gm) || []).length });
}

console.table(report);
