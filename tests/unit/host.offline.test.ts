// MOD-Host offline policy (ADR-0011, F-017) — the pure parts of /sw.js and of the page's seed list,
// and the MOD-Build list of the build's files.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM build script without type declarations
import { ASSETS_META as BUILD_META, assetList } from '../../scripts/lib/offline.mjs';
import { LANGUAGES } from '../../src/copy';
import { matchLanguage } from '../../src/host/language';
import { ASSETS_META as PAGE_META, seedList, settleWithin } from '../../src/host/offline';
import {
  ASSETS_META,
  CACHE_NAME,
  PAGE_LANGUAGES,
  cacheKey,
  isSupportedLanguage,
  keepsPageQuery,
  pageAssets,
  pageStorable,
  prunable,
  routeOf,
  seedPlan,
  staleCaches,
  storedPage,
} from '../../src/host/offline-policy';

const O = 'https://image-annotator.tarokit.app';
const page = (files: string[]) =>
  `<!doctype html><head><meta name="tk-assets" content="${files.join(' ')}" /></head><body></body>`;

describe('MOD-Host offline policy', () => {
  it('ADR-0011 the page, the worker and the build agree on the meta name and the languages', () => {
    expect(ASSETS_META).toBe(PAGE_META);
    expect(ASSETS_META).toBe(BUILD_META);
    expect([...PAGE_LANGUAGES]).toEqual([...LANGUAGES]);
  });

  it('F-017.R2 only the tool’s own page and hashed files have a cache key (NFR-01, INV-04)', () => {
    expect(cacheKey(new URL(`${O}/`), O)).toBe(`${O}/`);
    expect(cacheKey(new URL(`${O}/index.html?theme=dark&lang=vi`), O)).toBe(`${O}/`);
    expect(cacheKey(new URL(`${O}/assets/index-abc.js`), O)).toBe(`${O}/assets/index-abc.js`);
    expect(cacheKey(new URL(`${O}/assets/font-x.woff2`), O)).toBe(`${O}/assets/font-x.woff2`);
    expect(cacheKey(new URL(`${O}/assets/index-abc.js?x=1`), O)).toBeNull();
    expect(cacheKey(new URL(`${O}/assets/index-abc.js.map`), O)).toBeNull();
    expect(cacheKey(new URL(`${O}/sw.js`), O)).toBeNull();
    expect(cacheKey(new URL(`${O}/third-party-notices.txt`), O)).toBeNull();
    expect(cacheKey(new URL(`${O}/assets/sub/x.js`), O)).toBeNull();
    expect(cacheKey(new URL('https://tarokit.app/assets/index-abc.js'), O)).toBeNull();
    expect(cacheKey(new URL(`blob:${O}/1234`), O)).toBeNull();
    expect(cacheKey(new URL('data:image/png;base64,AAAA'), O)).toBeNull();
  });

  it('F-017.R2 the worker answers only GETs for its own page (navigations) and hashed files', () => {
    expect(routeOf({ method: 'GET', url: `${O}/?theme=dark`, mode: 'navigate' }, O)).toBe('page');
    expect(routeOf({ method: 'GET', url: `${O}/assets/a-1.js`, mode: 'cors' }, O)).toBe('asset');
    expect(routeOf({ method: 'GET', url: `${O}/assets/w-1.js`, mode: 'same-origin' }, O)).toBe('asset');
    expect(routeOf({ method: 'POST', url: `${O}/assets/a-1.js`, mode: 'cors' }, O)).toBeNull();
    expect(routeOf({ method: 'GET', url: `${O}/favicon.ico`, mode: 'no-cors' }, O)).toBeNull();
    expect(routeOf({ method: 'GET', url: `${O}/other`, mode: 'navigate' }, O)).toBeNull();
    expect(routeOf({ method: 'GET', url: `https://github.com/x`, mode: 'navigate' }, O)).toBeNull();
    expect(routeOf({ method: 'GET', url: `${O}/`, mode: 'cors' }, O)).toBeNull();
  });

  it('RULE-16 RULE-17 the seeded page keeps only a supported theme and language query', () => {
    expect(keepsPageQuery('')).toBe(true);
    expect(keepsPageQuery('?theme=dark')).toBe(true);
    expect(keepsPageQuery('?theme=light&lang=vi-VN')).toBe(true);
    expect(keepsPageQuery('?lang=vi%2DVN&theme=dark')).toBe(true);
    expect(keepsPageQuery('?lang=en-GB')).toBe(true);
    expect(keepsPageQuery('?theme=blue')).toBe(false);
    expect(keepsPageQuery('?lang=fr')).toBe(false);
    expect(keepsPageQuery('?theme=dark&theme=light')).toBe(false);
    expect(keepsPageQuery('?theme=dark&x=1')).toBe(false);
    expect(keepsPageQuery('?theme')).toBe(false);
    expect(keepsPageQuery('?')).toBe(false);
    expect(keepsPageQuery(`?lang=vi${'-x'.repeat(20)}`)).toBe(false);
    expect(keepsPageQuery('?lang=%E0%A4%A')).toBe(false);
  });

  it('RULE-17 the worker’s language check matches matchLanguage', () => {
    for (const v of ['en-US', 'EN-us', 'en', 'en-GB', 'vi', 'vi_VN', 'vi-vn', ' vi ', 'fr', 'de-DE', '', 'zz', '-']) {
      expect(isSupportedLanguage(v), v).toBe(matchLanguage(v) !== null);
    }
  });

  it('F-017.R1 the seed plan keeps the tool’s files, page last, and drops everything else', () => {
    const plan = seedPlan(
      {
        type: 'seed',
        urls: [
          '/?theme=dark&lang=vi-VN',
          '/assets/a-1.js',
          '/assets/a-1.js',
          `${O}/assets/b-2.css#x`,
          'https://evil.example/assets/c.js',
          'blob:https://image-annotator.tarokit.app/abc',
          '/assets/a-1.js?v=2',
          '/sw.js',
          42,
          '/index.html',
        ],
      },
      O,
    );
    expect(plan.assets).toEqual([
      { href: `${O}/assets/a-1.js`, key: `${O}/assets/a-1.js` },
      { href: `${O}/assets/b-2.css`, key: `${O}/assets/b-2.css` },
    ]);
    expect(plan.page).toEqual({ href: `${O}/?theme=dark&lang=vi-VN`, key: `${O}/` });
    expect(seedPlan({ type: 'seed', urls: ['/?x=secret'] }, O).page).toEqual({ href: `${O}/`, key: `${O}/` });
    expect(seedPlan({ type: 'other', urls: ['/'] }, O)).toEqual({ assets: [], page: null });
    expect(seedPlan(null, O)).toEqual({ assets: [], page: null });
    expect(seedPlan({ type: 'seed', urls: 'x' }, O)).toEqual({ assets: [], page: null });
    const many = Array.from({ length: 100 }, (_, i) => `/assets/f-${i}.js`);
    expect(seedPlan({ type: 'seed', urls: many }, O).assets.length).toBe(64);
  });

  it('F-017.R1 a page is stored only when every file its build names is cached', () => {
    const files = ['/assets/a-1.js', '/assets/b-2.css', '/assets/w-3.js', '/assets/f-4.woff2'];
    const keys = files.map((f) => O + f);
    expect(pageAssets(page(files), O)).toEqual(keys);
    expect(pageStorable(page(files), keys, O)).toBe(true);
    expect(pageStorable(page(files), keys.slice(0, 3), O)).toBe(false);
    expect(pageStorable('<html></html>', keys, O)).toBe(false); // no list: never stored
    expect(pageAssets(page([]), O)).toBeNull();
    expect(pageAssets(page(['https://evil.example/assets/a.js']), O)).toBeNull();
    expect(pageAssets(page(['/sw.js']), O)).toBeNull();
  });

  it('F-017.R3 pruning removes an older version’s files and anything off the list, never the page', () => {
    const cached = [`${O}/`, `${O}/assets/old-1.js`, `${O}/assets/new-2.js`, `${O}/sw.js`, `${O}/assets/x.js?q=1`];
    expect(prunable(cached, [`${O}/assets/new-2.js`], O)).toEqual([
      `${O}/assets/old-1.js`,
      `${O}/sw.js`,
      `${O}/assets/x.js?q=1`,
    ]);
  });

  it('F-017.R3 one cache shared by every worker version; only other schema versions are stale', () => {
    expect(staleCaches(['image-annotator-v0', CACHE_NAME, 'other-tool-v1'])).toEqual(['image-annotator-v0']);
  });

  it('INV-04 the stored page keeps its headers (the CSP) and drops the address it was fetched from', async () => {
    const headers = new Headers({ 'content-security-policy': "connect-src 'none'", 'content-type': 'text/html' });
    const res = storedPage('<html></html>', { status: 200, statusText: 'OK', headers });
    expect(res.url).toBe('');
    expect(res.headers.get('content-security-policy')).toBe("connect-src 'none'");
    expect(await res.text()).toBe('<html></html>');
  });
});

