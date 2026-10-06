(() => {
  if (window.__realPlayUpdatesGameDetailInstalled) return;
  window.__realPlayUpdatesGameDetailInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const hydrationRequests = new Map();
  const OFFICIAL_MVP_FEED_TTL_MS = 30000;
  const OFFICIAL_MVP_RETRY_BACKOFF_MS = 15000;
  let officialMvpFeedCache = new Map();
  let officialMvpFeedCachedAt = 0;
  let officialMvpFeedRetryAt = 0;
  let officialMvpFeedPromise = null;
  let mvpModal = null;
  let mvpModalReturnFocus = null;

  function sessionIdFromCard(card) {
    const id = String(card?.dataset.updateId || '');
    const match = id.match(/^career-(\d+)-result$/);
    const sessionId = Number(match?.[1] || 0);
    return Number.isSafeInteger(sessionId) && sessionId > 0 ? sessionId : 0;
  }

  function setReplayDestinationMode(mode = 'watch') {
    let attempts = 0;
    const apply = () => {
      attempts += 1;
      const viewer = document.querySelector('[data-rp-career-replay].open');
      if (!viewer) {
        if (attempts < 40) window.setTimeout(apply, 60);
        return;
      }

      const kicker = viewer.querySelector('.rp-career-replay-title small');
      if (kicker) kicker.textContent = mode === 'recap' ? 'GAME RECAP' : 'FULL GAME REPLAY';

      if (mode !== 'recap') {
        viewer.scrollTop = 0;
        return;
      }

      const stats = viewer.querySelector('[data-rp-career-replay-stats]');
      if (!stats) {
        if (attempts < 55) window.setTimeout(apply, 80);
        return;
      }

      stats.scrollIntoView({ block: 'start', behavior: 'instant' });
    };
    window.requestAnimationFrame(apply);
  }

  function openReplay(sessionId, mode = 'watch') {
    const bridge = document.createElement('button');
    bridge.type = 'button';
    bridge.hidden = true;
    bridge.dataset.rpCareerReplaySession = String(sessionId);
    bridge.dataset.rpCareerReplayMode = mode === 'recap' ? 'recap' : 'watch';
    document.body.appendChild(bridge);
    bridge.click();
    setReplayDestinationMode(mode);
    setTimeout(() => bridge.remove(), 0);
  }

  function ensureOverallMvpStyles() {
    if (document.getElementById('rp-results-overall-mvp-authority-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-results-overall-mvp-authority-style';
    style.textContent = `
      .rp-update-mvp[data-rp-overall-mvp-pending="true"]{display:none!important}

      /* Only the trophy is interactive. The player name remains normal text. */
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-mvp{
        position:absolute!important;
      }
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-mvp-trophy-hit{
        position:absolute!important;
        z-index:12!important;
        left:0!important;
        top:0!important;
        width:14%!important;
        height:100%!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-radius:999px!important;
        background:transparent!important;
        color:transparent!important;
        cursor:pointer!important;
        appearance:none!important;
        -webkit-appearance:none!important;
        touch-action:manipulation;
      }
      .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-mvp-trophy-hit:focus-visible{
        outline:2px solid rgba(246,198,90,.92)!important;
        outline-offset:-2px!important;
        box-shadow:0 0 0 4px rgba(246,198,90,.12),0 0 18px rgba(246,198,90,.24)!important;
      }
      @media(hover:hover) and (pointer:fine){
        .rp-update-card.rp-update-result[data-update-id^="career-"][data-update-id$="-result"] .rp-update-mvp-trophy-hit:hover{
          box-shadow:inset 0 0 18px rgba(246,198,90,.08)!important;
        }
      }

      body.rp-mvp-explainer-open{overflow:hidden!important}
      .rp-mvp-explainer-overlay{
        position:fixed;
        z-index:2147483000;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:22px;
        background:rgba(0,3,8,.76);
        backdrop-filter:blur(16px);
        -webkit-backdrop-filter:blur(16px);
      }
      .rp-mvp-explainer-overlay[hidden]{display:none!important}
      .rp-mvp-explainer-card{
        position:relative;
        width:min(100%,420px);
        max-height:min(84dvh,620px);
        overflow:auto;
        box-sizing:border-box;
        padding:28px 24px 24px;
        border:1px solid transparent;
        border-radius:24px;
        color:#f7fbff;
        background:
          linear-gradient(155deg,rgba(7,14,24,.985),rgba(2,6,12,.99)) padding-box,
          linear-gradient(120deg,rgba(41,205,255,.82),rgba(255,255,255,.08) 48%,rgba(255,53,72,.72)) border-box;
        box-shadow:
          0 30px 80px rgba(0,0,0,.62),
          0 0 32px rgba(26,189,255,.10),
          0 0 30px rgba(255,45,65,.08),
          inset 0 1px 0 rgba(255,255,255,.04);
        text-align:center;
      }
      .rp-mvp-explainer-close{
        position:absolute;
        top:13px;
        right:13px;
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        border:1px solid rgba(255,255,255,.09);
        border-radius:50%;
        color:#a9b8c9;
        background:rgba(4,9,16,.86);
        font:900 1rem/1 Arial,sans-serif;
        cursor:pointer;
      }
      .rp-mvp-explainer-trophy{
        width:66px;
        height:66px;
        margin:4px auto 17px;
        display:grid;
        place-items:center;
        border:1px solid rgba(246,198,90,.42);
        border-radius:50%;
        background:radial-gradient(circle,rgba(246,198,90,.17),rgba(246,198,90,.035) 64%,transparent 66%);
        box-shadow:0 0 28px rgba(246,198,90,.16),inset 0 0 18px rgba(246,198,90,.06);
      }
      .rp-mvp-explainer-trophy::before{
        content:'';
        width:31px;
        height:31px;
        background:#f6c65a;
        -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M18 2H6v3H3v3c0 3.15 2.05 5.72 5 6.59V17H6v2h12v-2h-2v-2.41c2.95-.87 5-3.44 5-6.59V5h-3V2Zm-10 9.36C6.25 10.62 5 9.07 5 7V7h1v1c0 1.18.32 2.3.88 3.26.36.04.74.08 1.12.1ZM19 7v0c0 2.07-1.25 3.62-3 4.36.38-.02.76-.06 1.12-.1A6.47 6.47 0 0 0 18 8V7h1Zm-5 10h-4v-2h4v2Zm2-7c0 2.21-1.79 4-4 4s-4-1.79-4-4V4h8v6Z'/%3E%3C/svg%3E") center/contain no-repeat;
        mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M18 2H6v3H3v3c0 3.15 2.05 5.72 5 6.59V17H6v2h12v-2h-2v-2.41c2.95-.87 5-3.44 5-6.59V5h-3V2Zm-10 9.36C6.25 10.62 5 9.07 5 7V7h1v1c0 1.18.32 2.3.88 3.26.36.04.74.08 1.12.1ZM19 7v0c0 2.07-1.25 3.62-3 4.36.38-.02.76-.06 1.12-.1A6.47 6.47 0 0 0 18 8V7h1Zm-5 10h-4v-2h4v2Zm2-7c0 2.21-1.79 4-4 4s-4-1.79-4-4V4h8v6Z'/%3E%3C/svg%3E") center/contain no-repeat;
        filter:drop-shadow(0 0 8px rgba(246,198,90,.30));
      }
      .rp-mvp-explainer-kicker{
        display:block;
        margin:0 0 7px;
        color:#f6c65a;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:.60rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.16em;
        text-transform:uppercase;
      }
      .rp-mvp-explainer-name{
        margin:0;
        color:#f7fbff;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:clamp(1.45rem,7vw,2.15rem);
        font-style:italic;
        font-weight:950;
        line-height:.96;
        letter-spacing:.01em;
        text-transform:none;
        text-shadow:0 3px 14px rgba(0,0,0,.92);
      }
      .rp-mvp-explainer-game{
        margin:10px auto 0;
        color:#7f91a6;
        font-size:.62rem;
        font-weight:850;
        line-height:1.45;
        letter-spacing:.055em;
        text-transform:uppercase;
      }
      .rp-mvp-explainer-rule{
        margin:22px 0 0;
        padding:17px 16px;
        border:1px solid rgba(75,216,255,.16);
        border-radius:16px;
        background:linear-gradient(135deg,rgba(14,87,125,.12),rgba(5,10,17,.72));
        text-align:left;
      }
      .rp-mvp-explainer-rule strong{
        display:block;
        margin-bottom:7px;
        color:#55dcff;
        font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);
        font-size:.70rem;
        font-style:italic;
        font-weight:950;
        letter-spacing:.08em;
      }
      .rp-mvp-explainer-rule p{
        margin:0;
        color:#d0dbe6;
        font-size:.78rem;
        font-weight:650;
        line-height:1.55;
      }
      .rp-mvp-explainer-note{
        margin:14px 4px 0;
        color:#697b90;
        font-size:.60rem;
        font-weight:750;
        line-height:1.5;
      }
      @media(max-width:390px){
        .rp-mvp-explainer-overlay{padding:16px}
        .rp-mvp-explainer-card{padding:25px 19px 21px;border-radius:21px}
        .rp-mvp-explainer-trophy{width:60px;height:60px}
        .rp-mvp-explainer-trophy::before{width:28px;height:28px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMvpModal() {
    if (mvpModal?.isConnected) return mvpModal;
    const overlay = document.createElement('div');
    overlay.className = 'rp-mvp-explainer-overlay';
    overlay.dataset.rpMvpExplainerModal = 'true';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <section class="rp-mvp-explainer-card" role="dialog" aria-modal="true" aria-labelledby="rp-mvp-explainer-name">
        <button type="button" class="rp-mvp-explainer-close" data-rp-mvp-explainer-close aria-label="Close Game MVP explanation">×</button>
        <div class="rp-mvp-explainer-trophy" aria-hidden="true"></div>
        <span class="rp-mvp-explainer-kicker">OFFICIAL GAME MVP</span>
        <h2 class="rp-mvp-explainer-name" id="rp-mvp-explainer-name" data-rp-mvp-explainer-name>GAME MVP</h2>
        <p class="rp-mvp-explainer-game" data-rp-mvp-explainer-game></p>
        <div class="rp-mvp-explainer-rule">
          <strong>WHY IS THIS NAME HERE?</strong>
          <p data-rp-mvp-explainer-copy></p>
        </div>
        <p class="rp-mvp-explainer-note">This recognition belongs to this specific recorded game. It is separate from the player's overall rank or OVR.</p>
      </section>`;
    document.body.appendChild(overlay);

    overlay.querySelector('[data-rp-mvp-explainer-close]')?.addEventListener('click', closeMvpExplainer);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeMvpExplainer();
    });
    mvpModal = overlay;
    return mvpModal;
  }

  function closeMvpExplainer() {
    if (!mvpModal) return;
    mvpModal.hidden = true;
    mvpModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-mvp-explainer-open');
    const returnFocus = mvpModalReturnFocus;
    mvpModalReturnFocus = null;
    try { returnFocus?.focus?.({ preventScroll: true }); } catch (_error) {}
  }

  function openMvpExplainer(card, trigger) {
    const block = card?.querySelector('.rp-update-mvp');
    const name = String(block?.querySelector('strong')?.textContent || '').trim();
    if (!name) return;

    const modal = ensureMvpModal();
    const title = String(card?.querySelector('h2')?.textContent || '').trim();
    const scoreValues = [...(card?.querySelectorAll('.rp-update-score > div strong') || [])]
      .map((node) => String(node.textContent || '').trim())
      .filter(Boolean);
    const score = scoreValues.length === 2 ? `WEST ${scoreValues[0]} · EAST ${scoreValues[1]}` : '';

    const nameNode = modal.querySelector('[data-rp-mvp-explainer-name]');
    const gameNode = modal.querySelector('[data-rp-mvp-explainer-game]');
    const copyNode = modal.querySelector('[data-rp-mvp-explainer-copy]');
    if (nameNode) nameNode.textContent = name;
    if (gameNode) gameNode.textContent = [title, score].filter(Boolean).join('  ·  ');
    if (copyNode) {
      copyNode.textContent = `${name} is the player officially recorded by Real Play as the Game MVP for this game. The trophy marks that game-specific recognition.`;
    }

    mvpModalReturnFocus = trigger || null;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-mvp-explainer-open');
    window.requestAnimationFrame(() => modal.querySelector('[data-rp-mvp-explainer-close]')?.focus?.({ preventScroll: true }));
  }

  function ensureMvpButton(block, name) {
    if (!block || !name) return;
    let button = block.querySelector('[data-rp-mvp-explainer]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-update-mvp-trophy-hit';
      button.dataset.rpMvpExplainer = 'true';
      block.insertBefore(button, block.firstChild);
    }
    button.setAttribute('aria-label', `Why ${name} is the Game MVP`);
    button.title = 'About this Game MVP';
  }

  function setOverallMvp(card, name) {
    if (!card || !name) return;
    let block = card.querySelector('.rp-update-mvp');
    if (!block) {
      const score = card.querySelector('.rp-update-score');
      if (!score) return;
      block = document.createElement('div');
      block.className = 'rp-update-mvp';
      block.innerHTML = '<span>GAME MVP</span><strong></strong>';
      score.insertAdjacentElement('afterend', block);
    }
    const nameNode = block.querySelector('strong');
    if (!nameNode) return;
    nameNode.textContent = name;
    ensureMvpButton(block, name);
    block.dataset.rpOverallMvpPending = 'false';
    block.dataset.rpOverallMvpVerified = 'true';
    block.setAttribute('aria-label', `Overall MVP: ${name}`);
  }

  function mvpNameFromUpdate(update) {
    const mvp = update?.metadata?.gameMvp || update?.metadata?.game_mvp || null;
    return String(
      mvp?.playerName
      || mvp?.player_name
      || mvp?.displayName
      || mvp?.display_name
      || mvp?.name
      || ''
    ).trim();
  }

  function localOverallMvp(sessionId) {
    const updates = window.RealPlayUpdates?.getUpdates?.();
    if (!Array.isArray(updates) || !updates.length) return '';
    const result = updates.find((item) => (
      String(item?.category || '').toLowerCase() === 'result'
      && Number(item?.metadata?.sessionId || 0) === Number(sessionId)
    ));
    return mvpNameFromUpdate(result);
  }

  async function loadOfficialMvpFeed() {
    const now = Date.now();
    if (officialMvpFeedCache.size && now - officialMvpFeedCachedAt < OFFICIAL_MVP_FEED_TTL_MS) {
      return officialMvpFeedCache;
    }
    if (now < officialMvpFeedRetryAt) return officialMvpFeedCache;
    if (officialMvpFeedPromise) return officialMvpFeedPromise;

    officialMvpFeedPromise = (async () => {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        officialMvpFeedRetryAt = Date.now() + OFFICIAL_MVP_RETRY_BACKOFF_MS;
        return officialMvpFeedCache;
      }

      const payload = await response.json().catch(() => ({}));
      const next = new Map();
      (Array.isArray(payload?.updates) ? payload.updates : [])
        .filter((item) => String(item?.category || '').toLowerCase() === 'result')
        .forEach((item) => {
          const id = Number(item?.metadata?.sessionId || 0);
          const name = mvpNameFromUpdate(item);
          if (Number.isSafeInteger(id) && id > 0 && name) next.set(id, name);
        });

      officialMvpFeedCache = next;
      officialMvpFeedCachedAt = Date.now();
      officialMvpFeedRetryAt = 0;
      return officialMvpFeedCache;
    })().catch(() => {
      officialMvpFeedRetryAt = Date.now() + OFFICIAL_MVP_RETRY_BACKOFF_MS;
      return officialMvpFeedCache;
    }).finally(() => {
      officialMvpFeedPromise = null;
    });

    return officialMvpFeedPromise;
  }

  // One finalized game has one authoritative Game MVP. Prefer the result payload
  // already loaded by RealPlayUpdates so 38 result cards do not make 38 copies
  // of the same public-updates request. The network path is only a batched,
  // cached fallback and backs off after rate-limit/error responses.
  async function fetchOverallMvp(sessionId) {
    const local = localOverallMvp(sessionId);
    if (local) return local;
    const mvps = await loadOfficialMvpFeed();
    return String(mvps.get(Number(sessionId)) || '').trim();
  }

  function hydrateCard(card) {
    if (!card || !card.isConnected) return;
    const sessionId = sessionIdFromCard(card);
    if (!sessionId) return;
    ensureOverallMvpStyles();

    const block = card.querySelector('.rp-update-mvp');
    if (block?.dataset.rpOverallMvpVerified === 'true') {
      const name = String(block.querySelector('strong')?.textContent || '').trim();
      if (name) ensureMvpButton(block, name);
      return;
    }
    if (block) block.dataset.rpOverallMvpPending = 'true';

    const existing = hydrationRequests.get(sessionId);
    const request = existing || fetchOverallMvp(sessionId);
    if (!existing) hydrationRequests.set(sessionId, request);

    request.then((name) => {
      if (name) setOverallMvp(card, name);
    }).catch(() => {
      // Never replace the official MVP with a browser-side guess. If official
      // result metadata cannot load, keep the MVP strip hidden until it can.
    }).finally(() => {
      if (!existing) hydrationRequests.delete(sessionId);
    });
  }

  function hydrateResultCards() {
    document.querySelectorAll('[data-rp-updates] .rp-update-card.rp-update-result[data-update-id]').forEach(hydrateCard);
  }

  function installOverallMvpAuthority() {
    ensureOverallMvpStyles();
    ensureMvpModal();
    const observer = new MutationObserver(hydrateResultCards);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    hydrateResultCards();
  }

  document.addEventListener('click', (event) => {
    const trophy = event.target.closest?.('[data-rp-mvp-explainer]');
    if (trophy) {
      const card = trophy.closest('.rp-update-card.rp-update-result');
      if (!card) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openMvpExplainer(card, trophy);
      return;
    }

    if (event.target.closest('[data-update-delete]')) return;

    const recapButton = event.target.closest?.('[data-rp-world-game-recap]');
    const watchButton = event.target.closest?.('[data-rp-world-watch]');
    const explicitAction = recapButton || watchButton;
    if (explicitAction) {
      const card = explicitAction.closest('.rp-update-card.rp-update-result');
      const sessionId = sessionIdFromCard(card);
      if (!sessionId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openReplay(sessionId, recapButton ? 'recap' : 'watch');
      return;
    }

    const card = event.target.closest('.rp-update-card.rp-update-result');
    if (!card) return;

    // WORLD cards are informational surfaces now. Only their explicit footer
    // controls navigate; tapping score, logos, MVP rows or empty card space
    // must do nothing.
    if (card.closest('[data-rp-updates].rp-world-results-entry')) return;

    const sessionId = sessionIdFromCard(card);
    if (!sessionId) return;
    event.preventDefault();
    openReplay(sessionId, 'watch');
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mvpModal && !mvpModal.hidden) {
      event.preventDefault();
      closeMvpExplainer();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installOverallMvpAuthority, { once: true });
  } else {
    installOverallMvpAuthority();
  }
})();
