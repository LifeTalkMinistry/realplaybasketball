(() => {
  if (window.__realPlayAssignedSessionWindowInstalled) return;
  window.__realPlayAssignedSessionWindowInstalled = true;

  let syncing = false;
  let apiWrapped = false;
  let wrapTimer = 0;

  function editorForm() {
    return document.querySelector('[data-rp-home-open-rank-edit-form]');
  }

  function schedulerRoot(form = editorForm()) {
    return form?.querySelector('[data-rp-home-team-schedule]') || null;
  }

  function assignedMode(form = editorForm()) {
    return schedulerRoot(form)?.dataset?.mode !== 'open';
  }

  function toMinutes(value) {
    const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return NaN;
    return (Number(match[1]) * 60) + Number(match[2]);
  }

  function toClock(value) {
    const safe = Math.max(0, Math.min(1439, Number(value) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  function assignedBounds(form = editorForm()) {
    if (!form || !assignedMode(form)) return null;
    const blocks = [...form.querySelectorAll('[data-rp-team-block]')];
    if (!blocks.length) return null;

    let earliest = Number.POSITIVE_INFINITY;
    let latest = Number.NEGATIVE_INFINITY;
    for (const block of blocks) {
      const start = toMinutes(block.querySelector('[data-rp-team-block-start]')?.value);
      const end = toMinutes(block.querySelector('[data-rp-team-block-end]')?.value);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      earliest = Math.min(earliest, start);
      latest = Math.max(latest, end);
    }

    return { start: toClock(earliest), end: toClock(latest) };
  }

  function dispatchFieldChange(field) {
    field?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function syncSessionWindow(form = editorForm(), { notify = true } = {}) {
    if (syncing || !form || !assignedMode(form)) return false;
    const bounds = assignedBounds(form);
    if (!bounds) return false;

    const startsAt = form.elements?.startsAt;
    const endsAt = form.elements?.endsAt;
    const currentStart = String(startsAt?.value || '');
    let startChanged = false;
    let endChanged = false;

    syncing = true;
    try {
      if (startsAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(currentStart)) {
        const nextStart = `${currentStart.slice(0, 11)}${bounds.start}`;
        if (startsAt.value !== nextStart) {
          startsAt.value = nextStart;
          startChanged = true;
        }
      }
      if (endsAt && endsAt.value !== bounds.end) {
        endsAt.value = bounds.end;
        endChanged = true;
      }
    } finally {
      syncing = false;
    }

    if (notify) {
      if (startChanged) dispatchFieldChange(startsAt);
      if (endChanged) dispatchFieldChange(endsAt);
    }
    return startChanged || endChanged;
  }

  function shouldSyncFromTarget(target) {
    return Boolean(target?.matches?.('[data-rp-team-block-start], [data-rp-team-block-end]'));
  }

  function queueSync(form = editorForm()) {
    window.queueMicrotask(() => syncSessionWindow(form));
  }

  document.addEventListener('input', (event) => {
    if (!shouldSyncFromTarget(event.target)) return;
    syncSessionWindow(event.target.closest?.('[data-rp-home-open-rank-edit-form]') || editorForm());
  }, true);

  document.addEventListener('change', (event) => {
    if (!shouldSyncFromTarget(event.target)) return;
    syncSessionWindow(event.target.closest?.('[data-rp-home-open-rank-edit-form]') || editorForm());
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target?.closest?.('[data-rp-home-open-rank-edit-form]');
    if (!form) return;
    syncSessionWindow(form, { notify: false });
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-team-add-block], [data-rp-team-block-remove], [data-rp-team-schedule-mode="assigned"]')) return;
    queueSync(event.target.closest?.('[data-rp-home-open-rank-edit-form]') || editorForm());
  });

  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) return;
    const form = editorForm();
    if (!form || !schedulerRoot(form)) return;
    queueSync(form);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function wrapSchedulingApi() {
    const api = window.__realPlayHomeTeamScheduling;
    if (!api?.snapshot || apiWrapped || api.__assignedSessionWindowWrapped) return Boolean(api?.__assignedSessionWindowWrapped);
    const originalSnapshot = api.snapshot.bind(api);
    api.snapshot = function assignedSessionWindowSnapshot() {
      syncSessionWindow(editorForm(), { notify: false });
      return originalSnapshot();
    };
    api.__assignedSessionWindowWrapped = true;
    apiWrapped = true;
    return true;
  }

  wrapTimer = window.setInterval(() => {
    if (!wrapSchedulingApi()) return;
    window.clearInterval(wrapTimer);
    wrapTimer = 0;
    queueSync();
  }, 100);
  window.setTimeout(() => {
    if (!wrapTimer) return;
    window.clearInterval(wrapTimer);
    wrapTimer = 0;
  }, 10000);
})();
