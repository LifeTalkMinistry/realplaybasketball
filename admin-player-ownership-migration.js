(() => {
  if (window.__realPlayAdminOwnershipMigrationInstalled) return;
  window.__realPlayAdminOwnershipMigrationInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let modal = null;
  let activeSourceId = null;
  let activeSource = null;
  let searchTimer = 0;
  let loading = false;
  let migrating = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-ownership-migration-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpOwnershipMigrationStyle = '1';
    style.textContent = `
      .rp-admin-claim-actions:has([data-admin-migrate-player]){grid-template-columns:1fr 1fr!important}
      .rp-admin-claim-actions [data-admin-migrate-player]{
        grid-column:1/-1;min-height:36px;border:1px solid rgba(73,204,255,.34);border-radius:10px;
        color:#7be3ff;background:rgba(24,121,160,.12);font-family:var(--rp-display,Arial,sans-serif);
        font-size:.47rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase
      }
      .rp-admin-claim-actions [data-admin-migrate-player]:disabled{opacity:.5;cursor:wait}
      .rp-admin-migration-overlay{position:fixed;z-index:2147483200;inset:0;display:none;align-items:flex-end;justify-content:center;padding:18px 12px max(18px,env(safe-area-inset-bottom));background:rgba(0,0,0,.78);backdrop-filter:blur(12px)}
      .rp-admin-migration-overlay.open{display:flex}
      .rp-admin-migration-panel{width:min(100%,520px);max-height:min(88dvh,760px);overflow:auto;padding:17px;border:1px solid rgba(74,211,255,.22);border-radius:22px;background:linear-gradient(180deg,#06111c,#02070d);box-shadow:0 28px 80px rgba(0,0,0,.62);color:#eef8ff}
      .rp-admin-migration-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .rp-admin-migration-head small{display:block;color:#54dbff;font-size:.42rem;font-weight:950;letter-spacing:.14em}
      .rp-admin-migration-head h2{margin:5px 0 0;font-family:var(--rp-display,Arial,sans-serif);font-size:1.15rem;font-style:italic;font-weight:950}
      .rp-admin-migration-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.1);border-radius:11px;color:#fff;background:#08121d;font-size:1.05rem;font-weight:950}
      .rp-admin-migration-copy{margin:12px 0;color:#8ca0b4;font-size:.58rem;font-weight:720;line-height:1.55}
      .rp-admin-migration-target{margin:12px 0;padding:12px;border:1px solid rgba(84,219,255,.15);border-radius:14px;background:rgba(16,83,112,.10)}
      .rp-admin-migration-target small{display:block;color:#61768b;font-size:.39rem;font-weight:950;letter-spacing:.12em}
      .rp-admin-migration-target strong{display:block;margin-top:4px;color:#fff;font-family:var(--rp-display,Arial,sans-serif);font-size:.78rem;font-weight:950}
      .rp-admin-migration-target span{display:block;margin-top:3px;color:#758a9e;font-size:.48rem;font-weight:800}
      .rp-admin-migration-search{display:block;margin:13px 0 8px;color:#6c8298;font-size:.4rem;font-weight:950;letter-spacing:.11em}
      .rp-admin-migration-search input{width:100%;height:42px;margin-top:6px;padding:0 12px;border:1px solid rgba(255,255,255,.10);border-radius:11px;outline:none;color:#eef8ff;background:#050b12;font:800 .62rem/1 Arial,sans-serif}
      .rp-admin-migration-search input:focus{border-color:rgba(80,220,255,.42)}
      .rp-admin-migration-list{display:grid;gap:8px}
      .rp-admin-migration-option{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px;border:1px solid rgba(255,255,255,.075);border-radius:13px;color:#eef8ff;background:#050c14;text-align:left}
      .rp-admin-migration-option:hover{border-color:rgba(78,215,255,.24);background:#07121d}
      .rp-admin-migration-option strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Arial,sans-serif);font-size:.68rem;font-weight:950;text-transform:uppercase}
      .rp-admin-migration-option span{display:block;margin-top:4px;color:#64798e;font-size:.43rem;font-weight:850;letter-spacing:.04em}
      .rp-admin-migration-option b{color:#57dcff;font-family:var(--rp-display,Arial,sans-serif);font-size:.54rem;font-weight:950;white-space:nowrap}
      .rp-admin-migration-empty{padding:20px 12px;border:1px dashed rgba(255,255,255,.08);border-radius:13px;color:#6d8093;font-size:.52rem;font-weight:850;text-align:center;line-height:1.5}
      .rp-admin-migration-note{margin:12px 0 0;padding:10px 11px;border-left:2px solid #4ed8ff;color:#8094a8;background:rgba(31,122,159,.08);font-size:.49rem;font-weight:760;line-height:1.5}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modal) return modal;
    installStyles();
    modal = document.createElement('div');
    modal.className = 'rp-admin-migration-overlay';
    modal.dataset.adminMigrationOverlay = '1';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <section class="rp-admin-migration-panel" role="dialog" aria-modal="true" aria-labelledby="rp-admin-migration-title">
        <div class="rp-admin-migration-head">
          <div><small>PLAYER IDENTITY MIGRATION</small><h2 id="rp-admin-migration-title">MIGRATE EXISTING PLAYER</h2></div>
          <button type="button" class="rp-admin-migration-close" data-admin-migration-close aria-label="Close">×</button>
        </div>
        <p class="rp-admin-migration-copy">Choose the old admin-created player identity that belongs to this real account. The real account becomes the permanent owner and master name while the old career history stays intact.</p>
        <div class="rp-admin-migration-target" data-admin-migration-target></div>
        <label class="rp-admin-migration-search">SEARCH UNCLAIMED PLAYER
          <input type="search" data-admin-migration-search placeholder="Player name or RP-00000" autocomplete="off">
        </label>
        <div class="rp-admin-migration-list" data-admin-migration-list></div>
        <p class="rp-admin-migration-note">Historical audited games are not recreated. Their existing player identity is linked to this account, so old sessions, stats, video timestamps and ranking evidence resolve to the new master profile name.</p>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-admin-migration-close]')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    modal.querySelector('[data-admin-migration-search]')?.addEventListener('input', (event) => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadOptions(String(event.target.value || '').trim()), 180);
    });
    modal.querySelector('[data-admin-migration-list]')?.addEventListener('click', (event) => {
      const option = event.target.closest('[data-admin-migration-option]');
      if (!option) return;
      const targetId = Number(option.dataset.adminMigrationOption);
      if (!Number.isSafeInteger(targetId) || targetId <= 0) return;
      migrateTo(targetId, option.dataset.playerName || '', option.dataset.publicPlayerId || '');
    });
    return modal;
  }

  function closeModal() {
    if (!modal || migrating) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    activeSourceId = null;
    activeSource = null;
  }

  async function loadSource(sourceId) {
    const data = await api('/api/real-play/admin/profile-ownership/claims');
    const claims = Array.isArray(data?.claims) ? data.claims : [];
    return claims.find((claim) => Number(claim?.playerId ?? claim?.id) === Number(sourceId)) || null;
  }

  async function openModal(sourceId) {
    if (loading || migrating) return;
    loading = true;
    try {
      const source = await loadSource(sourceId);
      if (!source) throw new Error('This pending ownership request is no longer available.');
      activeSourceId = Number(sourceId);
      activeSource = source;
      ensureModal();
      const target = modal.querySelector('[data-admin-migration-target]');
      if (target) {
        target.innerHTML = `<small>NEW REAL ACCOUNT / MASTER PROFILE</small><strong>${esc(source.playerName || source.accountName || 'REAL PLAY PLAYER')}</strong><span>${esc(source.accountEmail || '')} · ${esc(source.publicPlayerId || '')}</span>`;
      }
      const search = modal.querySelector('[data-admin-migration-search]');
      if (search) search.value = '';
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      await loadOptions('');
      search?.focus({ preventScroll: true });
    } catch (error) {
      window.alert(error?.message || 'Unable to open player migration.');
    } finally {
      loading = false;
    }
  }

  async function loadOptions(query = '') {
    if (!modal?.classList.contains('open') || migrating) return;
    const list = modal.querySelector('[data-admin-migration-list]');
    if (!list) return;
    list.innerHTML = '<div class="rp-admin-migration-empty">LOADING UNCLAIMED PLAYERS…</div>';
    try {
      const data = await api(`/api/real-play/profile-ownership/unclaimed?q=${encodeURIComponent(query)}`);
      const profiles = (Array.isArray(data?.profiles) ? data.profiles : [])
        .filter((profile) => String(profile?.ownershipSource || '').toLowerCase().startsWith('admin_created'));
      list.innerHTML = profiles.length
        ? profiles.map((profile) => {
          const games = Number(profile?.gamesPlayed || 0);
          return `<button type="button" class="rp-admin-migration-option" data-admin-migration-option="${Number(profile.playerId)}" data-player-name="${esc(profile.playerName)}" data-public-player-id="${esc(profile.publicPlayerId)}"><span><strong>${esc(profile.playerName)}</strong><span>${esc(profile.publicPlayerId)} · ${games} VERIFIED GAME${games === 1 ? '' : 'S'}</span></span><b>SELECT →</b></button>`;
        }).join('')
        : '<div class="rp-admin-migration-empty">NO ADMIN-CREATED UNCLAIMED PLAYERS FOUND.</div>';
    } catch (error) {
      list.innerHTML = `<div class="rp-admin-migration-empty">${esc(error?.message || 'Unable to load unclaimed players.')}</div>`;
    }
  }

  async function migrateTo(targetId, oldName, publicId) {
    if (migrating || !activeSourceId || !activeSource) return;
    const masterName = String(activeSource.playerName || activeSource.accountName || 'REAL PLAY PLAYER');
    const question = `Migrate ${oldName || publicId || 'this old player'} into ${masterName}?\n\n${masterName} will become the master profile name. Existing games, stats, audited video events and ranking history from ${oldName || 'the old identity'} will remain attached to the same career and will display under ${masterName}.`;
    if (!window.confirm(question)) return;

    migrating = true;
    const list = modal?.querySelector('[data-admin-migration-list]');
    if (list) list.innerHTML = '<div class="rp-admin-migration-empty">MIGRATING PLAYER IDENTITY… DO NOT CLOSE THIS SCREEN.</div>';
    try {
      const result = await api('/api/real-play/admin/profile-ownership/review', {
        method: 'POST',
        body: {
          playerId: activeSourceId,
          decision: 'migrate',
          reason: targetId,
        },
      });
      window.dispatchEvent(new CustomEvent('realplay:player-identity-migrated', { detail: result }));
      modal?.classList.remove('open');
      modal?.setAttribute('aria-hidden', 'true');
      const message = `${oldName || publicId || 'Existing player'} is now owned by ${masterName}. Historical Real Play data stays with the migrated career.`;
      activeSourceId = null;
      activeSource = null;
      window.alert(message);
      document.querySelector('[data-admin-ownership-tab]')?.click();
    } catch (error) {
      window.alert(error?.message || 'Player migration failed. Nothing was changed.');
      await loadOptions('');
    } finally {
      migrating = false;
    }
  }

  function enhancePendingCards(root = document) {
    root.querySelectorAll?.('.rp-admin-claim[data-admin-claim-id]').forEach((card) => {
      const actions = card.querySelector('.rp-admin-claim-actions');
      if (!actions || actions.querySelector('[data-admin-migrate-player]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.adminMigratePlayer = '1';
      button.textContent = 'MIGRATE EXISTING PLAYER';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceId = Number(card.dataset.adminClaimId);
        if (Number.isSafeInteger(sourceId) && sourceId > 0) openModal(sourceId);
      });
      actions.appendChild(button);
    });
  }

  installStyles();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.rp-admin-claim[data-admin-claim-id]')) enhancePendingCards(node.parentElement || document);
        else if (node.querySelector?.('.rp-admin-claim[data-admin-claim-id]')) enhancePendingCards(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhancePendingCards();
})();