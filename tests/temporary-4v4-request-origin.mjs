import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = `https://joinrealplay.com/?rp-request-origin=${Date.now()}`;
const DEPLOY_ID = '20261001-team-schedule-rotation-v153';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const requests = [];

await context.route('https://api.clarapmc.com/api/real-play/public/updates', async (route) => {
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify({
      updates: [{
        id: 'request-origin-rotation-test',
        category: 'schedule',
        title: 'OPEN RANK SESSION',
        event_at: '2026-10-03T12:00:00.000Z',
        published_at: new Date().toISOString(),
        metadata: {
          teamSchedule: {
            version: 2,
            mode: 'assigned',
            rotationType: 'weekly',
            blocks: [
              { day: 'SATURDAY', start: '20:00', end: '22:00', teamKeys: ['lions', 'valiant'] },
              { day: 'SUNDAY', start: '20:00', end: '22:00', teamKeys: ['eagles', 'steadfast'] },
            ],
          },
        },
      }],
    }),
  });
});

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
        clubs: ['lions', 'valiant', 'eagles', 'steadfast'],
        joinedClub: null,
        preferredClub: null,
        preferencePlayers: [],
        teamStates: ['lions', 'valiant', 'eagles', 'steadfast'].map((club) => ({ club, status: 'available', memberCount: 0, capacity: 6, expiresAt: null, securedAt: null })),
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
await page.waitForFunction(() => window.__realPlayTeamRotationPickerV2Installed === true, null, { timeout: 20000 });
await page.waitForSelector('[data-rp-home-save-slot]', { state: 'attached', timeout: 30000 });
await page.evaluate(() => localStorage.setItem('real_play_access_token', 'runtime-test-token'));

// DOM clicks intentionally bypass any unrelated public takeover announcement that may be open on the live site.
await page.locator('[data-rp-home-save-slot]').evaluate((element) => element.click());
await page.waitForFunction(() => {
  const modal = document.querySelector('.rp-team-rotation-modal');
  return Boolean(modal && !modal.hidden);
});
await page.locator('[data-rp-rotation-id="saturday-2000-2200"]').evaluate((element) => element.click());
await page.waitForFunction(() => window.__realPlay4v4TeamCodeBetaInstalled === true, null, { timeout: 15000 });
await page.waitForSelector('[data-rp-4v4-static-view].open', { state: 'attached', timeout: 15000 });
await page.waitForTimeout(1500);

const origins = await page.evaluate(() => window.__rp4v4FetchOrigins || []);
const meRequests = requests.filter((item) => item.path === '/api/real-play/4v4/me' && item.method === 'GET');
console.log('NETWORK_REQUESTS=' + JSON.stringify(meRequests, null, 2));
console.log('FETCH_ORIGINS=' + JSON.stringify(origins, null, 2));
console.log('TEAM_CODE_SCRIPTS=' + await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count());

assert.equal(await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count(), 1, 'Team Code runtime was duplicated.');
assert.equal(meRequests.length, 1, `Expected one initial GET /4v4/me, got ${meRequests.length}.`);
assert.equal(origins.length, 1, `Expected one fetch origin, got ${origins.length}.`);
assert.equal(origins[0]?.open, true, 'GET /4v4/me happened before the team view was open.');
assert.equal(origins[0]?.teamCodeInstalled, true, 'GET /4v4/me was not owned by the lazy Team Code runtime.');

await page.waitForTimeout(3000);
assert.equal(requests.filter((item) => item.path === '/api/real-play/4v4/me' && item.method === 'GET').length, 1, 'Idle rotation view repeated GET /4v4/me.');

console.log('REQUEST_ORIGIN_ROTATION PASS');
await browser.close();
