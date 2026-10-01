import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = `https://joinrealplay.com/?rp-rotation-live=${Date.now()}`;
const DEPLOY_ID = '20261001-team-schedule-rotation-v153';
const hardStop = setTimeout(() => {
  console.error('LIVE_4V4_ROTATION_HARD_TIMEOUT');
  process.exit(124);
}, 70000);

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  await context.route('https://api.clarapmc.com/api/real-play/public/updates', async (route) => {
    const now = new Date().toISOString();
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        updates: [{
          id: 'rotation-live-test',
          category: 'schedule',
          title: 'OPEN RANK SESSION',
          event_at: '2026-10-03T12:00:00.000Z',
          published_at: now,
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

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  console.log('STAGE navigate-live');
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction((id) => document.documentElement?.dataset?.rpDeploy === id, DEPLOY_ID, { timeout: 30000 });
  await page.waitForFunction(() => window.__realPlayTeamRotationPickerV2Installed === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.__realPlay4v4RotationCleanUiInstalled === true, null, { timeout: 20000 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('rp-shell-booting'), null, { timeout: 20000 });

  const loadedScripts = await page.evaluate(() => [...document.scripts].map((script) => script.src));
  assert.ok(loadedScripts.some((src) => src.includes('home-4v4-slot-picker.js?v=20261001-team-schedule-rotation-v3')), 'Live page did not load the rotation picker loader.');
  assert.ok(loadedScripts.some((src) => src.includes('home-4v4-team-schedule-rotation-v2.js?v=20261001-team-schedule-rotation-v3')), 'Live page did not load the safe rotation runtime.');
  assert.ok(loadedScripts.some((src) => src.includes('home-4v4-rotation-clean-ui.js?v=20261001-rotation-clean-ui-v1')), 'Live page did not load the rotation clean UI guard.');

  console.log('STAGE verify-clean-home');
  await page.waitForFunction(() => document.querySelector('[data-rp-home-open-rank-meta]')?.textContent?.trim() === 'SAT + SUN · 8:00 PM – 10:00 PM');
  const homeUi = await page.evaluate(() => {
    const capacity = document.querySelector('[data-rp-home-open-rank-capacity]');
    const card = document.querySelector('[data-rp-home-open-rank]');
    return {
      meta: document.querySelector('[data-rp-home-open-rank-meta]')?.textContent?.trim(),
      capacityHidden: !capacity || capacity.hidden || getComputedStyle(capacity).display === 'none',
      minHeight: card ? getComputedStyle(card).minHeight : '',
    };
  });
  assert.equal(homeUi.meta, 'SAT + SUN · 8:00 PM – 10:00 PM');
  assert.equal(homeUi.capacityHidden, true, 'Old global FULL/capacity badge is still visible.');

  console.log('STAGE open-rotation');
  const homeButton = page.locator('[data-rp-home-save-slot]').first();
  await homeButton.waitFor({ state: 'attached' });
  assert.equal((await homeButton.textContent())?.trim(), 'CHECK TEAM SCHEDULE');
  await homeButton.evaluate((element) => element.click());
  await page.waitForFunction(() => {
    const modal = document.querySelector('.rp-team-rotation-modal');
    return Boolean(modal && !modal.hidden);
  });

  const options = await page.locator('[data-rp-rotation-id]').allTextContents();
  assert.equal(options.length, 2, 'Expected Saturday and Sunday rotation choices.');
  assert.match(options[0], /SATURDAY.*8:00 PM.*10:00 PM/i);
  assert.match(options[1], /SUNDAY.*8:00 PM.*10:00 PM/i);

  console.log('STAGE choose-saturday');
  await page.locator('[data-rp-rotation-id="saturday-2000-2200"]').evaluate((element) => element.click());
  await page.waitForSelector('[data-rp-4v4-static-view].open', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => {
    const heading = document.querySelector('.rp-4v4-static-view .rp-3v3-select-head h1');
    return heading?.textContent?.trim() === 'SATURDAY · 8:00 PM – 10:00 PM';
  }, null, { timeout: 5000 });
  await page.waitForTimeout(300);

  const saturday = await page.evaluate(() => ({
    keys: window.__realPlay4v4AssignedTeamKeys,
    stored: JSON.parse(sessionStorage.getItem('real_play_4v4_time_slot') || 'null'),
    bodyOpen: document.body.classList.contains('rp-4v4-static-open'),
    viewCount: document.querySelectorAll('[data-rp-4v4-static-view]').length,
    bannerCount: document.querySelectorAll('.rp-4v4-static-view .rp-4v4-team-slot').length,
    canonicalBannerCount: document.querySelectorAll('.rp-4v4-static-view [data-rp-4v4-team-slot]').length,
    malformedBannerCount: document.querySelectorAll('.rp-4v4-static-view [data-rp4v4-team-slot]').length,
  }));
  assert.deepEqual(saturday.keys, ['lions', 'valiant']);
  assert.equal(saturday.stored?.day, 'SATURDAY');
  assert.equal(saturday.bodyOpen, true);
  assert.equal(saturday.viewCount, 1);
  assert.equal(saturday.bannerCount, 1, 'Saturday team screen contains repeated schedule banners.');
  assert.equal(saturday.canonicalBannerCount, 1, 'Saturday schedule banner is missing its canonical data attribute.');
  assert.equal(saturday.malformedBannerCount, 0, 'Malformed legacy rotation banner attribute remains.');

  console.log('STAGE switch-to-sunday');
  await page.locator('.rp-4v4-static-view .rp-3v3-select-head h1').evaluate((element) => element.click());
  await page.waitForFunction(() => {
    const modal = document.querySelector('.rp-team-rotation-modal');
    return Boolean(modal && !modal.hidden);
  });
  await page.locator('[data-rp-rotation-id="sunday-2000-2200"]').evaluate((element) => element.click());
  await page.waitForSelector('[data-rp-4v4-static-view].open', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => {
    const heading = document.querySelector('.rp-4v4-static-view .rp-3v3-select-head h1');
    return heading?.textContent?.trim() === 'SUNDAY · 8:00 PM – 10:00 PM';
  }, null, { timeout: 5000 });
  await page.waitForTimeout(300);

  const sunday = await page.evaluate(() => ({
    keys: window.__realPlay4v4AssignedTeamKeys,
    stored: JSON.parse(sessionStorage.getItem('real_play_4v4_time_slot') || 'null'),
    viewCount: document.querySelectorAll('[data-rp-4v4-static-view]').length,
    bannerCount: document.querySelectorAll('.rp-4v4-static-view .rp-4v4-team-slot').length,
    canonicalBannerCount: document.querySelectorAll('.rp-4v4-static-view [data-rp-4v4-team-slot]').length,
  }));
  assert.deepEqual(sunday.keys, ['eagles', 'steadfast']);
  assert.equal(sunday.stored?.day, 'SUNDAY');
  assert.equal(sunday.viewCount, 1);
  assert.equal(sunday.bannerCount, 1, 'Sunday team screen contains repeated schedule banners.');
  assert.equal(sunday.canonicalBannerCount, 1);

  await page.waitForTimeout(500);
  assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(consoleErrors.some((text) => /Maximum call stack|out of memory|MutationObserver|unresponsive/i.test(text)), false, `Freeze-related console error: ${consoleErrors.join(' | ')}`);

  console.log('LIVE_ROTATION_RESULT PASS');
} catch (error) {
  console.error('LIVE_ROTATION_RESULT FAIL', error);
  process.exitCode = 1;
} finally {
  clearTimeout(hardStop);
  if (browser) await browser.close().catch(() => {});
}
