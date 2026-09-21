(() => {
  if (window.__realPlayRecognitionSystemInstalled) return;
  window.__realPlayRecognitionSystemInstalled = true;
  // Keep the old flag for cached callers that only know the captain layer.
  window.__realPlayCaptainEligibilityInstalled = true;

  const AUTHORITY_TTL_MS = 60_000;
  const CAPTAIN_RANK_LIMIT = 4;

  const RECOGNITIONS = Object.freeze({
    most_overall_mvp: {
      title: 'MOST OVERALL MVP',
      shortTitle: 'MOST OVERALL MVP',
      priority: 500,
      badge: 'assets/recognitions/badges/badge-most-overall-team-mvp.png',
      bar: 'assets/recognitions/bars/bar-most-overall-team-mvp.png',
      profileScale: 1.04,
      fallback: 'Leads Real Play in verified Overall MVP awards.',
    },
    most_team_mvp: {
      title: 'MOST TEAM MVP',
      shortTitle: 'MOST TEAM MVP',
      priority: 400,
      badge: 'assets/recognitions/badges/badge-most-team-mvp.png',
      bar: 'assets/recognitions/bars/bar-most-team-mvp.png',
      profileScale: 1.00,
      fallback: 'Leads Real Play in verified Team MVP awards.',
    },
    best_shooting: {
      title: 'BEST SHOOTING %',
      shortTitle: 'BEST SHOOTING %',
      priority: 300,
      badge: 'assets/recognitions/badges/badge-best-shooting.png',
      bar: 'assets/recognitions/bars/bar-best-shooting.png',
      profileScale: 1.10,
      fallback: 'Leads qualified Real Play players in career shooting percentage.',
    },
    best_rebounder: {
      title: 'BEST REBOUNDER',
      shortTitle: 'BEST REBOUNDER',
      priority: 200,
      badge: 'assets/recognitions/badges/badge-best-rebounder.png',
      bar: 'assets/recognitions/bars/bar-best-rebounder.png',
      profileScale: 1.08,
      fallback: 'Leads qualified Real Play players in rebounds per game.',
    },
    captain_eligible: {
      title: 'CAPTAIN ELIGIBLE',
      shortTitle: 'CAPTAIN ELIGIBLE',
      priority: 100,
      badge: 'assets/recognitions/badges/badge-captain-eligible.png',
      bar: 'assets/recognitions/bars/bar-captain-eligible.png',
      profileScale: 1.22,
      fallback: 'Currently inside the official Top 4 captain line for a future Real Play League.',
    },
  });

  let playersById = new Map();
  let authorityLoadedAt = 0;
  let authorityPromise = null;
  let scheduled = false;
  let modal = null;
  let refreshTimer = null;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function recognitionMeta(type) {
    return RECOGNITIONS[String(type || '').trim().toLowerCase()] || null;
  }

  function recognitionPriority(badge) {
    return Number(recognitionMeta(badge?.type)?.priority ?? badge?.priority ?? 0) || 0;
  }

  function playerId(player) {
    return String(player?.playerId ?? player?.userId ?? '').trim();
  }

  function currentRank(row, player) {
    const values = [player?.rank, row?.dataset?.officialRank];
    for (const value of values) {
      const rank = Number(value);
      if (Number.isSafeInteger(rank) && rank > 0) return rank;
    }
    return null;
  }

  function captainBadge(rank) {
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > CAPTAIN_RANK_LIMIT) return null;
    return {
      type: 'captain_eligible',
      title: 'CAPTAIN ELIGIBLE',
      priority: RECOGNITIONS.captain_eligible.priority,
      value: rank,
      reason: `Official Rank #${rank} is currently inside the Top ${CAPTAIN_RANK_LIMIT} captain line for a future Real Play League.`,
      metrics: {
        rank,
        captainRankLimit: CAPTAIN_RANK_LIMIT,
        leagueFormat: '4v4',
        maximumRoster: 5,
      },
    };
  }

  function badgeSources(...sources) {
    const lists = [];
    sources.filter(Boolean).forEach((source) => {
      [source, source?.player, source?.profile, source?.career, source?.careerStats].filter(Boolean).forEach((candidate) => {
        if (Array.isArray(candidate?.badges)) lists.push(candidate.badges);
        if (Array.isArray(candidate?.recognitions)) lists.push(candidate.recognitions);
      });
    });
    return lists.flat();
  }

  function normalizeBadges(sourceBadges, rank = null) {
    const byType = new Map();
    (Array.isArray(sourceBadges) ? sourceBadges : []).forEach((badge) => {
      const type = String(badge?.type || '').trim().toLowerCase();
      const meta = recognitionMeta(type);
      if (!meta) return;
      byType.set(type, { ...badge, type, title: badge?.title || meta.title });
    });

    const captain = captainBadge(rank);
    if (captain && !byType.has(captain.type)) byType.set(captain.type, captain);
    if (!captain) byType.delete('captain_eligible');

    return [...byType.values()].sort((left, right) => {
      const priorityDiff = recognitionPriority(right) - recognitionPriority(left);
      if (priorityDiff) return priorityDiff;
      return String(left.title || '').localeCompare(String(right.title || ''));
    });
  }

  function badgesForRow(row) {
    const id = String(row?.dataset?.worldPlayerId || '').trim();
    const player = playersById.get(id) || null;
    return normalizeBadges(badgeSources(player), currentRank(row, player));
  }

  function profilePlayerName(profile) {
    return String(profile?.querySelector('.rp-profile-name h1')?.textContent || 'REAL PLAY PLAYER').trim();
  }

  function profileRank(profile, ...sources) {
    const values = [];
    sources.filter(Boolean).forEach((source) => {
      values.push(
        source?.rank,
        source?.career?.rank,
        source?.careerStats?.rank,
        source?.ranking?.rank,
        source?.player?.rank,
        source?.profile?.rank
      );
    });
    const visible = String(profile?.querySelector('.rp-profile-rank strong')?.textContent || '');
    const match = visible.match(/#?\s*(\d+)/);
    if (match) values.push(Number(match[1]));
    for (const value of values) {
      const rank = Number(value);
      if (Number.isSafeInteger(rank) && rank > 0) return rank;
    }
    return null;
  }

  function sourcePlayerId(source) {
    const candidates = [
      source?.playerId,
      source?.userId,
      source?.id,
      source?.player?.playerId,
      source?.player?.userId,
      source?.player?.id,
      source?.profile?.playerId,
      source?.profile?.player_id,
      source?.profile?.userId,
      source?.profile?.user_id,
      source?.profile?.id,
    ];
    for (const value of candidates) {
      const id = Number(value);
      if (Number.isSafeInteger(id) && id > 0) return String(id);
    }
    return '';
  }

  function worldPlayerForProfile(profile, source) {
    const explicitId = String(
      profile?.dataset?.rpPublicPlayerId
      || profile?.dataset?.rpProfilePlayerId
      || sourcePlayerId(source)
      || ''
    ).trim();
    if (explicitId && playersById.has(explicitId)) return playersById.get(explicitId);

    const wantedName = profilePlayerName(profile).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!wantedName) return null;
    const matches = [...playersById.values()].filter((player) => (
      String(player?.playerName || player?.player_name || player?.name || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim() === wantedName
    ));
    return matches.length === 1 ? matches[0] : null;
  }

  function profileBadgeData(profile) {
    const source = profile?.classList?.contains('rp-public-player-profile')
      ? profile.__realPlayPublicPlayer
      : profile.__realPlayProfileState;
    const worldPlayer = worldPlayerForProfile(profile, source);
    const rank = profileRank(profile, worldPlayer, source);
    return {
      playerName: profilePlayerName(profile),
      rank,
      badges: normalizeBadges(badgeSources(source, worldPlayer), rank),
    };
  }

  function installStyles() {
    if (document.querySelector('[data-rp-recognition-system-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpRecognitionSystemStyles = '1';
    style.textContent = `
      .rp-world-player-row{position:relative;isolation:isolate;overflow:hidden}
      .rp-world-player-row>*{position:relative;z-index:2}
      .rp-world-player-row.rp-recognition-themed::before{
        content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
        background-image:var(--rp-recognition-bar);background-repeat:no-repeat;background-position:center;background-size:100% 100%;
        opacity:.94;transition:opacity .18s ease,filter .18s ease;
      }
      .rp-world-player-row.rp-recognition-themed::after{
        content:'';position:absolute;inset:0;z-index:1;pointer-events:none;border-radius:inherit;
        background:linear-gradient(90deg,rgba(2,5,9,.28) 0%,rgba(2,5,9,.05) 47%,rgba(2,5,9,.18) 100%);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 0 24px rgba(255,255,255,.015);
      }
      .rp-world-player-row.rp-recognition-themed:hover::before{opacity:1;filter:brightness(1.08)}
      .rp-world-player-row.rp-recognition-themed{border-color:rgba(255,255,255,.13);background:#03070c;box-shadow:0 7px 22px rgba(0,0,0,.24)}
      .rp-world-player-row.rp-recognition-themed .rp-world-player-name{padding-right:112px}
      .rp-player-featured-badge{
        position:absolute!important;right:62px;top:50%;z-index:5!important;width:108px;height:48px;display:grid;place-items:center;
        transform:translateY(-50%);cursor:pointer;filter:drop-shadow(0 5px 9px rgba(0,0,0,.6));
        transition:transform .16s ease,filter .16s ease;touch-action:manipulation;
      }
      .rp-player-featured-badge:hover{transform:translateY(-50%) scale(1.055);filter:drop-shadow(0 7px 13px rgba(0,0,0,.66)) brightness(1.08)}
      .rp-player-featured-badge:active{transform:translateY(-50%) scale(.97)}
      .rp-player-featured-badge:focus-visible{outline:2px solid #72e6ff;outline-offset:2px;border-radius:10px}
      .rp-player-featured-badge img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}
      .rp-player-featured-count{
        position:absolute;right:-4px;bottom:1px;min-width:20px;height:20px;display:grid;place-items:center;padding:0 5px;border:1px solid rgba(255,255,255,.24);
        border-radius:999px;color:#f5fbff;background:rgba(3,8,14,.94);box-shadow:0 3px 10px rgba(0,0,0,.48);
        font-family:var(--rp-display,Arial,sans-serif);font-size:.48rem;font-weight:1000;line-height:1;
      }

      .rp-recognition-modal{position:fixed;inset:0;z-index:2147483000;display:none;place-items:center;padding:18px;background:rgba(0,3,7,.84);backdrop-filter:blur(11px)}
      .rp-recognition-modal.open{display:grid}
      .rp-recognition-card{position:relative;width:min(100%,440px);max-height:min(86dvh,760px);overflow:auto;padding:22px;border:1px solid rgba(255,255,255,.13);border-radius:24px;color:#f2f8ff;background:radial-gradient(circle at 50% 0%,rgba(45,189,238,.12),transparent 34%),linear-gradient(180deg,#08111a,#03070d 72%);box-shadow:0 32px 90px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.055)}
      .rp-recognition-card::before{content:'';position:absolute;left:18%;right:18%;top:0;height:2px;background:linear-gradient(90deg,transparent,#58ddff,transparent)}
      .rp-recognition-close{position:sticky;float:right;top:0;z-index:5;width:36px;height:36px;margin:-4px -4px 0 8px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:50%;color:#b8c7d5;background:#0b1520;font-size:1.08rem;font-weight:900;line-height:1;cursor:pointer}
      .rp-recognition-kicker{margin:2px 0 5px;color:#51d9ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.52rem;font-weight:1000;letter-spacing:.14em;text-transform:uppercase}
      .rp-recognition-hero{display:grid;justify-items:center;margin:4px 0 4px;text-align:center}
      .rp-recognition-hero img{width:min(78%,290px);height:112px;object-fit:contain;filter:drop-shadow(0 10px 16px rgba(0,0,0,.55))}
      .rp-recognition-hero h2{margin:2px 0 0;font-family:var(--rp-display,Arial,sans-serif);font-size:1.35rem;font-style:italic;font-weight:1000;letter-spacing:.018em;text-transform:uppercase}
      .rp-recognition-player{display:flex;align-items:baseline;gap:8px;margin:12px 0 14px;padding:11px 12px;border:1px solid rgba(90,218,255,.13);border-radius:13px;background:rgba(3,10,16,.78)}
      .rp-recognition-player strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Arial,sans-serif);font-size:.83rem;font-style:italic;font-weight:1000;text-transform:uppercase}
      .rp-recognition-player b{margin-left:auto;flex:none;color:#54dcff;font-family:var(--rp-display,Arial,sans-serif);font-size:.76rem;font-style:italic;font-weight:1000}
      .rp-recognition-reason{margin:0;color:#a9bac9;font-size:.72rem;font-weight:650;line-height:1.58;text-align:center}
      .rp-recognition-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:15px 0}
      .rp-recognition-metrics span{padding:10px 8px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.025);text-align:center}
      .rp-recognition-metrics b{display:block;color:#eef8ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.72rem;font-style:italic;font-weight:1000}
      .rp-recognition-metrics small{display:block;margin-top:3px;color:#6f8296;font-size:.42rem;font-weight:950;letter-spacing:.07em;text-transform:uppercase}
      .rp-recognition-collection{margin-top:17px;padding-top:15px;border-top:1px solid rgba(255,255,255,.075)}
      .rp-recognition-collection-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:9px}
      .rp-recognition-collection-head div small{display:block;color:#4fd9ff;font-size:.45rem;font-weight:1000;letter-spacing:.11em}
      .rp-recognition-collection-head div strong{display:block;margin-top:2px;font-family:var(--rp-display,Arial,sans-serif);font-size:.82rem;font-style:italic;font-weight:1000}
      .rp-recognition-collection-head>span{color:#64788b;font-size:.48rem;font-weight:900}
      .rp-recognition-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .rp-recognition-owned{min-width:0;padding:8px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(255,255,255,.025);text-align:center}
      .rp-recognition-owned.is-featured{border-color:rgba(84,219,255,.25);background:rgba(42,172,216,.06)}
      .rp-recognition-owned img{display:block;width:100%;height:66px;object-fit:contain;filter:drop-shadow(0 5px 8px rgba(0,0,0,.5))}
      .rp-recognition-owned strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;font-family:var(--rp-display,Arial,sans-serif);font-size:.51rem;font-style:italic;font-weight:1000;text-transform:uppercase}
      .rp-recognition-owned small{display:block;margin-top:3px;color:#708396;font-size:.4rem;font-weight:900;letter-spacing:.055em;text-transform:uppercase}
      .rp-recognition-note{margin:12px 0 0;color:#687b8f;font-size:.58rem;line-height:1.5;text-align:center}

      /* Profile badge showcase — uses the intentionally open band between the
         identity header and the player's name. Every currently owned verified
         badge stays visible instead of collapsing to only the featured badge. */
      .rp-profile-badges{
        position:relative;z-index:3;display:flex;align-items:center;justify-content:center;gap:12px;
        min-height:88px;margin:8px 12px 0;padding:4px 4px;overflow-x:auto;overflow-y:hidden;
        scrollbar-width:none;-webkit-overflow-scrolling:touch;
      }
      .rp-profile-badges::-webkit-scrollbar{display:none}
      .rp-profile-badge{
        position:relative;flex:0 0 auto;width:132px;height:78px;padding:0;border:0;border-radius:13px;
        color:inherit;background:transparent;cursor:pointer;filter:drop-shadow(0 7px 12px rgba(0,0,0,.64));
        transition:transform .16s ease,filter .16s ease;touch-action:manipulation;
      }
      .rp-profile-badge:hover{transform:translateY(-1px) scale(1.035);filter:drop-shadow(0 9px 15px rgba(0,0,0,.70)) brightness(1.08)}
      .rp-profile-badge:active{transform:scale(.97)}
      .rp-profile-badge:focus-visible{outline:2px solid #72e6ff;outline-offset:2px}
      .rp-profile-badge img{
        display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;
        transform:scale(var(--rp-profile-badge-scale,1));transform-origin:center;
      }
      .rp-profile.has-rp-profile-badges .rp-profile-player{margin-top:0!important;padding-top:0!important}

      @media(max-width:420px){
        .rp-world-player-row.rp-recognition-themed .rp-world-player-name{padding-right:88px}
        .rp-player-featured-badge{right:55px;width:88px;height:43px}
        .rp-player-featured-count{right:-3px;bottom:0;min-width:18px;height:18px;font-size:.43rem}
        .rp-recognition-card{padding:19px 16px;border-radius:20px}
        .rp-recognition-hero img{height:100px;width:min(84%,260px)}
        .rp-profile-badges{gap:10px;min-height:82px;margin-inline:7px;padding-inline:3px}
        .rp-profile-badge{width:120px;height:72px}
      }
      @media(max-width:355px){
        .rp-world-player-row.rp-recognition-themed .rp-world-player-name{padding-right:66px}
        .rp-player-featured-badge{right:51px;width:68px;height:38px}
        .rp-recognition-grid{grid-template-columns:1fr}
        .rp-profile-badges{justify-content:flex-start;gap:8px;min-height:74px;padding-inline:4px}
        .rp-profile-badge{width:108px;height:66px}
      }
    `;
    document.head.appendChild(style);
  }

  async function loadAuthority(force = false) {
    const now = Date.now();
    if (!force && authorityLoadedAt && now - authorityLoadedAt < AUTHORITY_TTL_MS) return;
    if (authorityPromise) return authorityPromise;

    authorityPromise = (async () => {
      try {
        const data = await window.RealPlayWorld?.community?.('players');
        const next = new Map();
        (Array.isArray(data?.players) ? data.players : []).forEach((player) => {
          const id = playerId(player);
          if (id) next.set(id, player);
        });
        playersById = next;
        authorityLoadedAt = Date.now();
      } catch (_error) {
        // The rows remain fully usable even if recognition refresh is temporarily
        // unavailable. Captain fallback can still render from data-official-rank.
      } finally {
        authorityPromise = null;
        scheduleRender();
      }
    })();

    return authorityPromise;
  }

  function featuredButton(row) {
    return row.querySelector('[data-rp-featured-recognition]');
  }

  function clearRecognition(row) {
    featuredButton(row)?.remove();
    row.classList.remove('rp-recognition-themed');
    row.removeAttribute('data-recognition-type');
    row.style.removeProperty('--rp-recognition-bar');
  }

  function renderRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const badges = badgesForRow(row);
    const featured = badges[0] || null;

    row.__realPlayBadges = badges;
    if (!featured) {
      if (row.classList.contains('rp-recognition-themed') || featuredButton(row)) clearRecognition(row);
      return;
    }

    const meta = recognitionMeta(featured.type);
    if (!meta) return;

    row.classList.add('rp-recognition-themed');
    row.dataset.recognitionType = featured.type;
    row.style.setProperty('--rp-recognition-bar', `url("${meta.bar}")`);

    let trigger = featuredButton(row);
    if (!trigger) {
      trigger = document.createElement('span');
      trigger.className = 'rp-player-featured-badge';
      trigger.dataset.rpFeaturedRecognition = 'true';
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');
      row.appendChild(trigger);
    }

    const signature = `${featured.type}:${badges.length}`;
    if (trigger.dataset.signature !== signature) {
      trigger.dataset.signature = signature;
      trigger.innerHTML = `<img src="${esc(meta.badge)}" alt="${esc(meta.title)} badge" draggable="false" />${badges.length > 1 ? `<span class="rp-player-featured-count" aria-label="${badges.length} owned badges">+${badges.length - 1}</span>` : ''}`;
    }
    trigger.title = badges.length > 1
      ? `${meta.title} · View all ${badges.length} badges`
      : `${meta.title} · View badge details`;
    trigger.setAttribute('aria-label', trigger.title);
  }

  function renderProfileBadges(profile) {
    if (!(profile instanceof HTMLElement) || !profile.classList.contains('open')) return;
    const hero = profile.querySelector('.rp-profile-hero');
    const identity = hero?.querySelector('.rp-profile-identity-line');
    if (!hero || !identity) return;

    const data = profileBadgeData(profile);
    profile.__realPlayBadges = data.badges;
    profile.__realPlayBadgeRank = data.rank;
    profile.__realPlayBadgePlayerName = data.playerName;

    let strip = hero.querySelector('[data-rp-profile-badges]');
    if (!data.badges.length) {
      strip?.remove();
      profile.classList.remove('has-rp-profile-badges');
      return;
    }

    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'rp-profile-badges';
      strip.dataset.rpProfileBadges = 'true';
      strip.setAttribute('aria-label', 'Player badges');
      identity.insertAdjacentElement('afterend', strip);
    }

    const signature = data.badges.map((badge) => {
      const value = badge?.count ?? badge?.value ?? badge?.metrics?.rank ?? '';
      return `${badge.type}:${value}`;
    }).join('|');
    if (strip.dataset.signature !== signature) {
      strip.dataset.signature = signature;
      strip.innerHTML = data.badges.map((badge) => {
        const meta = recognitionMeta(badge.type);
        if (!meta) return '';
        const scale = Number(meta.profileScale || 1);
        return `<button type="button" class="rp-profile-badge" data-rp-profile-recognition="${esc(badge.type)}" title="${esc(meta.title)}" aria-label="${esc(meta.title)}" style="--rp-profile-badge-scale:${Number.isFinite(scale) ? scale : 1}"><img src="${esc(meta.badge)}" alt="" draggable="false" /></button>`;
      }).join('');
    }
    profile.classList.add('has-rp-profile-badges');
  }

  function renderAll() {
    scheduled = false;
    const rows = [...document.querySelectorAll('.rp-world-player-row')];
    const profiles = [...document.querySelectorAll('.rp-profile.open')];
    rows.forEach(renderRow);
    profiles.forEach(renderProfileBadges);
    if ((rows.length || profiles.length) && (!authorityLoadedAt || Date.now() - authorityLoadedAt >= AUTHORITY_TTL_MS)) loadAuthority();
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(renderAll);
  }

  function playerName(row) {
    return String(row?.querySelector('.rp-world-player-name strong')?.textContent || 'REAL PLAY PLAYER').trim();
  }

  function metricPairs(badge) {
    const metrics = badge?.metrics || {};
    switch (badge?.type) {
      case 'most_overall_mvp':
        return [[metrics.overallMvpCount ?? badge.count ?? badge.value ?? 0, 'OVERALL MVPs']];
      case 'most_team_mvp':
        return [[metrics.teamMvpCount ?? badge.count ?? badge.value ?? 0, 'TEAM MVPs']];
      case 'best_shooting':
        return [
          [`${Number(metrics.fieldGoalPct ?? badge.value ?? 0).toFixed(1)}%`, 'FIELD GOAL %'],
          [`${metrics.madeShots ?? 0}/${metrics.attempts ?? 0}`, 'MADE / ATTEMPTS'],
          [metrics.games ?? '—', 'GAMES'],
          [metrics.minimumAttempts ?? 10, 'MIN ATTEMPTS'],
        ];
      case 'best_rebounder':
        return [
          [Number(metrics.reboundsPerGame ?? badge.value ?? 0).toFixed(2), 'REB / GAME'],
          [metrics.rebounds ?? '—', 'TOTAL REB'],
          [metrics.games ?? '—', 'GAMES'],
          [metrics.minimumGames ?? 3, 'MIN GAMES'],
        ];
      case 'captain_eligible':
        return [
          [`#${metrics.rank ?? badge.value ?? '—'}`, 'OFFICIAL RANK'],
          [metrics.leagueFormat ?? '4v4', 'LEAGUE FORMAT'],
          [metrics.maximumRoster ?? 5, 'MAX ROSTER'],
          [`TOP ${metrics.captainRankLimit ?? CAPTAIN_RANK_LIMIT}`, 'CAPTAIN LINE'],
        ];
      default:
        return [];
    }
  }

  function ownedBadgeHtml(badge, featuredType = '') {
    const meta = recognitionMeta(badge?.type);
    if (!meta) return '';
    let sub = 'OWNED BADGE';
    if (badge.type === 'most_overall_mvp') sub = `${badge?.metrics?.overallMvpCount ?? badge.count ?? badge.value ?? 0} OVERALL MVP`;
    if (badge.type === 'most_team_mvp') sub = `${badge?.metrics?.teamMvpCount ?? badge.count ?? badge.value ?? 0} TEAM MVP`;
    if (badge.type === 'best_shooting') sub = `${Number(badge?.metrics?.fieldGoalPct ?? badge.value ?? 0).toFixed(1)}% FG`;
    if (badge.type === 'best_rebounder') sub = `${Number(badge?.metrics?.reboundsPerGame ?? badge.value ?? 0).toFixed(2)} REB/G`;
    if (badge.type === 'captain_eligible') sub = `OFFICIAL RANK #${badge?.metrics?.rank ?? badge.value ?? '—'}`;
    return `<article class="rp-recognition-owned${badge?.type === featuredType ? ' is-featured' : ''}"><img src="${esc(meta.badge)}" alt="" draggable="false" /><strong>${esc(meta.title)}</strong><small>${esc(sub)}</small></article>`;
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.className = 'rp-recognition-modal';
    modal.dataset.rpRecognitionModal = 'true';
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-rp-recognition-close]')) closeModal();
    });
    return modal;
  }

  function showRecognitionModal({ badges, featured, name, rank }) {
    const meta = recognitionMeta(featured?.type);
    if (!featured || !meta) return;

    const metrics = metricPairs(featured);
    const dialog = ensureModal();
    const reason = String(featured.reason || meta.fallback || '').trim();
    const note = featured.type === 'captain_eligible'
      ? 'Captain eligibility is earned through official Rank — not voting, popularity, or payment. Eligibility may change before league captains and rosters are formally locked.'
      : 'Badges are awarded from verified Real Play game data. A player keeps every badge they genuinely earn; awards are never passed down just because that player already owns another badge.';

    dialog.innerHTML = `
      <section class="rp-recognition-card" role="dialog" aria-modal="true" aria-label="${esc(meta.title)} recognition details">
        <button type="button" class="rp-recognition-close" data-rp-recognition-close aria-label="Close recognition details">×</button>
        <p class="rp-recognition-kicker">REAL PLAY RECOGNITION</p>
        <div class="rp-recognition-hero"><img src="${esc(meta.badge)}" alt="${esc(meta.title)} badge" draggable="false" /><h2>${esc(meta.title)}</h2></div>
        <div class="rp-recognition-player"><strong>${esc(name || 'REAL PLAY PLAYER')}</strong><b>${rank ? `RANK #${rank}` : 'REAL PLAY PLAYER'}</b></div>
        <p class="rp-recognition-reason">${esc(reason)}</p>
        ${metrics.length ? `<div class="rp-recognition-metrics">${metrics.map(([value, label]) => `<span><b>${esc(value)}</b><small>${esc(label)}</small></span>`).join('')}</div>` : ''}
        <section class="rp-recognition-collection">
          <div class="rp-recognition-collection-head"><div><small>PLAYER COLLECTION</small><strong>BADGES</strong></div><span>${badges.length} OWNED</span></div>
          <div class="rp-recognition-grid">${badges.map((badge) => ownedBadgeHtml(badge, featured.type)).join('')}</div>
        </section>
        <p class="rp-recognition-note">${esc(note)}</p>
      </section>`;

    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
    dialog.querySelector('[data-rp-recognition-close]')?.focus({ preventScroll: true });
  }

  function openModal(row) {
    const badges = Array.isArray(row?.__realPlayBadges) ? row.__realPlayBadges : badgesForRow(row);
    const featured = badges[0];
    if (!row || !featured) return;
    const rank = currentRank(row, playersById.get(String(row.dataset.worldPlayerId || '').trim()));
    showRecognitionModal({ badges, featured, name: playerName(row), rank });
  }

  function openProfileModal(trigger) {
    const profile = trigger?.closest?.('.rp-profile');
    if (!profile) return;
    const badges = Array.isArray(profile.__realPlayBadges) ? profile.__realPlayBadges : profileBadgeData(profile).badges;
    const type = String(trigger.dataset.rpProfileRecognition || '').trim().toLowerCase();
    const featured = badges.find((badge) => badge?.type === type);
    if (!featured) return;
    showRecognitionModal({
      badges,
      featured,
      name: profile.__realPlayBadgePlayerName || profilePlayerName(profile),
      rank: profile.__realPlayBadgeRank || profileRank(profile),
    });
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function handleFeaturedInteraction(event) {
    const profileTrigger = event.target.closest?.('[data-rp-profile-recognition]');
    if (profileTrigger) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openProfileModal(profileTrigger);
      return true;
    }

    const trigger = event.target.closest?.('[data-rp-featured-recognition]');
    if (!trigger) return false;
    const row = trigger.closest('.rp-world-player-row');
    if (!row) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openModal(row);
    return true;
  }

  document.addEventListener('click', handleFeaturedInteraction, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeModal();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ')
      && event.target.closest?.('[data-rp-featured-recognition], [data-rp-profile-recognition]')) {
      handleFeaturedInteraction(event);
    }
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList' || mutation.attributeName === 'data-official-rank')) scheduleRender();
  });

  installStyles();
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-official-rank'],
  });

  refreshTimer = window.setInterval(() => {
    if (document.hidden || !document.querySelector('.rp-world-player-row')) return;
    loadAuthority(true);
  }, AUTHORITY_TTL_MS);

  window.addEventListener('realplay:profile-loaded', scheduleRender);
  window.addEventListener('realplay:public-profile-loaded', scheduleRender);
  window.addEventListener('focus', () => {
    if (document.querySelector('.rp-world-player-row, .rp-profile.open')) loadAuthority();
  });

  window.addEventListener('pagehide', () => {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = null;
  }, { once: true });

  loadAuthority();
  scheduleRender();
})();
