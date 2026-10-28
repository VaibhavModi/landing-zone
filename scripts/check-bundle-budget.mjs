import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';

// Caps are ceilings, not exact sizes. Vite inlines VITE_* values, and the
// Vercel preview build sets VITE_WEB3FORMS_KEY (and sometimes
// VITE_STEAM_PROXY_URL). That keeps the recruiter contact-form branch and
// grows those chunks by about 1 KB versus a CI build with the vars unset.
// Headroom covers that and small copy changes. The game chunk is ~35 KB,
// so these caps still cannot hide it, and the marker checks below reject
// it outright if it lands in the home, recruiter, or friend output.
const BASELINE_MAIN = 159464;
const MAIN_BUDGET = 180000;
const RECRUITER_BUDGET = 24000;
const FRIEND_BUDGET = 8000;
const MARKER = 'captcha-hell-game-chunk';

const html = readFileSync('dist/index.html', 'utf8');
const entryMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
if (!entryMatch) {
  console.error('Could not find the main entry script in dist/index.html');
  process.exit(1);
}

const entryPath = `dist${entryMatch[1]}`;
const entryBytes = statSync(entryPath).size;
const entryGzip = gzipSync(readFileSync(entryPath)).length;
const entrySource = readFileSync(entryPath, 'utf8');

const assetNames = readdirSync('dist/assets').filter((name) => name.endsWith('.js') || name.endsWith('.css'));
const sources = new Map(assetNames.map((name) => [name, readFileSync(`dist/assets/${name}`, 'utf8')]));

const gameJs = [...sources.entries()].filter(([, source]) => source.includes(MARKER)).map(([name]) => name);
const recruiterJs = [...sources.entries()]
  .filter(([name, source]) => name.endsWith('.js') && source.includes('On AWS - ATX Refactor'))
  .map(([name]) => name);
const friendJs = [...sources.entries()]
  .filter(([name, source]) => name.endsWith('.js') && source.includes("Games I'm currently playing"))
  .map(([name]) => name);
const mainCss = [...sources.entries()]
  .filter(([name, source]) => name.endsWith('.css') && html.includes(name) && source.includes('.operator-stage'))
  .map(([name]) => name);
const gameCss = [...sources.entries()]
  .filter(([name, source]) => name.endsWith('.css') && source.includes('.ch-widget'))
  .map(([name]) => name);

let failed = false;
const complain = (message) => {
  failed = true;
  console.error(message);
};

console.log(`main ${entryBytes} bytes, gzip ${entryGzip} (baseline ${BASELINE_MAIN}, delta ${entryBytes - BASELINE_MAIN}, budget ${MAIN_BUDGET})`);

if (entryBytes > MAIN_BUDGET) {
  complain(`Main chunk grew past the budget (${entryBytes} > ${MAIN_BUDGET}). The captcha game must stay in its own route chunk.`);
}
if (entrySource.includes(MARKER)) {
  complain('Captcha Hell game code is inside the main entry chunk.');
}
if (html.includes(MARKER) || gameJs.some((name) => html.includes(name))) {
  complain('index.html preloads the captcha game chunk.');
}
if (gameJs.length !== 1) {
  complain(`Expected the game marker in exactly one JS chunk, found ${gameJs.length}: ${gameJs.join(', ') || 'none'}.`);
}
if (recruiterJs.length !== 1) {
  complain(`Expected one recruiter chunk, found ${recruiterJs.length}.`);
} else {
  const size = statSync(`dist/assets/${recruiterJs[0]}`).size;
  console.log(`recruiter ${size} bytes (budget ${RECRUITER_BUDGET})`);
  if (size > RECRUITER_BUDGET) complain(`Recruiter chunk grew (${size} > ${RECRUITER_BUDGET}).`);
  if (sources.get(recruiterJs[0]).includes(MARKER)) complain('Recruiter chunk contains the captcha game.');
}
if (friendJs.length !== 1) {
  complain(`Expected one friend chunk, found ${friendJs.length}.`);
} else {
  const size = statSync(`dist/assets/${friendJs[0]}`).size;
  console.log(`friend ${size} bytes (budget ${FRIEND_BUDGET})`);
  if (size > FRIEND_BUDGET) complain(`Friend chunk grew (${size} > ${FRIEND_BUDGET}).`);
  if (sources.get(friendJs[0]).includes(MARKER)) complain('Friend chunk contains the captcha game.');
}
if (mainCss.some((name) => sources.get(name).includes('.ch-widget'))) {
  complain('Game CSS was merged into the main stylesheet.');
}
if (gameCss.length !== 1) {
  complain(`Expected one game stylesheet, found ${gameCss.length}.`);
} else {
  console.log(`game js ${statSync(`dist/assets/${gameJs[0]}`).size} bytes, css ${statSync(`dist/assets/${gameCss[0]}`).size} bytes`);
}

const secretMarkers = ['GROQ_API_KEY', 'gsk_', 'api.groq.com'];
for (const [name, source] of sources) {
  for (const marker of secretMarkers) {
    if (source.includes(marker)) complain(`${name} contains ${marker}`);
  }
}
for (const marker of secretMarkers) {
  if (html.includes(marker)) complain(`index.html contains ${marker}`);
}

if (failed) process.exit(1);
console.log('bundle budget ok');
