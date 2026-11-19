// Rasterises _tools/scene.svg (the placeholder scene) to a 1600×1000 PNG in the OS temp folder.
// Then convert to WebP:  see README ("Rebuilding assets").   node website/_tools/scene.mjs <out.png>
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) { console.error('usage: node scene.mjs <out.png>'); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(pathToFileURL(path.join(here, 'scene.svg')).href);
await page.screenshot({ path: out });
await browser.close();
