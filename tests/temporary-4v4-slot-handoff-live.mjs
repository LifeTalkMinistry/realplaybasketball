import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = `https://joinrealplay.com/?rp-slot-live=${Date.now()}`;
const hardStop = setTimeout(() => {
  console.error('LIVE_4V4_HARD_TIMEOUT');
  process.exit(124);
}, 70000);

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
  await page.waitForFunction(() => window.__realPlayFourVFourSlotPickerInstalled === true, null, { timeout: 20000 });
  console.log('STAGE wait-app-boot');
  await page.waitForFunction(() => !document.documentElement.classList.contains('rp-shell-booting'), null, { timeout: 20000 });

  const loadedSlotScript = await page.evaluate(() =>
    [...document.scripts]
      .map((script) => script.src)
      .find((src) => src.includes('home-4v4-slot-picker.js')) || ''
  );
  assert.match(loadedSlotScript, /20260930-slot-banner-attr-v9/, `Live page did not load v9 slot picker: ${loadedSlotScript}`);

  console.log('STAGE wait-real-home-button');
  await page.waitForSelector('[data-rp-home-save-slot]', { state: 'attached', timeout: 20000 });

  console.log('STAGE open-slot-picker');
  await page.locator('[data-rp-home-save-slot]').first().evaluate((element) => element.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('.rp-4v4-slot-overlay');
    return Boolean(overlay && !overlay.hidden);
  });

  const slotState = await page.evaluate(() => ({
    inactive1600: document.querySelector('[data-rp-4v4-slot="1600-1800"]')?.disabled === true,
    inactive1800: document.querySelector('[data-rp-4v4-slot="1800-2000"]')?.disabled === true,
    active2000: document.querySelector('[data-rp-4v4-slot="2000-2200"]')?.disabled === false,
  }));
  assert.deepEqual(slotState, { inactive1600: true, inactive1800: true, active2000: true });

  console.log('STAGE choose-8pm-slot');
  await page.locator('[data-rp-4v4-slot="2000-2200"]').evaluate((element) => element.click());
  await page.waitForFunction(() => {
    const view = document.querySelector('.rp-4v4-static-view');
    return Boolean(
      view
      && view.classList.contains('open')
      && view.getAttribute('aria-hidden') === 'false'
      && document.body.classList.contains('rp-4v4-static-open')
    );
  }, null, { timeout: 15000 });

  await page.waitForTimeout(1200);

  const firstOpen = await page.evaluate(() => {
    const view = document.querySelector('.rp-4v4-static-view');
    const style = view ? getComputedStyle(view) : null;
    const overlay = document.querySelector('.rp-4v4-slot-overlay');
    return {
      storage: sessionStorage.getItem('real_play_4v4_time_slot'),
      overlayHidden: overlay?.hidden === true,
      viewCount: document.querySelectorAll('.rp-4v4-static-view').length,
      viewOpen: view?.classList.contains('open') === true,
      ariaHidden: view?.getAttribute('aria-hidden') || null,
      bodyOpen: document.body.classList.contains('rp-4v4-static-open'),
      heading: view?.querySelector('.rp-3v3-select-head h1')?.textContent?.trim() || null,
      display: style?.display || null,
      position: style?.position || null,
      visibility: style?.visibility || null,
      slotBannerCount: view?.querySelectorAll('[data-rp-4v4-team-slot]').length || 0,
      preferenceActionExists: Boolean(view?.querySelector('[data-rp-4v4-preference-action]')),
      backExists: Boolean(view?.querySelector('[data-rp-4v4-static-back]')),
      cleanupInstalled: window.__realPlayFuture4v4CardCleanupInstalled === true,
      teamCodeInstalled: window.__realPlay4v4TeamCodeBetaInstalled === true,
    };
  });

  assert.match(firstOpen.storage || '', /2000-2200/);
  assert.equal(firstOpen.overlayHidden, true);
  assert.equal(firstOpen.viewCount, 1);
  assert.equal(firstOpen.viewOpen, true);
  assert.equal(firstOpen.ariaHidden, 'false');
  assert.equal(firstOpen.bodyOpen, true);
  assert.equal(firstOpen.heading, 'SELECT YOUR TEAM.');
  assert.equal(firstOpen.display, 'block');
  assert.equal(firstOpen.position, 'fixed');
  assert.equal(firstOpen.visibility, 'visible');
  assert.equal(firstOpen.slotBannerCount, 1, 'Selected-slot banner duplicated.');
  assert.equal(firstOpen.preferenceActionExists, true, 'Team preference control disappeared.');
  assert.equal(firstOpen.backExists, true, 'Back button disappeared.');
  assert.equal(firstOpen.cleanupInstalled, true, 'Current 4v4 cleanup runtime is not installed.');

  console.log('STAGE back-button');
  await page.locator('[data-rp-4v4-static-back]').click();
  await page.waitForFunction(() => {
    const view = document.querySelector('.rp-4v4-static-view');
    return Boolean(view && !view.classList.contains('open') && view.getAttribute('aria-hidden') === 'true' && !document.body.classList.contains('rp-4v4-static-open'));
  });

  console.log('STAGE direct-explore-regression');
  for (let cycle = 0; cycle < 4; cycle += 1) {
    await page.evaluate(() => {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'rp-home-4v4-explore';
      trigger.hidden = true;
      document.body.appendChild(trigger);
      trigger.click();
      trigger.remove();
    });
    await page.waitForFunction(() => document.body.classList.contains('rp-4v4-static-open'));
    await page.waitForTimeout(150);

    const counts = await page.evaluate(() => ({
      views: document.querySelectorAll('.rp-4v4-static-view').length,
      banners: document.querySelectorAll('.rp-4v4-static-view [data-rp-4v4-team-slot]').length,
    }));
    assert.equal(counts.views, 1, `Cycle ${cycle + 1}: duplicate 4v4 views created.`);
    assert.equal(counts.banners, 1, `Cycle ${cycle + 1}: duplicate selected-slot banners created.`);

    await page.locator('[data-rp-4v4-static-back]').click();
    await page.waitForFunction(() => !document.body.classList.contains('rp-4v4-static-open'));
  }

  const regressionState = await page.evaluate(() => ({
    storage: sessionStorage.getItem('real_play_4v4_time_slot'),
    viewCount: document.querySelectorAll('.rp-4v4-static-view').length,
    bannerCount: document.querySelectorAll('.rp-4v4-static-view [data-rp-4v4-team-slot]').length,
    preferencePanelExists: Boolean(document.querySelector('.rp-4v4-preference-panel')),
    preferenceActionExists: Boolean(document.querySelector('[data-rp-4v4-preference-action]')),
    teamCodeInstalled: window.__realPlay4v4TeamCodeBetaInstalled === true,
    teamCodeAdminControlExists: Boolean(document.querySelector('[data-rp-4v4-team-code-admin]')),
    bodyOpen: document.body.classList.contains('rp-4v4-static-open'),
  }));

  assert.match(regressionState.storage || '', /2000-2200/);
  assert.equal(regressionState.viewCount, 1);
  assert.equal(regressionState.bannerCount, 1);
  assert.equal(regressionState.preferencePanelExists, true);
  assert.equal(regressionState.preferenceActionExists, true);
  assert.equal(regressionState.bodyOpen, false);
  assert.equal(pageErrors.length, 0, `JavaScript exceptions: ${pageErrors.join(' | ')}`);

  console.log('LIVE_RESULT ' + JSON.stringify({
    loadedSlotScript,
    slotState,
    firstOpen,
    regressionState,
    pageErrors,
    consoleErrors,
  }));
  console.log('LIVE_RESULT PASS');

  clearTimeout(hardStop);
  await browser.close();
  process.exit(0);
} catch (error) {
  clearTimeout(hardStop);
  if (browser) await browser.close().catch(() => {});
  console.error('LIVE_RESULT FAIL', error?.stack || error);
  process.exit(1);
}
