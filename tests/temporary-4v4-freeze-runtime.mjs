import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = `https://joinrealplay.com/?rp-freeze-rotation=${Date.now()}`;
const DEPLOY_ID = '20261001-team-schedule-rotation-v153';
const requests = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

await context.route('https://api.clarapmc.com/api/real-play/public/updates', async (route) => {
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify({
      updates: [{
        id: 'freeze-rotation-test',
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
              { day: 'SATURDAY', start: '20:00', end: '22:00', teamKeys: ['lions', 'valiant'], teamNames: ['LIONS', 'VALIANT'] },
              { day: 'SUNDAY', start: '20:00', end: '22:00', teamKeys: ['eagles', 'steadfast'], teamNames: ['EAGLES', 'STEADFAST'] },
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
  requests.push({ path: url.pathname, method: request.method(), at: Date.now() });
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'content-type': 'application/json',
  };
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
  if (url.pathname === '/api/real-play/4v4/me' && request.method() === 'GET') {
    return route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        userId: 900001,
        playerName: 'RUNTIME TEST PLAYER',
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
  return route.fulfill({ status: 404, headers, body: JSON.stringify({ message: 'Unhandled runtime route.' }) });
});

const page = await context.newPage();
const freezeErrors = [];
page.on('pageerror', (error) => freezeErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && /Maximum call stack|out of memory|MutationObserver|unresponsive/i.test(message.text())) freezeErrors.push(message.text());
});

await page.addInitScript(() => {
  window.__rpLongTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__rpLongTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch (_error) {}
});

await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction((id) => document.documentElement?.dataset?.rpDeploy === id, DEPLOY_ID, { timeout: 30000 });
await page.waitForFunction(() => window.__realPlayTeamRotationPickerV2Installed === true, null, { timeout: 20000 });
await page.waitForFunction(() => !document.documentElement.classList.contains('rp-shell-booting'), null, { timeout: 20000 });
await page.waitForSelector('[data-rp-home-save-slot]', { state: 'attached', timeout: 20000 });

// A. Home idle must remain responsive and must not spin a MutationObserver loop.
await page.evaluate(() => { window.__rpLongTasks = []; });
const homeText = (await page.locator('[data-rp-home-save-slot]').textContent())?.trim();
assert.equal(homeText, 'CHECK TEAM SCHEDULE');
await page.waitForTimeout(10000);
assert.equal((await page.locator('[data-rp-home-save-slot]').textContent())?.trim(), homeText, 'Home CTA kept mutating during idle.');
assert.deepEqual(freezeErrors, [], `Freeze errors during home idle: ${freezeErrors.join(' | ')}`);
let longTasks = await page.evaluate(() => window.__rpLongTasks || []);
let maxLongTask = longTasks.length ? Math.max(...longTasks) : 0;
assert.ok(maxLongTask < 2000, `Home idle produced a ${maxLongTask}ms long task.`);

await page.evaluate(() => localStorage.setItem('real_play_access_token', 'runtime-test-token'));

// Use DOM click for the tested controls so an unrelated public takeover announcement cannot block the rotation regression.
// B. Open Saturday rotation and verify the 4v4 runtime remains single-instance and responsive.
await page.locator('[data-rp-home-save-slot]').evaluate((element) => element.click());
await page.waitForFunction(() => {
  const modal = document.querySelector('.rp-team-rotation-modal');
  return Boolean(modal && !modal.hidden);
});
await page.locator('[data-rp-rotation-id="saturday-2000-2200"]').evaluate((element) => element.click());
await page.waitForSelector('[data-rp-4v4-static-view].open', { timeout: 15000 });
await page.waitForFunction(() => window.__realPlay4v4TeamCodeBetaInstalled === true, null, { timeout: 15000 });
await page.waitForTimeout(1000);
assert.equal(await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count(), 1, 'Team Code runtime duplicated after Saturday open.');
const meAfterOpen = requests.filter((item) => item.path === '/api/real-play/4v4/me' && item.method === 'GET').length;
await page.waitForTimeout(5000);
const meAfterIdle = requests.filter((item) => item.path === '/api/real-play/4v4/me' && item.method === 'GET').length;
assert.equal(meAfterIdle, meAfterOpen, '4v4 idle repeated GET /me.');
assert.deepEqual(freezeErrors, [], `Freeze errors while 4v4 was open: ${freezeErrors.join(' | ')}`);

// C. Switching rotation must replace the view cleanly, not multiply views or scripts.
await page.locator('.rp-4v4-static-view .rp-3v3-select-head h1').evaluate((element) => element.click());
await page.waitForFunction(() => {
  const modal = document.querySelector('.rp-team-rotation-modal');
  return Boolean(modal && !modal.hidden);
});
await page.locator('[data-rp-rotation-id="sunday-2000-2200"]').evaluate((element) => element.click());
await page.waitForSelector('[data-rp-4v4-static-view].open', { timeout: 15000 });
await page.waitForFunction(() => document.querySelector('.rp-4v4-static-view .rp-3v3-select-head h1')?.textContent?.includes('SUNDAY'), null, { timeout: 5000 });
assert.equal(await page.locator('[data-rp-4v4-static-view]').count(), 1, 'Rotation switch duplicated the 4v4 view.');
assert.equal(await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count(), 1, 'Rotation switch duplicated the Team Code runtime.');
assert.deepEqual(await page.evaluate(() => window.__realPlay4v4AssignedTeamKeys), ['eagles', 'steadfast']);

await page.evaluate(() => { window.__rpLongTasks = []; });
await page.waitForTimeout(3000);
longTasks = await page.evaluate(() => window.__rpLongTasks || []);
maxLongTask = longTasks.length ? Math.max(...longTasks) : 0;
assert.ok(maxLongTask < 2000, `Rotation switch produced a ${maxLongTask}ms long task.`);
assert.deepEqual(freezeErrors, [], `Freeze-related runtime errors: ${freezeErrors.join(' | ')}`);
assert.equal(await page.evaluate(() => 20 + 22), 42, 'Main thread stopped responding.');

console.log('ROTATION_FREEZE_RUNTIME PASS');
await browser.close();
