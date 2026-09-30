(() => {
  if (window.__realPlayFourVFourSlotPickerInstalled) return;
  window.__realPlayFourVFourSlotPickerInstalled = true;

  const SLOT_KEY = 'real_play_4v4_time_slot';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const CURRENT_4V4_RUNTIME_VERSION = '20260930-slot-handoff-runtime-v7';
  const SESSION_GRACE_MS = 12 * 60 * 60 * 1000;

  let slotOverlay = null;
  let observer = null;
  let selectedSlotMemory = null;
  let currentFourVFourRuntimeRequested = false;
  let availableSlots = [];
  let slotsLoadPromise = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readStoredSlot() {
    try {
      const raw = sessionStorage.getItem(SLOT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function getSelectedSlot() {
    return selectedSlotMemory || readStoredSlot();
  }

  function setSelectedSlot(slot) {
    selectedSlotMemory = slot || null;
    try {
      if (slot) sessionStorage.setItem(SLOT_KEY, JSON.stringify(slot));
      else sessionStorage.removeItem(SLOT_KEY);
    } catch (_error) {}
  }

  function isSelectedSlotValid() {
    const selected = getSelectedSlot();
    return Boolean(selected?.id && availableSlots.some((slot) => slot.id === selected.id));
  }

  function syncStoredSelection() {
    const stored = getSelectedSlot();
    if (!stored?.id) return;
    const current = availableSlots.find((slot) => slot.id === stored.id);
    if (current) setSelectedSlot(current);
    else setSelectedSlot(null);
  }

  function normalizeClock(value) {
    const clock = String(value || '').trim();
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock) ? clock : '';
  }

  function clockToId(clock) {
    return normalizeClock(clock).replace(':', '');
  }

  function formatClock(clock) {
    const normalized = normalizeClock(clock);
    if (!normalized) return '';
    const [hourText, minute] = normalized.split(':');
    const hour = Number(hourText);
    const period = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minute} ${period}`;
  }

  function parseTwelveHourClock(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return '';
    const period = match[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function eventClockInManila(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(date);
      const hour = parts.find((part) => part.type === 'hour')?.value;
      const minute = parts.find((part) => part.type === 'minute')?.value;
      return normalizeClock(`${hour}:${minute}`);
    } catch (_error) {
      return '';
    }
  }

  function slotFromTimes(start, end) {
    const startClock = normalizeClock(start);
    const endClock = normalizeClock(end);
    if (!startClock || !endClock || startClock === endClock) return null;
    return {
      id: `${clockToId(startClock)}-${clockToId(endClock)}`,
      label: `${formatClock(startClock)} – ${formatClock(endClock)}`,
      start: startClock,
      end: endClock,
      active: true,
    };
  }

  function teamScheduleOf(update) {
    return update?.metadata?.teamSchedule || update?.metadata?.team_schedule || null;
  }

  function scheduleCandidates(updates) {
    return (Array.isArray(updates) ? updates : []).filter((update) => {
      if (!update || String(update.category || '').toLowerCase() !== 'schedule') return false;
      const schedule = teamScheduleOf(update);
      return schedule && typeof schedule === 'object';
    });
  }

  function chooseCurrentSchedule(updates) {
    const candidates = scheduleCandidates(updates).map((update) => ({
      update,
      eventMs: Date.parse(update?.event_at || update?.eventAt || ''),
      publishedMs: Date.parse(update?.published_at || update?.publishedAt || ''),
    }));
    if (!candidates.length) return null;

    const now = Date.now();
    const currentOrFuture = candidates
      .filter((item) => Number.isFinite(item.eventMs) && item.eventMs >= now - SESSION_GRACE_MS)
      .sort((left, right) => {
        if (left.eventMs !== right.eventMs) return left.eventMs - right.eventMs;
        return (right.publishedMs || 0) - (left.publishedMs || 0);
      });

    if (currentOrFuture.length) {
      const eventMs = currentOrFuture[0].eventMs;
      return currentOrFuture
        .filter((item) => item.eventMs === eventMs)
        .sort((left, right) => (right.publishedMs || 0) - (left.publishedMs || 0))[0].update;
    }

    return candidates.sort((left, right) => {
      if ((right.eventMs || 0) !== (left.eventMs || 0)) return (right.eventMs || 0) - (left.eventMs || 0);
      return (right.publishedMs || 0) - (left.publishedMs || 0);
    })[0]?.update || null;
  }

  function slotsFromScheduleUpdate(update) {
    const schedule = teamScheduleOf(update);
    if (!schedule || typeof schedule !== 'object') return [];

    const mode = String(schedule.mode || '').toLowerCase();
    const slots = [];
    const seen = new Set();

    if (mode === 'assigned' && Array.isArray(schedule.blocks)) {
      schedule.blocks.forEach((block) => {
        const slot = slotFromTimes(block?.start, block?.end);
        if (!slot || seen.has(slot.id)) return;
        seen.add(slot.id);
        slots.push(slot);
      });
    } else if (mode === 'open') {
      const start = eventClockInManila(update?.event_at || update?.eventAt);
      const endText = String(update?.body || '').match(/\bENDS\s+(.+?)\s*·/i)?.[1] || '';
      const end = parseTwelveHourClock(endText);
      const slot = slotFromTimes(start, end);
      if (slot) slots.push(slot);
    }

    return slots.sort((left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end));
  }

  async function loadAdminSlots() {
    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Schedule request returned ${response.status}.`);
      const data = await response.json().catch(() => ({}));
      return slotsFromScheduleUpdate(chooseCurrentSchedule(data?.updates));
    } catch (error) {
      console.warn('[Real Play] Could not load admin time blocks for the slot picker.', error);
      return [];
    }
  }

  async function refreshSlots() {
    if (slotsLoadPromise) return slotsLoadPromise;
    slotsLoadPromise = (async () => {
      availableSlots = await loadAdminSlots();
      syncStoredSelection();
      return availableSlots;
    })();
    try {
      return await slotsLoadPromise;
    } finally {
      slotsLoadPromise = null;
    }
  }

  function requestCurrentFourVFourRuntime() {
    if (window.__realPlayFuture4v4CardCleanupInstalled === true || currentFourVFourRuntimeRequested) return;
    currentFourVFourRuntimeRequested = true;
    const script = document.createElement('script');
    script.src = `home-future-4v4-card-cleanup.js?v=${CURRENT_4V4_RUNTIME_VERSION}`;
    script.async = false;
    script.addEventListener('load', () => {
      if (window.__realPlayFuture4v4CardCleanupInstalled !== true) currentFourVFourRuntimeRequested = false;
    }, { once: true });
    script.addEventListener('error', () => { currentFourVFourRuntimeRequested = false; }, { once: true });
    document.head.appendChild(script);
  }

  function ensureStyles() {
    if (document.getElementById('rp-4v4-slot-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'rp-4v4-slot-picker-styles';
    style.textContent = `
      [data-rp-home-open-rank-meta],[data-rp-home-open-rank-capacity]{display:none!important}
      .rp-4v4-slot-overlay[hidden]{display:none!important}
      .rp-4v4-slot-overlay{position:fixed;inset:0;z-index:940;display:grid;place-items:center;padding:20px 16px;background:rgba(0,5,12,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .rp-4v4-slot-sheet{width:min(100%,520px);max-height:min(88vh,720px);overflow:auto;margin:0;padding:18px;border:1px solid rgba(47,216,255,.28);border-radius:24px;background:radial-gradient(circle at 15% 0%,rgba(0,174,255,.14),transparent 32%),radial-gradient(circle at 88% 8%,rgba(238,38,67,.12),transparent 30%),linear-gradient(180deg,#07131f 0%,#02070d 100%);box-shadow:0 24px 80px rgba(0,0,0,.55);color:#f4f8fb}
      .rp-4v4-slot-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:20px}
      .rp-4v4-slot-head h2{margin:0;font-size:1.55rem;line-height:1.04;font-style:italic;letter-spacing:.01em;text-transform:uppercase}
      .rp-4v4-slot-close{flex:0 0 42px;width:42px;height:42px;border-radius:14px;border:1px solid rgba(47,216,255,.25);background:#06111c;color:#dce9f3;font:900 1.25rem/1 sans-serif;cursor:pointer}
      .rp-4v4-slot-list{display:grid;gap:11px}
      .rp-4v4-slot-option{position:relative;display:grid;grid-template-columns:1fr auto;align-items:center;gap:14px;width:100%;min-height:76px;padding:14px 16px;text-align:left;cursor:pointer;color:#f5fbff;background:linear-gradient(135deg,rgba(7,25,38,.98),rgba(4,12,21,.98));border:1px solid rgba(47,216,255,.22);border-radius:16px;box-shadow:inset 3px 0 0 rgba(33,200,255,.72)}
      .rp-4v4-slot-option:hover,.rp-4v4-slot-option:focus-visible{border-color:rgba(47,216,255,.72);outline:none}
      .rp-4v4-slot-option.is-selected{border-color:#28ccff;box-shadow:inset 3px 0 0 #28ccff,0 0 0 1px rgba(40,204,255,.12)}
      .rp-4v4-slot-option small{display:block;margin-bottom:4px;color:#70879b;font-size:.59rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
      .rp-4v4-slot-option strong{display:block;font-size:1.03rem;letter-spacing:.035em}
      .rp-4v4-slot-arrow{color:#28ccff;font-size:1.25rem;font-weight:900}
      .rp-4v4-slot-empty{padding:18px 14px;border:1px dashed rgba(47,216,255,.18);border-radius:16px;color:#7f93a5;background:rgba(3,12,20,.72);font-size:.68rem;font-weight:850;letter-spacing:.055em;line-height:1.5;text-align:center;text-transform:uppercase}
      .rp-4v4-slot-loading{color:#9cb2c2}
      .rp-4v4-team-slot{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;width:calc(100% - 28px);max-width:500px;margin:12px auto 4px;padding:11px 13px;border:1px solid rgba(47,216,255,.24);border-radius:13px;background:linear-gradient(100deg,rgba(7,28,42,.96),rgba(6,14,24,.94));color:#eff9ff;text-align:left;cursor:pointer}
      .rp-4v4-team-slot-copy small{display:block;margin-bottom:3px;color:#28ccff;font-size:.55rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
      .rp-4v4-team-slot-copy strong{display:block;font-size:.78rem;letter-spacing:.055em}
      .rp-4v4-team-slot-change{color:#7890a4;font-size:.57rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
      @media (min-width:640px){.rp-4v4-slot-overlay{padding:24px}}
    `;
    document.head.appendChild(style);
  }

  function enforceHomeCard() {
    const button = document.querySelector('[data-rp-home-save-slot]');
    if (button) {
      if (button.textContent.trim() !== 'CHOOSE MY SLOT') button.textContent = 'CHOOSE MY SLOT';
      if (button.getAttribute('aria-label') !== 'Choose my 4v4 time slot') button.setAttribute('aria-label', 'Choose my 4v4 time slot');
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
    slotOverlay.addEventListener('click', (event) => { if (event.target === slotOverlay) closeSlotPicker(); });
    return slotOverlay;
  }

  function renderSlotOptions({ loading = false } = {}) {
    const overlay = ensureOverlay();
    const list = overlay.querySelector('[data-rp-4v4-slot-list]');
    if (!list) return;

    if (loading) {
      list.innerHTML = '<div class="rp-4v4-slot-empty rp-4v4-slot-loading">LOADING ADMIN TIME SLOTS…</div>';
      return;
    }
    if (!availableSlots.length) {
      list.innerHTML = '<div class="rp-4v4-slot-empty">NO TIME SLOTS ARE AVAILABLE YET.<br>PLEASE CHECK AGAIN AFTER THE SESSION SCHEDULE IS SET.</div>';
      return;
    }

    const selected = getSelectedSlot();
    list.innerHTML = availableSlots.map((slot) => `
      <button class="rp-4v4-slot-option${selected?.id === slot.id ? ' is-selected' : ''}" type="button" data-rp-4v4-slot="${escapeHtml(slot.id)}">
        <span><small>TIME SLOT</small><strong>${escapeHtml(slot.label)}</strong></span>
        <span class="rp-4v4-slot-arrow" aria-hidden="true">›</span>
      </button>`).join('');

    list.querySelectorAll('[data-rp-4v4-slot]').forEach((button) => {
      button.addEventListener('click', () => {
        const slotId = button.getAttribute('data-rp-4v4-slot');
        const slot = availableSlots.find((item) => item.id === slotId);
        if (slot) chooseSlot(slot);
      });
    });
  }

  async function openSlotPicker() {
    requestCurrentFourVFourRuntime();
    ensureStyles();
    const overlay = ensureOverlay();
    overlay.hidden = false;
    document.body.classList.add('rp-4v4-slot-picker-open');
    renderSlotOptions({ loading: true });
    await refreshSlots();
    if (!overlay.hidden) {
      renderSlotOptions();
      window.setTimeout(() => overlay.querySelector('[data-rp-4v4-slot]')?.focus({ preventScroll: true }), 0);
    }
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
    if (!selected || !isSelectedSlotValid()) return false;

    let banner = view.querySelector('[data-rp-4v4-team-slot]');
    if (!banner) {
      banner = document.createElement('button');
      banner.type = 'button';
      banner.className = 'rp-4v4-team-slot';
      banner.setAttribute('data-rp-4v4-team-slot', 'true');
      banner.addEventListener('click', openSlotPicker);
      banner.innerHTML = `
        <span class="rp-4v4-team-slot-copy"><small>YOUR TIME SLOT</small><strong>${escapeHtml(selected.label)}</strong></span>
        <span class="rp-4v4-team-slot-change">CHANGE</span>`;
      const topbar = view.querySelector('.rp-3v3-topbar');
      if (topbar) topbar.insertAdjacentElement('afterend', banner);
      else view.prepend(banner);
    }

    const ariaLabel = `Selected time slot ${selected.label}. Change time slot.`;
    if (banner.getAttribute('aria-label') !== ariaLabel) banner.setAttribute('aria-label', ariaLabel);
    const value = banner.querySelector('.rp-4v4-team-slot-copy strong');
    if (value && value.textContent !== selected.label) value.textContent = selected.label;
    return true;
  }

  function fireCurrentFourVFourOpen() {
    if (document.body.classList.contains('rp-4v4-static-open')) {
      ensureTeamSlotBanner();
      return true;
    }
    requestCurrentFourVFourRuntime();
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
      if (attempts < 100) window.setTimeout(tryOpen, 100);
      else openSlotPicker();
    };
    tryOpen();
  }

  function chooseSlot(slot) {
    if (!slot?.id || !availableSlots.some((item) => item.id === slot.id)) return;
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
    if (directTeamAction && !isSelectedSlotValid()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openSlotPicker();
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && slotOverlay && !slotOverlay.hidden) closeSlotPicker();
  }

  async function start() {
    requestCurrentFourVFourRuntime();
    ensureStyles();
    enforceHomeCard();
    await refreshSlots();
    ensureTeamSlotBanner();

    document.addEventListener('click', onCaptureClick, true);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('realplay:home-schedule-changed', async () => {
      await refreshSlots();
      if (slotOverlay && !slotOverlay.hidden) renderSlotOptions();
      if (document.body.classList.contains('rp-4v4-static-open')) ensureTeamSlotBanner();
    });

    observer = new MutationObserver(() => {
      enforceHomeCard();
      if (document.body.classList.contains('rp-4v4-static-open')) ensureTeamSlotBanner();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();