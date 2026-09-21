(() => {
  if (window.__realPlayAdminAccessBootstrapInstalled) return;
  window.__realPlayAdminAccessBootstrapInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const HEAD_ADMIN_EMAILS = new Set([
    'jeromemirabuenos62@gmail.com',
  ]);

  let verifiedAdmin = Boolean(
    window.__realPlayAdminVerified === true ||
    window.RealPlayServerGate?.isAdminBypass?.() === true
  );
  let verifySequence = 0;

  window.__realPlayAdminVerified = verifiedAdmin;
  window.__realPlayAdminAccessProbe = false;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function settingsEmail() {
    return String(
      document.querySelector('.rp-settings-overlay [data-rp-settings-email]')?.textContent ||
      document.querySelector('[data-auth-account-email]')?.textContent ||
      ''
    ).trim().toLowerCase();
  }

  function hasKnownHeadAdminIdentity() {
    return HEAD_ADMIN_EMAILS.has(settingsEmail());
  }

  function settingsList() {
    return document.querySelector('.rp-settings-overlay .rp-settings-list');
  }

  function syncSettingsRow() {
    const list = settingsList();
    if (!list) return;
    let row = list.querySelector('[data-rp-settings-action="admin"]');

    const shouldShow = verifiedAdmin || hasKnownHeadAdminIdentity();
    if (!shouldShow) {
      row?.remove();
      return;
    }

    if (!row) {
      row = document.createElement('button');
      row.type = 'button';
      row.className = 'rp-settings-row rp-settings-admin-row';
      row.dataset.rpSettingsAction = 'admin';
      row.innerHTML = '<span><strong>ADMIN</strong><small>Season setup, players, game control and scoring</small></span><b>→</b>';
      list.appendChild(row);
      row.addEventListener('click', openAdmin);
    }
  }

  function setAdminRowBusy(busy) {
    const row = settingsList()?.querySelector('[data-rp-settings-action="admin"]');
    if (!row) return;
    row.disabled = Boolean(busy);
    const small = row.querySelector('small');
    const arrow = row.querySelector('b');
    if (small) {
      small.textContent = busy
        ? 'Opening Game Control…'
        : 'Season setup, players, game control and scoring';
    }
    if (arrow) arrow.textContent = busy ? '…' : '→';
  }

  async function verifyAdmin() {
    const sequence = ++verifySequence;
    const auth = token();
    if (!auth) {
      verifiedAdmin = false;
      window.__realPlayAdminVerified = false;
      syncSettingsRow();
      return false;
    }

    window.__realPlayAdminAccessProbe = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (sequence !== verifySequence) return verifiedAdmin;
      verifiedAdmin = Boolean(response.ok && data?.admin);
    } catch (_error) {
      if (sequence !== verifySequence) return verifiedAdmin;
      verifiedAdmin = false;
    } finally {
      if (sequence === verifySequence) window.__realPlayAdminAccessProbe = false;
    }

    window.__realPlayAdminVerified = verifiedAdmin;
    syncSettingsRow();
    return verifiedAdmin;
  }

  async function ensureAdminLoaded() {
    if (!verifiedAdmin && !(await verifyAdmin())) {
      throw new Error('Real Play could not verify Head Admin access for this session.');
    }

    const loader = window.RealPlayFeatures;
    if (typeof loader?.ensure !== 'function') {
      throw new Error('Real Play Admin loader is not available for this session.');
    }

    await loader.ensure('admin');
    await window.__realPlayRefreshAdminGameControl?.();
    return true;
  }

  window.__realPlayVerifyAdminAccess = verifyAdmin;
  window.__realPlayEnsureAdminLoaded = ensureAdminLoaded;

  async function openAdmin() {
    setAdminRowBusy(true);
    try {
      await ensureAdminLoaded();
    } catch (error) {
      setAdminRowBusy(false);
      window.alert(error?.message || 'Real Play could not verify Head Admin access for this session. Please sign in again and retry.');
      return;
    }

    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();

    const settingsBack = document.querySelector('[data-rp-settings-back]');
    if (settingsBack) {
      settingsBack.click();
    } else {
      const overlay = document.querySelector('.rp-settings-overlay');
      if (document.body) {
        document.body.tabIndex = -1;
        document.body.focus({ preventScroll: true });
      }
      overlay?.classList.remove('open');
      overlay?.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('rp-settings-open');
    }

    try {
      await window.__realPlayRefreshAdminGameControl?.();

      let opened = window.__realPlayOpenAdminGameControl?.();
      if (!opened) {
        await new Promise((resolve) => window.setTimeout(resolve, 60));
        opened = window.__realPlayOpenAdminGameControl?.();
      }

      if (!opened) throw new Error('Admin tools loaded but Game Control did not open.');
    } catch (error) {
      console.error('[Real Play] Unable to open admin tools.', error);
      window.alert('Unable to open Real Play Admin right now. Please try again.');
    } finally {
      setAdminRowBusy(false);
    }
  }

  function boot() {
    const observer = new MutationObserver(() => {
      if (settingsList()) {
        syncSettingsRow();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    syncSettingsRow();
  }

  window.addEventListener('realplay:settings-open', syncSettingsRow);

  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    verifySequence += 1;
    verifiedAdmin = false;
    window.__realPlayAdminVerified = false;
    syncSettingsRow();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
