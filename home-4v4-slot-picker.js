(() => {
  if (window.__realPlayFourVFourSlotPickerInstalled) return;
  window.__realPlayFourVFourSlotPickerInstalled = true;

  const SLOT_KEY = 'real_play_4v4_time_slot';
  const CURRENT_4V4_SLOT_ID = '2000-2200';
  const SLOTS = [
    { id: '1600-1800', label: '4:00 PM – 6:00 PM', active: false },
    { id: '1800-2000', label: '6:00 PM – 8:00 PM', active: false },
    { id: '2000-2200', label: '8:00 PM – 10:00 PM', active: true },
  ];

  let slotOverlay = null;
  let observer = null;
  let selectedSlotMemory = null;
  let currentFourVFourRuntimeRequested = false;

  function getSelectedSlot() {
    if (selectedSlotMemory) return selectedSlotMemory;
    try {
      const raw = sessionStorage.getItem(SLOT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      selectedSlotMemory = SLOTS.find((slot) => slot.id === parsed?.id) || null;
      return selectedSlotMemory;
    } catch (_error) {
      return selectedSlotMemory;
    }
  }

  function setSelectedSlot(slot) {
    selectedSlotMemory = slot || null;
    try {
      sessionStorage.setItem(SLOT_KEY, JSON.stringify(slot));
    } catch (_error) {
      // Keep the current selection in memory when sessionStorage is unavailable.
    }
  }

  function requestCurrentFourVFourRuntime() {
    if (window.__realPlayFuture4v4CardCleanupInstalled === true || currentFourVFourRuntimeRequested) return;

    currentFourVFourRuntimeRequested = true;
    const script = document.createElement('script');
    const deployId = String(document.documentElement?.dataset?.rpDeploy || '').trim();
    script.src = `home-future-4v4-card-cleanup.js${deployId ? `?v=${encodeURIComponent(deployId)}` : ''}`;
    script.async = false;
    script.addEventListener('load', () => {
      if (window.__realPlayFuture4v4CardCleanupInstalled !== true) currentFourVFourRuntimeRequested = false;
    }, { once: true });
    script.addEventListener('error', () => {
      currentFourVFourRuntimeRequested = false;
    }, { once: true });
    document.head.appendChild(script);
  }

  function ensureStyles() {
    if (document.getElementById('rp-4v4-slot-picker-styles')) return;

    const style = document.createElement('style');
    style.id = 'rp-4v4-slot-picker-styles';
    style.textContent = `
      [data-rp-home-open-rank-meta],
      [data-rp-home-open-rank-capacity]{display:none!important}

      .rp-4v4-slot-overlay[hidden]{display:none!important}
      .rp-4v4-slot-overlay{
        position:fixed;inset:0;z-index:940;
        display:grid;place-items:center;
        padding:20px 16px;
        background:rgba(0,5,12,.78);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
      }
      .rp-4v4-slot-sheet{
        width:min(100%,520px);max-height:min(88vh,720px);overflow:auto;
        margin:0;padding:18px;
        border:1px solid rgba(47,216,255,.28);
        border-radius:24px;
        background:
          radial-gradient(circle at 15% 0%,rgba(0,174,255,.14),transparent 32%),
          radial-gradient(circle at 88% 8%,rgba(238,38,67,.12),transparent 30%),
          linear-gradient(180deg,#07131f 0%,#02070d 100%);
        box-shadow:0 24px 80px rgba(0,0,0,.55);
        color:#f4f8fb;
      }
      .rp-4v4-slot-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:20px}
      .rp-4v4-slot-head h2{margin:0;font-size:1.55rem;line-height:1.04;font-style:italic;letter-spacing:.01em;text-transform:uppercase}
      .rp-4v4-slot-close{
        flex:0 0 42px;width:42px;height:42px;border-radius:14px;
        border:1px solid rgba(47,216,255,.25);background:#06111c;color:#dce9f3;
        font:900 1.25rem/1 sans-serif;cursor:pointer;
      }
      .rp-4v4-slot-list{display:grid;gap:11px}
      .rp-4v4-slot-option{
        position:relative;display:grid;grid-template-columns:1fr auto;align-items:center;gap:14px;
        width:100%;min-height:76px;padding:14px 16px;text-align:left;cursor:pointer;
        color:#f5fbff;background:linear-gradient(135deg,rgba(7,25,38,.98),rgba(4,12,21,.98));
        border:1px solid rgba(47,216,255,.22);border-radius:16px;
        box-shadow:inset 3px 0 0 rgba(33,200,255,.72);
      }
      .rp-4v4-slot-option:hover,.rp-4v4-slot-option:focus-visible{border-color:rgba(47,216,255,.72);outline:none}
      .rp-4v4-slot-option.is-selected{border-color:#28ccff;box-shadow:inset 3px 0 0 #28ccff,0 0 0 1px rgba(40,204,255,.12)}
      .rp-4v4-slot-option:disabled{cursor:default;opacity:.48}
      .rp-4v4-slot-option:disabled:hover{border-color:rgba(47,216,255,.22)}
      .rp-4v4-slot-option:disabled .rp-4v4-slot-arrow{opacity:.35}
      .rp-4v4-slot-option small{display:block;margin-bottom:4px;color:#70879b;font-size:.59rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
      .rp-4v4-slot-option strong{display:block;font-size:1.03rem;letter-spacing:.035em}
      .rp-4v4-slot-arrow{color:#28ccff;font-size:1.25rem;font-weight:900}

      .rp-4v4-team-slot{
        display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;
        width:calc(100% - 28px);max-width:500px;margin:12px auto 4px;padding:11px 13px;
        border:1px solid rgba(47,216,255,.24);border-radius:13px;
        background:linear-gradient(100deg,rgba(7,28,42,.96),rgba(6,14,24,.94));
        color:#eff9ff;text-align:left;cursor:pointer;
      }
      .rp-4v4-team-slot-copy small{display:block;margin-bottom:3px;color:#28ccff;font-size:.55rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
      .rp-4v4-team-slot-copy strong{display:block;font-size:.78rem;letter-spacing:.055em}
      .rp-4v4-team-slot-change{color:#7890a4;font-size:.57rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}

      @media (min-width:640px){
        .rp-4v4-slot-overlay{padding:24px}
      }
    `;
    document.head.appendChild(style);
  }

  function enforceHomeCard() {
    const button = document.querySelector('[data-rp-home-save-slot]');
    if (button) {
      if (button.textContent.trim() !== 'CHOOSE MY SLOT') button.textContent = 'CHOOSE MY SLOT';
      if (button.getAttribute('aria-label') !== 'Choose my 4v4 time slot') {
        button.setAttribute('aria-label', 'Choose my 4v4 time slot');
      }
    }

    const meta = document.querySelector('[data-rp-home-open-rank-meta]');
    if (meta && !meta.hidden) meta.hidden = true;

    const capacity = document.querySelector('[data-rp-home-open-rank-capacity]');
    if (capacity && !capacity.hidden) capacity.hidden = true;
  }

  function ensureOverlay() {
    if (slotOverlay?.isConnected) return slotOverlay;

    slotOverlay = document.createElement('div');
    slotOverlay.className = 'rp-4v4-slot-overlay';
    slotOverlay.dataset.rp4v4SlotOverlay = 'true';
    slotOverlay.hidden = true;
    slotOverlay.innerHTML = `
      <section class="rp-4v4-slot-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-4v4-slot-title">
        <header class="rp-4v4-slot-head">
          <h2 id="rp-4v4-slot-title">Choose Your Time Slot</h2>
          <button class="rp-4v4-slot-close" type="button" aria-label="Close time slot picker" data-rp-4v4-slot-close>×</button>
        </header>
        <div class="rp-4v4-slot-list" data-rp-4v4-slot-list></div>
      </section>`;

    document.body.appendChild(slotOverlay);

    slotOverlay.querySelector('[data-rp-4v4-slot-close]')?.addEventListener('click', closeSlotPicker);
    slotOverlay.addEventListener('click', (event) => {
      if (event.target === slotOverlay) closeSlotPicker();
    });

    return slotOverlay;
  }

  function renderSlotOptions() {
    const overlay = ensureOverlay();
    const list = overlay.querySelector('[data-rp-4v4-slot-list]');
    if (!list) return;

    const selected = getSelectedSlot();
    list.innerHTML = SLOTS.map((slot) => `
      <button class="rp-4v4-slot-option${selected?.id === slot.id ? ' is-selected' : ''}" type="button" data-rp-4v4-slot="${slot.id}"${slot.active ? '' : ' disabled aria-disabled="true"'}>
        <span><small>TIME SLOT</small><strong>${slot.label}</strong></span>
        <span class="rp-4v4-slot-arrow" aria-hidden="true">›</span>
      </button>`).join('');

    list.querySelectorAll('[data-rp-4v4-slot]').forEach((button) => {
      button.addEventListener('click', () => {
        const slotId = button.getAttribute('data-rp-4v4-slot');
        const slot = SLOTS.find((item) => item.id === slotId);
        if (slot?.active) chooseSlot(slot);
      });
    });
  }

  function openSlotPicker() {
    requestCurrentFourVFourRuntime();
    ensureStyles();
    renderSlotOptions();
    const overlay = ensureOverlay();
    overlay.hidden = false;
    document.body.classList.add('rp-4v4-slot-picker-open');
    window.setTimeout(() => overlay.querySelector('[data-rp-4v4-slot]:not(:disabled)')?.focus({ preventScroll: true }), 0);
  }

  function closeSlotPicker() {
    if (!slotOverlay) return;
    slotOverlay.hidden = true;
    document.body.classList.remove('rp-4v4-slot-picker-open');
  }

  function ensureTeamSlotBanner() {
    const view = document.querySelector('.rp-4v4-static-view');
    if (!view) return false;

    const selected = getSelectedSlot();
    if (!selected || selected.id !== CURRENT_4V4_SLOT_ID) return false;

    let banner = view.querySelector('[data-rp-4v4-team-slot]');
    if (!banner) {
      banner = document.createElement('button');
      banner.type = 'button';
      banner.className = 'rp-4v4-team-slot';
      banner.dataset.rp4v4TeamSlot = 'true';
      banner.addEventListener('click', openSlotPicker);

      const topbar = view.querySelector('.rp-3v3-topbar');
      if (topbar) topbar.insertAdjacentElement('afterend', banner);
      else view.prepend(banner);
    }

    banner.setAttribute('aria-label', `Selected time slot ${selected.label}. Change time slot.`);
    banner.innerHTML = `
      <span class="rp-4v4-team-slot-copy"><small>YOUR TIME SLOT</small><strong>${selected.label}</strong></span>
      <span class="rp-4v4-team-slot-change">CHANGE</span>`;
    return true;
  }

  function fireCurrentFourVFourOpen() {
    if (document.body.classList.contains('rp-4v4-static-open')) {
      ensureTeamSlotBanner();
      return true;
    }

    requestCurrentFourVFourRuntime();

    // The current 4v4 screen is owned by home-future-4v4-card-cleanup.js.
    // Its document-level click handler only needs an .rp-home-4v4-explore target,
    // so create a temporary handoff button instead of depending on the old card
    // still being present in the Home DOM.
    if (window.__realPlayFuture4v4CardCleanupInstalled === true) {
      const handoff = document.createElement('button');
      handoff.type = 'button';
      handoff.className = 'rp-home-4v4-explore';
      handoff.dataset.rpSlotHandoff = 'true';
      handoff.hidden = true;
      document.body.appendChild(handoff);
      handoff.click();
      handoff.remove();
      return true;
    }

    // Fallback for older cached runtime where the visible 4v4 action still exists.
    const trigger = document.querySelector('.rp-home-4v4-explore');
    if (trigger) {
      trigger.dataset.rpSlotHandoff = 'true';
      trigger.click();
      delete trigger.dataset.rpSlotHandoff;
      return true;
    }

    return false;
  }

  function openTeamSelection() {
    let attempts = 0;

    const tryOpen = () => {
      if (document.body.classList.contains('rp-4v4-static-open') || document.querySelector('[data-rp-4v4-static-view].open')) {
        ensureTeamSlotBanner();
        return;
      }

      const handedOff = fireCurrentFourVFourOpen();
      if (handedOff) {
        window.setTimeout(() => {
          if (document.body.classList.contains('rp-4v4-static-open') || document.querySelector('[data-rp-4v4-static-view].open')) {
            ensureTeamSlotBanner();
            window.setTimeout(ensureTeamSlotBanner, 120);
            return;
          }

          attempts += 1;
          if (attempts < 100) window.setTimeout(tryOpen, 100);
          else openSlotPicker();
        }, 50);
        return;
      }

      attempts += 1;
      if (attempts < 100) {
        window.setTimeout(tryOpen, 100);
        return;
      }

      // If the 4v4 runtime genuinely never loads, return the player to the picker.
      openSlotPicker();
    };

    tryOpen();
  }

  function chooseSlot(slot) {
    if (!slot?.active || slot.id !== CURRENT_4V4_SLOT_ID) return;

    setSelectedSlot(slot);
    closeSlotPicker();

    if (document.body.classList.contains('rp-4v4-static-open')) {
      ensureTeamSlotBanner();
      return;
    }

    window.setTimeout(openTeamSelection, 20);
  }

  function onCaptureClick(event) {
    const homeButton = event.target?.closest?.('[data-rp-home-save-slot]');
    if (homeButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openSlotPicker();
      return;
    }

    const directTeamAction = event.target?.closest?.('.rp-home-4v4-explore');
    if (directTeamAction?.dataset?.rpSlotHandoff === 'true') return;

    const selected = getSelectedSlot();
    if (directTeamAction && selected?.id !== CURRENT_4V4_SLOT_ID) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openSlotPicker();
    }
  }

  function onKeydown(event) {
    if (event.key !== 'Escape') return;
    if (slotOverlay && !slotOverlay.hidden) closeSlotPicker();
  }

  function start() {
    ensureStyles();
    enforceHomeCard();
    ensureTeamSlotBanner();

    document.addEventListener('click', onCaptureClick, true);
    document.addEventListener('keydown', onKeydown);

    observer = new MutationObserver(() => {
      enforceHomeCard();
      if (document.body.classList.contains('rp-4v4-static-open')) ensureTeamSlotBanner();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();