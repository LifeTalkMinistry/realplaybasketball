(() => {
  if (window.__realPlaySessionGuardInstalled) return;
  window.__realPlaySessionGuardInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const REAL_PLAY_API = 'https://api.clarapmc.com/api/real-play/';
  const COMMUNITY_URL = `${REAL_PLAY_API}community`;
  const PUBLIC_COMMUNITY_URL = `${REAL_PLAY_API}public/community`;
  const TOKEN_KEY = 'real_play_access_token';
  const VISITOR_KEY = 'real_play_visitor_mode';
  const ADMIN_CACHE_KEY = 'real_play_admin_ui_bypass_v1';
  const OUTAGE_STATUSES = new Set([502, 503, 504]);
  const PUBLIC_ACTIONS = new Set(['bootstrap', 'feed', 'channels', 'chat', 'players', 'player_profile']);

  let outageOverlay = null;
  let outageProbe = null;
  let outageRetryTimer = 0;
  let adminRememberTimer = 0;

  function requestUrl(input) {
    return typeof input === 'string' ? input : input?.url || '';
  }

  function currentToken() {
    try {
      return window.localStorage.getItem(TOKEN_KEY) || '';
    } catch (_error) {
      return '';
    }
  }

  function tokenFingerprint(value) {
    const token = String(value || '');
    if (!token) return '';
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `rp-${(hash >>> 0).toString(16)}`;
  }

  function tokenClaimsAdmin() {
    const token = currentToken();
    const payload = token.split('.')[1];
    if (!payload) return false;
    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const claims = JSON.parse(atob(padded));
      const role = String(claims?.role || claims?.user_role || claims?.access || '').trim().toLowerCase();
      return claims?.admin === true
        || claims?.is_admin === true
        || claims?.isAdmin === true
        || ['admin', 'head_admin', 'head-admin', 'superadmin', 'super_admin'].includes(role);
    } catch (_error) {
      return false;
    }
  }

  function rememberVerifiedAdmin() {
    if (window.__realPlayAdminVerified !== true) return false;
    const fingerprint = tokenFingerprint(currentToken());
    if (!fingerprint) return false;
    try {
      window.localStorage.setItem(ADMIN_CACHE_KEY, fingerprint);
    } catch (_error) {}
    return true;
  }

  function hasCachedAdminAccess() {
    const fingerprint = tokenFingerprint(currentToken());
    if (!fingerprint) return false;
    try {
      return window.localStorage.getItem(ADMIN_CACHE_KEY) === fingerprint;
    } catch (_error) {
      return false;
    }
  }

  function hasAdminUiEvidence() {
    return Boolean(
      document.body?.classList.contains('rp-admin-open')
      || document.querySelector('.rp-admin-control.open')
      || document.querySelector('[data-rp-settings-action="admin"]')
    );
  }

  function isAdminBypass() {
    rememberVerifiedAdmin();
    return window.__realPlayAdminVerified === true
      || hasCachedAdminAccess()
      || tokenClaimsAdmin()
      || hasAdminUiEvidence();
  }

  function installOutageStyles() {
    if (document.querySelector('[data-rp-server-unavailable-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpServerUnavailableStyle = '1';
    style.textContent = `
      body.rp-server-unavailable{overflow:hidden!important;background:#000!important}
      .rp-server-unavailable-screen{position:fixed;z-index:2147483646;inset:0;display:none;overflow:hidden;color:#f7fbff;background:#000;font-family:Arial,Helvetica,sans-serif;isolation:isolate}
      .rp-server-unavailable-screen.open{display:grid;place-items:center}
      .rp-server-unavailable-screen::before{content:'';position:absolute;inset:-18%;z-index:-3;background:radial-gradient(55% 42% at 15% 8%,rgba(25,190,255,.13),transparent 72%),radial-gradient(48% 38% at 90% 88%,rgba(255,35,58,.09),transparent 74%),linear-gradient(180deg,#020407 0%,#000 58%,#010203 100%)}
      .rp-server-unavailable-screen::after{content:'';position:absolute;z-index:-2;inset:0;opacity:.14;background:linear-gradient(90deg,transparent 49.8%,rgba(90,211,255,.22) 50%,transparent 50.2%),radial-gradient(circle at 50% 50%,transparent 0 16%,rgba(90,211,255,.18) 16.2% 16.45%,transparent 16.7%);mask-image:linear-gradient(to bottom,transparent 0%,#000 22%,#000 78%,transparent 100%)}
      .rp-server-unavailable-shell{position:relative;width:min(calc(100% - 34px),560px);min-height:min(700px,calc(100dvh - 34px));padding:34px 24px 26px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:1px solid rgba(67,209,255,.16);border-radius:28px;background:linear-gradient(180deg,rgba(7,11,17,.92),rgba(2,3,5,.96));box-shadow:0 30px 90px rgba(0,0,0,.78),inset 0 1px rgba(255,255,255,.04)}
      .rp-server-unavailable-shell::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(135deg,rgba(58,214,255,.08),transparent 30%,transparent 70%,rgba(255,55,72,.05))}
      .rp-server-unavailable-mark{width:64px;height:64px;display:grid;place-items:center;margin-bottom:18px;border:1px solid rgba(71,215,255,.34);border-radius:20px;color:#5bdcff;background:linear-gradient(145deg,rgba(16,96,124,.22),rgba(3,9,14,.58));box-shadow:0 0 38px rgba(29,190,255,.12);font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.28rem;font-style:italic;letter-spacing:.04em}
      .rp-server-unavailable-brand strong{display:block;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:clamp(1.7rem,8vw,2.7rem);font-style:italic;letter-spacing:.045em;line-height:.9}.rp-server-unavailable-brand span{display:block;margin-top:7px;color:#51d9ff;font-size:.56rem;font-weight:950;letter-spacing:.28em}
      .rp-server-unavailable-status{margin:32px 0 12px;padding:7px 11px;border:1px solid rgba(255,103,119,.22);border-radius:999px;color:#ff8795;background:rgba(89,12,25,.20);font-size:.48rem;font-weight:950;letter-spacing:.15em;text-transform:uppercase}
      .rp-server-unavailable-screen h1{max-width:430px;margin:0;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:clamp(2.15rem,11vw,4rem);font-style:italic;font-weight:950;letter-spacing:.025em;line-height:.94;text-transform:uppercase}
      .rp-server-unavailable-copy{max-width:410px;margin:18px auto 0;color:#8997a8;font-size:.78rem;font-weight:650;line-height:1.7}.rp-server-unavailable-copy strong{color:#cdd7e2}
      .rp-server-unavailable-retry{position:relative;min-width:190px;min-height:48px;margin-top:28px;padding:0 22px;border:1px solid rgba(77,219,255,.36);border-radius:14px;color:#eafaff;background:linear-gradient(180deg,rgba(19,92,120,.44),rgba(7,31,43,.58));box-shadow:0 12px 30px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.06);font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:.76rem;font-style:italic;font-weight:950;letter-spacing:.08em;cursor:pointer}.rp-server-unavailable-retry:disabled{cursor:wait;opacity:.68}
      .rp-server-unavailable-foot{width:100%;margin-top:auto;padding-top:36px}.rp-server-unavailable-tagline{margin:0;color:#536174;font-size:.52rem;font-weight:900;letter-spacing:.16em}.rp-server-unavailable-credit{margin:18px 0 0;color:#6b7786;font-size:.58rem;font-weight:750;letter-spacing:.05em}.rp-server-unavailable-credit strong{display:block;margin-top:4px;color:#d9e4ee;font-size:.78rem;letter-spacing:.035em}
      .rp-server-unavailable-pulse{width:6px;height:6px;margin:18px auto 0;border-radius:50%;background:#ff6376;box-shadow:0 0 0 0 rgba(255,99,118,.45);animation:rpServerPulse 1.8s ease-out infinite}
      @keyframes rpServerPulse{0%{box-shadow:0 0 0 0 rgba(255,99,118,.38)}70%{box-shadow:0 0 0 11px rgba(255,99,118,0)}100%{box-shadow:0 0 0 0 rgba(255,99,118,0)}}
      @media(max-width:420px){.rp-server-unavailable-shell{width:calc(100% - 22px);min-height:calc(100dvh - 22px);padding:28px 18px 22px;border-radius:24px}.rp-server-unavailable-status{margin-top:26px}.rp-server-unavailable-copy{font-size:.72rem}}
      @media(prefers-reduced-motion:reduce){.rp-server-unavailable-pulse{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureOutageOverlay() {
    if (outageOverlay?.isConnected) return outageOverlay;
    installOutageStyles();
    outageOverlay = document.createElement('section');
    outageOverlay.className = 'rp-server-unavailable-screen';
    outageOverlay.dataset.rpServerUnavailable = '1';
    outageOverlay.setAttribute('role', 'dialog');
    outageOverlay.setAttribute('aria-modal', 'true');
    outageOverlay.setAttribute('aria-labelledby', 'rp-server-unavailable-title');
    outageOverlay.setAttribute('aria-hidden', 'true');
    outageOverlay.innerHTML = `
      <div class="rp-server-unavailable-shell">
        <div class="rp-server-unavailable-mark" aria-hidden="true">RP</div>
        <div class="rp-server-unavailable-brand"><strong>REAL PLAY</strong><span>BASKETBALL</span></div>
        <div class="rp-server-unavailable-status">SYSTEM CONNECTION</div>
        <h1 id="rp-server-unavailable-title">SERVER<br>UNAVAILABLE</h1>
        <div class="rp-server-unavailable-pulse" aria-hidden="true"></div>
        <p class="rp-server-unavailable-copy">Real Play can’t reach the server right now. <strong>Your player history, stats and rankings remain protected.</strong> Please retry in a moment.</p>
        <button class="rp-server-unavailable-retry" type="button" data-rp-server-retry>RETRY CONNECTION</button>
        <div class="rp-server-unavailable-foot">
          <p class="rp-server-unavailable-tagline">LESS SCREEN. REAL POINTS.</p>
          <p class="rp-server-unavailable-credit">Project By:<strong>Max Emorej</strong></p>
        </div>
      </div>
    `;
    document.body.appendChild(outageOverlay);

    const retryButton = outageOverlay.querySelector('[data-rp-server-retry]');
    retryButton?.addEventListener('click', async () => {
      retryButton.disabled = true;
      retryButton.textContent = 'CHECKING…';
      const available = await probeServerAvailability({ allowShow: true });
      if (available) {
        hideServerUnavailable();
        retryButton.textContent = 'RETRY CONNECTION';
        retryButton.disabled = false;
        return;
      }
      retryButton.textContent = 'STILL UNAVAILABLE';
      window.setTimeout(() => {
        if (!retryButton.isConnected) return;
        retryButton.textContent = 'RETRY CONNECTION';
        retryButton.disabled = false;
      }, 1200);
    });

    return outageOverlay;
  }

  function scheduleOutageRetry() {
    if (outageRetryTimer) window.clearTimeout(outageRetryTimer);
    outageRetryTimer = window.setTimeout(async () => {
      outageRetryTimer = 0;
      if (!outageOverlay?.classList.contains('open')) return;
      const available = await probeServerAvailability({ allowShow: true });
      if (!available && outageOverlay?.classList.contains('open')) scheduleOutageRetry();
    }, 15000);
  }

  function showServerUnavailable() {
    if (isAdminBypass()) {
      hideServerUnavailable();
      return;
    }
    const overlay = ensureOutageOverlay();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-server-unavailable');
    scheduleOutageRetry();
  }

  function hideServerUnavailable() {
    if (outageRetryTimer) {
      window.clearTimeout(outageRetryTimer);
      outageRetryTimer = 0;
    }
    outageOverlay?.classList.remove('open');
    outageOverlay?.setAttribute('aria-hidden', 'true');
    document.body?.classList.remove('rp-server-unavailable');
  }

  async function probeServerAvailability({ allowShow = true } = {}) {
    if (outageProbe) return outageProbe;
    outageProbe = (async () => {
      try {
        const response = await nativeFetch(`${REAL_PLAY_API}health?rp_connection_probe=${Date.now()}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        });
        const unavailable = OUTAGE_STATUSES.has(response.status);
        if (!unavailable) {
          hideServerUnavailable();
          return true;
        }
        if (allowShow) showServerUnavailable();
        return false;
      } catch (_error) {
        if (allowShow) showServerUnavailable();
        return false;
      } finally {
        outageProbe = null;
      }
    })();
    return outageProbe;
  }

  function signalPossibleOutage() {
    window.setTimeout(() => {
      probeServerAvailability({ allowShow: true }).catch(() => undefined);
    }, 0);
  }

  function isProtectedRealPlayRequest(input, init = {}) {
    const url = requestUrl(input);
    if (!url.startsWith(REAL_PLAY_API)) return false;

    const headers = new Headers(init.headers || (typeof input !== 'string' ? input?.headers : undefined) || {});
    return headers.has('Authorization');
  }

  function isConfirmedExpiredSession(body) {
    const text = String(body || '').toLowerCase();
    return [
      'authorization token is invalid or expired',
      'token is invalid or expired',
      'token expired',
      'jwt expired',
      'invalid token',
      'expired token',
    ].some((phrase) => text.includes(phrase));
  }

  function switchToPublicSession() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.setItem(VISITOR_KEY, '1');
    } catch (_error) {}

    try {
      window.dispatchEvent(new CustomEvent('realplay:session-expired'));
      window.dispatchEvent(new CustomEvent('realplay:visitorchange'));
    } catch (_error) {}
  }

  function readBody(init = {}) {
    if (typeof init.body !== 'string' || !init.body) return null;
    try {
      return JSON.parse(init.body);
    } catch (_error) {
      return null;
    }
  }

  async function retryPublicCommunity(input, init = {}) {
    const url = requestUrl(input);
    if (url !== COMMUNITY_URL) return null;

    const body = readBody(init);
    const action = String(body?.action || '');
    if (!PUBLIC_ACTIONS.has(action)) return null;

    const headers = new Headers(init.headers || {});
    headers.delete('Authorization');
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');

    return nativeFetch(PUBLIC_COMMUNITY_URL, {
      ...init,
      method: init.method || 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  }

  async function guardedFetch(input, init = {}) {
    const url = requestUrl(input);
    const realPlayRequest = url.startsWith(REAL_PLAY_API);
    const protectedRequest = isProtectedRealPlayRequest(input, init);
    let response;

    try {
      response = await nativeFetch(input, init);
    } catch (error) {
      if (realPlayRequest) signalPossibleOutage();
      throw error;
    }

    if (realPlayRequest) {
      if (OUTAGE_STATUSES.has(response.status)) signalPossibleOutage();
      else if (outageOverlay?.classList.contains('open')) hideServerUnavailable();
    }

    if (!protectedRequest || response.ok) return response;

    // Inspect explicit expired-token responses regardless of whether the backend
    // surfaced them as 401, 403, or another auth failure status.
    const firstBody = await response.clone().text().catch(() => '');
    if (isConfirmedExpiredSession(firstBody)) {
      switchToPublicSession();

      // Public World/Players data should keep working instantly. Transparently
      // retry the same read action against the public endpoint, so the user does
      // not need to clear browser data, close the tab, or manually reset storage.
      try {
        const publicResponse = await retryPublicCommunity(input, init);
        if (publicResponse) return publicResponse;
      } catch (_error) {}

      return response;
    }

    if (response.status !== 401) return response;

    // A single ambiguous 401 must never destroy the whole app session. Retry once
    // in case the request raced with page/app initialization.
    try {
      response = await nativeFetch(input, init);
    } catch (_error) {
      if (realPlayRequest) signalPossibleOutage();
      return response;
    }

    if (OUTAGE_STATUSES.has(response.status)) signalPossibleOutage();
    if (response.status !== 401) return response;

    const body = await response.clone().text().catch(() => firstBody);
    if (isConfirmedExpiredSession(body)) {
      switchToPublicSession();
      try {
        const publicResponse = await retryPublicCommunity(input, init);
        if (publicResponse) return publicResponse;
      } catch (_error) {}
      return response;
    }

    // Preserve ambiguous/transient 401s. This keeps the original protection
    // against accidental logouts caused by short-lived backend/session races.
    const headers = new Headers(response.headers);
    headers.set('X-Real-Play-Session-Guard', 'preserved');

    return new Response(body, {
      status: 503,
      statusText: 'Session sync unavailable',
      headers,
    });
  }

  window.RealPlayServerGate = {
    retry: () => probeServerAvailability({ allowShow: true }),
    show: showServerUnavailable,
    hide: hideServerUnavailable,
    isAdminBypass,
  };

  window.fetch = guardedFetch;

  adminRememberTimer = window.setInterval(() => {
    if (rememberVerifiedAdmin()) {
      if (outageOverlay?.classList.contains('open')) hideServerUnavailable();
    }
  }, 1200);

  window.addEventListener('realplay:app-ready', () => {
    window.setTimeout(() => probeServerAvailability({ allowShow: true }).catch(() => undefined), 350);
  }, { once: true });

  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY && outageOverlay?.classList.contains('open') && isAdminBypass()) {
      hideServerUnavailable();
    }
  });
})();