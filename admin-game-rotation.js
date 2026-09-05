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
