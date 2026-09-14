(() => {
  if (window.__realPlayReplayMarkerCleanupInstalled) return;
  window.__realPlayReplayMarkerCleanupInstalled = true;

  const style = document.createElement('style');
  style.textContent = `
    .rp-career-replay-score-pop{
      left:auto!important;
      right:10px!important;
      bottom:10px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:0!important;
      width:auto!important;
      max-width:calc(100% - 20px)!important;
      min-height:30px;
      padding:6px 9px!important;
      border:1px solid rgba(94,226,247,.28)!important;
      border-radius:9px!important;
      background:linear-gradient(105deg,rgba(3,18,27,.9),rgba(5,35,47,.86))!important;
      box-shadow:0 8px 24px rgba(0,0,0,.3)!important;
      backdrop-filter:blur(9px)!important;
      -webkit-backdrop-filter:blur(9px)!important;
      transform:translateY(6px)!important;
      box-sizing:border-box;
    }
    .rp-career-replay-score-pop.show{
      transform:translateY(0)!important;
    }
    .rp-career-replay-score-pop>small{
      display:none!important;
    }
    .rp-career-replay-score-pop>div{
      display:contents!important;
    }
    .rp-career-replay-score-pop [data-rp-career-score-detail]{
      order:1;
      margin:0!important;
      color:#70dfee!important;
      font-size:.5rem!important;
      font-weight:950!important;
      line-height:1!important;
      letter-spacing:.08em!important;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .rp-career-replay-score-pop [data-rp-career-score-detail]::after{
      content:' · ';
      margin:0 .28rem;
      color:#6f8f9c;
    }
    .rp-career-replay-score-pop [data-rp-career-score-name]{
      order:2;
      min-width:0;
      max-width:190px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      color:#f4fbff!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.72rem!important;
      font-style:italic!important;
      font-weight:950!important;
      line-height:1!important;
    }
    .rp-career-replay-score-pop [data-rp-career-score-name]::after{
      content:' · ';
      margin:0 .28rem;
      color:#6f8f9c;
      font-style:normal;
    }
    .rp-career-replay-score-pop [data-rp-career-score-value]{
      order:3;
      grid-column:auto!important;
      grid-row:auto!important;
      color:#7cf2d0!important;
      font-family:var(--rp-display,Arial,sans-serif)!important;
      font-size:.82rem!important;
      font-style:italic!important;
      font-weight:950!important;
      line-height:1!important;
      white-space:nowrap;
    }
    .rp-replay-open-rank-edit{
      width:38px;height:38px;display:grid;place-items:center;justify-self:end;
      border:1px solid rgba(85,197,229,.22);border-radius:11px;background:#061722;
      color:#a7edf6;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.2);
      font-family:var(--rp-display,Arial,sans-serif);font-size:.72rem;font-weight:950;
      letter-spacing:-.02em;
    }
    .rp-replay-open-rank-edit:hover{border-color:rgba(85,224,245,.5);background:#082331;color:#d9fbff}
    .rp-replay-open-rank-edit:active{transform:scale(.96)}
    .rp-replay-open-rank-edit:disabled{opacity:.5;cursor:wait}
    @media(max-width:620px){
      .rp-career-replay-score-pop{
        right:8px!important;
        bottom:8px!important;
        max-width:calc(100% - 16px)!important;
        min-height:28px;
        padding:5px 8px!important;
        border-radius:8px!important;
      }
      .rp-career-replay-score-pop [data-rp-career-score-detail]{font-size:.46rem!important}
      .rp-career-replay-score-pop [data-rp-career-score-name]{max-width:165px;font-size:.66rem!important}
      .rp-career-replay-score-pop [data-rp-career-score-value]{font-size:.76rem!important}
    }
  `;
  document.head.appendChild(style);

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function cleanMarker(marker) {
    if (!marker) return;
    const timestamp = marker.querySelector('small');
    if (!timestamp) return;
    const clean = formatTime(Number(marker.dataset.rpCareerReplayMarker || 0));
    if (timestamp.textContent !== clean) timestamp.textContent = clean;
  }

  function cleanMarkers(root = document) {
    root.querySelectorAll?.('[data-rp-career-replay-marker]').forEach(cleanMarker);
  }

  function cleanScorePop(pop) {
    if (!pop) return;
    const detail = pop.querySelector('[data-rp-career-score-detail]');
    if (!detail) return;
    const team = String(detail.textContent || '').split('·')[0].trim().toUpperCase();
    if (team && detail.textContent !== team) detail.textContent = team;
  }

  function cleanScorePops(root = document) {
    if (root.matches?.('[data-rp-career-score-pop]')) cleanScorePop(root);
    root.querySelectorAll?.('[data-rp-career-score-pop]').forEach(cleanScorePop);
  }

  function cleanReplayUi(root = document) {
    cleanMarkers(root);
    cleanScorePops(root);
  }

  function cleanScorePopFromMutationTarget(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    const pop = element?.closest?.('[data-rp-career-score-pop]');
    if (pop) cleanScorePop(pop);
  }

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  let replaySessionId = 0;
  let renumberBusy = false;

  function replayRoot() {
    return document.querySelector('[data-rp-career-replay].open');
  }

  function visibleReplayNumber() {
    const title = String(replayRoot()?.querySelector('[data-rp-career-replay-title]')?.textContent || '');
    const match = title.match(/OPEN\s+RANK(?:ING\s+SESSION)?\s*#\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function canonicalReplayTitle(number) {
    return `OPEN RANKING SESSION #${String(number).padStart(3, '0')}`;
  }

  function applyReplayTitle(number) {
    const root = replayRoot();
    if (!root) return;
    const title = canonicalReplayTitle(number);
    const header = root.querySelector('[data-rp-career-replay-title]');
    const gameHead = root.querySelector('.rp-career-replay-gamehead h2');
    const brand = root.querySelector('[data-rp-career-replay-brand-session]');
    if (header) header.textContent = title;
    if (gameHead) gameHead.textContent = title;
    if (brand) brand.textContent = title;
  }

  async function renumberReplay(button) {
    if (renumberBusy || window.__realPlayAdminVerified !== true) return;
    const sessionId = Number(button?.dataset?.rpReplayOpenRankEdit || replaySessionId || 0);
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) {
      window.alert('Real Play could not identify this game session. Close the replay, reopen it, and try again.');
      return;
    }

    const current = visibleReplayNumber();
    const proposed = window.prompt(
      'Set the official Open Rank number for this game:',
      current ? String(current) : ''
    );
    if (proposed === null) return;

    const value = Number(String(proposed).trim());
    if (!Number.isSafeInteger(value) || value < 1 || value > 999999) {
      window.alert('Enter a whole Open Rank number from 1 to 999999.');
      return;
    }

    const auth = localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) {
      window.alert('Admin session is not available. Sign in again and try once more.');
      return;
    }

    renumberBusy = true;
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = '…';
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({
          action: 'set-open-rank-number',
          sessionId,
          openRankNumber: value,
        }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Could not change this Open Rank number (${response.status}).`);
      }

      const saved = Number(data?.control?.renumberedSession?.openRankNumber ?? value);
      if (!Number.isSafeInteger(saved) || saved < 1) {
        throw new Error('The backend did not return the saved Open Rank number.');
      }

      replaySessionId = sessionId;
      applyReplayTitle(saved);
      button.textContent = '✓';
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = '#';
      }, 1100);
    } catch (error) {
      window.alert(error?.message || 'Could not change this Open Rank number.');
      button.textContent = oldText;
    } finally {
      renumberBusy = false;
      button.disabled = false;
    }
  }

  function syncReplayNumberEditor() {
    const root = replayRoot();
    if (!root) return;
    const topbar = root.querySelector('.rp-career-replay-topbar');
    if (!topbar) return;

    let button = topbar.querySelector('[data-rp-replay-open-rank-edit]');
    const shouldShow = window.__realPlayAdminVerified === true && replaySessionId > 0;
    if (!shouldShow) {
      button?.remove();
      return;
    }

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-replay-open-rank-edit';
      button.dataset.rpReplayOpenRankEdit = String(replaySessionId);
      button.setAttribute('aria-label', 'Edit Open Rank session number');
      button.setAttribute('title', 'Edit Open Rank session number');
      button.textContent = '#';
      const pencil = topbar.querySelector('[data-rp-replay-admin-edit]');
      if (pencil) topbar.insertBefore(button, pencil);
      else topbar.appendChild(button);
      button.addEventListener('click', () => renumberReplay(button));
    } else {
      button.dataset.rpReplayOpenRankEdit = String(replaySessionId);
    }
  }

  document.addEventListener('click', (event) => {
    const replayTrigger = event.target.closest?.('[data-rp-career-replay-session]');
    if (replayTrigger) {
      const id = Number(replayTrigger.dataset.rpCareerReplaySession || 0);
      if (Number.isSafeInteger(id) && id > 0) replaySessionId = id;
      window.setTimeout(syncReplayNumberEditor, 140);
    }
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      cleanScorePopFromMutationTarget(mutation.target);

      if (mutation.target instanceof Element) cleanReplayUi(mutation.target);

      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          cleanReplayUi(node);
          cleanScorePopFromMutationTarget(node);
        } else {
          cleanScorePopFromMutationTarget(node);
        }
      }
    }
    syncReplayNumberEditor();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.setInterval(syncReplayNumberEditor, 700);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      cleanReplayUi();
      syncReplayNumberEditor();
    }, { once: true });
  } else {
    cleanReplayUi();
    syncReplayNumberEditor();
  }
})();