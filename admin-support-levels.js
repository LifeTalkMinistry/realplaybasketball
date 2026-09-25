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

  function cleanSupportEntry(entry) {
    const playerId = Number(entry?.playerId ?? entry?.player_id);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) return null;
    const support = entry?.support && typeof entry.support === 'object' ? entry.support : null;
    const tierCode = normalizeTierCode(support?.tierCode ?? support?.tier_code);
    return {
      playerId,
      accountAvailable: entry?.accountAvailable !== false && Number.isSafeInteger(Number(entry?.accountUserId ?? entry?.userId)),
      accountUserId: Number.isSafeInteger(Number(entry?.accountUserId ?? entry?.userId))
        ? Number(entry?.accountUserId ?? entry?.userId)
        : null,
      support: tierCode
        ? {
            ...support,
            tierCode,
            amountPhp: Number(support?.amountPhp ?? support?.amount_php ?? TIER_META[tierCode]?.amount ?? 0),
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
      .rp-member-support-status{align-self:start;padding:6px 8px;border:1px solid rgba(85,222,255,.24);border-radius:999px;background:rgba(41,189,222,.07);color:#6eeaff;font-size:.46rem;font-weight:950;letter-spacing:.07em;white-space:nowrap}
      .rp-member-support-status.builder{border-color:rgba(103,169,255,.28);background:rgba(70,119,255,.08);color:#a9c5ff}
      .rp-member-support-status.founding{border-color:rgba(194,147,255,.3);background:rgba(142,87,255,.09);color:#d8bdff}
      .rp-member-support-status.sponsor{border-color:rgba(255,205,86,.32);background:rgba(255,190,45,.08);color:#ffd56d}
      .rp-member-status-controls{flex-wrap:wrap;justify-content:flex-end;max-width:170px}
      .rp-member-support-section{display:grid;gap:11px;margin-top:3px;padding:14px 0 2px;border-top:1px solid rgba(88,221,255,.16)}
      .rp-member-support-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
      .rp-member-support-section-head strong{color:#f6fbff;font-family:var(--rp-display,Arial,sans-serif);font-size:.78rem;font-style:italic;font-weight:950;letter-spacing:.035em}
      .rp-member-support-section-head small{color:#58dff5;font-size:.48rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase;text-align:right}
      .rp-member-support-amount{position:relative}
      .rp-member-support-amount input[readonly]{color:#9edfec;background:#06131e;cursor:default}
      .rp-member-support-note{margin:0;color:#73889a;font-size:.59rem;line-height:1.45}
      .rp-member-support-note strong{color:#bdeef7}
      .rp-member-support-section.is-unavailable{opacity:.7}
      .rp-member-support-section.is-unavailable select{cursor:not-allowed}
      .rp-member-support-loading{color:#6f879d;font-size:.58rem;font-weight:800;letter-spacing:.04em}
      @media(max-width:430px){
        .rp-member-status-controls{max-width:142px;gap:5px}
        .rp-member-support-status,.rp-member-status{padding:5px 7px;font-size:.43rem}
        .rp-member-support-section-head{align-items:flex-start;flex-direction:column;gap:3px}
        .rp-member-support-section-head small{text-align:left}
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
    scheduleDecoration(80);
    if (activePlayerId) window.setTimeout(() => hydrateEditor(activePlayerId), 0);
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
        console.warn('[Real Play] Support tier directory could not load.', error);
        throw error;
      })
      .finally(() => {
        if (sequence === loadSequence) loadPromise = null;
      });
    return loadPromise;
  }

  function supportBadgeMarkup(support) {
    const code = normalizeTierCode(support?.tierCode ?? support?.tier_code);
    if (!code || support?.active === false) return '';
    const meta = TIER_META[code];
    if (!meta) return '';
    return `<span class="rp-member-support-status ${code}" data-member-support-status title="${meta.fullLabel || meta.label} · ₱${meta.amount}/month">${meta.label}</span>`;
  }

  function decorateCards() {
    decorateTimer = 0;
    ensureStyles();
    document.querySelectorAll('[data-member-player]').forEach((card) => {
      const playerId = Number(card.dataset.memberPlayer);
      const controls = card.querySelector('.rp-member-status-controls');
      if (!controls) return;
      controls.querySelector('[data-member-support-status]')?.remove();
      const entry = supportByPlayerId.get(playerId);
      const markup = supportBadgeMarkup(entry?.support);
      if (!markup) return;
      const accessBadge = controls.querySelector('.rp-member-status');
      if (accessBadge) accessBadge.insertAdjacentHTML('beforebegin', markup);
      else controls.insertAdjacentHTML('afterbegin', markup);
    });
  }

  function scheduleDecoration(delay = 0) {
    if (decorateTimer) window.clearTimeout(decorateTimer);
    decorateTimer = window.setTimeout(decorateCards, delay);
  }

  function supportSectionMarkup() {
    return `
      <section class="rp-member-support-section" data-member-support-section>
        <div class="rp-member-support-section-head">
          <strong>SUPPORT LEVEL</strong>
          <small>SEPARATE FROM PLAY ACCESS</small>
        </div>
        <label class="rp-member-editor-field"><span>Support tier</span>
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
        <p class="rp-member-support-note" data-member-support-note>Loading supporter status…</p>
      </section>`;
  }

  function ensureSupportSection() {
    ensureStyles();
    const backdrop = document.querySelector('[data-member-editor-backdrop]');
    const fields = backdrop?.querySelector('.rp-member-editor-fields');
    if (!backdrop || !fields) return null;

    let section = fields.querySelector('[data-member-support-section]');
    if (!section) {
      fields.insertAdjacentHTML('beforeend', supportSectionMarkup());
      section = fields.querySelector('[data-member-support-section]');
    }

    // Support is its own system. Keep it visually between access and token tools.
    const tokenControl = fields.querySelector('[data-member-editor-token-wrap]');
    const accessNote = fields.querySelector('[data-member-editor-note]');
    if (tokenControl && tokenControl.previousElementSibling !== section) {
      tokenControl.insertAdjacentElement('beforebegin', section);
    } else if (!tokenControl && accessNote && accessNote.nextElementSibling !== section) {
      accessNote.insertAdjacentElement('afterend', section);
    }

    const headKicker = backdrop.querySelector('.rp-member-editor-head small');
    if (headKicker) headKicker.textContent = 'PLAYER ACCESS + SUPPORT';
    const save = backdrop.querySelector('[data-member-editor-save]');
    if (save && !save.disabled) save.textContent = 'SAVE PLAYER';
    return section;
  }

  function syncSupportFields(section = ensureSupportSection()) {
    if (!section) return;
    const select = section.querySelector('[data-member-support-tier]');
    const amountWrap = section.querySelector('[data-member-support-amount-wrap]');
    const amount = section.querySelector('[data-member-support-amount]');
    const sponsorWrap = section.querySelector('[data-member-support-sponsor-wrap]');
    const note = section.querySelector('[data-member-support-note]');
    const tierCode = normalizeTierCode(select?.value);
    const meta = TIER_META[tierCode] || null;

    if (amountWrap) amountWrap.hidden = !meta;
    if (amount) amount.value = meta ? String(meta.amount) : '';
    if (sponsorWrap) sponsorWrap.hidden = tierCode !== 'sponsor';

    const entry = supportByPlayerId.get(Number(activePlayerId));
    const accountAvailable = Boolean(entry?.accountAvailable);
    section.classList.toggle('is-unavailable', !accountAvailable);
    if (select) select.disabled = !accountAvailable;

    if (note) {
      note.innerHTML = !accountAvailable
        ? 'A claimed <strong>Real Play account is required</strong> before supporter perks can be assigned.'
        : meta
          ? `<strong>${meta.fullLabel || meta.label}</strong> is voluntary support and stays separate from this player's Free / Member / Pay to Play access.`
          : 'No monthly support level is assigned. The player\'s court access remains completely separate.';
    }
  }

  function hydrateEditor(playerId) {
    if (Number(playerId) !== Number(activePlayerId)) return;
    const section = ensureSupportSection();
    if (!section) return;
    const entry = supportByPlayerId.get(Number(playerId));
    const support = entry?.support || null;
    const tierCode = normalizeTierCode(support?.tierCode ?? support?.tier_code);
    const select = section.querySelector('[data-member-support-tier]');
    const sponsor = section.querySelector('[data-member-support-sponsor-name]');

    if (!entry) {
      if (select) select.disabled = true;
      const note = section.querySelector('[data-member-support-note]');
      if (note) note.textContent = 'Loading supporter status…';
      return;
    }

    if (select) select.value = tierCode;
    if (sponsor) sponsor.value = String(support?.sponsorName ?? support?.sponsor_name ?? '');
    section.dataset.supportInitialTier = tierCode;
    section.dataset.supportInitialSponsor = String(support?.sponsorName ?? support?.sponsor_name ?? '').trim();
    syncSupportFields(section);
  }

  function beginEditor(playerId) {
    activePlayerId = Number(playerId);
    window.requestAnimationFrame(() => {
      const section = ensureSupportSection();
      if (section) {
        const select = section.querySelector('[data-member-support-tier]');
        if (select) select.disabled = true;
      }
      hydrateEditor(activePlayerId);
      window.setTimeout(() => {
        ensureSupportSection();
        hydrateEditor(activePlayerId);
      }, 50);
    });

    if (!supportByPlayerId.has(activePlayerId)) {
      loadSupportDirectory().catch(() => {
        const section = ensureSupportSection();
        const note = section?.querySelector('[data-member-support-note]');
        if (note) note.textContent = 'Support controls are temporarily unavailable. Player access can still be managed.';
      });
    }
  }

  async function saveSupportBeforeAccess(button, event) {
    if (bypassSaveCapture || !activePlayerId) return false;
    const section = ensureSupportSection();
    if (!section) return false;

    const entry = supportByPlayerId.get(Number(activePlayerId));
    if (!entry) return false;

    const tierCode = normalizeTierCode(section.querySelector('[data-member-support-tier]')?.value);
    const sponsorName = String(section.querySelector('[data-member-support-sponsor-name]')?.value || '').trim();
    const initialTier = normalizeTierCode(section.dataset.supportInitialTier);
    const initialSponsor = String(section.dataset.supportInitialSponsor || '').trim();
    const sponsorChanged = tierCode === 'sponsor' && sponsorName !== initialSponsor;
    const changed = tierCode !== initialTier || sponsorChanged;

    if (!changed) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    const backdrop = document.querySelector('[data-member-editor-backdrop]');
    const message = backdrop?.querySelector('[data-member-editor-message]');
    if (tierCode && !entry.accountAvailable) {
      if (message) message.textContent = 'This player needs a claimed Real Play account before a support level can be assigned.';
      return true;
    }

    button.disabled = true;
    button.textContent = 'SAVING SUPPORT…';
    if (message) message.textContent = '';

    try {
      const result = await api({
        action: 'support_tier_update',
        playerId: activePlayerId,
        tierCode,
        sponsorName: tierCode === 'sponsor' ? sponsorName : null,
      });

      supportByPlayerId.set(Number(activePlayerId), {
        ...entry,
        support: result?.support || null,
      });
      section.dataset.supportInitialTier = normalizeTierCode(result?.support?.tierCode);
      section.dataset.supportInitialSponsor = String(result?.support?.sponsorName || '').trim();
      scheduleDecoration(0);

      // Hand the same save back to the existing Player Access authority so its
      // membership, Play Token, and validation behavior stays untouched.
      button.disabled = false;
      button.textContent = 'SAVE PLAYER';
      bypassSaveCapture = true;
      button.click();
      bypassSaveCapture = false;
      return true;
    } catch (error) {
      button.disabled = false;
      button.textContent = 'SAVE PLAYER';
      if (message) message.textContent = error?.message || 'Could not save supporter level.';
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
    saveSupportBeforeAccess(save, event);
  }, true);

  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-member-player]')) scheduleDecoration(0);
    const openEditor = document.querySelector('[data-member-editor-backdrop].open');
    if (openEditor && activePlayerId) {
      ensureSupportSection();
      hydrateEditor(activePlayerId);
    }
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
    loadSupportDirectory({ force: true }).catch(() => {});
  });

  ensureStyles();
  window.setTimeout(() => loadSupportDirectory().catch(() => {}), 300);
})();
