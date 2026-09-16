(() => {
  if (window.__realPlayRankExplainerInstalled) return;
  window.__realPlayRankExplainerInstalled = true;

  const AUTHORITY_TTL_MS = 30_000;
  let authorityCache = null;
  let authorityLoadedAt = 0;
  let authorityPromise = null;
  let modal = null;
  let scheduled = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function numeric(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-rank-explainer-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpRankExplainerStyles = 'true';
    style.textContent = `
      .rp-profile-rank{position:relative}
      .rp-rank-info{
        position:absolute;top:8px;right:8px;z-index:4;width:22px;height:22px;display:grid;place-items:center;padding:0;
        border:1px solid rgba(86,218,255,.28);border-radius:50%;color:#65dcff;background:rgba(16,92,132,.14);
        font-family:Arial,sans-serif;font-size:.68rem;font-weight:900;font-style:normal;line-height:1;cursor:pointer;
        transition:border-color .16s ease,background .16s ease,transform .16s ease,color .16s ease;
      }
      .rp-rank-info:hover{border-color:rgba(99,226,255,.62);background:rgba(31,145,196,.2);color:#b7f2ff;transform:scale(1.06)}
      .rp-rank-info:active{transform:scale(.95)}
      .rp-rank-info:focus-visible{outline:2px solid #72e6ff;outline-offset:2px}

      .rp-rank-explainer{position:fixed;inset:0;z-index:2147483200;display:none;place-items:center;padding:18px;background:rgba(0,3,7,.86);backdrop-filter:blur(12px)}
      .rp-rank-explainer.open{display:grid}
      .rp-rank-explainer-card{position:relative;width:min(100%,460px);max-height:min(88dvh,760px);overflow:auto;padding:22px;border:1px solid rgba(255,255,255,.13);border-radius:24px;color:#f3f8ff;background:radial-gradient(circle at 50% 0%,rgba(49,190,240,.13),transparent 35%),linear-gradient(180deg,#08111a,#03070d 72%);box-shadow:0 32px 90px rgba(0,0,0,.74),inset 0 1px 0 rgba(255,255,255,.055)}
      .rp-rank-explainer-card::before{content:'';position:absolute;left:18%;right:18%;top:0;height:2px;background:linear-gradient(90deg,transparent,#58ddff,transparent)}
      .rp-rank-explainer-close{position:sticky;float:right;top:0;z-index:5;width:36px;height:36px;margin:-4px -4px 0 8px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:50%;color:#c4d1dd;background:#0b1520;font-size:1.08rem;font-weight:900;line-height:1;cursor:pointer}
      .rp-rank-explainer-kicker{margin:2px 0 5px;color:#51d9ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.5rem;font-weight:1000;letter-spacing:.14em;text-transform:uppercase}
      .rp-rank-explainer h2{margin:0;font-family:var(--rp-display,Arial,sans-serif);font-size:1.35rem;font-style:italic;font-weight:1000;letter-spacing:.018em;text-transform:uppercase}
      .rp-rank-explainer-player{margin:14px 0 12px;color:#7890a5;font-size:.56rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .rp-rank-receipt{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}
      .rp-rank-receipt>div{padding:13px 10px;border:1px solid rgba(80,218,255,.13);border-radius:13px;background:rgba(7,18,27,.8);text-align:center}
      .rp-rank-receipt strong{display:block;color:#eefaff;font-family:var(--rp-display,Arial,sans-serif);font-size:1.18rem;font-style:italic;font-weight:1000}
      .rp-rank-receipt>div:first-child strong{color:#62ddff}
      .rp-rank-receipt small{display:block;margin-top:4px;color:#63778b;font-size:.4rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
      .rp-rank-explainer-copy{margin:0;color:#a9bac9;font-size:.7rem;font-weight:650;line-height:1.62}
      .rp-rank-explainer-copy strong{color:#eef8ff;font-weight:900}
      .rp-rank-formula{margin-top:13px;padding:12px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(255,255,255,.025)}
      .rp-rank-formula b{display:block;margin-bottom:7px;color:#dff7ff;font-size:.55rem;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}
      .rp-rank-formula p{margin:0;color:#8396a8;font-size:.61rem;line-height:1.55}
      .rp-rank-neighbor{margin-top:12px;padding:10px 11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;color:#7f91a3;background:rgba(2,8,13,.72);font-size:.56rem;line-height:1.45;text-align:center}
      .rp-rank-neighbor strong{color:#d8eaf6}
      .rp-rank-note{margin:11px 0 0;color:#607589;font-size:.54rem;line-height:1.5;text-align:center}
      .rp-rank-loading{padding:28px 4px;color:#6c8195;font-size:.62rem;font-weight:900;letter-spacing:.08em;text-align:center}
      @media(max-width:420px){.rp-rank-explainer-card{padding:19px 16px;border-radius:20px}.rp-rank-receipt{gap:7px}.rp-rank-info{top:7px;right:7px;width:21px;height:21px}}
    `;
    document.head.appendChild(style);
  }

  async function loadAuthority(force = false) {
    const now = Date.now();
    if (!force && authorityCache && now - authorityLoadedAt < AUTHORITY_TTL_MS) return authorityCache;
    if (authorityPromise) return authorityPromise;

    authorityPromise = (async () => {
      try {
        if (window.RealPlayWorld?.community) {
          const data = await window.RealPlayWorld.community('players');
          authorityCache = data || null;
          authorityLoadedAt = Date.now();
          return authorityCache;
        }

        const response = await fetch('https://api.clarapmc.com/api/real-play/public/community', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'players' }),
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
          authorityCache = data;
          authorityLoadedAt = Date.now();
        }
        return authorityCache;
      } catch (_error) {
        return authorityCache;
      } finally {
        authorityPromise = null;
      }
    })();

    return authorityPromise;
  }

  function ranking(player) {
    return player?.ranking || player?.careerRecord?.ranking || player?.career?.ranking || {};
  }

  function playerRank(player) {
    return numeric(player?.rank ?? ranking(player)?.rank, null);
  }

  function rawOvr(player) {
    return numeric(
      ranking(player)?.rawOvr
      ?? player?.rawOvr
      ?? player?.ovrRaw
      ?? player?.careerStats?.rawOvr
      ?? player?.careerStats?.ovrRaw
      ?? player?.career?.rawOvr
      ?? player?.career?.ovrRaw
      ?? player?.ratingMean,
      null
    );
  }

  function publicSelectedPlayer(profile) {
    return profile?.__realPlayPublicPlayer || null;
  }

  function displayedName(profile) {
    return String(profile?.querySelector('.rp-profile-name h1')?.textContent || 'REAL PLAY PLAYER').trim();
  }

  function displayedOvr(profile) {
    return numeric(profile?.querySelector('.rp-profile-ovr strong')?.textContent, null);
  }

  function displayedRank(profile) {
    const text = String(profile?.querySelector('.rp-profile-rank strong')?.textContent || '').replace('#', '').trim();
    return numeric(text, null);
  }

  function unrankedProgress(player, profile) {
    const state = ranking(player);
    const stats = player?.careerStats || player?.careerRecord || player?.career || {};
    const required = Math.max(1, Math.floor(numeric(
      state?.requiredGames
      ?? state?.required_games
      ?? player?.officialRankingGamesRequired
      ?? player?.official_ranking_games_required
      ?? player?.rankingGamesRequired
      ?? player?.ranking_games_required,
      5
    )));

    let completed = numeric(
      state?.completedGames
      ?? state?.completed_games
      ?? player?.rankingGamesCompleted
      ?? player?.ranking_games_completed
      ?? stats?.games
      ?? stats?.gamesPlayed
      ?? player?.games
      ?? player?.gamesPlayed,
      null
    );

    if (completed === null) {
      const recordText = String(profile?.querySelector('.rp-profile-record small')?.textContent || '');
      const match = recordText.match(/(\d+)\s*GAMES?/i);
      if (match) completed = numeric(match[1], 0);
    }

    completed = Math.max(0, Math.min(required, Math.floor(numeric(completed, 0))));
    return { required, completed, remaining: Math.max(0, required - completed) };
  }

  function sameId(left, right) {
    const a = numeric(left, null);
    const b = numeric(right, null);
    return a !== null && b !== null && a === b;
  }

  function sameName(left, right) {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
  }

  function matchPlayer(players, selected, profile, authority) {
    if (!Array.isArray(players)) return selected || null;

    const isPublic = Boolean(profile?.classList?.contains('rp-public-player-profile'));

    // Public profiles expose the canonical playerId on the panel. Keep ID
    // namespaces isolated so playerId can never collide with accountUserId.
    if (isPublic) {
      const canonicalPlayerId = numeric(profile?.dataset?.rpPublicPlayerId ?? selected?.playerId, null);
      if (canonicalPlayerId !== null) {
        const byPlayerId = players.find((player) => sameId(player?.playerId, canonicalPlayerId));
        if (byPlayerId) return byPlayerId;
      }
    }

    // If the profile already carries a selected player, preserve each namespace.
    if (selected) {
      const identifierKeys = ['playerId', 'accountUserId', 'userId'];
      for (const key of identifierKeys) {
        const selectedValue = numeric(selected?.[key], null);
        if (selectedValue === null) continue;
        const exact = players.find((player) => sameId(player?.[key], selectedValue));
        if (exact) return exact;
      }
    }

    if (!isPublic) {
      // The canonical community response distinguishes the signed-in account ID
      // from the permanent Real Play player ID. Never compare one namespace to
      // the other: numeric collisions can select somebody else's player record.
      const accountUserId = numeric(authority?.meAccountUserId, null);
      if (accountUserId !== null) {
        const byAccount = players.find((player) => sameId(player?.accountUserId, accountUserId));
        if (byAccount) return byAccount;
      }

      // The visible profile name is a safer fallback than cross-namespace ID
      // matching when an older/cached response does not expose meAccountUserId.
      const visibleName = displayedName(profile);
      const byVisibleName = players.find((player) => sameName(player?.playerName, visibleName));
      if (byVisibleName) return byVisibleName;

      const canonicalPlayerId = numeric(authority?.mePlayerId ?? authority?.meUserId, null);
      if (canonicalPlayerId !== null) {
        const byCanonicalPlayerId = players.find((player) => sameId(player?.playerId, canonicalPlayerId));
        if (byCanonicalPlayerId) return byCanonicalPlayerId;
      }
    }

    const name = displayedName(profile);
    const byName = players.find((player) => sameName(player?.playerName, name));
    return byName || selected || null;
  }

  function createModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'rp-rank-explainer';
    modal.dataset.rpRankExplainer = 'true';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <section class="rp-rank-explainer-card" role="dialog" aria-modal="true" aria-labelledby="rp-rank-explainer-title">
        <button type="button" class="rp-rank-explainer-close" data-rp-rank-close aria-label="Close rank explanation">×</button>
        <div data-rp-rank-body><div class="rp-rank-loading">LOADING OFFICIAL RANK DATA…</div></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-rp-rank-close]')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderUnranked(body, { name, player, profile }) {
    const progress = unrankedProgress(player, profile);
    const gameWord = progress.remaining === 1 ? 'game' : 'games';
    const explanation = progress.remaining > 0
      ? `You’ve played <strong>${progress.completed} of ${progress.required} required games.</strong> Play <strong>${progress.remaining} more verified Open Ranking ${gameWord}</strong> to unlock your official Real Play Rank.`
      : 'You’ve completed the required verified games. Your official Real Play Rank will appear once ranking eligibility is confirmed.';

    body.innerHTML = `
      <p class="rp-rank-explainer-kicker">OFFICIAL RANKING</p>
      <h2 id="rp-rank-explainer-title">WHY UNRANKED?</h2>
      <p class="rp-rank-explainer-player">${esc(name)}</p>
      <p class="rp-rank-explainer-copy">${explanation}</p>
      <div class="rp-rank-receipt">
        <div><strong>${progress.completed}/${progress.required}</strong><small>GAMES COMPLETED</small></div>
        <div><strong>${progress.remaining}</strong><small>GAMES TO GO</small></div>
      </div>`;
  }

  function renderRankWithoutRawReceipt(body, { rank, name, publicOvr }) {
    body.innerHTML = `
      <p class="rp-rank-explainer-kicker">OFFICIAL RANKING</p>
      <h2 id="rp-rank-explainer-title">WHY #${rank}?</h2>
      <p class="rp-rank-explainer-player">${esc(name)}</p>
      <div class="rp-rank-receipt">
        <div><strong>#${rank}</strong><small>OFFICIAL RANK</small></div>
        <div><strong>${publicOvr === null ? '—' : esc(publicOvr)}</strong><small>PUBLIC OVR</small></div>
      </div>
      <p class="rp-rank-explainer-copy"><strong>#${rank} is the authoritative official rank currently assigned to this player.</strong> The detailed underlying rating receipt is not available on this surface right now, so Real Play will not invent or recalculate one in the browser.</p>
      <p class="rp-rank-explainer-copy" style="margin-top:12px">Official Rank comes from the canonical ranking authority. Rounded OVR, career averages, win rate, list position, and recognition badges do not independently assign the ordinal.</p>
      <p class="rp-rank-note">Missing receipt detail does not make an already-ranked player Unranked.</p>`;
  }

  async function openExplanation(profile) {
    createModal();
    const body = modal.querySelector('[data-rp-rank-body]');
    body.innerHTML = '<div class="rp-rank-loading">LOADING OFFICIAL RANK DATA…</div>';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    const selected = publicSelectedPlayer(profile);
    const authority = await loadAuthority(true);
    const players = Array.isArray(authority?.players) ? authority.players : [];
    const player = matchPlayer(players, selected, profile, authority || {});
    const rank = playerRank(player) ?? displayedRank(profile);
    const raw = rawOvr(player);
    const publicOvr = numeric(player?.ovr, displayedOvr(profile));
    const name = String(player?.playerName || displayedName(profile)).trim();

    const ordered = players
      .filter((item) => playerRank(item) !== null)
      .sort((a, b) => playerRank(a) - playerRank(b));
    const nextBelow = rank === null ? null : ordered.find((item) => playerRank(item) === rank + 1) || null;
    const nextRaw = rawOvr(nextBelow);

    // Rank eligibility and receipt precision are different questions. A missing
    // raw rating must never turn an already-canonical #rank into "not ranked".
    if (rank === null) {
      renderUnranked(body, { name, player, profile });
      return;
    }

    if (raw === null) {
      renderRankWithoutRawReceipt(body, { rank, name, publicOvr });
      return;
    }

    const nextLine = nextBelow && nextRaw !== null
      ? `<div class="rp-rank-neighbor">Next below: <strong>#${playerRank(nextBelow)} ${esc(nextBelow.playerName || 'PLAYER')} · ${nextRaw.toFixed(2)}</strong></div>`
      : '';

    body.innerHTML = `
      <p class="rp-rank-explainer-kicker">OFFICIAL RANKING</p>
      <h2 id="rp-rank-explainer-title">WHY #${rank}?</h2>
      <p class="rp-rank-explainer-player">${esc(name)}</p>
      <div class="rp-rank-receipt">
        <div><strong>#${rank}</strong><small>OFFICIAL RANK</small></div>
        <div><strong>${raw.toFixed(2)}</strong><small>UNDERLYING RATING</small></div>
      </div>
      <p class="rp-rank-explainer-copy">The profile shows a rounded OVR${publicOvr === null ? '' : ` of <strong>${esc(publicOvr)}</strong>`}, but Real Play keeps greater precision underneath it. Official Rank is ordered by that underlying competitive rating, not by simply sorting career PPG, RPG, shooting percentage, win rate, or MVP badges.</p>
      <div class="rp-rank-formula">
        <b>HOW THE RATING IS BUILT</b>
        <p>Every verified game evaluates scoring, playmaking, rebounding, defense, ball security, competitive result, and game context. The current game-impact mix is 30% scoring, 20% playmaking, 15% rebounding, 15% defense, 10% ball security, and 10% competitive result. Game context and rating confidence affect how strongly each game changes the underlying rating.</p>
      </div>
      <p class="rp-rank-explainer-copy" style="margin-top:12px"><strong>Career stats describe what was accumulated.</strong> The underlying rating estimates the competitive level demonstrated across those verified games. That is why two players can both display the same rounded OVR while holding different official ranks.</p>
      ${nextLine}
      <p class="rp-rank-note">MVP and other recognition badges remain separate achievements. They do not directly assign official rank.</p>`;
  }

  function mountIcons() {
    document.querySelectorAll('.rp-profile .rp-profile-rank').forEach((card) => {
      if (card.querySelector('[data-rp-rank-info]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-rank-info';
      button.dataset.rpRankInfo = 'true';
      button.textContent = 'i';
      button.setAttribute('aria-label', 'Why this official rank?');
      button.setAttribute('title', 'Why this rank?');
      card.appendChild(button);
    });
  }

  function scheduleMount() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      mountIcons();
    });
  }

  installStyles();
  scheduleMount();

  const observer = new MutationObserver(scheduleMount);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rp-rank-info]');
    if (!button) return;
    const profile = button.closest('.rp-profile');
    if (!profile) return;
    event.preventDefault();
    event.stopPropagation();
    openExplanation(profile);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });
})();