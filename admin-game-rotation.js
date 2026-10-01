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
  if (window.__realPlayReplayAdminHashHoldInstalled) return;
  window.__realPlayReplayAdminHashHoldInstalled = true;

  const HOLD_MS = 700;
  const MOVE_CANCEL_PX = 14;
  let timer = 0;
  let pressedHash = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let suppressNextHashClick = false;

  function hashButtonFrom(target) {
    if (!(target instanceof Element)) return null;
    const topbar = target.closest('.rp-career-replay-topbar');
    if (!topbar || !target.closest('[data-rp-career-replay].open')) return null;
    const direct = target.closest('button,[role="button"]');
    if (direct && topbar.contains(direct) && String(direct.textContent || '').trim() === '#') return direct;
    return [...topbar.querySelectorAll('button,[role="button"]')]
      .find((button) => String(button.textContent || '').trim() === '#') || null;
  }

  function clearHold() {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    pressedHash?.classList.remove('rp-replay-admin-hold-arming');
    pressedHash = null;
    pointerId = null;
  }

  function adminEditButton(hash) {
    if (window.__realPlayAdminVerified !== true) return null;
    return hash?.closest('[data-rp-career-replay].open')?.querySelector('[data-rp-replay-admin-edit]') || null;
  }

  document.addEventListener('pointerdown', (event) => {
    const hash = hashButtonFrom(event.target);
    if (!hash || window.__realPlayAdminVerified !== true) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    clearHold();
    pressedHash = hash;
    pointerId = event.pointerId;
    startX = Number(event.clientX || 0);
    startY = Number(event.clientY || 0);
    hash.classList.add('rp-replay-admin-hold-arming');

    timer = window.setTimeout(() => {
      timer = 0;
      if (pressedHash !== hash) return;
      hash.classList.remove('rp-replay-admin-hold-arming');
      pressedHash = null;
      const edit = adminEditButton(hash);
      if (!edit) return;
      suppressNextHashClick = true;
      edit.click();
    }, HOLD_MS);
  }, true);

  document.addEventListener('pointermove', (event) => {
    if (!pressedHash || event.pointerId !== pointerId) return;
    const distance = Math.hypot(
      Number(event.clientX || 0) - startX,
      Number(event.clientY || 0) - startY
    );
    if (distance > MOVE_CANCEL_PX) clearHold();
  }, true);

  document.addEventListener('pointerup', (event) => {
    if (pointerId === null || event.pointerId === pointerId) clearHold();
  }, true);
  document.addEventListener('pointercancel', clearHold, true);

  document.addEventListener('click', (event) => {
    const hash = hashButtonFrom(event.target);
    if (!hash || !suppressNextHashClick) return;
    suppressNextHashClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .rp-replay-admin-edit{display:none!important;pointer-events:none!important;}
    .rp-replay-admin-hold-arming{transform:scale(.96);filter:brightness(1.16);}
  `;
  document.head.appendChild(style);
})();
