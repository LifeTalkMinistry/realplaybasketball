(() => {
  if (window.__realPlayLiveSessionExpiryInstalled) return;
  window.__realPlayLiveSessionExpiryInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const CONTROL_PATH = '/api/real-play/admin/career/control';
  const EXPIRE_AFTER_MS = 6 * 60 * 60 * 1000;
  const MAX_ARCHIVES_PER_PASS = 12;

  let busy = false;
  let timer = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function modeOf(session) {
    return String(session?.gameEntryMode || session?.game_entry_mode || '').trim().toLowerCase();
  }

  function statusOf(session) {
    return String(session?.gameStatus || session?.game_status || '').trim().toLowerCase();
  }

  function startsAtMs(session) {
    const raw = session?.startsAt || session?.starts_at || null;
    if (!raw) return null;
    const value = new Date(raw).getTime();
    return Number.isFinite(value) ? value : null;
  }

  function hasStarted(session) {
    return Boolean(
      session?.sessionStarted
      || session?.session_started
      || statusOf(session) === 'live'
      || session?.startedAt
      || session?.started_at
    );
  }

  function isPastLive(session) {
    const start = startsAtMs(session);
    return modeOf(session) === 'live' && start !== null && start < Date.now();
  }

  function isExpiredUnstartedLive(session) {
    const start = startsAtMs(session);
    if (modeOf(session) !== 'live' || start === null) return false;
    if (hasStarted(session)) return false;
    if (statusOf(session) && statusOf(session) !== 'setup') return false;
    return Date.now() - start >= EXPIRE_AFTER_MS;
  }

  async function api(options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${CONTROL_PATH}`, {
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

  function decorateBadge(session) {
    const adminRoot = root();
    if (!adminRoot || modeOf(session) !== 'live') return;
    const badge = adminRoot.querySelector('[data-rp-entry-mode-badge]');
    if (!badge) return;

    const past = isPastLive(session);
    const expired = isExpiredUnstartedLive(session);
    badge.classList.toggle('expired', expired);
    const text = expired ? 'EXPIRED · LIVE' : past ? 'PAST · LIVE' : 'FUTURE · LIVE';
    if (badge.textContent !== text) badge.textContent = text;
  }

  function ensureStyle() {
    if (document.querySelector('[data-rp-live-expiry-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpLiveExpiryStyle = '1';
    style.textContent = `.rp-entry-mode-badge.expired{border-color:rgba(255,122,122,.42)!important;background:rgba(62,15,18,.48)!important;color:#ff9c9c!important}`;
    document.head.appendChild(style);
  }

  async function archiveExpiredSessions() {
    if (busy || !token() || !root()?.classList.contains('open')) return;
    busy = true;
    ensureStyle();
    let archived = 0;

    try {
      for (let index = 0; index < MAX_ARCHIVES_PER_PASS; index += 1) {
        const data = await api();
        const control = data?.control || { session: null, players: [] };
        const session = control?.session || null;

        decorateBadge(session);
        if (!session || !isExpiredUnstartedLive(session)) break;

        const closed = await api({ method: 'POST', body: { action: 'cancel-session' } });
        archived += 1;

        const nextSession = closed?.control?.session || null;
        decorateBadge(nextSession);
        if (!nextSession || !isExpiredUnstartedLive(nextSession)) break;
      }

      if (archived > 0) {
        await window.__realPlayRefreshAdminGameControl?.();
        root()?.querySelector('[data-admin-tab="session"]')?.click();
        window.dispatchEvent(new CustomEvent('realplay:expired-live-sessions-archived', {
          detail: { count: archived },
        }));
      }
    } catch (error) {
      console.warn('[Real Play] Expired live-session cleanup skipped:', error);
    } finally {
      busy = false;
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(archiveExpiredSessions, 90);
  }

  window.addEventListener('realplay:admin-render', schedule);
  window.addEventListener('realplay:entry-mode-state', (event) => {
    decorateBadge(event.detail?.control?.session || null);
    schedule();
  });
  window.addEventListener('focus', schedule);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
