(() => {
  if (window.__realPlayTeamRotationPickerV2Installed) return;
  window.__realPlayTeamRotationPickerV2Installed = true;

  const API = 'https://api.clarapmc.com/api/real-play/public/updates';
  const STORE = 'real_play_4v4_time_slot';
  const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const DEFAULT_ACTIVE_DAYS = new Set(['SUNDAY']);
  const SESSION_GRACE_MS = 12 * 60 * 60 * 1000;
  const TEAM_RUNTIME_SRC = 'home-future-4v4-card-cleanup.js?v=20261001-team-schedule-rotation-v3';

  let rotations = [];
  let modal = null;
  let refreshPromise = null;
  let runtimePromise = null;
  let observerQueued = false;

  const esc = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const clock = (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : '';
  const keys = (value) => [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))];
  const displayTime = (value) => {
    const normalized = clock(value);
    if (!normalized) return '';
    const [hourText, minute] = normalized.split(':');
    const hour = Number(hourText);
    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  function selected() {
    try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); }
    catch (_error) { return null; }
  }
  function setSelected(item) {
    try { item ? sessionStorage.setItem(STORE, JSON.stringify(item)) : sessionStorage.removeItem(STORE); }
    catch (_error) {}
    window.__realPlay4v4SelectedSlot = item || null;
    window.__realPlay4v4AssignedTeamKeys = item?.teamKeys || null;
    window.dispatchEvent(new CustomEvent('realplay:4v4-slot-context', {
      detail: { slot: item || null, rotation: item || null, filterMode: item ? 'assigned' : 'all', teamKeys: item?.teamKeys || null },
    }));
  }

  function teamScheduleOf(update) {
    return update?.metadata?.teamSchedule || update?.metadata?.team_schedule || null;
  }
  function scheduleCandidates(updates) {
    return (Array.isArray(updates) ? updates : []).filter((update) => String(update?.category || '').toLowerCase() === 'schedule' && teamScheduleOf(update));
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

  function fromSchedule(schedule) {
    if (!schedule || schedule.mode === 'open' || !Array.isArray(schedule.blocks)) return [];
    const hasDayMetadata = Number(schedule.version || 1) >= 2 && schedule.blocks.some((block) => block?.day);
    const legacyByDay = {
      SATURDAY: schedule.blocks[0] || null,
      SUNDAY: schedule.blocks[1] || null,
    };
    const source = DAYS.map((day) => ({
      day,
      block: hasDayMetadata
        ? schedule.blocks.find((item) => String(item?.day || '').toUpperCase() === day)
        : legacyByDay[day] || null,
    }));

    return source.map(({ day, block }) => {
      const start = hasDayMetadata ? (clock(block?.start) || '20:00') : '20:00';
      const end = hasDayMetadata ? (clock(block?.end) || '22:00') : '22:00';
      const teamKeys = keys(block?.teamKeys);
      const requestedEnabled = typeof block?.enabled === 'boolean' ? block.enabled : DEFAULT_ACTIVE_DAYS.has(day);
      const enabled = Boolean(requestedEnabled && teamKeys.length);
      return {
        id: `${day.toLowerCase()}-${start.replace(':','')}-${end.replace(':','')}`,
        day,
        start,
        end,
        label: `${day} · ${displayTime(start)} – ${displayTime(end)}`,
        enabled,
        teamKeys,
        filterMode: 'assigned',
      };
    });
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      try {
        const response = await fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        const data = response.ok ? await response.json() : {};
        rotations = fromSchedule(teamScheduleOf(chooseCurrentSchedule(data?.updates)));
      } catch (_error) {
        rotations = [];
      }

      window.__realPlay4v4RotationDays = rotations;
      window.dispatchEvent(new CustomEvent('realplay:4v4-rotation-schedule', { detail: { rotations } }));

      const saved = selected();
      if (saved?.id) {
        const current = rotations.find((item) => item.id === saved.id && item.enabled);
        setSelected(current || null);
      } else {
        setSelected(null);
      }
      return rotations;
    })();
    try { return await refreshPromise; }
    finally { refreshPromise = null; }
  }

  function styles() {
    if (document.getElementById('rp-team-rotation-v2-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-team-rotation-v2-style';
    style.textContent = `
      .rp-team-rotation-modal[hidden]{display:none!important}.rp-team-rotation-modal{position:fixed;inset:0;z-index:980;display:grid;place-items:center;padding:20px;background:rgba(0,5,12,.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .rp-team-rotation-card{width:min(100%,520px);max-height:min(92vh,760px);overflow:auto;padding:18px;border:1px solid rgba(47,216,255,.28);border-radius:24px;background:radial-gradient(circle at 15% 0%,rgba(0,174,255,.14),transparent 32%),radial-gradient(circle at 88% 8%,rgba(238,38,67,.12),transparent 30%),linear-gradient(180deg,#07131f,#02070d);color:#f4f8fb;box-shadow:0 24px 80px rgba(0,0,0,.55)}
      .rp-team-rotation-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.rp-team-rotation-head h2{margin:0;font:950 italic 1.35rem/1.05 system-ui,sans-serif;text-transform:uppercase}.rp-team-rotation-close{width:42px;height:42px;border:1px solid rgba(47,216,255,.25);border-radius:14px;background:#06111c;color:#dce9f3;font-size:1.25rem;font-weight:900;cursor:pointer}
      .rp-team-rotation-help{margin:8px 0 14px;color:#8ca0b1;font:750 .64rem/1.45 system-ui,sans-serif}.rp-team-rotation-list{display:grid;gap:7px}
      .rp-team-rotation-option{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;width:100%;min-height:68px;padding:12px 15px;border:1px solid rgba(47,216,255,.24);border-radius:15px;background:#071522;color:#f5fbff;text-align:left;box-shadow:inset 3px 0 0 #28ccff;cursor:pointer}.rp-team-rotation-option:hover,.rp-team-rotation-option:focus-visible{border-color:#28ccff;outline:none}.rp-team-rotation-option small{display:block;margin-bottom:4px;color:#70879b;font-size:.55rem;font-weight:900;letter-spacing:.13em}.rp-team-rotation-option strong{font-size:.94rem}.rp-team-rotation-option b{color:#28ccff;font-size:1.3rem}.rp-team-rotation-option.is-disabled{min-height:44px;padding:9px 14px;border-color:rgba(255,255,255,.07);background:rgba(5,13,21,.52);box-shadow:none;color:#687b8a;cursor:default;opacity:.62}.rp-team-rotation-option.is-disabled small{margin-bottom:2px;color:#546775;font-size:.49rem}.rp-team-rotation-option.is-disabled strong{font-size:.78rem}.rp-team-rotation-option.is-disabled em{font-style:normal;color:#596d7b;font-size:.52rem;font-weight:900;letter-spacing:.08em}.rp-team-rotation-empty{padding:18px;border:1px dashed rgba(47,216,255,.2);border-radius:16px;color:#8295a5;text-align:center;font:850 .68rem/1.5 system-ui,sans-serif}
      .rp-4v4-team-slot{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;width:calc(100% - 28px);max-width:500px;margin:12px auto 4px;padding:11px 13px;border:1px solid rgba(47,216,255,.24);border-radius:13px;background:#071522;color:#eff9ff;text-align:left;cursor:pointer}.rp-4v4-team-slot small{display:block;color:#28ccff;font-size:.52rem;font-weight:900;letter-spacing:.11em}.rp-4v4-team-slot strong{font-size:.72rem}.rp-4v4-team-slot span:last-child{color:#7890a4;font-size:.56rem;font-weight:900}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.className = 'rp-team-rotation-modal';
    modal.hidden = true;
    modal.innerHTML = `<section class="rp-team-rotation-card" role="dialog" aria-modal="true" aria-labelledby="rp-team-rotation-title"><div class="rp-team-rotation-head"><h2 id="rp-team-rotation-title">TEAM SCHEDULE ROTATION</h2><button class="rp-team-rotation-close" type="button" aria-label="Close team schedule rotation">×</button></div><p class="rp-team-rotation-help">Choose an active team schedule. Gray days are visible for future rotation demand but are not active yet.</p><div class="rp-team-rotation-list"></div></section>`;
    document.body.appendChild(modal);
    modal.querySelector('.rp-team-rotation-close')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function render() {
    const list = ensureModal().querySelector('.rp-team-rotation-list');
    if (!rotations.length) {
      list.innerHTML = '<div class="rp-team-rotation-empty">TEAM ROTATION IS NOT PUBLISHED YET.</div>';
      return;
    }
    list.innerHTML = rotations.map((rotation) => rotation.enabled
      ? `<button class="rp-team-rotation-option" type="button" data-rp-rotation-id="${esc(rotation.id)}"><span><small>ACTIVE TEAM ROTATION</small><strong>${esc(rotation.label)}</strong></span><b aria-hidden="true">›</b></button>`
      : `<div class="rp-team-rotation-option is-disabled" aria-disabled="true"><span><small>ROTATION DAY</small><strong>${esc(rotation.day)}</strong></span><em>NOT ACTIVE YET</em></div>`
    ).join('');
    list.querySelectorAll('[data-rp-rotation-id]').forEach((button) => {
      button.addEventListener('click', () => chooseRotation(rotations.find((item) => item.id === button.dataset.rpRotationId && item.enabled)));
    });
  }

  async function openModal() {
    styles();
    const root = ensureModal();
    root.hidden = false;
    const list = root.querySelector('.rp-team-rotation-list');
    list.innerHTML = '<div class="rp-team-rotation-empty">LOADING TEAM SCHEDULE ROTATION…</div>';
    await refresh();
    if (!root.hidden) render();
  }
  function closeModal() { if (modal) modal.hidden = true; }

  function teamViewOpen() {
    return document.body.classList.contains('rp-4v4-static-open') || Boolean(document.querySelector('[data-rp-4v4-static-view].open'));
  }

  function ensureTeamRuntime() {
    if (window.__realPlayFuture4v4CardCleanupInstalled === true) return Promise.resolve(true);
    if (runtimePromise) return runtimePromise;
    runtimePromise = new Promise((resolve) => {
      let script = document.querySelector('script[data-rp-rotation-team-view-loader]');
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        runtimePromise = null;
        resolve(value);
      };
      if (!script) {
        script = document.createElement('script');
        script.dataset.rpRotationTeamViewLoader = '1';
        script.src = TEAM_RUNTIME_SRC;
        script.async = false;
        document.head.appendChild(script);
      }
      script.addEventListener('load', () => finish(window.__realPlayFuture4v4CardCleanupInstalled === true), { once: true });
      script.addEventListener('error', () => finish(false), { once: true });
      window.setTimeout(() => finish(window.__realPlayFuture4v4CardCleanupInstalled === true), 5000);
    });
    return runtimePromise;
  }

  function waitForTeamView(timeoutMs = 3500) {
    const started = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        if (teamViewOpen()) return resolve(true);
        if (Date.now() - started >= timeoutMs) return resolve(false);
        window.setTimeout(check, 80);
      };
      check();
    });
  }

  async function openTeamSelection() {
    if (teamViewOpen()) { ensureBanner(); return true; }
    const runtimeReady = await ensureTeamRuntime();
    if (!runtimeReady && !document.querySelector('.rp-home-4v4-explore')) return false;

    const trigger = document.querySelector('.rp-home-4v4-explore');
    if (trigger) {
      trigger.dataset.rpSlotHandoff = 'true';
      trigger.click();
      delete trigger.dataset.rpSlotHandoff;
    } else if (window.__realPlayFuture4v4CardCleanupInstalled === true) {
      const handoff = document.createElement('button');
      handoff.type = 'button';
      handoff.className = 'rp-home-4v4-explore';
      handoff.dataset.rpSlotHandoff = 'true';
      handoff.hidden = true;
      document.body.appendChild(handoff);
      handoff.click();
      handoff.remove();
    }

    const opened = await waitForTeamView();
    if (opened) ensureBanner();
    return opened;
  }

  async function chooseRotation(item) {
    if (!item?.enabled) return;
    setSelected(item);
    closeModal();
    const existing = document.querySelector('[data-rp-4v4-static-view]');
    if (existing) existing.remove();
    document.body.classList.remove('rp-4v4-static-open');
    const opened = await openTeamSelection();
    if (!opened) openModal();
  }

  function ensureBanner() {
    const view = document.querySelector('.rp-4v4-static-view');
    const item = selected();
    if (!view || !item) return false;
    let banner = view.querySelector('[data-rp-4v4-team-slot]');
    if (!banner) {
      banner = document.createElement('button');
      banner.type = 'button';
      banner.className = 'rp-4v4-team-slot';
      banner.setAttribute('data-rp-4v4-team-slot', '1');
      banner.addEventListener('click', openModal);
      const topbar = view.querySelector('.rp-3v3-topbar');
      if (topbar) topbar.insertAdjacentElement('afterend', banner); else view.prepend(banner);
    }
    if (banner.dataset.rpRotationLabel !== item.label) {
      banner.dataset.rpRotationLabel = item.label;
      banner.innerHTML = `<span><small>TEAM SCHEDULE ROTATION</small><strong>${esc(item.label)}</strong></span><span>CHECK</span>`;
    }
    return true;
  }

  function enforce() {
    const button = document.querySelector('[data-rp-home-save-slot]');
    if (button) {
      if (button.textContent.trim() !== 'CHECK TEAM SCHEDULE') button.textContent = 'CHECK TEAM SCHEDULE';
      if (button.getAttribute('aria-label') !== 'Check team schedule rotation') button.setAttribute('aria-label', 'Check team schedule rotation');
    }
    if (teamViewOpen()) ensureBanner();
  }

  function queueEnforce() {
    if (observerQueued) return;
    observerQueued = true;
    window.requestAnimationFrame(() => {
      observerQueued = false;
      enforce();
    });
  }

  function onCaptureClick(event) {
    const homeButton = event.target?.closest?.('[data-rp-home-save-slot]');
    if (homeButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openModal();
      return;
    }

    const directTeamAction = event.target?.closest?.('.rp-home-4v4-explore');
    if (directTeamAction?.dataset?.rpSlotHandoff === 'true') return;
    if (directTeamAction && !selected()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openModal();
    }
  }

  async function handleScheduleChanged() {
    const wasOpen = teamViewOpen();
    await refresh();
    if (modal && !modal.hidden) render();
    if (!wasOpen) return;
    const existing = document.querySelector('[data-rp-4v4-static-view]');
    if (existing) existing.remove();
    document.body.classList.remove('rp-4v4-static-open');
    if (selected()) openTeamSelection(); else openModal();
  }

  async function start() {
    styles();
    enforce();

    // Make the UI interactive immediately. Previously these listeners were
    // registered only after the first schedule fetch finished, which left a
    // short window where CHECK TEAM SCHEDULE could still fall through to the
    // legacy handler.
    document.addEventListener('click', onCaptureClick, true);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal && !modal.hidden) closeModal(); });
    window.addEventListener('realplay:home-schedule-changed', handleScheduleChanged);
    new MutationObserver(queueEnforce).observe(document.documentElement, { childList: true, subtree: true });
    window.__realPlayTeamRotationPickerV2Ready = true;

    await refresh();
    enforce();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
