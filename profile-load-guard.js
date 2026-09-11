(() => {
  if (window.__rpProfileLoadGuard) return;
  window.__rpProfileLoadGuard = true;

  const API = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const PREVIEW_LIMIT = 3;
  const originalFetch = window.fetch.bind(window);
  let archive = null;
  let allGames = [];
  let resultFilter = 'all';
  let modeFilter = 'all';

  const urlOf = (input) => typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
  const profileIsOpen = () => Boolean(document.querySelector('[data-rp-profile].open'));
  const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const esc = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function releaseFocus(container = null) {
    const active = document.activeElement;
    if (!active || active === document.body || (container && !container.contains(active))) return;
    try { active.blur?.(); } catch (_) {}
  }

  function closeCompetingOverlay(selector, closeSelector, bodyClass = '') {
    const overlay = document.querySelector(selector);
    if (!overlay?.classList.contains('open')) return;
    releaseFocus(overlay);
    const close = overlay.querySelector(closeSelector);
    if (close) return close.click();
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    if (bodyClass) document.body.classList.remove(bodyClass);
  }

  function closeArchive() {
    if (!archive) return;
    releaseFocus(archive);
    archive.classList.remove('open');
    archive.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-history-open');
  }

  function prepareProfileOpen() {
    closeArchive();
    closeCompetingOverlay('[data-rp-career-replay]', '[data-rp-career-replay-close]', 'rp-career-replay-open');
    closeCompetingOverlay('[data-rp-updates]', '[data-updates-close]', 'rp-updates-open');
    closeCompetingOverlay('.rp-admin-control', '[data-admin-exit]', 'rp-admin-open');
    closeCompetingOverlay('.rp-public-player-profile, [data-rp-public-profile]', '[data-rp-public-profile-close], [data-rp-player-profile-close], [data-rp-profile-close]');
    releaseFocus();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-main-action="profile"], [data-rp-open-profile]')) prepareProfileOpen();
  }, true);

  window.addEventListener('focus', (event) => {
    if (!profileIsOpen()) return;
    event.stopImmediatePropagation();
  }, true);

  window.fetch = function guardedRealPlayFetch(input, init = {}) {
    const isOptionalTeamState = profileIsOpen() && /\/api\/real-play\/3v3\/me(?:\?|$)/.test(urlOf(input));
    if (!isOptionalTeamState) return originalFetch(input, init);
    const controller = new AbortController();
    let callerAbort = null;
    if (init.signal) {
      if (init.signal.aborted) controller.abort();
      else {
        callerAbort = () => controller.abort();
        init.signal.addEventListener('abort', callerAbort, { once: true });
      }
    }
    const timer = setTimeout(() => controller.abort(), 900);
    return originalFetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      if (init.signal && callerAbort) init.signal.removeEventListener('abort', callerAbort);
    });
  };

  function modeKey(game) {
    const mode = String(pick(game?.mode, game?.gameMode, game?.game_mode, 'ranking')).trim().toLowerCase();
    if (['ranking','open-rank','open_rank','open rank'].includes(mode)) return 'open-rank';
    if (['3v3','three-v-three','three_v_three'].includes(mode)) return '3v3';
    if (['5v5','five-v-five','full-court','full_court'].includes(mode)) return '5v5';
    return mode || 'other';
  }
  const modeLabel = (mode) => mode === 'open-rank' ? 'OPEN RANK' : mode === '3v3' ? '3V3' : mode === '5v5' ? '5V5 / FULL COURT' : String(mode).replaceAll('-',' ').replaceAll('_',' ').toUpperCase();
  const sessionId = (game) => { const id = Number(pick(game?.sessionId, game?.session_id, game?.id)); return Number.isSafeInteger(id) && id > 0 ? id : null; };
  const resultOf = (game) => String(game?.result || 'FINAL').toUpperCase();
  const side = (game, key) => String((game?.teamLabels || game?.team_labels || {})[key] || key).toUpperCase();
  const score = (game, key) => num(key === 'east' ? pick(game?.eastScore, game?.east_score) : pick(game?.westScore, game?.west_score));

  function labelOf(game) {
    if (game?.displayLabel || game?.officialGameId || game?.official_game_id) return String(game.displayLabel || game.officialGameId || game.official_game_id);
    const number = Number(pick(game?.openRankNumber, game?.open_rank_number));
    if (number > 0) return `OPEN RANK #${String(number).padStart(3,'0')}`;
    return String(game?.label || `OFFICIAL GAME #${sessionId(game) || ''}`);
  }

  function dateOf(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', { month:'short', day:'numeric', year:'numeric', timeZone:'Asia/Manila' }).format(date).toUpperCase();
  }

  function installStyles() {
    if (document.querySelector('[data-rp-history-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHistoryStyle = '1';
    style.textContent = `
      .rp-profile-history>.rp-profile-game[data-rp-preview-hidden="1"]{display:none!important}
      .rp-history-more{width:100%;min-height:46px;margin-top:2px;border:1px solid rgba(55,202,255,.22);border-radius:13px;color:#54d9ff;background:rgba(13,78,119,.09);font-family:var(--rp-display,Impact,sans-serif);font-size:.56rem;font-weight:950;letter-spacing:.09em;cursor:pointer}
      body.rp-history-open{overflow:hidden}.rp-history-overlay{position:fixed;z-index:675;inset:0;display:none;overflow-y:auto;color:#f7fbff;background:radial-gradient(70% 42% at -8% 12%,rgba(8,108,255,.18),transparent 72%),radial-gradient(62% 40% at 108% 40%,rgba(255,32,40,.10),transparent 74%),linear-gradient(180deg,#02050a,#010205 58%,#000);font-family:var(--rp-body,Arial,sans-serif)}.rp-history-overlay.open{display:block}
      .rp-history-shell{width:min(100%,620px);min-height:100%;margin:auto;padding:0 16px 36px}.rp-history-head{position:sticky;top:0;z-index:4;min-height:66px;margin:0 -16px;padding:10px 16px;display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.065);background:rgba(2,4,9,.96);backdrop-filter:blur(18px)}
      .rp-history-back{width:40px;height:40px;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;background:#080d15;font-size:1.05rem}.rp-history-head strong{display:block;font-family:var(--rp-display,Impact,sans-serif);font-style:italic;font-size:1.05rem;letter-spacing:.08em}.rp-history-head span{display:block;margin-top:2px;color:#617084;font-size:.48rem;font-weight:900;letter-spacing:.12em}.rp-history-count{padding:6px 8px;border:1px solid rgba(40,195,255,.18);border-radius:999px;color:#4fdcff;background:rgba(18,109,255,.08);font-size:.46rem;letter-spacing:.08em}
      .rp-history-filters{display:grid;gap:9px;padding:18px 0 12px}.rp-history-results{display:flex;gap:7px}.rp-history-filter{min-height:34px;padding:0 12px;border:1px solid rgba(255,255,255,.09);border-radius:999px;color:#7c899a;background:#070c14;font-family:var(--rp-display,Impact,sans-serif);font-size:.48rem;font-weight:950;letter-spacing:.08em}.rp-history-filter.active{border-color:rgba(69,211,255,.38);color:#58dbff;background:rgba(17,110,174,.13)}.rp-history-mode{width:100%;min-height:42px;padding:0 12px;border:1px solid rgba(255,255,255,.09);border-radius:12px;color:#c6d0dc;background:#070c14;font-size:.62rem;font-weight:850}
      .rp-history-list{display:grid;gap:10px}.rp-history-list.rp-profile-history{margin-top:0;padding:0;border:0;background:none;box-shadow:none}.rp-history-status{padding:32px 16px;border:1px dashed rgba(255,255,255,.09);border-radius:16px;color:#68798d;background:#050910;text-align:center;font-size:.56rem;font-weight:900;letter-spacing:.04em}
      @media(max-width:380px){.rp-history-shell{padding-inline:12px}.rp-history-head{margin-inline:-12px;padding-inline:12px;grid-template-columns:42px 1fr}.rp-history-count{display:none}}
    `;
    document.head.appendChild(style);
  }

  function syncPreview() {
    const history = document.querySelector('[data-rp-profile] .rp-profile-history');
    if (!history) return;
    const cards = [...history.querySelectorAll(':scope > .rp-profile-game')];
    cards.forEach((card, index) => index >= PREVIEW_LIMIT ? card.dataset.rpPreviewHidden = '1' : delete card.dataset.rpPreviewHidden);
    let more = history.querySelector(':scope > [data-rp-history-more]');
    if (cards.length > PREVIEW_LIMIT && !more) {
      more = document.createElement('button');
      more.type = 'button'; more.className = 'rp-history-more'; more.dataset.rpHistoryMore = '1'; more.textContent = 'SEE ALL GAMES  →';
      history.appendChild(more);
    } else if (cards.length <= PREVIEW_LIMIT) more?.remove();
  }

  function makeArchive() {
    if (archive) return archive;
    archive = document.createElement('section');
    archive.className = 'rp-history-overlay'; archive.dataset.rpHistoryOverlay = '1'; archive.setAttribute('aria-hidden','true');
    archive.innerHTML = `<div class="rp-history-shell"><header class="rp-history-head"><button class="rp-history-back" type="button" data-rp-history-close>←</button><div><strong>GAME HISTORY</strong><span>YOUR REAL PLAY RECORD</span></div><b class="rp-history-count" data-rp-history-count>0 GAMES</b></header><div class="rp-history-filters"><div class="rp-history-results"><button class="rp-history-filter active" type="button" data-rp-result="all">ALL</button><button class="rp-history-filter" type="button" data-rp-result="win">WINS</button><button class="rp-history-filter" type="button" data-rp-result="loss">LOSSES</button></div><select class="rp-history-mode" data-rp-mode><option value="all">ALL GAME TYPES</option></select></div><div class="rp-history-list rp-profile-history" data-rp-history-list></div></div>`;
    document.body.appendChild(archive);
    archive.querySelector('[data-rp-history-close]').addEventListener('click', closeArchive);
    archive.querySelectorAll('[data-rp-result]').forEach((button) => button.addEventListener('click', () => {
      resultFilter = button.dataset.rpResult;
      archive.querySelectorAll('[data-rp-result]').forEach((item) => item.classList.toggle('active', item === button));
      renderArchive();
    }));
    archive.querySelector('[data-rp-mode]').addEventListener('change', (event) => { modeFilter = event.target.value; renderArchive(); });
    return archive;
  }

  function gameMarkup(game) {
    const result = resultOf(game), id = sessionId(game);
    const resultClass = result === 'WIN' ? 'win' : result === 'LOSS' ? 'loss' : 'final';
    const meta = [dateOf(pick(game?.finalizedAt,game?.finalized_at,game?.startsAt,game?.starts_at)), String(pick(game?.locationName,game?.location_name,'')).toUpperCase(), modeLabel(modeKey(game))].filter(Boolean).join(' · ');
    return `<details class="rp-profile-game"${id ? ` data-rp-profile-game-session="${id}"` : ''}><summary class="rp-profile-game-summary"><div class="rp-profile-game-main"><strong>${esc(labelOf(game))}</strong><span>${esc(meta)}</span></div><b class="${resultClass}">${esc(result)}</b><div class="rp-profile-game-score"><span>${esc(side(game,'east'))}</span><strong>${score(game,'east')}</strong><i>—</i><strong>${score(game,'west')}</strong><span>${esc(side(game,'west'))}</span></div><div class="rp-profile-game-stats"><span>${num(pick(game?.pts,game?.points))} PTS</span><span>${num(pick(game?.ast,game?.assists))} AST</span><span>${num(pick(game?.reb,game?.rebounds))} REB</span><span>${num(pick(game?.tov,game?.to,game?.turnovers))} TO</span></div><div class="rp-profile-game-open-hint"><span>VIEW GAME</span><b>›</b></div></summary></details>`;
  }

  function renderArchive(status = '') {
    const root = archive?.querySelector('[data-rp-history-list]'), count = archive?.querySelector('[data-rp-history-count]');
    if (!root || !count) return;
    if (status) { root.innerHTML = `<div class="rp-history-status">${esc(status)}</div>`; count.textContent = '…'; return; }
    const games = allGames.filter((game) => (resultFilter === 'all' || resultOf(game).toLowerCase() === resultFilter) && (modeFilter === 'all' || modeKey(game) === modeFilter));
    count.textContent = `${games.length} GAME${games.length === 1 ? '' : 'S'}`;
    root.innerHTML = games.length ? games.map(gameMarkup).join('') : '<div class="rp-history-status">NO GAMES MATCH THIS FILTER.</div>';
  }

  async function openArchive() {
    makeArchive();
    resultFilter = 'all'; modeFilter = 'all';
    archive.querySelectorAll('[data-rp-result]').forEach((b) => b.classList.toggle('active', b.dataset.rpResult === 'all'));
    archive.classList.add('open'); archive.setAttribute('aria-hidden','false'); document.body.classList.add('rp-history-open'); archive.scrollTop = 0;
    renderArchive('LOADING COMPLETE GAME HISTORY…');
    try {
      const token = localStorage.getItem(TOKEN_KEY) || '';
      if (!token) throw new Error('PLEASE SIGN IN TO REAL PLAY FIRST.');
      const response = await originalFetch(`${API}/api/real-play/me`, { headers:{ Accept:'application/json', Authorization:`Bearer ${token}` }, cache:'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'COULD NOT LOAD GAME HISTORY.');
      allGames = Array.isArray(data?.recentGames) ? data.recentGames : Array.isArray(data?.recent_games) ? data.recent_games : [];
      const modes = [...new Set(allGames.map(modeKey))];
      const select = archive.querySelector('[data-rp-mode]');
      select.innerHTML = '<option value="all">ALL GAME TYPES</option>' + modes.map((mode) => `<option value="${esc(mode)}">${esc(modeLabel(mode))}</option>`).join('');
      select.value = 'all';
      renderArchive();
    } catch (error) {
      allGames = [];
      renderArchive(error.message || 'COULD NOT LOAD GAME HISTORY.');
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-rp-history-more]')) { event.preventDefault(); event.stopImmediatePropagation(); openArchive(); return; }
    if (archive?.classList.contains('open') && event.target.closest('.rp-history-list .rp-profile-game')) closeArchive();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && archive?.classList.contains('open')) { event.preventDefault(); event.stopImmediatePropagation(); closeArchive(); }
  }, true);

  installStyles(); syncPreview();
  new MutationObserver((mutations) => {
    if (mutations.some((m) => [...m.addedNodes].some((node) => node.nodeType === 1))) requestAnimationFrame(syncPreview);
  }).observe(document.documentElement, { childList:true, subtree:true });
})();