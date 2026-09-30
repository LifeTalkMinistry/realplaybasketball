(() => {
  if (window.__realPlayFourVFourSlotHeaderInstalled) return;
  window.__realPlayFourVFourSlotHeaderInstalled = true;

  const SLOT_KEY = 'real_play_4v4_time_slot';
  const STYLE_ID = 'rp-4v4-slot-header-style';
  const boundHeadings = new WeakSet();

  function selectedSlot() {
    try {
      const raw = sessionStorage.getItem(SLOT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-4v4-static-view [data-rp-4v4-team-slot]{display:none!important}
      .rp-4v4-static-view .rp-3v3-select-head h1[data-rp-4v4-slot-heading]{cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function openSlotPickerFromHeading(view) {
    const hiddenSlotControl = view?.querySelector('[data-rp-4v4-team-slot]');
    if (hiddenSlotControl) {
      hiddenSlotControl.click();
      return;
    }
    document.querySelector('[data-rp-home-save-slot]')?.click();
  }

  function syncSlotHeading() {
    ensureStyle();
    const view = document.querySelector('.rp-4v4-static-view');
    if (!view) return false;

    const heading = view.querySelector('.rp-3v3-select-head h1');
    const slot = selectedSlot();
    const label = String(slot?.label || '').trim();
    if (!heading || !label) return false;

    if (heading.textContent !== label) heading.textContent = label;
    if (heading.getAttribute('data-rp-4v4-slot-heading') !== 'true') {
      heading.setAttribute('data-rp-4v4-slot-heading', 'true');
    }

    const ariaLabel = `Selected time slot ${label}. Activate to change time slot.`;
    if (heading.getAttribute('aria-label') !== ariaLabel) heading.setAttribute('aria-label', ariaLabel);
    if (heading.getAttribute('role') !== 'button') heading.setAttribute('role', 'button');
    if (heading.tabIndex !== 0) heading.tabIndex = 0;

    if (!boundHeadings.has(heading)) {
      boundHeadings.add(heading);
      heading.addEventListener('click', () => openSlotPickerFromHeading(view));
      heading.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openSlotPickerFromHeading(view);
      });
    }

    return true;
  }

  window.addEventListener('realplay:4v4-open', () => {
    syncSlotHeading();
    window.setTimeout(syncSlotHeading, 80);
  });

  window.addEventListener('realplay:home-schedule-changed', () => {
    window.setTimeout(syncSlotHeading, 0);
  });

  document.addEventListener('click', (event) => {
    if (!event.target?.closest?.('[data-rp-4v4-slot]')) return;
    window.setTimeout(syncSlotHeading, 0);
    window.setTimeout(syncSlotHeading, 120);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(syncSlotHeading, 0), { once: true });
  } else {
    syncSlotHeading();
  }
})();