describe('MOD-Host offline seed list (page side)', () => {
  it('F-017.R1 names the page as loaded, every loaded own file and every file of the build', () => {
    const list = seedList(
      `${O}/?theme=dark&lang=vi-VN`,
      [
        `${O}/assets/index-1.js`,
        `${O}/assets/font-2.woff2`,
        'https://evil.example/assets/x.js',
        `blob:${O}/abc`,
        'data:image/png;base64,AA',
        `${O}/favicon.ico`,
        `${O}/assets/index-1.js.map`,
      ],
      ['/assets/index-1.js', '/assets/worker-3.js'],
      O,
    );
    expect(list).toEqual([
      '/?theme=dark&lang=vi-VN',
      '/assets/index-1.js',
      '/assets/font-2.woff2',
      '/assets/worker-3.js',
    ]);
  });

  it('F-017.R1 the build lists every hashed file but its source maps', () => {
    expect(
      assetList([
        'index.html',
        'sw.js',
        'assets/index-1.js',
        'assets/index-1.js.map',
        'assets/f-2.woff2',
        'assets/a-0.css',
      ]),
    ).toEqual(['/assets/a-0.css', '/assets/f-2.woff2', '/assets/index-1.js']);
  });

  it('ADR-0011 the seed waits for the fonts, but not forever', async () => {
    let settled = false;
    await settleWithin(Promise.reject(new Error('font failed')), 1000).then(() => (settled = true));
    expect(settled).toBe(true);
    const started = Date.now();
    await settleWithin(new Promise(() => undefined), 20);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
