// Review script: serves website/ locally, screenshots every page at every width,
// checks horizontal overflow, console errors, tap-target sizes and first-load weight,
// then exercises the hero demo with touch emulation.
//   node website/_tools/review.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_review');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'text/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { f = path.join(root, '404.html'); res.statusCode = 404; }
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const WIDTHS = [360, 390, 430, 768, 1024, 1440, 1920];
const PAGES = ['index.html', 'confidentialite.html', 'mentions-legales.html', 'nope/404'];
const only = process.argv[2];
const browser = await chromium.launch();
const NOSMOOTH = { content: 'html{scroll-behavior:auto!important}' }; // instant scrolling so measurements are not taken mid-animation
const problems = [];
const note = (m) => { problems.push(m); console.log('  ✗ ' + m); };

for (const w of WIDTHS) {
  const mobile = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 800 : 900 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  for (const pg of PAGES) {
    if (only && !pg.startsWith(only)) continue;
    const page = await ctx.newPage();
    const errors = [];
    const pending = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(pg.includes('404') && /404/.test(m.text()))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => pending.push(r.body().then((b) => [b.length, r.url().replace(base, '')], () => null)));
    await page.goto(base + pg, { waitUntil: 'load' });
    await page.addStyleTag(NOSMOOTH);
    // everything requested up to the load event = first load
    const firstReqs = (await Promise.all(pending.slice())).filter(Boolean);
    const firstLoad = firstReqs.reduce((a, r) => a + r[0], 0);
    // scroll through so lazy content and reveals settle
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 600) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(120); }
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
    const res = await page.evaluate(() => {
      const de = document.documentElement;
      const wide = [...document.querySelectorAll('body *')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width && r.right > de.clientWidth + 1 && !e.closest('.world, .world-crop, .tray-list, .tabs, .table-scroll');
      }).slice(0, 5).map((e) => e.tagName + '.' + e.className);
      const small = [...document.querySelectorAll('a, button, summary, input')].filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || e.closest('.prose, .fine, .faq details > div, .hero-lede, p')) return false; // inline text links
        return r.height < 44 || r.width < 44;
      }).map((e) => (e.id || e.className || e.textContent.trim().slice(0, 20)) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height));
      return { overflow: de.scrollWidth - de.clientWidth, wide, small };
    });
    const name = pg.replace(/[^a-z0-9]+/gi, '-').replace(/-html$/, '');
    await page.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: true });
    if (pg === 'index.html') await page.screenshot({ path: path.join(out, `${name}-${w}-fold.png`) });
    console.log(`${pg} @${w}: first load ${(firstLoad / 1024).toFixed(0)} KB in ${firstReqs.length} requests`);
    if (pg === 'index.html' && w === 390) firstReqs.sort((a, b) => b[0] - a[0]).slice(0, 12).forEach((r) => console.log(`    ${(r[0] / 1024).toFixed(0).padStart(5)} KB  ${r[1]}`));
    if (res.overflow > 0) note(`${pg} @${w}: horizontal overflow ${res.overflow}px ${res.wide.join(', ')}`);
    if (res.small.length) note(`${pg} @${w}: small tap targets: ${res.small.join(' | ')}`);
    if (errors.length) note(`${pg} @${w}: console errors: ${errors.join(' | ')}`);
    if (pg === 'index.html' && firstLoad > 1.5 * 1024 * 1024) note(`index @${w}: first load over 1.5 MB`);
    await page.close();
  }
  await ctx.close();
}

