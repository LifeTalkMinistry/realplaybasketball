import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = 'https://joinrealplay.com/';
let browser;
let report;

try {
  console.log('STAGE launch');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const errors = [];
  const consoleErrors = [];
  const cleanupRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => { if (request.url().includes('home-future-4v4-card-cleanup.js')) cleanupRequests.push(request.url()); });

  console.log('STAGE navigate');
  await page.goto(APP_URL, { waitUntil: 'commit', timeout: 15000 });
  console.log('STAGE wait-slot-runtime');
  await page.waitForFunction(() => window.__realPlayFourVFourSlotPickerInstalled === true, null, { timeout: 20000 });

  const deploy = await page.evaluate(() => document.documentElement?.dataset?.rpDeploy || '');
  const hadRealHomeButton = await page.locator('[data-rp-home-save-slot]').count() > 0;
  if (!hadRealHomeButton) {
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.rpHomeSaveSlot = 'diagnostic';
      button.textContent = 'CHOOSE MY SLOT';
      document.body.appendChild(button);
    });
  }

  console.log('STAGE open-slot-picker');
  await page.locator('[data-rp-home-save-slot]').first().evaluate((el) => el.click());
  await page.waitForSelector('.rp-4v4-slot-overlay:not([hidden])', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  const beforeClick = await page.evaluate(() => ({
    cleanupInstalled: window.__realPlayFuture4v4CardCleanupInstalled === true,
    cleanupScripts: [...document.querySelectorAll('script[src*="home-future-4v4-card-cleanup.js"]')].map((script) => script.src),
    activeSlotExists: Boolean(document.querySelector('[data-rp-4v4-slot="2000-2200"]')),
    activeSlotDisabled: Boolean(document.querySelector('[data-rp-4v4-slot="2000-2200"]')?.disabled),
  }));

  console.log('STAGE choose-active-slot');
  await page.locator('[data-rp-4v4-slot="2000-2200"]').evaluate((el) => el.click());
  await page.waitForTimeout(2500);

  const afterClick = await page.evaluate(() => {
    const view = document.querySelector('.rp-4v4-static-view');
    const overlay = document.querySelector('.rp-4v4-slot-overlay');
    const style = view ? getComputedStyle(view) : null;
    return {
      storage: sessionStorage.getItem('real_play_4v4_time_slot'),
      overlayHidden: overlay ? overlay.hidden : null,
      cleanupInstalled: window.__realPlayFuture4v4CardCleanupInstalled === true,
      previewInstalled: window.__realPlayFuture4v4PreviewInstalled === true,
      cleanupScripts: [...document.querySelectorAll('script[src*="home-future-4v4-card-cleanup.js"]')].map((script) => script.src),
      viewExists: Boolean(view),
      viewOpen: Boolean(view?.classList.contains('open')),
      ariaHidden: view?.getAttribute('aria-hidden') ?? null,
      bodyOpen: document.body.classList.contains('rp-4v4-static-open'),
      selectedTeamHeading: view?.querySelector('.rp-3v3-select-head h1')?.textContent?.trim() || null,
      viewDisplay: style?.display || null,
      viewPosition: style?.position || null,
      viewVisibility: style?.visibility || null,
      viewOpacity: style?.opacity || null,
      bodyClasses: document.body.className,
    };
  });

  report = { deploy, hadRealHomeButton, cleanupRequests, beforeClick, afterClick, pageErrors: errors, consoleErrors };
  console.log('LIVE_REPORT ' + JSON.stringify(report));
} catch (error) {
  console.error('DIAGNOSTIC_FAILURE', error?.stack || error);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
}

const { afterClick, pageErrors } = report;
assert.match(afterClick.storage || '', /2000-2200/, 'Selected slot was not stored.');
assert.equal(afterClick.overlayHidden, true, 'Slot picker did not close.');
assert.equal(afterClick.cleanupInstalled, true, '4v4 cleanup runtime did not install.');
assert.equal(afterClick.viewExists, true, '4v4 static view does not exist after slot selection.');
assert.equal(afterClick.viewOpen, true, '4v4 static view exists but is not open.');
assert.equal(afterClick.ariaHidden, 'false', '4v4 static view aria-hidden is not false.');
assert.equal(afterClick.bodyOpen, true, 'body.rp-4v4-static-open is missing.');
assert.equal(afterClick.selectedTeamHeading, 'SELECT YOUR TEAM.', 'SELECT YOUR TEAM heading is not present.');
assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
