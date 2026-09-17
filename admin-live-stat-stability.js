(() => {
  if (window.__realPlayLiveStatStabilityInstalled) return;
  window.__realPlayLiveStatStabilityInstalled = true;

  // RETIRED: LIVE stat controls are no longer an active scoring path.
  // This file remains loaded late in the app boot, so it also carries small
  // compatibility fixes for the mobile player-admin sheet.
  if (!document.querySelector('[data-rp-player-admin-mobile-scroll-fix]')) {
    const style = document.createElement('style');
    style.dataset.rpPlayerAdminMobileScrollFix = '1';
    style.textContent = `
      .rp-player-admin-sheet{
        overscroll-behavior:contain!important;
        touch-action:pan-y!important;
      }
      .rp-player-admin-card{
        min-height:0!important;
        max-height:min(82dvh,720px)!important;
        overflow-x:hidden!important;
        overflow-y:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
        touch-action:pan-y!important;
        scrollbar-gutter:stable;
      }
      .rp-player-admin-body{
        padding-bottom:calc(28px + env(safe-area-inset-bottom))!important;
        touch-action:pan-y!important;
      }
      @media(max-height:760px){
        .rp-player-admin-card{max-height:calc(100dvh - 92px)!important}
      }
    `;
    document.head.appendChild(style);
  }

  /*
    World rows use the canonical player identity id from
    real_play_unclaimed_players, while the player-admin endpoint historically
    expects the Real Play account user id. Those two ids are not guaranteed to
    be equal. The old admin sheet therefore worked only when the numbers happened
    to line up and could otherwise show "player account was not found".

    Resolve the open sheet's visible player identity against the authoritative
    admin directory before any account-level action. This also prevents an
    unclaimed/manual World player id from ever being mistaken for an unrelated
    account id that happens to share the same number.
  */
  if (!window.__realPlayCanonicalAdminTargetFixInstalled) {
    window.__realPlayCanonicalAdminTargetFixInstalled = true;

    const ADMIN_URL = 'https://api.clarapmc.com/api/real-play/admin/player';
    const ACCOUNT_ACTIONS = new Set([
      'edit_name',
      'change_jersey',
      'reset_competitive',
      'suspend',
      'reactivate',
      'delete_account',
    ]);
    const upstreamFetch = window.fetch.bind(window);

    const normalizeName = (value) => String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

    function requestUrl(input) {
      return typeof input === 'string' ? input : String(input?.url || '');
    }

    function sheetIdentity() {
      const sheet = document.querySelector('.rp-player-admin-sheet.open');
      const label = sheet?.querySelector('.rp-player-admin-identity strong');
      if (!sheet || !label) return null;

      const text = String(label.textContent || '').trim();
      if (!text) return null;

      const numbered = text.match(/\s+#(\d{1,2})\s*$/);
      if (numbered) {
        return {
          name: text.slice(0, numbered.index).trim(),
          playerNumber: Number(numbered[1]),
        };
      }

      return {
        name: text.replace(/\s+#(?:—|--)\s*$/, '').trim(),
        playerNumber: null,
      };
    }

    async function loadAdminPlayers(url, init) {
      const response = await upstreamFetch(url, {
        ...init,
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
        cache: 'no-store',
      });
      if (!response.ok) return [];
      const data = await response.json().catch(() => ({}));
      return Array.isArray(data?.players) ? data.players : [];
    }

    function resolveAccountPlayer(players, identity, requestedId) {
      const wantedName = normalizeName(identity?.name);
      const wantedNumber = identity?.playerNumber;
      if (!wantedName) return null;

      const sameName = players.filter((player) => normalizeName(player?.playerName) === wantedName);
      if (wantedNumber !== null && wantedNumber !== undefined) {
        const sameIdentity = sameName.filter(
          (player) => Number(player?.playerNumber) === Number(wantedNumber)
        );
        if (sameIdentity.length === 1) return sameIdentity[0];
      }

      // A direct account-id row (for example a suspended player appended by the
      // admin directory) is safe only when its visible name also agrees.
      const direct = sameName.find((player) => Number(player?.userId) === Number(requestedId));
      if (direct) return direct;

      // Names without a current jersey are still resolvable when unique.
      if (sameName.length === 1) return sameName[0];
      return null;
    }

    window.fetch = async function realPlayCanonicalAdminTargetFetch(input, init = {}) {
      const url = requestUrl(input);
      if (!url.startsWith(ADMIN_URL) || String(init?.method || 'GET').toUpperCase() !== 'POST') {
        return upstreamFetch(input, init);
      }

      let payload = null;
      try {
        payload = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      } catch (_error) {
        payload = null;
      }

      const action = String(payload?.action || '').trim().toLowerCase();
      if (!payload || !ACCOUNT_ACTIONS.has(action)) {
        return upstreamFetch(input, init);
      }

      const identity = sheetIdentity();
      if (!identity) {
        // Non-sheet callers keep their existing account-id contract.
        return upstreamFetch(input, init);
      }

      try {
        const players = await loadAdminPlayers(url, init);
        const accountPlayer = resolveAccountPlayer(players, identity, payload.playerId);

        if (!accountPlayer?.userId) {
          return new Response(JSON.stringify({
            ok: false,
            code: 'PLAYER_ACCOUNT_UNLINKED',
            message: 'This player does not have a linked Real Play account yet. Account actions are unavailable until the player is claimed.',
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return upstreamFetch(input, {
          ...init,
          body: JSON.stringify({
            ...payload,
            playerId: Number(accountPlayer.userId),
          }),
        });
      } catch (_error) {
        // Fail closed instead of risking an account action against an unrelated
        // numeric id. The existing admin UI will surface this message normally.
        return new Response(JSON.stringify({
          ok: false,
          code: 'PLAYER_ACCOUNT_RESOLUTION_FAILED',
          message: 'Could not safely match this player to a Real Play account. Refresh the Players list and try again.',
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    };
  }
})();
