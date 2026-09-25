(() => {
  if (window.__realPlayAdminSupportLevelsInstalled) return;
  window.__realPlayAdminSupportLevelsInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const TIER_META = Object.freeze({
    supporter: Object.freeze({ code: 'supporter', label: 'SUPPORTER', amount: 99 }),
    builder: Object.freeze({ code: 'builder', label: 'BUILDER', amount: 199 }),
    founding: Object.freeze({ code: 'founding', label: 'FOUNDING', fullLabel: 'FOUNDING SUPPORTER', amount: 499 }),
    sponsor: Object.freeze({ code: 'sponsor', label: 'SPONSOR', amount: 999 }),
  });

  const nativeFetch = window.fetch.bind(window);
  let supportByPlayerId = new Map();
  let activePlayerId = null;
  let loadPromise = null;
  let loadSequence = 0;
  let bypassSaveCapture = false;
  let decorateTimer = 0;
  let editorSyncTimer = 0;

  function authToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function normalizeTierCode(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/[_\s-]+/g, '');
    if (!raw || raw === 'none' || raw === 'off') return '';
    if (raw === 'supporter' || raw === '99') return 'supporter';
    if (raw === 'builder' || raw === '199') return 'builder';
    if (raw === 'founding' || raw === 'foundingsupporter' || raw === '499') return 'founding';
    if (raw === 'sponsor' || raw === 'realplaysponsor' || raw === '999') return 'sponsor';
    return '';
  }

  function dateValue(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function inputDate(value) {
    const date = dateValue(value);
    if (!date) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type) => parts.find((entry) => entry.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function todayInput() {
    return inputDate(new Date());
  }

  function oneMonthAfter(dateString) {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))
      ? new Date(`${dateString}T12:00:00+08:00`)
      : new Date();
    const next = new Date(base.getTime());
    next.setMonth(next.getMonth() + 1);
    return inputDate(next);
  }

  function formatDate(value) {
    const date = dateValue(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date).toUpperCase();
  }

  function cleanSupportEntry(entry) {
    const playerId = Number(entry?.playerId ?? entry?.player_id);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) return null;
    const support = entry?.support && typeof entry.support === 'object' ? entry.support : null;
    const tierCode = normalizeTierCode(support?.tierCode ?? support?.tier_code);
    const accountId = Number(entry?.accountUserId ?? entry?.userId);
    return {
      playerId,
      accountAvailable: entry?.accountAvailable !== false && Number.isSafeInteger(accountId) && accountId > 0,
      accountUserId: Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null,
      support: tierCode
        ? {
            ...support,
            tierCode,
            amountPhp: Number(support?.amountPhp ?? support?.amount_php ?? TIER_META[tierCode]?.amount ?? 0),
            startedAt: support?.startedAt ?? support?.validFrom ?? support?.valid_from ?? null,
            endsAt: support?.endsAt ?? support?.validUntil ?? support?.valid_until ?? null,
            active: support?.active !== false,
          }
        : null,
    };
  }

  function ensureStyles() {
    if (document.getElementById('rp-admin-support-level-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-admin-support-level-style';
    style.textContent = `
      .rp-member-editor{max-height:calc(100dvh - 28px);overflow-y:auto;overscroll-behavior:contain}
      .rp-member-summary,.rp-member-filters{display:none!important}
      .rp-member-tools{grid-template-columns:1fr!important}
      .rp-member-support-status{align-self:start;padding:6px 8px;border:1px solid rgba(85,222,255,.24);border-radius:999px;background:rgba(41,189,222,.07);color:#6eeaff;font-size:.46rem;font-weight:950;letter-spacing:.07em;white-space:nowrap}
      .rp-member-support-status.builder{border-color:rgba(103,169,255,.28);background:rgba(70,119,255,.08);color:#a9c5ff}
      .rp-member-support-status.founding{border-color:rgba(194,147,255,.3);background:rgba(142,87,255,.09);color:#d8bdff}
      .rp-member-support-status.sponsor{border-color:rgba(255,205,86,.32);background:rgba(255,190,45,.08);color:#ffd56d}
      .rp-member-status-controls{flex-wrap:wrap;justify-content:flex-end;max-width:160px}
      .rp-member-support-section{display:grid;gap:12px;margin:0;padding:0;border:0}
      .rp-member-support-amount input[readonly]{color:#9edfec;background:#06131e;cursor:default}
      .rp-member-support-note{margin:0;color:#73889a;font-size:.59rem;line-height:1.45}
      .rp-member-support-note:empty{display:none}
      .rp-member-support-section.is-unavailable{opacity:.7}
      .rp-member-support-section.is-unavailable select{cursor:not-allowed}
      .rp-member-editor-access-retired{display:none!important}
      @media(max-width:430px){
        .rp-member-status-controls{max-width:142px;gap:5px}
        .rp-member-support-status{padding:5px 7px;font-size:.43rem}
      }
    `;
    document.head.appendChild(style);
  }

  async function api(body) {
    const token = authToken();
    if (!token) throw new Error('Admin session is not available.');
    const response = await nativeFetch(`${API_BASE_URL}/api/real-play/admin/player`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || '';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function cacheDirectory(data) {
    const next = new Map();
    (Array.isArray(data?.players) ? data.players : []).forEach((entry) => {
      const clean = cleanSupportEntry(entry);
      if (clean) next.set(clean.playerId, clean);
    });
    supportByPlayerId = next;
    scheduleDecoration(0);
    if (activePlayerId) scheduleEditorSync(0);
  }

  async function loadSupportDirectory({ force = false } = {}) {
    if (loadPromise && !force) return loadPromise;
    const sequence = ++loadSequence;
    loadPromise = api({ action: 'support_tier_directory' })
      .then((data) => {
        if (sequence === loadSequence) cacheDirectory(data);
        return data;
      })
      .catch((error) => {
        console.warn('[Real Play] Player status directory could not load.', error);
        throw error;
      })
      .finally(() => {
        if (sequence === loadSequence) loadPromise = null;
      });
    return loadPromise;
  }

  function decorateCards() {
    decorateTimer = 0;
    ensureStyles();
    document.querySelectorAll('[data-member-player]').forEach((card) => {
      const playerId = Number(card.dataset.memberPlayer);
      const entry = supportByPlayerId.get(playerId);
      const support = entry?.support || null;
      const code = normalizeTierCode(support?.tierCode ?? support?.tier_code);
      const meta = code && support?.active !== false ? TIER_META[code] : null;
      const controls = card.querySelector('.rp-member-status-controls');
      if (!controls) return;

      controls.querySelector('.rp-member-status')?.remove();
      controls.querySelector('[data-member-support-status]')?.remove();

      if (meta) {
        const badge = document.createElement('span');
        badge.className = `rp-member-support-status ${code}`;
        badge.dataset.memberSupportStatus = '1';
        badge.textContent = meta.label;
        badge.title = `${meta.fullLabel || meta.label} · ₱${meta.amount}/month`;
        controls.prepend(badge);
      }

      const subtitle = card.querySelector('.rp-member-identity small');
      if (subtitle) subtitle.textContent = meta ? (meta.fullLabel || meta.label) : 'PLAYER';

      const dateValues = card.querySelectorAll('.rp-member-dates .rp-member-date strong');
      if (dateValues[0]) dateValues[0].textContent = support ? formatDate(support.startedAt) : '—';
      if (dateValues[1]) dateValues[1].textContent = support ? formatDate(support.endsAt) : '—';
    });
  }

  function scheduleDecoration(delay = 0) {
    if (decorateTimer) window.clearTimeout(decorateTimer);
    decorateTimer = window.setTimeout(decorateCards, delay);
  }

  function supportSectionMarkup() {
    return `
      <section class="rp-member-support-section" data-member-support-section>
        <label class="rp-member-editor-field"><span>Support level</span>
          <select data-member-support-tier>
            <option value="">None</option>
            <option value="supporter">Supporter — ₱99 / month</option>
            <option value="builder">Builder — ₱199 / month</option>
            <option value="founding">Founding Supporter — ₱499 / month</option>
            <option value="sponsor">Sponsor — ₱999 / month</option>
          </select>
        </label>
        <label class="rp-member-editor-field rp-member-support-amount" data-member-support-amount-wrap hidden>
          <span>Monthly support (PHP)</span>
          <input type="number" readonly tabindex="-1" data-member-support-amount>
        </label>
        <label class="rp-member-editor-field" data-member-support-sponsor-wrap hidden>
          <span>Sponsor display name</span>
          <input type="text" maxlength="120" autocomplete="off" placeholder="Player, business, or brand name" data-member-support-sponsor-name>
        </label>
        <p class="rp-member-support-note" data-member-support-note></p>
      </section>`;
  }

  function retireAccessControls(backdrop) {
    const accessSelect = backdrop?.querySelector('[data-member-editor-type]');
    const accessField = accessSelect?.closest('.rp-member-editor-field');
    const amountWrap = backdrop?.querySelector('[data-member-editor-amount-wrap]');
    const accessNote = backdrop?.querySelector('[data-member-editor-note]');
    const dates = backdrop?.querySelector('[data-member-editor-dates]');

    if (accessField) accessField.classList.add('rp-member-editor-access-retired');
    if (amountWrap) amountWrap.classList.add('rp-member-editor-access-retired');
    if (accessNote) accessNote.classList.add('rp-member-editor-access-retired');
    if (accessSelect) accessSelect.value = 'free';
    if (dates) dates.hidden = false;
  }

  function ensureSupportSection() {
    ensureStyles();
    const backdrop = document.querySelector('[data-member-editor-backdrop]');
    const fields = backdrop?.querySelector('.rp-member-editor-fields');
    if (!backdrop || !fields) return null;

    retireAccessControls(backdrop);

    let section = fields.querySelector('[data-member-support-section]');
    if (!section) {
      fields.insertAdjacentHTML('afterbegin', supportSectionMarkup());
      section = fields.querySelector('[data-member-support-section]');
    }

    const dates = fields.querySelector('[data-member-editor-dates]');
    if (dates && section.nextElementSibling !== dates) {
      section.insertAdjacentElement('afterend', dates);
    }

    const tokenControl = fields.querySelector('[data-member-editor-token-wrap]');
    if (tokenControl && dates && dates.nextElementSibling !== tokenControl) {
      dates.insertAdjacentElement('afterend', tokenControl);
    }

    const headKicker = backdrop.querySelector('.rp-member-editor-head small');
    if (headKicker) headKicker.textContent = 'PLAYER STATUS';
    const save = backdrop.querySelector('[data-member-editor-save]');
    if (save && !save.disabled) save.textContent = 'SAVE STATUS';
    return section;
  }

  function syncSupportFields(section = ensureSupportSection()) {
    if (!section) return;
    const backdrop = section.closest('[data-member-editor-backdrop]');
    const select = section.querySelector('[data-member-support-tier]');
    const amountWrap = section.querySelector('[data-member-support-amount-wrap]');
    const amount = section.querySelector('[data-member-support-amount]');
    const sponsorWrap = section.querySelector('[data-member-support-sponsor-wrap]');
    const note = section.querySelector('[data-member-support-note]');
    const start = backdrop?.querySelector('[data-member-editor-start]');
    const end = backdrop?.querySelector('[data-member-editor-end]');
    const tierCode = normalizeTierCode(select?.value);
    const meta = TIER_META[tierCode] || null;
    const entry = supportByPlayerId.get(Number(activePlayerId));
    const accountAvailable = Boolean(entry?.accountAvailable);

    if (amountWrap) amountWrap.hidden = !meta;
    if (amount) amount.value = meta ? String(meta.amount) : '';
    if (sponsorWrap) sponsorWrap.hidden = tierCode !== 'sponsor';
    if (start) start.disabled = !meta || !accountAvailable;
    if (end) end.disabled = !meta || !accountAvailable;

    section.classList.toggle('is-unavailable', !accountAvailable);
    if (select) select.disabled = !accountAvailable;
    if (note) {
      note.innerHTML = !accountAvailable
        ? 'A claimed Real Play account is required before a supporter status can be assigned.'
        : '';
    }
  }

  function hydrateEditor(playerId) {
    if (Number(playerId) !== Number(activePlayerId)) return;
    const section = ensureSupportSection();
    if (!section) return;
    const backdrop = section.closest('[data-member-editor-backdrop]');
    const entry = supportByPlayerId.get(Number(playerId));
    const support = entry?.support || null;
    const tierCode = normalizeTierCode(support?.tierCode ?? support?.tier_code);
    const select = section.querySelector('[data-member-support-tier]');
    const sponsor = section.querySelector('[data-member-support-sponsor-name]');
    const startInput = backdrop?.querySelector('[data-member-editor-start]');
    const endInput = backdrop?.querySelector('[data-member-editor-end]');

    if (!entry) {
      if (select) select.disabled = true;
      const note = section.querySelector('[data-member-support-note]');
      if (note) note.textContent = 'Loading player status…';
      return;
    }

    const startValue = inputDate(support?.startedAt) || todayInput();
    const endValue = inputDate(support?.endsAt) || oneMonthAfter(startValue);
    const sponsorValue = String(support?.sponsorName ?? support?.sponsor_name ?? '');

    if (select) select.value = tierCode;
    if (sponsor) sponsor.value = sponsorValue;
    if (startInput) startInput.value = startValue;
    if (endInput) endInput.value = endValue;

    section.dataset.supportInitialTier = tierCode;
    section.dataset.supportInitialSponsor = sponsorValue.trim();
    section.dataset.supportInitialStart = tierCode ? startValue : '';
    section.dataset.supportInitialEnd = tierCode ? endValue : '';
    syncSupportFields(section);
  }

  function scheduleEditorSync(delay = 0) {
    if (editorSyncTimer) window.clearTimeout(editorSyncTimer);
    editorSyncTimer = window.setTimeout(() => {
      editorSyncTimer = 0;
      if (activePlayerId && document.querySelector('[data-member-editor-backdrop].open')) {
        ensureSupportSection();
      }
    }, delay);
  }

  function beginEditor(playerId) {
    activePlayerId = Number(playerId);
    window.requestAnimationFrame(() => {
      ensureSupportSection();
      hydrateEditor(activePlayerId);
      scheduleEditorSync(60);
    });

    if (!supportByPlayerId.has(activePlayerId)) {
      loadSupportDirectory().then(() => hydrateEditor(activePlayerId)).catch(() => {
        const section = ensureSupportSection();
        const note = section?.querySelector('[data-member-support-note]');
        if (note) note.textContent = 'Player status controls are temporarily unavailable.';
      });
    }
  }

  function prepareLegacyAccessForSave() {
    const backdrop = document.querySelector('[data-member-editor-backdrop]');
    retireAccessControls(backdrop);
    const type = backdrop?.querySelector('[data-member-editor-type]');
    const amount = backdrop?.querySelector('[data-member-editor-amount]');
    if (type) type.value = 'free';
    if (amount) amount.value = '';
  }

  function replayBaseSave(button) {
    prepareLegacyAccessForSave();
    button.disabled = false;
    button.textContent = 'SAVE STATUS';
    bypassSaveCapture = true;
    button.click();
    bypassSaveCapture = false;
  }

  async function saveStatus(button, event) {
    if (bypassSaveCapture || !activePlayerId) return false;
    const section = ensureSupportSection();
    if (!section) return false;
    const entry = supportByPlayerId.get(Number(activePlayerId));
    if (!entry) return false;

    const backdrop = section.closest('[data-member-editor-backdrop]');
    const tierCode = normalizeTierCode(section.querySelector('[data-member-support-tier]')?.value);
    const sponsorName = String(section.querySelector('[data-member-support-sponsor-name]')?.value || '').trim();
    const startedAt = String(backdrop?.querySelector('[data-member-editor-start]')?.value || '');
    const endsAt = String(backdrop?.querySelector('[data-member-editor-end]')?.value || '');
    const initialTier = normalizeTierCode(section.dataset.supportInitialTier);
    const initialSponsor = String(section.dataset.supportInitialSponsor || '').trim();
    const initialStart = String(section.dataset.supportInitialStart || '');
    const initialEnd = String(section.dataset.supportInitialEnd || '');

    const changed = tierCode !== initialTier
      || (tierCode === 'sponsor' && sponsorName !== initialSponsor)
      || (tierCode && startedAt !== initialStart)
      || (tierCode && endsAt !== initialEnd);

    prepareLegacyAccessForSave();
    if (!changed) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    const message = backdrop?.querySelector('[data-member-editor-message]');
    if (tierCode && !entry.accountAvailable) {
      if (message) message.textContent = 'This player needs a claimed Real Play account before a support level can be assigned.';
      return true;
    }
    if (tierCode && (!startedAt || !endsAt)) {
      if (message) message.textContent = 'Choose the status start and end dates.';
      return true;
    }
    if (tierCode) {
      const start = new Date(`${startedAt}T00:00:00+08:00`);
      const end = new Date(`${endsAt}T23:59:59+08:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
        if (message) message.textContent = 'The end date must be after the start date.';
        return true;
      }
    }

    button.disabled = true;
    button.textContent = 'SAVING STATUS…';
    if (message) message.textContent = '';

    try {
      const result = await api({
        action: 'support_tier_update',
        playerId: activePlayerId,
        tierCode,
        sponsorName: tierCode === 'sponsor' ? sponsorName : null,
        startedAt: tierCode ? startedAt : null,
        endsAt: tierCode ? endsAt : null,
      });

      supportByPlayerId.set(Number(activePlayerId), {
        ...entry,
        support: result?.support || null,
      });
      scheduleDecoration(0);
      replayBaseSave(button);
      return true;
    } catch (error) {
      button.disabled = false;
      button.textContent = 'SAVE STATUS';
      if (message) message.textContent = error?.message || 'Could not save player status.';
      return true;
    }
  }

  document.addEventListener('change', (event) => {
    if (!event.target.matches?.('[data-member-support-tier]')) return;
    syncSupportFields(event.target.closest('[data-member-support-section]'));
  });

  document.addEventListener('click', (event) => {
    const edit = event.target.closest?.('[data-member-edit]');
    if (edit) {
      const playerId = Number(edit.dataset.memberEdit);
      if (Number.isSafeInteger(playerId) && playerId > 0) beginEditor(playerId);
      return;
    }

    const close = event.target.closest?.('[data-member-editor-close]');
    if (close) {
      activePlayerId = null;
      return;
    }

    const save = event.target.closest?.('[data-member-editor-save]');
    if (!save || bypassSaveCapture || !activePlayerId) return;
    saveStatus(save, event);
  }, true);

  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-member-player]')) scheduleDecoration(16);
    if (activePlayerId && document.querySelector('[data-member-editor-backdrop].open')) scheduleEditorSync(16);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('realplay:admin-render', () => {
    window.setTimeout(() => {
      scheduleDecoration(0);
      loadSupportDirectory({ force: true }).catch(() => {});
    }, 0);
  });

  window.addEventListener('focus', () => {
    if (!document.querySelector('.rp-admin-control.open')) return;
    if (document.querySelector('[data-member-editor-backdrop].open')) return;
    loadSupportDirectory({ force: true }).catch(() => {});
  });

  ensureStyles();
  window.setTimeout(() => loadSupportDirectory().catch(() => {}), 300);
})();