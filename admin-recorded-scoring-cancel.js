(() => {
  if (window.__realPlayRecordedScoringCancelInstalled) return;
  window.__realPlayRecordedScoringCancelInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const DRAFT_PREFIX = 'rp-recorded-score-sheet:v2:';
  let cancelling = false;
  let injectTimer = null;

  function root() {
    return document.querySelector('.rp-admin-control');
  }

  function scoringScreen() {
    return root()?.querySelector('.rp-video-scoring-screen') || null;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function api(path, options = {}) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth}`,
        ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || null;
      throw error;
    }
    return data;
  }

  function installStyle() {
    if (document.getElementById('rp-recorded-cancel-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-recorded-cancel-style';
    style.textContent = `
      .rp-video-cancel-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 13px;border:1px solid rgba(255,95,95,.26);border-radius:13px;background:rgba(65,12,17,.22)}
      .rp-video-cancel-card>div{display:grid;gap:4px;min-width:0}
      .rp-video-cancel-card strong{color:#ffc2c2;font:900 9px/1 system-ui,sans-serif;letter-spacing:.1em}
      .rp-video-cancel-card small{color:#9e7378;font:650 8px/1.35 system-ui,sans-serif}
      .rp-video-cancel-button{min-height:37px;padding:0 12px;border:1px solid rgba(255,95,95,.5);border-radius:9px;background:rgba(76,11,17,.52);color:#ff9c9c;font:950 8px/1 system-ui,sans-serif;letter-spacing:.09em;white-space:nowrap}
      .rp-video-cancel-button:disabled{opacity:.45}
      @media(max-width:390px){.rp-video-cancel-card{grid-template-columns:1fr}.rp-video-cancel-button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function injectButton() {
    installStyle();
    const screen = scoringScreen();
    if (!screen || screen.querySelector('[data-rp-cancel-video]')) return;

    const card = document.createElement('div');
    card.className = 'rp-video-cancel-card';
    card.dataset.rpCancelVideoCard = '1';
    card.innerHTML = `
      <div>
        <strong>WRONG VIDEO?</strong>
        <small>Discard this recording and the unfinished score sheet, then upload a new video. Your selected players and game rules stay.</small>
      </div>
      <button type="button" class="rp-video-cancel-button" data-rp-cancel-video>CANCEL VIDEO</button>`;

    const draftBanner = screen.querySelector('[data-rp-draft-banner]');
    const anchor = draftBanner || screen.querySelector('.rp-video-auto-note') || screen.querySelector('.rp-video-player-wrap');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else screen.prepend(card);
  }

  function clearLocalDrafts(sessionId) {
    const prefix = `${DRAFT_PREFIX}${Number(sessionId)}:`;
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  async function cancelVideo(button) {
    if (cancelling) return;

    const controlData = await api('/api/real-play/admin/career/control');
    const sessionId = Number(controlData?.control?.session?.id || 0);
    if (!sessionId) throw new Error('There is no active game to reset.');

    const confirmed = window.confirm(
      'Cancel this game video?\n\nThis will discard the uploaded recording and the unfinished VIDEO score sheet so you can upload a new video. Your player roster and game rules will stay.'
    );
    if (!confirmed) return;

    cancelling = true;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'CANCELLING…';

    try {
      await api('/api/real-play/admin/recorded-scoring/cancel', {
        method: 'POST',
        json: { session_id: sessionId },
      });
      clearLocalDrafts(sessionId);
      window.__realPlayRecordedScoringDraftActive = false;

      const video = scoringScreen()?.querySelector('[data-rp-recorded-video]');
      if (video) {
        try { video.pause(); } catch (_) {}
        video.removeAttribute('src');
        try { video.load(); } catch (_) {}
      }

      const videoTab = root()?.querySelector('[data-rp-video-tab]');
      if (videoTab) videoTab.click();
      else window.location.reload();
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      window.alert(error.message || 'Could not cancel this game video.');
    } finally {
      cancelling = false;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-cancel-video]');
    if (!button || !root()?.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelVideo(button).catch((error) => {
      cancelling = false;
      button.disabled = false;
      button.textContent = 'CANCEL VIDEO';
      window.alert(error.message || 'Could not cancel this game video.');
    });
  }, true);

  function scheduleInject() {
    if (injectTimer) clearTimeout(injectTimer);
    injectTimer = setTimeout(injectButton, 30);
  }

  const observer = new MutationObserver(scheduleInject);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('realplay:admin-render', scheduleInject);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInject, { once: true });
  else scheduleInject();
})();
