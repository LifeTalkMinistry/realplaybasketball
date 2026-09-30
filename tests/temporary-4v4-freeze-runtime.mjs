import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = 'https://joinrealplay.com/';
const DEPLOY_ID = '20260929-4v4-main-thread-freeze-v135';
const clubs = ['lions', 'valiant', 'watchmen', 'conquerors'];
const requests = [];
let state = {
  ok: true,
  userId: 900001,
  playerName: 'RUNTIME TEST PLAYER',
  clubs,
  joinedClub: null,
  joinedAt: null,
  preferredClub: null,
  preferenceUpdatedAt: null,
  preferencePlayers: [],
  teamStates: clubs.map((club) => ({ club, status: 'available', memberCount: 0, capacity: 6, expiresAt: null, securedAt: null })),
  formationState: 'team_code',
  rosterLocked: false,
};

const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'content-type': 'application/json',
};
const clone = (extra = {}) => JSON.parse(JSON.stringify({ ...state, ...extra }));
const team = (club) => state.teamStates.find((item) => item.club === club);
const count = (path, method = null) => requests.filter((item) => item.path === path && (!method || item.method === method)).length;
const meCount = () => count('/api/real-play/4v4/me', 'GET');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

await context.route('https://api.clarapmc.com/api/real-play/4v4/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  requests.push({ path: url.pathname, method, at: Date.now() });

  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
  if (url.pathname === '/api/real-play/4v4/me' && method === 'GET') {
    return route.fulfill({ status: 200, headers, body: JSON.stringify(clone()) });
  }
  if (url.pathname === '/api/real-play/4v4/join' && method === 'POST') {
    const body = request.postDataJSON();
    const club = String(body?.club || 'lions').toLowerCase();
    Object.assign(team(club), { status: 'held', memberCount: 2, expiresAt: '2026-09-30T22:00:00.000Z', securedAt: null });
    state.joinedClub = club;
    state.preferredClub = club;
    state.joinedAt = '2026-09-29T22:00:00.000Z';
    state.preferencePlayers = [
      { userId: 900001, playerName: 'RUNTIME TEST PLAYER', preferredClub: club, rank: 1, ovr: 81, verifiedGames: 10, record: { wins: 6, losses: 4, games: 10 }, winRate: 60, topStats: [{ key: 'PTS', value: 4.2 }] },
      { userId: 900002, playerName: 'TEAMMATE', preferredClub: club, rank: 2, ovr: 79, verifiedGames: 10, record: { wins: 5, losses: 5, games: 10 }, winRate: 50, topStats: [{ key: 'REB', value: 3.1 }] },
    ];
    return route.fulfill({ status: 200, headers, body: JSON.stringify(clone({ message: 'Joined forming team.' })) });
  }
  if (url.pathname === '/api/real-play/4v4/preference' && method === 'DELETE') {
    const club = state.joinedClub || 'lions';
    Object.assign(team(club), { status: 'held', memberCount: 1 });
    state.joinedClub = null;
    state.preferredClub = null;
    state.joinedAt = null;
    state.preferencePlayers = state.preferencePlayers.filter((player) => player.userId !== 900001);
    return route.fulfill({ status: 200, headers, body: JSON.stringify(clone({ message: 'Left forming team.' })) });
  }
  if (url.pathname === '/api/real-play/4v4/admin/code' && method === 'POST') {
    const body = request.postDataJSON();
    const club = String(body?.club || 'lions').toLowerCase();
    const current = team(club);
    if (current.status === 'available') Object.assign(current, { status: 'held', expiresAt: '2026-09-30T22:00:00.000Z' });
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, club, code: 'RP-TEST1', ...current }) });
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
await page.waitForSelector('.rp-home-4v4-explore', { state: 'attached', timeout: 30000 });

// A. Home idle: no Team Code script and no 4v4 state request.
const homeStart = meCount();
await page.waitForTimeout(30000);
assert.equal(meCount(), homeStart, 'Home idle generated 4v4 state requests.');
assert.equal(await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count(), 0, 'Team Code Beta was not lazy.');

await page.evaluate(() => localStorage.setItem('real_play_access_token', 'runtime-test-token'));

