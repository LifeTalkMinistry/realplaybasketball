(() => {
  if (window.__realPlayGameRotationInstalled) return;
  window.__realPlayGameRotationInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  let busy = false;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  async function finalizeCurrentGame() {
    if (busy) return;
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;
    if (!window.confirm('Confirm the FINAL RESULT?\n\nThis game will be locked into player history, then Real Play will prepare the next rotation game from the same checked-in player pool.')) return;

    busy = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'finalize' }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `Unable to finalize (${response.status}).`);

      await window.__realPlayRefreshAdminGameControl?.();
      root()?.querySelector('[data-admin-tab="live"]')?.click();
      window.setTimeout(() => {
        const pregame = root()?.querySelector('[data-courtside-pregame]');
        if (!pregame || pregame.querySelector('[data-rp-rotation-ready]')) return;
        const banner = document.createElement('div');
        banner.className = 'rp-admin-success';
        banner.dataset.rpRotationReady = '1';
        banner.textContent = 'GAME SAVED. Next rotation game is ready — assign the next West/East matchup and confirm its rules.';
        pregame.prepend(banner);
      }, 80);
    } catch (error) {
      window.alert(error.message || 'Unable to finalize this game.');
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', (event) => {
    const adminRoot = root();
    if (!adminRoot || !adminRoot.contains(event.target)) return;
    const button = event.target.closest('[data-control-action="finalize"]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    finalizeCurrentGame();
  }, true);
})();

(() => {
  if (window.__realPlayReplayAdminHashDoubleTapInstalled) return;
  window.__realPlayReplayAdminHashDoubleTapInstalled = true;

  const DOUBLE_TAP_MS = 430;
  let lastTapAt = 0;
  let lastHash = null;

  function hashButtonFrom(target) {
    if (!(target instanceof Element)) return null;
    const direct = target.closest('button,[role="button"]');
    if (!direct) return null;
    const topbar = direct.closest('.rp-career-replay-topbar');
    if (!topbar || !direct.closest('[data-rp-career-replay].open')) return null;
    if (String(direct.textContent || '').trim() !== '#') return null;
    direct.classList.add('rp-replay-admin-hash');
    return direct;
  }

  function adminEditButton(hash) {
    if (window.__realPlayAdminVerified !== true) return null;
    return hash?.closest('[data-rp-career-replay].open')?.querySelector('[data-rp-replay-admin-edit]') || null;
  }

  function hideLegacyPencil() {
    document.querySelectorAll('[data-rp-replay-admin-edit]').forEach((button) => {
      button.style.setProperty('display', 'none', 'important');
      button.style.setProperty('pointer-events', 'none', 'important');
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });
  }

  document.addEventListener('click', (event) => {
    const hash = hashButtonFrom(event.target);
    if (!hash || window.__realPlayAdminVerified !== true) return;

    const now = performance.now();
    const isDoubleTap = lastHash === hash && now - lastTapAt <= DOUBLE_TAP_MS;

    if (!isDoubleTap) {
      lastHash = hash;
      lastTapAt = now;
      return;
    }

    lastHash = null;
    lastTapAt = 0;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    hash.classList.add('rp-replay-admin-doubletap-hit');
    window.setTimeout(() => hash.classList.remove('rp-replay-admin-doubletap-hit'), 180);

    const replayRoot = hash.closest('[data-rp-career-replay].open');
    const sessionId = Number(replayRoot?.dataset?.rpCareerReplaySession || 0);
    const openCorrection = window.__realPlayOpenReplayCorrection;
    if (typeof openCorrection === 'function' && Number.isSafeInteger(sessionId) && sessionId > 0) {
      openCorrection(sessionId);
      return;
    }

    const edit = adminEditButton(hash);
    if (edit) edit.click();
  }, true);

  const observer = new MutationObserver(hideLegacyPencil);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  hideLegacyPencil();

  const style = document.createElement('style');
  style.textContent = `
    .rp-replay-admin-edit{display:none!important;pointer-events:none!important;}
    .rp-replay-admin-hash{touch-action:manipulation;}
    .rp-replay-admin-doubletap-hit{transform:scale(.94);filter:brightness(1.22);}
  `;
  document.head.appendChild(style);
})();
