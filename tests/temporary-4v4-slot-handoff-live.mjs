import { chromium } from 'playwright';

const APP_URL = 'https://joinrealplay.com/';
const hardStop = setTimeout(() => {
  console.error('DIAGNOSTIC_HARD_TIMEOUT');
  process.exit(124);
}, 60000);

try {
  console.log('STAGE launch');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  await page.addInitScript(() => {
    const NativeMutationObserver = window.MutationObserver;
    let nextId = 0;
    window.__rpMutationObserverStats = [];
    window.__rpDomWriteStats = new Map();

    const recordWrite = (kind) => {
      const stack = String(new Error().stack || '')
        .split('\n')
        .slice(2, 6)
        .join('\n');
      const key = `${kind}\n${stack}`;
      window.__rpDomWriteStats.set(key, (window.__rpDomWriteStats.get(key) || 0) + 1);
    };

    const wrapMethod = (proto, name, kind = name) => {
      const native = proto?.[name];
      if (typeof native !== 'function') return;
      proto[name] = function (...args) {
        recordWrite(kind);
        return native.apply(this, args);
      };
    };

    wrapMethod(Node.prototype, 'appendChild');
    wrapMethod(Node.prototype, 'insertBefore');
    wrapMethod(Node.prototype, 'removeChild');
    wrapMethod(Node.prototype, 'replaceChild');
    wrapMethod(Element.prototype, 'replaceChildren');
    wrapMethod(Element.prototype, 'insertAdjacentHTML');
    wrapMethod(Element.prototype, 'insertAdjacentElement');
    wrapMethod(Element.prototype, 'remove');

    const wrapSetter = (proto, name) => {
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (!descriptor?.set || !descriptor?.get) return;
      Object.defineProperty(proto, name, {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
          recordWrite(`${name}=`);
          return descriptor.set.call(this, value);
        },
      });
    };

    wrapSetter(Node.prototype, 'textContent');
    wrapSetter(Element.prototype, 'innerHTML');
    wrapSetter(Element.prototype, 'outerHTML');

    window.MutationObserver = class RealPlayDiagnosticMutationObserver extends NativeMutationObserver {
      constructor(callback) {
        const id = ++nextId;
        const stat = {
          id,
          callbacks: 0,
          records: 0,
          disconnectedByDiagnostic: false,
          stack: String(new Error(`MutationObserver #${id}`).stack || ''),
        };
        window.__rpMutationObserverStats.push(stat);

        super((records, observer) => {
          stat.callbacks += 1;
          stat.records += records.length;
          if (stat.callbacks > 250) {
            stat.disconnectedByDiagnostic = true;
            observer.disconnect();
            return;
          }
          callback(records, observer);
        });
      }
    };
  });

  console.log('STAGE navigate');
  await page.goto(APP_URL, { waitUntil: 'commit', timeout: 15000 });
  console.log('STAGE wait-slot-runtime');
  await page.waitForFunction(() => window.__realPlayFourVFourSlotPickerInstalled === true, null, { timeout: 20000 });

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
  await page.waitForSelector('.rp-4v4-slot-overlay', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => {
    const overlay = document.querySelector('.rp-4v4-slot-overlay');
    if (overlay?.hidden) {
      overlay.hidden = false;
      document.body.classList.add('rp-4v4-slot-picker-open');
    }
    window.__rpDomWriteStats.clear();
  });
  await page.waitForTimeout(250);

  console.log('STAGE choose-active-slot');
  await page.locator('[data-rp-4v4-slot="2000-2200"]').evaluate((el) => el.click());
  await page.waitForTimeout(1000);

  const report = await page.evaluate(() => {
    const view = document.querySelector('.rp-4v4-static-view');
    const style = view ? getComputedStyle(view) : null;
    const topWrites = [...window.__rpDomWriteStats.entries()]
      .map(([stack, count]) => ({ count, stack }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
    return {
      storage: sessionStorage.getItem('real_play_4v4_time_slot'),
      cleanupInstalled: window.__realPlayFuture4v4CardCleanupInstalled === true,
      viewExists: Boolean(view),
      viewOpen: Boolean(view?.classList.contains('open')),
      ariaHidden: view?.getAttribute('aria-hidden') ?? null,
      bodyOpen: document.body.classList.contains('rp-4v4-static-open'),
      heading: view?.querySelector('.rp-3v3-select-head h1')?.textContent?.trim() || null,
      display: style?.display || null,
      position: style?.position || null,
      topWrites,
      observerStats: window.__rpMutationObserverStats
        .filter((item) => item.callbacks >= 20)
        .sort((a, b) => b.callbacks - a.callbacks)
        .slice(0, 25),
    };
  });

  console.log('LIVE_REPORT ' + JSON.stringify(report));
  await browser.close();
  clearTimeout(hardStop);
  process.exit(0);
} catch (error) {
  clearTimeout(hardStop);
  console.error('DIAGNOSTIC_FAILURE', error?.stack || error);
  process.exit(1);
}