// B. Open: one lazy script and one state load.
await page.locator('.rp-home-4v4-explore').first().evaluate((el) => el.click());
await page.waitForFunction(() => window.__realPlay4v4TeamCodeBetaInstalled === true, null, { timeout: 15000 });
await page.waitForSelector('[data-rp-4v4-static-view].open');
await page.waitForTimeout(700);
assert.equal(await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count(), 1, 'Team Code script count after open was not exactly 1.');
assert.equal(meCount(), homeStart + 1, 'Initial 4v4 open did not issue exactly one GET /me.');

// C. 60s 4v4 idle: zero repeated state requests and responsive main thread.
const idleStart = meCount();
await page.evaluate(() => { window.__rpLongTasks = []; });
await page.waitForTimeout(60000);
assert.equal(meCount(), idleStart, '4v4 idle repeated GET /me.');
assert.equal(await page.locator('[data-rp-4v4-static-view].open').count(), 1, '4v4 view became unresponsive or closed during idle.');
const longTasks = await page.evaluate(() => window.__rpLongTasks || []);
const maxLongTask = longTasks.length ? Math.max(...longTasks) : 0;
assert.ok(maxLongTask < 2000, `Main thread produced a ${maxLongTask}ms long task during idle.`);

// D. Cycle all clubs: no state request and no legacy text fight.
const switchStart = meCount();
for (let i = 0; i < 4; i += 1) {
  await page.locator('[data-rp-4v4-next]').click();
  await page.waitForTimeout(100);
}
assert.equal(meCount(), switchStart, 'Club switching fetched state.');
const actionText = String(await page.locator('[data-rp-4v4-preference-action]').textContent()).trim();
assert.ok(!/^I PREFER/i.test(actionText), `Legacy UI reclaimed Team Code control: ${actionText}`);
await page.waitForTimeout(15000);
assert.equal(String(await page.locator('[data-rp-4v4-preference-action]').textContent()).trim(), actionText, 'Action text kept fighting after club switching.');
assert.equal(meCount(), switchStart, 'Club-switch idle fetched state.');

// E. Close: 30s hidden idle has zero state requests.
await page.locator('[data-rp-4v4-static-back]').click();
await page.waitForFunction(() => !document.querySelector('[data-rp-4v4-static-view]')?.classList.contains('open'));
const closeStart = meCount();
await page.waitForTimeout(30000);
assert.equal(meCount(), closeStart, 'Closed 4v4 view kept requesting state.');

// F. Reopen ten times: exactly one refresh/open, one script tag, no multiplication.
for (let i = 0; i < 10; i += 1) {
  const before = meCount();
  await page.locator('.rp-home-4v4-explore').first().evaluate((el) => el.click());
  await page.waitForSelector('[data-rp-4v4-static-view].open');
  await page.waitForTimeout(220);
  assert.equal(meCount(), before + 1, `Reopen ${i + 1} did not issue exactly one refresh.`);
  assert.equal(await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count(), 1, `Reopen ${i + 1} duplicated the Team Code script.`);
  await page.locator('[data-rp-4v4-static-back]').click();
  await page.waitForFunction(() => !document.querySelector('[data-rp-4v4-static-view]')?.classList.contains('open'));
}

await page.locator('.rp-home-4v4-explore').first().evaluate((el) => el.click());
await page.waitForSelector('[data-rp-4v4-static-view].open');
await page.waitForTimeout(220);

// G. Focus: one refresh while open, zero while closed.
let before = meCount();
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await page.waitForTimeout(220);
assert.equal(meCount(), before + 1, 'Focus while open did not cause exactly one state refresh.');
await page.locator('[data-rp-4v4-static-back]').click();
before = meCount();
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await page.waitForTimeout(220);
assert.equal(meCount(), before, 'Focus while closed refreshed 4v4 state.');
await page.locator('.rp-home-4v4-explore').first().evaluate((el) => el.click());
await page.waitForSelector('[data-rp-4v4-static-view].open');
await page.waitForTimeout(220);