// ── hero demo with touch emulation ──
// Skipped while the hero demo is removed from index.html (kept in _tools/removed-demo/).
if (fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="stage"') && (!only || only === 'index.html')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + 'index.html', { waitUntil: 'load' });
  await page.addStyleTag(NOSMOOTH);
  await page.locator('#stage').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const state = () => page.evaluate(() => [...document.querySelectorAll('.item')].map((e) => ({ label: e.getAttribute('aria-label').split(' — ')[0], t: e.style.transform, sel: e.classList.contains('is-selected') })));
  const centre = async (sel) => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) problems.push('demo: ' + what); };

  console.log('demo (touch, 390 px):');
  const s0 = await state();
  check(s0.length === 3, 'pre-composed scene has 3 elements');

  // 1. swipe starting on an unselected element scrolls the page.
  //    Own context: headless Chromium drops the click of the first tap that follows a synthetic fling.
  {
    const c1 = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p1 = await c1.newPage();
    await p1.goto(base + 'index.html', { waitUntil: 'load' });
    await p1.addStyleTag(NOSMOOTH);
    await p1.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
    await p1.waitForTimeout(400);
    const cdp1 = await c1.newCDPSession(p1);
    const t1 = (type, pts) => cdp1.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
    const b = await p1.locator('.item--fire >> nth=1').boundingBox();
    const c = [b.x + b.width / 2, b.y + b.height / 2];
    const y0 = await p1.evaluate(() => scrollY);
    await t1('touchStart', [c]); for (let i = 1; i <= 8; i++) await t1('touchMove', [[c[0], c[1] - i * 25]]); await t1('touchEnd', []);
    await p1.waitForTimeout(500);
    const y1 = await p1.evaluate(() => scrollY);
    check(y1 > y0 + 50, `swipe over the scene scrolls the page (${y0} → ${y1})`);
    await c1.close();
  }
  let c, before, after;

  // 2. tap selects, drag moves
  await page.locator('.item--fire >> nth=1').tap();
  await page.waitForTimeout(300);
  c = await centre('.item--fire >> nth=1');
  check((await state())[2].sel, 'tap selects the element');
  before = (await state())[2].t;
  await touch('touchStart', [c]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[c[0] - i * 10, c[1] - i * 6]]); await touch('touchEnd', []);
  after = (await state())[2].t;
  check(before !== after && /translate/.test(after), 'one-finger drag moves it');
  await page.screenshot({ path: path.join(out, 'demo-1-selected-moved.png') });

  // 3. two-finger pinch scales + rotates
  c = await centre('.item.is-selected');
  before = (await state())[2].t;
  await touch('touchStart', [c]);
  await touch('touchStart', [c, [c[0] + 60, c[1]]]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [c, [c[0] + 60 + i * 2, c[1] + i * 4]]);
  await touch('touchEnd', []);
  after = (await state())[2].t;
  const sc = (t) => +/scale\(([\d.]+)\)/.exec(t)[1], ro = (t) => +/rotate\(([-\d.]+)deg\)/.exec(t)[1];
  check(sc(after) > sc(before) && ro(after) !== ro(before), `pinch scales and rotates (×${sc(before)} → ×${sc(after).toFixed(2)}, ${ro(after).toFixed(0)}°)`);

  // 4. single-finger handles
  before = after;
  c = await centre('.handle--scale');
  await touch('touchStart', [c]); for (let i = 1; i <= 5; i++) await touch('touchMove', [[c[0] - i * 6, c[1] - i * 6]]); await touch('touchEnd', []);
  after = (await state())[2].t;
  check(sc(after) < sc(before), 'scale handle works with one finger');
  before = after;
  c = await centre('.handle--rot');
  await touch('touchStart', [c]); for (let i = 1; i <= 5; i++) await touch('touchMove', [[c[0] + i * 9, c[1] + i * 4]]); await touch('touchEnd', []);
  after = (await state())[2].t;
  check(ro(after) !== ro(before), 'rotate handle works with one finger');
  await page.screenshot({ path: path.join(out, 'demo-2-scaled-rotated.png') });

  // 5. mask off / on, edit outline
  await page.locator('#mask-toggle').tap();
  check(await page.evaluate(() => document.getElementById('mask').hidden), 'mask switches off');
  await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(out, 'demo-3-mask-off.png') });
  await page.locator('#mask-edit-toggle').tap();
  check(await page.evaluate(() => !document.getElementById('mask').hidden && !document.getElementById('mask-pts').hidden), 'editing the outline switches the mask back on and shows its corners');
  await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(450);
  const clip0 = await page.evaluate(() => document.getElementById('mask').style.clipPath);
  c = await centre('.mask-pt >> nth=0');
  await touch('touchStart', [c]); for (let i = 1; i <= 4; i++) await touch('touchMove', [[c[0] - i * 4, c[1] - i * 6]]); await touch('touchEnd', []);
  check(clip0 !== await page.evaluate(() => document.getElementById('mask').style.clipPath), 'dragging a mask corner reshapes it');
  await page.screenshot({ path: path.join(out, 'demo-4-mask-edit.png') });

  // 6. tint, add from tray, delete, reset
  await page.locator('[data-tint="vert"]').tap();
  check(await page.evaluate(() => document.querySelector('.item--smoke img').style.filter.includes('tint-vert')), 'smoke tint "Vert toxique" applies');
  await page.locator('#tab-explosions').tap();
  await page.locator('[data-key="explosion-night"]').tap();
  check((await state()).length === 4, 'tapping a tray effect adds it');
  await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'demo-5-tint-added.png') });
  await page.locator('.handle--del').tap();
  check((await state()).length === 3, 'delete handle removes the selected element');
  await page.locator('#reset').tap();
  const s1 = await state();
  check(JSON.stringify(s1.map((x) => x.t)) === JSON.stringify(s0.map((x) => x.t)), 'Réinitialiser restores the starting scene');

  // 7. scroll past the demo from top to the next section with swipes only
  await page.evaluate(() => scrollTo(0, 0));
  for (let k = 0; k < 14; k++) {
    await touch('touchStart', [[195, 620]]); for (let i = 1; i <= 8; i++) await touch('touchMove', [[195, 620 - i * 60]]); await touch('touchEnd', []);
    await page.waitForTimeout(350);
  }
  const past = await page.evaluate(() => document.getElementById('fonctionnement').getBoundingClientRect().top < innerHeight);
  check(past, 'swiping from the top of the page gets past the demo');

  // 8. keyboard (desktop)
  const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await d.goto(base + 'index.html', { waitUntil: 'load' });
  await d.addStyleTag(NOSMOOTH);
  await d.locator('.item >> nth=1').focus();
  const k0 = await d.evaluate(() => document.querySelector('.item.is-selected').style.transform);
  await d.keyboard.press('ArrowRight'); await d.keyboard.press('+'); await d.keyboard.press('r');
  const k1 = await d.evaluate(() => document.querySelector('.item.is-selected').style.transform);
  check(k0 !== k1 && /rotate\(15deg\)/.test(k1), 'keyboard moves, scales and rotates the focused element');
  await d.keyboard.press('Delete');
  check(await d.evaluate(() => document.querySelectorAll('.item').length) === 2, 'Suppr removes it');
  // mouse drag from the tray
  await d.evaluate(() => document.getElementById('tray').scrollIntoView({ block: 'end' }));
  const tb = await d.locator('[data-key="fire-body"]').boundingBox(), sb = await d.locator('#stage').boundingBox();
  await d.mouse.move(tb.x + 40, tb.y + 40); await d.mouse.down();
  await d.mouse.move(sb.x + 300, sb.y + 400, { steps: 8 }); await d.mouse.up();
  check(await d.evaluate(() => document.querySelectorAll('.item').length) === 3, 'mouse drag from the tray drops an effect on the photo');
  await d.waitForTimeout(2500);
  await d.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
  await d.waitForTimeout(600);
  await d.screenshot({ path: path.join(out, 'demo-6-desktop.png') });
  // animated files load after the page, and stop when off screen
  const anim = await d.evaluate(() => [...document.querySelectorAll('.item img')].filter((i) => !i.src.includes('.poster.')).length);
  await d.evaluate(() => scrollTo(0, 5000)); await d.waitForTimeout(400);
  const animOff = await d.evaluate(() => [...document.querySelectorAll('.item img')].filter((i) => !i.src.includes('.poster.')).length);
  check(anim > 0 && animOff === 0, `effects animate on screen (${anim}) and fall back to stills off screen (${animOff})`);
  // reduced motion
  const rm = await browser.newPage({ viewport: { width: 1024, height: 800 }, reducedMotion: 'reduce' });
  await rm.goto(base + 'index.html', { waitUntil: 'load' }); await rm.waitForTimeout(1500);
  check(await rm.evaluate(() => [...document.querySelectorAll('.item img')].every((i) => i.src.includes('.poster.'))), 'reduced motion keeps still frames');
  await rm.screenshot({ path: path.join(out, 'demo-7-reduced-motion.png') });
  if (errors.length) note('demo: page errors ' + errors.join(' | '));
}

await browser.close();
server.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nNo problems found');
process.exit(problems.length ? 1 : 0);
