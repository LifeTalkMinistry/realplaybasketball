(() => {
  if (window.__realPlayAdminDomScoreSyncInstalledV4) return;
  window.__realPlayAdminDomScoreSyncInstalledV4 = true;

  function readNumber(value) {
    const parsed = Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function playerCardPoints(card) {
    const ptsControl = card.querySelector('[data-control-action="stat"][data-stat="pts"]');
    const ptsBox = ptsControl?.closest('.rp-admin-stat') || card.querySelector('.rp-admin-stat');
    return readNumber(ptsBox?.querySelector('strong')?.textContent);
  }

  function playerCardTeam(card) {
    return String(card.querySelector('.rp-admin-stat-player-head .rp-admin-pill')?.textContent || '')
      .trim()
      .toLowerCase();
  }

  function calculate(root) {
    if (!root?.classList.contains('open')) return null;
    const scores = { west: 0, east: 0 };
    let players = 0;

    root.querySelectorAll('.rp-admin-stat-player').forEach((card) => {
      const team = playerCardTeam(card);
      if (team !== 'west' && team !== 'east') return;
      scores[team] += playerCardPoints(card);
      players += 1;
    });

    return players ? scores : null;
  }

  function writeScore(root = document.querySelector('.rp-admin-control')) {
    const scores = calculate(root);
    if (!scores) return;

    root.querySelectorAll('.rp-admin-scoreboard').forEach((scoreboard) => {
      const sides = scoreboard.querySelectorAll('.rp-admin-score-side strong');
      if (sides.length < 2) return;
      if (sides[0].textContent !== String(scores.west)) sides[0].textContent = String(scores.west);
      if (sides[1].textContent !== String(scores.east)) sides[1].textContent = String(scores.east);
    });

    const livebar = root.querySelector('.rp-admin-livebar > span:last-child');
    if (livebar && /\d+\s*[–-]\s*\d+/.test(livebar.textContent || '')) {
      const next = `${scores.west}–${scores.east}`;
      if (livebar.textContent !== next) livebar.textContent = next;
    }
  }

  let raf = 0;
  function queue(root) {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      writeScore(root);
    });
  }

  function attach(root) {
    if (!root || root.dataset.scoreSyncReady === 'true') return Boolean(root);
    root.dataset.scoreSyncReady = 'true';

    // Observe only the admin control subtree. The previous whole-document
    // observer + 250ms interval kept waking up the entire app and caused lag.
    const observer = new MutationObserver(() => queue(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    queue(root);
    return true;
  }

  function boot() {
    const existing = document.querySelector('.rp-admin-control');
    if (existing && attach(existing)) return;

    const observer = new MutationObserver(() => {
      const root = document.querySelector('.rp-admin-control');
      if (!root || !attach(root)) return;
      observer.disconnect();
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener('click', (event) => {
    const statButton = event.target.closest('[data-control-action="stat"]');
    if (!statButton) return;
    const root = statButton.closest('.rp-admin-control');
    queue(root);
    window.setTimeout(() => writeScore(root), 60);
    window.setTimeout(() => writeScore(root), 300);
  }, true);

  window.addEventListener('focus', () => writeScore());

  // Startup safety net. If the newer mobile lobby has not mounted, retry only
  // that critical layer once or twice; no recurring loop is left running.
  function rescueLobby() {
    if (document.querySelector('[data-rp-app]')) return;

    const version = '20260829-1018-rescue';
    ['mobile-lobby.css', 'mobile-entry.css', 'mobile-shell-fix.css', 'mobile-lobby-cleanup.css'].forEach((href) => {
      const alreadyLoaded = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .some((link) => String(link.href || '').includes(href));
      if (alreadyLoaded) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${href}?v=${version}`;
      document.head.appendChild(link);
    });

    if (!document.querySelector('script[data-rp-lobby-rescue]')) {
      const script = document.createElement('script');
      script.src = `mobile-lobby.js?v=${version}`;
      script.async = false;
      script.dataset.rpLobbyRescue = 'true';
      document.head.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(rescueLobby, 350), { once: true });
  } else {
    window.setTimeout(rescueLobby, 350);
  }
  window.setTimeout(rescueLobby, 1200);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

(() => {
  if (window.__realPlayAuditOneStepSubmitInstalled) return;
  window.__realPlayAuditOneStepSubmitInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const RECORDED_SUBMIT_PATH = '/api/real-play/admin/recorded-scoring/submit-draft';
  const AUDIT_SUBMIT_PATH = '/api/real-play/admin/audit/submit-draft';
  const nativeFetch = window.fetch.bind(window);

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return String(input?.url || '');
  }

  function auditWorkspaceActive() {
    const activeTab = document.querySelector('.rp-admin-control [data-admin-tab].active');
    const label = String(activeTab?.textContent || '').trim().toLowerCase();
    return label === 'audit'
      || activeTab?.matches('[data-admin-tab="audit"]')
      || Boolean(document.querySelector('.rp-admin-control [data-admin-tab="audit"].active'));
  }

  function isAuditSubmit(url) {
    try {
      const pathname = new URL(url, window.location.href).pathname;
      if (pathname === AUDIT_SUBMIT_PATH) return true;
      return pathname === RECORDED_SUBMIT_PATH && auditWorkspaceActive();
    } catch (_) {
      const raw = String(url || '');
      if (raw.includes(AUDIT_SUBMIT_PATH)) return true;
      return raw.includes(RECORDED_SUBMIT_PATH) && auditWorkspaceActive();
    }
  }

  function parseRequestBody(options) {
    try {
      if (!options?.body || typeof options.body !== 'string') return {};
      return JSON.parse(options.body) || {};
    } catch (_) {
      return {};
    }
  }

  function authHeader(options) {
    const headers = new Headers(options?.headers || {});
    return headers.get('Authorization') || '';
  }

  async function readJson(response) {
    return response.clone().json().catch(() => ({}));
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function finalizeAudit(options, sessionId) {
    const authorization = authHeader(options);
    const response = await nativeFetch(`${API_BASE_URL}/api/real-play/admin/audit/control`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({ action: 'finalize', sessionId: Number(sessionId) || undefined }),
      cache: 'no-store',
    });
    const data = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        response: jsonResponse({
          code: data?.code || 'AUDIT_FINALIZE_FAILED',
          message: data?.message || data?.error || `Could not complete Audit (${response.status}).`,
        }, response.status),
      };
    }
    return { ok: true, data };
  }

  window.fetch = async function realPlayAuditOneStepFetch(input, options = {}) {
    const url = requestUrl(input);
    if (!isAuditSubmit(url)) return nativeFetch(input, options);

    const body = parseRequestBody(options);
    const submitResponse = await nativeFetch(input, options);
    const submitData = await readJson(submitResponse);
    const alreadyVerified = submitResponse.status === 409 && (
      submitData?.code === 'VIDEO_REVIEW_COMPLETE'
      || /already verified and locked/i.test(String(submitData?.message || submitData?.error || ''))
    );

    if (!submitResponse.ok && !alreadyVerified) return submitResponse;

    const sessionId = Number(body.session_id ?? body.sessionId ?? 0);
    const finalized = await finalizeAudit(options, sessionId);
    if (!finalized.ok) return finalized.response;

    const finalResult = finalized.data?.finalized || {};
    return jsonResponse({
      ok: true,
      finalized: true,
      alreadyVerified,
      submittedEvents: Number(submitData?.submittedEvents || 0),
      westScore: Number(finalResult?.westScore ?? submitData?.westScore ?? 0),
      eastScore: Number(finalResult?.eastScore ?? submitData?.eastScore ?? 0),
    });
  };

  function removeFinalizeStep() {
    document.querySelectorAll('[data-admin-tab="finalize"]').forEach((tab) => {
      if (tab.classList.contains('active')) {
        const fallback = document.querySelector('[data-admin-tab="audit"], [data-admin-tab="live"], [data-admin-tab="session"]');
        fallback?.click();
      }
      tab.remove();
    });
  }

  const observer = new MutationObserver(removeFinalizeStep);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:admin-render', removeFinalizeStep);
  removeFinalizeStep();
})();