// H. Join: one POST, returned state renders directly, 24h hold visible, no background GET.
const joinPosts = count('/api/real-play/4v4/join', 'POST');
const joinGets = meCount();
await page.locator('[data-rp-4v4-preference-action]').click();
await page.locator('[data-rp-4v4-code-input]').fill('RP-TEST1');
await page.locator('[data-rp-4v4-code-submit]').click();
await page.waitForFunction(() => /JOINED/.test(document.querySelector('[data-rp-4v4-preference-action]')?.textContent || ''));
assert.equal(count('/api/real-play/4v4/join', 'POST'), joinPosts + 1, 'Join sent more than one POST.');
assert.equal(meCount(), joinGets, 'Join caused an unnecessary GET refresh.');
assert.match(await page.locator('.rp-4v4-preference-note').textContent(), /24-HOUR HOLD ACTIVE/);
assert.equal(String(await page.locator('[data-rp-4v4-preference-count]').textContent()).trim(), '2/6');
await page.waitForTimeout(5000);
assert.equal(meCount(), joinGets, 'Join started repeated GETs.');

// I. Leave: one DELETE and no GET storm.
const leaveDeletes = count('/api/real-play/4v4/preference', 'DELETE');
const leaveGets = meCount();
await page.locator('[data-rp-4v4-preference-cancel]').click();
await page.waitForFunction(() => /JOIN MY TEAM/.test(document.querySelector('[data-rp-4v4-preference-action]')?.textContent || ''));
assert.equal(count('/api/real-play/4v4/preference', 'DELETE'), leaveDeletes + 1, 'Leave sent more than one DELETE.');
assert.equal(meCount(), leaveGets, 'Leave caused an unnecessary GET refresh.');
await page.waitForTimeout(3000);
assert.equal(meCount(), leaveGets, 'Leave started repeated GETs.');

// 6/6 secured state through one explicit reopen refresh.
const activeClub = await page.evaluate(() => document.querySelector('[data-rp-4v4-static-view]')?.dataset?.rpActiveClub || 'lions');
Object.assign(team(activeClub), { status: 'secured', memberCount: 6, expiresAt: null, securedAt: '2026-09-29T23:00:00.000Z' });
before = meCount();
await page.locator('[data-rp-4v4-static-back]').click();
await page.locator('.rp-home-4v4-explore').first().evaluate((el) => el.click());
await page.waitForSelector('[data-rp-4v4-static-view].open');
await page.waitForTimeout(220);
assert.equal(meCount(), before + 1, 'Secured-state reopen did not issue exactly one refresh.');
assert.match(await page.locator('[data-rp-4v4-preference-action]').textContent(), /TEAM SECURED|MY TEAM · SECURED/);
assert.match(await page.locator('.rp-4v4-preference-note').textContent(), /ROSTER LOCKED · 6\/6 CONFIRMED/);

// J. Admin: one POST + one explicit GET; no repeated traffic.
await page.evaluate(() => {
  window.__realPlayAdminVerified = true;
  window.dispatchEvent(new CustomEvent('realplay:admin-render'));
});
await page.waitForSelector('[data-rp-4v4-team-code-admin]:not([hidden])');
const adminPosts = count('/api/real-play/4v4/admin/code', 'POST');
const adminGets = meCount();
await page.locator('[data-rp-4v4-team-code-admin]').click();
await page.waitForSelector('[data-rp-4v4-team-code-dialog]:not([hidden])');
assert.equal(count('/api/real-play/4v4/admin/code', 'POST'), adminPosts + 1, 'Admin code sent more than one POST.');
assert.equal(meCount(), adminGets + 1, 'Admin success did not issue exactly one state refresh.');
await page.locator('[data-rp-4v4-code-close]').click();
await page.waitForTimeout(3000);
assert.equal(meCount(), adminGets + 1, 'Admin flow started repeated GETs.');

assert.equal(await page.locator('script[src*="home-future-4v4-team-code-beta.js"]').count(), 1, 'Final Team Code script count was not exactly one.');
await page.locator('[data-rp-4v4-static-back]').click();
assert.equal(await page.evaluate(() => document.body.classList.contains('rp-4v4-static-open')), false, 'Home shell did not restore after close.');
assert.ok(await page.locator('.rp-simple-nav').count(), 'Home navigation was missing after close.');
assert.equal(freezeErrors.length, 0, `Freeze-related runtime errors: ${freezeErrors.join(' | ')}`);

console.log(`PASS deploy=${DEPLOY_ID} idleRequestsPerMinute=0 scriptTags=1 maxIdleLongTaskMs=${Math.round(maxLongTask * 10) / 10}`);
await browser.close();
