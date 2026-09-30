import { chromium } from 'playwright';

const APP_URL = 'https://joinrealplay.com/';
const DEPLOY_ID = '20260929-4v4-main-thread-freeze-v137';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const requests = [];

await context.route('https://api.clarapmc.com/api/real-play/4v4/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname === '/api/real-play/4v4/me') {
    requests.push({ method: request.method(), path: url.pathname, at: Date.now() });
    return route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization,content-type',
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ok: true,
        userId: 900001,
        playerName: 'DIAGNOSTIC PLAYER',
        clubs: ['lions', 'valiant', 'watchmen', 'conquerors'],
        joinedClub: null,
        preferredClub: null,
        preferencePlayers: [],
        teamStates: ['lions', 'valiant', 'watchmen', 'conquerors'].map((club) => ({ club, status: 'available', memberCount: 0, capacity: 4, expiresAt: null, securedAt: null })),
        formationState: 'team_code',
        rosterLocked: false,
      }),
    });
  }
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' });
  return route.fulfill({ status: 404, body: '{}' });
});

const page = await context.newPage();
await page.addInitScript(() => {
  window.__rp4v4FetchOrigins = [];
  const nativeFetch = window.fetch;
  window.fetch = function(...args) {
    const input = args[0];
    const target = typeof input === 'string' ? input : input?.url;
    if (String(target || '').includes('/api/real-play/4v4/me')) {
      window.__rp4v4FetchOrigins.push({
        at: performance.now(),
        stack: new Error('4v4/me fetch origin').stack,
        open: Boolean(document.querySelector('[data-rp-4v4-static-view].open')),
        hasPanel: Boolean(document.querySelector('.rp-4v4-preference-panel')),
        teamCodeInstalled: window.__realPlay4v4TeamCodeBetaInstalled === true,
      });
    }
    return nativeFetch.apply(this, args);
  };
});

await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction((id) => document.documentElement?.dataset?.rpDeploy === id, DEPLOY_ID, { timeout: 30000 });
await page.waitForSelector('.rp-home-4v4-explore', { state: 'attached', timeout: 30000 });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.setItem('real_play_access_token', 'runtime-test-token'));
await page.locator('.rp-home-4v4-explore').first().evaluate((el) => el.click());
await page.waitForFunction(() => window.__realPlay4v4TeamCodeBetaInstalled === true, null, { timeout: 15000 });
await page.waitForSelector('[data-rp-4v4-static-view].open');
await page.waitForTimeout(1500);

const origins = await page.evaluate(() => window.__rp4v4FetchOrigins || []);
console.log('NETWORK_REQUESTS=' + JSON.stringify(requests, null, 2));
console.log('FETCH_ORIGINS=' + JSON.stringify(origins, null, 2));
console.log('TEAM_CODE_SCRIPTS=' + await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count());

await browser.close();
