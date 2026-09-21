(() => {
  if (window.__realPlayHomeOpenRankAdminDeleteInstalled) return;
  window.__realPlayHomeOpenRankAdminDeleteInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  const UPDATES_API_URL = 'https://api.clarapmc.com/api/real-play/updates';

  let deleting = false;
  let mountedBackdrop = null;
  let cachedSchedule = null;

  function token() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch (_error) { return ''; }
  }

  function scheduleType(update) {
    const metadata = update?.metadata || {};
    const text = [
      update?.title,
      update?.body,
      update?.source_key,
      update?.sourceKey,
      metadata.gameType,
      metadata.game_type,
      metadata.mode,
      metadata.format,
      metadata.sessionType,
      metadata.session_type,
    ].filter(Boolean).join(' ').toLowerCase();
    return /\bopen[\s-]?rank(?:ing)?\b|\branking session\b|\bcareer session\b|\beast vs west\b/.test(text)
      ? 'open-rank'
      : '';
  }

  function isManualHomeSchedule(update) {
    if (!update || update.category !== 'schedule') return false;
    const id = Number(update.id);
    if (!Number.isSafeInteger(id) || id <= 0) return false;
    if (update.source_key || update.sourceKey) return false;
    if (scheduleType(update) !== 'open-rank') return false;
    return /\bPLAYER\s+CAP\b/i.test(String(update.body || ''));
  }

  function manilaInputToMs(value) {
    const clean = String(value || '').trim();
    if (!clean) return NaN;
    const date = new Date(`${clean.length === 16 ? `${clean}:00` : clean}+08:00`);
    return date.getTime();
  }

  function matchingSchedule(updates) {
    const form = document.querySelector('[data-rp-home-open-rank-edit-form]');
    const title = String(form?.elements?.title?.value || '').trim().toLowerCase();
    const formTime = manilaInputToMs(form?.elements?.startsAt?.value);
    const list = (Array.isArray(updates) ? updates : [])
      .filter(isManualHomeSchedule)
      .map((item) => ({
        item,
        time: Date.parse(item.event_at || item.eventAt || ''),
        published: Date.parse(item.published_at || item.publishedAt || '') || 0,
      }));

    if (!list.length) return null;

    const exact = list
      .filter(({ item, time }) => {
        const sameTitle = !title || String(item?.title || '').trim().toLowerCase() === title;
        const sameMinute = !Number.isFinite(formTime) || (Number.isFinite(time) && Math.abs(time - formTime) < 60_000);
        return sameTitle && sameMinute;
      })
      .sort((a, b) => b.published - a.published)[0];

    if (exact?.item) return exact.item;

    const now = Date.now();
    const future = list
      .filter(({ time }) => Number.isFinite(time) && time >= now - 60_000)
      .sort((a, b) => b.published - a.published || a.time - b.time)[0];
    if (future?.item) return future.item;

    return null;
  }

  async function fetchCurrentSchedule() {
    const response = await fetch(PUBLIC_UPDATES_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Could not load the current Home schedule (${response.status}).`);
    const data = await response.json().catch(() => ({}));
    cachedSchedule = matchingSchedule(data?.updates);
    syncEditorState();
    return cachedSchedule;
  }

  async function updatesAction(body) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(UPDATES_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-home-open-rank-delete-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomeOpenRankDeleteStyle = '1';
    style.textContent = `
      .rp-home-open-rank-edit-delete{height:34px;min-width:72px;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border:1px solid rgba(255,90,104,.34);border-radius:999px;background:rgba(88,12,21,.28);color:#ff7884;font:950 .53rem/1 system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .rp-home-open-rank-edit-delete[hidden]{display:none!important}
      .rp-home-open-rank-edit-delete:disabled{opacity:.45;cursor:wait}
      .rp-home-open-rank-edit-delete svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .rp-home-open-rank-edit-delete:active{transform:scale(.96)}
      .rp-home-open-rank-delete-confirm{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,2,5,.78);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
      .rp-home-open-rank-delete-confirm[hidden]{display:none!important}
      .rp-home-open-rank-delete-confirm-card{width:min(100%,430px);box-sizing:border-box;padding:18px;border:1px solid rgba(255,100,112,.24);border-radius:18px;background:linear-gradient(180deg,#10131a,#07090e);box-shadow:0 24px 70px rgba(0,0,0,.62)}
      .rp-home-open-rank-delete-confirm-card small{display:block;margin-bottom:7px;color:#ff7d88;font:950 .5rem/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}
      .rp-home-open-rank-delete-confirm-card strong{display:block;color:#f7f9fb;font:950 1rem/1.15 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-style:italic;letter-spacing:.025em}
      .rp-home-open-rank-delete-confirm-card p{margin:10px 0 15px;color:#91a2b1;font:700 .66rem/1.5 system-ui,sans-serif}
      .rp-home-open-rank-delete-confirm-actions{display:grid;grid-template-columns:1fr 1.2fr;gap:8px}
      .rp-home-open-rank-delete-confirm-actions button{min-height:44px;border-radius:11px;font:950 .58rem/1 var(--rp-display,Arial,sans-serif);font-style:italic;letter-spacing:.075em;text-transform:uppercase;cursor:pointer}
      .rp-home-open-rank-delete-keep{border:1px solid rgba(255,255,255,.09);background:#0b1119;color:#9dafbe}
      .rp-home-open-rank-delete-confirm-button{border:1px solid rgba(255,90,104,.42);background:linear-gradient(180deg,#c93242,#9d1d2b);color:#fff}
      .rp-home-open-rank-delete-confirm-button:disabled{opacity:.5;cursor:wait}
      @media(max-width:420px){.rp-home-open-rank-edit-delete{min-width:34px;width:34px;padding:0}.rp-home-open-rank-edit-delete span{display:none}.rp-home-open-rank-edit-head{gap:8px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDeleteUi(backdrop) {
    if (!backdrop) return false;
    const header = backdrop.querySelector('.rp-home-open-rank-edit-head');
    const close = header?.querySelector('[data-rp-home-open-rank-edit-close]');
    if (!header || !close) return false;

    let button = header.querySelector('[data-rp-home-open-rank-delete]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-home-open-rank-edit-delete';
      button.dataset.rpHomeOpenRankDelete = '1';
      button.setAttribute('aria-label', 'Delete current Home schedule');
      button.setAttribute('title', 'Delete current schedule');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 10v6M14 10v6"/></svg><span>DELETE</span>';
      header.insertBefore(button, close);
      button.addEventListener('click', openDeleteConfirm);
    }

    let confirm = backdrop.querySelector('[data-rp-home-open-rank-delete-confirm]');
    if (!confirm) {
      confirm = document.createElement('div');
      confirm.className = 'rp-home-open-rank-delete-confirm';
      confirm.dataset.rpHomeOpenRankDeleteConfirm = '1';
      confirm.hidden = true;
      confirm.innerHTML = `
        <section class="rp-home-open-rank-delete-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="rp-home-open-rank-delete-title">
          <small>DELETE CURRENT SCHEDULE</small>
          <strong id="rp-home-open-rank-delete-title">REMOVE THIS BATCH?</strong>
          <p>This removes only the current Home schedule. Completed games, player stats, OVR, and game history stay untouched.</p>
          <div class="rp-home-open-rank-delete-confirm-actions">
            <button type="button" class="rp-home-open-rank-delete-keep" data-rp-home-open-rank-delete-keep>KEEP SCHEDULE</button>
            <button type="button" class="rp-home-open-rank-delete-confirm-button" data-rp-home-open-rank-delete-confirm-button>DELETE SCHEDULE</button>
          </div>
        </section>`;
      backdrop.appendChild(confirm);
      confirm.querySelector('[data-rp-home-open-rank-delete-keep]')?.addEventListener('click', closeDeleteConfirm);
      confirm.querySelector('[data-rp-home-open-rank-delete-confirm-button]')?.addEventListener('click', deleteCurrentSchedule);
      confirm.addEventListener('click', (event) => {
        if (event.target === confirm && !deleting) closeDeleteConfirm();
      });
    }

    mountedBackdrop = backdrop;
    syncEditorState();
    return true;
  }

  function syncEditorState() {
    const backdrop = mountedBackdrop || document.querySelector('[data-rp-home-open-rank-editor]');
    if (!backdrop) return;
    const button = backdrop.querySelector('[data-rp-home-open-rank-delete]');
    const title = backdrop.querySelector('#rp-home-open-rank-edit-title');
    const hasSchedule = Boolean(cachedSchedule && Number(cachedSchedule.id) > 0);
    if (button) button.hidden = !hasSchedule;
    if (title) title.textContent = hasSchedule ? 'EDIT CURRENT REAL PLAY' : 'CREATE NEXT REAL PLAY';
  }

  function editorStatus(message = '', isError = false) {
    const node = document.querySelector('[data-rp-home-open-rank-edit-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
  }

  async function openDeleteConfirm() {
    if (deleting) return;
    try {
      await fetchCurrentSchedule();
    } catch (error) {
      editorStatus(error?.message || 'Could not verify the current schedule.', true);
      return;
    }
    if (!cachedSchedule) {
      editorStatus('There is no current Home schedule to delete. You can create the next batch now.');
      syncEditorState();
      return;
    }
    const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-delete-confirm]');
    if (!confirm) return;
    const title = confirm.querySelector('#rp-home-open-rank-delete-title');
    if (title) title.textContent = `REMOVE ${String(cachedSchedule.title || 'THIS BATCH').toUpperCase()}?`;
    confirm.hidden = false;
    window.setTimeout(() => confirm.querySelector('[data-rp-home-open-rank-delete-keep]')?.focus({ preventScroll: true }), 0);
  }

  function closeDeleteConfirm() {
    if (deleting) return;
    const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-delete-confirm]');
    if (confirm) confirm.hidden = true;
  }

  function setDeleting(next) {
    deleting = Boolean(next);
    const backdrop = mountedBackdrop || document.querySelector('[data-rp-home-open-rank-editor]');
    const deleteButton = backdrop?.querySelector('[data-rp-home-open-rank-delete]');
    const confirmButton = backdrop?.querySelector('[data-rp-home-open-rank-delete-confirm-button]');
    const keepButton = backdrop?.querySelector('[data-rp-home-open-rank-delete-keep]');
    const saveButton = backdrop?.querySelector('[data-rp-home-open-rank-edit-save]');
    if (deleteButton) deleteButton.disabled = deleting;
    if (keepButton) keepButton.disabled = deleting;
    if (saveButton) saveButton.disabled = deleting;
    if (confirmButton) {
      confirmButton.disabled = deleting;
      confirmButton.textContent = deleting ? 'DELETING…' : 'DELETE SCHEDULE';
    }
  }

  function resetEditorForNextBatch() {
    const form = document.querySelector('[data-rp-home-open-rank-edit-form]');
    if (!form) return;
    if (form.elements?.title) form.elements.title.value = 'SUNDAY OPEN RANKING';
    if (form.elements?.startsAt) form.elements.startsAt.value = '';
    if (form.elements?.endsAt) form.elements.endsAt.value = '23:00';
    if (form.elements?.capacity) form.elements.capacity.value = '16';
    if (form.elements?.locationName) form.elements.locationName.value = '';
  }

  function resetHomeCard() {
    const root = document.querySelector('[data-rp-simple-home]');
    const title = root?.querySelector('[data-rp-home-open-rank-title]');
    const meta = root?.querySelector('[data-rp-home-open-rank-meta]');
    const capacity = root?.querySelector('[data-rp-home-open-rank-capacity]');
    if (title) title.textContent = 'SUNDAY OPEN RANKING';
    if (meta) meta.textContent = 'EVERY SUNDAY · 8:00 PM – 11:00 PM';
    if (capacity) capacity.textContent = '16 PLAYER CAP';
  }

  async function deleteCurrentSchedule() {
    if (deleting) return;
    const id = Number(cachedSchedule?.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      closeDeleteConfirm();
      editorStatus('There is no current Home schedule to delete. You can create the next batch now.');
      return;
    }

    setDeleting(true);
    editorStatus('Deleting current Home schedule…');

    try {
      const deleted = await updatesAction({ action: 'delete', id });
      cachedSchedule = matchingSchedule(deleted?.updates);
      const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-delete-confirm]');
      if (confirm) confirm.hidden = true;

      if (!cachedSchedule) {
        resetEditorForNextBatch();
        resetHomeCard();
        editorStatus('Schedule deleted. Create the next batch whenever you are ready.');
      } else {
        editorStatus('Current schedule deleted. Another published Home schedule is still available.');
      }

      syncEditorState();
      window.dispatchEvent(new CustomEvent('realplay:home-schedule-changed', {
        detail: { source: 'home-open-rank-admin-delete', deletedId: id },
      }));
    } catch (error) {
      editorStatus(error?.message || 'Unable to delete the current Home schedule.', true);
    } finally {
      setDeleting(false);
    }
  }

  function mount() {
    ensureStyles();
    const backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (!backdrop) return false;
    if (!ensureDeleteUi(backdrop)) return false;
    fetchCurrentSchedule().catch(() => {});
    return true;
  }

  let backdropObserver = null;
  const mountObserver = new MutationObserver(() => {
    const backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (!backdrop || backdrop === mountedBackdrop) return;
    if (!mount()) return;
    mountObserver.disconnect();
    backdropObserver?.disconnect();
    backdropObserver = new MutationObserver(() => {
      if (mountedBackdrop?.hidden) closeDeleteConfirm();
    });
    backdropObserver.observe(backdrop, { attributes: true, attributeFilter: ['hidden'] });
  });
  mountObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-home-open-rank-edit]')) return;
    window.setTimeout(() => {
      mount();
      fetchCurrentSchedule().catch(() => {});
    }, 0);
  }, true);

  window.addEventListener('realplay:home-schedule-changed', () => {
    window.setTimeout(() => fetchCurrentSchedule().catch(() => {}), 100);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const confirm = mountedBackdrop?.querySelector('[data-rp-home-open-rank-delete-confirm]');
    if (confirm && !confirm.hidden && !deleting) confirm.hidden = true;
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
