(() => {
  if (window.__realPlayGameStoryViewerInstalled) return;
  window.__realPlayGameStoryViewerInstalled = true;

  const API = 'https://api.clarapmc.com/api/real-play/public/career/games';
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clampWords = (value, max) => {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    return words.length <= max ? words.join(' ') : `${words.slice(0, max).join(' ')}…`;
  };

  function injectStyles() {
    if (document.getElementById('rp-game-story-viewer-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-game-story-viewer-style';
    style.textContent = `
      body.rp-story-open{overflow:hidden!important}
      .rp-story-viewer{position:fixed;inset:0;z-index:2147482500;display:grid;background:#02060b;color:#fff}
      .rp-story-viewer[hidden]{display:none!important}
      .rp-story-shell{position:relative;width:min(100%,520px);height:100dvh;margin:auto;overflow:hidden;background:radial-gradient(circle at 50% 22%,rgba(8,94,137,.22),transparent 37%),linear-gradient(155deg,#06101b,#02060b 58%,#0d0508)}
      .rp-story-top{position:absolute;z-index:5;top:0;left:0;right:0;padding:max(14px,env(safe-area-inset-top)) 16px 8px;background:linear-gradient(#02060b 40%,transparent)}
      .rp-story-progress{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px}.rp-story-progress i{height:3px;border-radius:9px;background:rgba(255,255,255,.16)}.rp-story-progress i.active{background:#50ddff}.rp-story-progress i.past{background:rgba(80,221,255,.52)}
      .rp-story-nav{display:flex;justify-content:space-between;align-items:center;margin-top:12px}.rp-story-nav small{font:900 .52rem/1 Arial,sans-serif;letter-spacing:.13em;color:#718296}.rp-story-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(3,8,14,.72);color:#fff;font-size:1.25rem;cursor:pointer}
      .rp-story-track{display:flex;height:100%;transition:transform .3s cubic-bezier(.2,.72,.24,1);touch-action:pan-y}
      .rp-story-slide{position:relative;flex:0 0 100%;min-width:0;height:100%;padding:92px 22px calc(30px + env(safe-area-inset-bottom));display:flex;flex-direction:column;justify-content:flex-end;box-sizing:border-box;overflow:hidden}
      .rp-story-slide::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 12%,rgba(2,6,11,.10) 42%,rgba(2,6,11,.96) 79%);pointer-events:none}
      .rp-story-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;margin:0 auto;width:100%}
      .rp-story-kicker{display:block;width:100%;margin-bottom:10px;color:#53dcff;font:950 .56rem/1 Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase;text-align:center}
      .rp-story-headline{margin:0 auto;max-width:470px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:clamp(2rem,10vw,3.45rem);font-style:italic;font-weight:950;line-height:.94;letter-spacing:.01em;text-transform:uppercase;text-wrap:balance;text-align:center}
      .rp-story-body{margin:15px auto 0;max-width:430px;color:#bbc8d4;font:650 .86rem/1.55 Arial,sans-serif;text-align:center}
      .rp-story-game-versus{position:absolute;z-index:1;top:92px;left:50%;transform:translateX(-50%);width:min(74vw,310px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;pointer-events:none}
      .rp-story-game-team-logo{display:block;width:min(30vw,116px);height:min(30vw,116px);object-fit:contain;filter:drop-shadow(0 12px 24px rgba(0,0,0,.4))}
      .rp-story-game-team-logo.loser{width:min(24vw,92px);height:min(24vw,92px);opacity:.68}
      .rp-story-game-vs{color:rgba(255,255,255,.72);font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.05rem;font-style:italic;letter-spacing:.08em;text-transform:uppercase}
      .rp-story-game-team-fallback{display:grid;place-items:center;border:1px solid rgba(80,220,255,.16);border-radius:50%;background:radial-gradient(circle,rgba(34,136,184,.18),rgba(2,6,11,0) 68%);color:rgba(255,255,255,.16);font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:3.4rem;font-style:italic}
      .rp-story-game-team-fallback.winner{width:min(30vw,116px);height:min(30vw,116px)}
      .rp-story-game-team-fallback.loser{width:min(24vw,92px);height:min(24vw,92px);opacity:.68}
      .rp-story-score{display:flex;justify-content:center;align-items:center;gap:12px;margin:18px auto 2px;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-style:italic;text-align:center}.rp-story-score b{font-size:2.8rem}.rp-story-score span{color:#718293;font-size:.9rem}
      .rp-story-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:18px auto 0;width:100%;max-width:430px}.rp-story-stat{padding:10px 7px;border:1px solid rgba(80,220,255,.10);border-radius:11px;background:rgba(7,20,32,.7);text-align:center}.rp-story-stat b{display:block;font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:1.45rem;font-style:italic}.rp-story-stat small{display:block;margin-top:2px;color:#6edfff;font:900 .44rem/1 Arial,sans-serif;letter-spacing:.08em}
      .rp-story-player-art{position:absolute;z-index:0;top:105px;right:-10px;width:68%;height:48%;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 16px 28px rgba(0,0,0,.42));opacity:.95}
      .rp-story-player-fallback{position:absolute;z-index:0;top:125px;right:22px;width:210px;height:210px;border:1px solid rgba(80,220,255,.12);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,rgba(34,136,184,.18),rgba(2,6,11,0) 66%);color:rgba(255,255,255,.11);font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:6rem;font-style:italic}
      .rp-story-team-mark{position:absolute;z-index:0;top:135px;right:18px;color:rgba(255,255,255,.055);font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:7rem;font-style:italic;line-height:.8;text-transform:uppercase;writing-mode:vertical-rl}
      .rp-story-arrows{position:absolute;z-index:6;inset:0;pointer-events:none}.rp-story-arrows button{position:absolute;top:50%;transform:translateY(-50%);pointer-events:auto;width:42px;height:42px;border:1px solid rgba(255,255,255,.11);border-radius:50%;background:rgba(2,7,12,.72);color:#dff8ff;font-size:1.1rem;opacity:.5;transition:opacity .16s ease}.rp-story-arrows button:first-child{left:8px}.rp-story-arrows button:last-child{right:8px}.rp-story-arrows button:hover,.rp-story-arrows button:focus-visible{opacity:1}.rp-story-arrows button:disabled{opacity:.18}
      .rp-story-loading{margin:auto;color:#63ddff;font:950 .66rem/1.6 Arial,sans-serif;letter-spacing:.15em;text-align:center}
      @media(max-width:380px){.rp-story-slide{padding-left:18px;padding-right:18px}.rp-story-body{font-size:.78rem}.rp-story-stats{gap:5px}.rp-story-stat{padding:8px 4px}}
      @media(prefers-reduced-motion:reduce){.rp-story-track{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function readGameFromCard(card) {
    const idMatch = String(card?.dataset?.updateId || '').match(/^career-(\d+)-result$/);
    const teamNodes = [...(card?.querySelectorAll('.rp-world-scorecard-team') || [])];
    const teams = teamNodes.map((node) => node.querySelector('span:last-child')?.textContent?.trim() || '');
    const logos = teamNodes.map((node) => node.querySelector('.rp-world-scorecard-team-logo')?.src || '');
    const scores = [...(card?.querySelectorAll('.rp-world-scorecard-score b') || [])].map((el) => n(el.textContent));
    const title = card?.querySelector('.rp-world-scorecard-head strong')?.textContent?.trim() || 'GAME STORY';
    return {
      sessionId: idMatch ? Number(idMatch[1]) : null,
      title,
      westName: teams[0] || 'WEST',
      eastName: teams[1] || 'EAST',
      westLogo: logos[0] || '',
      eastLogo: logos[1] || '',
      westScore: scores[0] || 0,
      eastScore: scores[1] || 0,
    };
  }

  function normalizePlayer(raw = {}) {
    const made = n(raw.madeShots ?? raw.made_shots ?? (n(raw.onePtMade) + n(raw.twoPtMade)));
    const missed = n(raw.missedShots ?? raw.missed_shots ?? (n(raw.onePtMiss) + n(raw.twoPtMiss)));
    const attempts = made + missed;
    return {
      id: raw.identityKey || raw.identity_key || raw.playerId || raw.userId || raw.player_id || raw.playerName,
      name: String(raw.playerName ?? raw.player_name ?? raw.name ?? 'REAL PLAY PLAYER').trim(),
      number: raw.jerseyNumber ?? raw.playerNumber ?? raw.player_number ?? null,
      team: String(raw.team || '').toLowerCase(),
      pts: n(raw.points ?? raw.pts), ast: n(raw.assists ?? raw.ast), reb: n(raw.rebounds ?? raw.reb),
      stl: n(raw.steals ?? raw.stl), blk: n(raw.blocks ?? raw.blk), to: n(raw.turnovers ?? raw.tov), fouls: n(raw.fouls ?? raw.foul),
      made, missed, attempts, fg: attempts ? Math.round((made / attempts) * 100) : null,
      impact: n(raw.impactScore ?? raw.impact_score) || (n(raw.points ?? raw.pts) + n(raw.rebounds ?? raw.reb) * 1.2 + n(raw.assists ?? raw.ast) * 1.5 + n(raw.steals ?? raw.stl) * 2 + n(raw.blocks ?? raw.blk) * 2 - n(raw.turnovers ?? raw.tov) * 1.5 - missed * .5 - n(raw.fouls ?? raw.foul) * .25),
      art: String(raw.cutoutUrl ?? raw.cutout_url ?? raw.playerImageUrl ?? raw.player_image_url ?? raw.profilePhotoUrl ?? raw.profile_photo_url ?? raw.avatarUrl ?? raw.avatar_url ?? '').trim(),
    };
  }

  function playerGrade(p) {
    let score = p.impact;
    if (p.attempts >= 3 && p.fg !== null) score += (p.fg - 35) / 12;
    if (score >= 12) return 'EXCELLENT';
    if (score >= 8) return 'STRONG';
    if (score >= 4) return 'SOLID';
    if (score >= 1) return 'LIMITED';
    return 'STRUGGLED';
  }

  function strongest(p) {
    const options = [
      ['scoring', p.pts * 1.4], ['rebounding', p.reb * 1.15], ['playmaking', p.ast * 1.7],
      ['defense', p.stl * 2 + p.blk * 2],
    ].sort((a,b) => b[1] - a[1]);
    return options[0][1] > 0 ? options[0][0] : 'activity';
  }

  function playerCopy(p, won, teamName, opponentName) {
    const grade = playerGrade(p);
    const strength = strongest(p);
    const statBits = [];
    if (p.pts) statBits.push(`${p.pts} points`);
    if (p.reb) statBits.push(`${p.reb} rebounds`);
    if (p.ast) statBits.push(`${p.ast} assists`);
    if (p.stl) statBits.push(`${p.stl} steals`);
    if (p.blk) statBits.push(`${p.blk} blocks`);
    const positives = statBits.slice(0,3).join(', ').replace(/, ([^,]*)$/, ' and $1');
    const weaknesses = [];
    if (p.attempts >= 3 && p.fg !== null && p.fg < 30) weaknesses.push(`${p.fg}% shooting`);
    if (p.to >= 3) weaknesses.push(`${p.to} turnovers`);
    const weak = weaknesses.join(' and ');

    let headline;
    if (grade === 'EXCELLENT' || grade === 'STRONG') headline = won
      ? `${p.name} makes a major impact in ${teamName}'s win.`
      : `${p.name} delivers a strong performance despite ${teamName} falling short.`;
    else if (grade === 'STRUGGLED' || grade === 'LIMITED') headline = won
      ? `${p.name} has a difficult outing, but ${teamName} still gets the win.`
      : `${p.name} struggles to find consistent impact in the loss.`;
    else headline = won
      ? `${p.name} provides a steady contribution as ${teamName} beats ${opponentName}.`
      : `${p.name} gives ${teamName} useful production, but the team falls short.`;

    let body = positives ? `${p.name}'s strongest contribution came through ${strength}, finishing with ${positives}.` : `${p.name} had a quieter statistical game.`;
    if (weak) body += ` The main drawback was ${weak}.`;
    if (won && (grade === 'LIMITED' || grade === 'STRUGGLED')) body += ' The rest of the lineup was able to overcome the difficult individual night and secure the result.';
    else if (!won && (grade === 'EXCELLENT' || grade === 'STRONG')) body += ' The individual production was not enough to overturn the final result.';
    else body += won ? ' Those contributions helped support the winning effort.' : ' The team ultimately could not convert enough of that production into a win.';

    return { grade, headline: clampWords(headline, 18), body: clampWords(body, 58) };
  }

  function teamCopy(side, players, game, won) {
    const name = side === 'west' ? game.westName : game.eastName;
    const opp = side === 'west' ? game.eastName : game.westName;
    const totals = players.reduce((a,p) => ({pts:a.pts+p.pts,reb:a.reb+p.reb,ast:a.ast+p.ast,stl:a.stl+p.stl,blk:a.blk+p.blk,to:a.to+p.to,impact:a.impact+p.impact}), {pts:0,reb:0,ast:0,stl:0,blk:0,to:0,impact:0});
    const best = [['rebounding',totals.reb],['ball movement',totals.ast*1.35],['defensive activity',totals.stl*1.8+totals.blk*1.8],['scoring production',totals.pts]].sort((a,b)=>b[1]-a[1])[0][0];
    const headline = won ? `${name} turns ${best} into the winning edge.` : `${name} battles, but ${opp} finds the stronger finish.`;
    const body = won
      ? `${name} combined for ${totals.reb} rebounds, ${totals.ast} assists and ${totals.stl + totals.blk} defensive plays. Their collective ${best} helped separate them from ${opp}.`
      : `${name} produced ${totals.reb} rebounds, ${totals.ast} assists and ${totals.stl + totals.blk} defensive plays, but the overall execution was not enough to get past ${opp}.`;
    return { headline: clampWords(headline,18), body: clampWords(body,58), totals };
  }

  function gameCopy(game) {
    const tie = game.westScore === game.eastScore;
    const westWon = game.westScore > game.eastScore;
    const winner = tie ? '' : westWon ? game.westName : game.eastName;
    const loser = tie ? '' : westWon ? game.eastName : game.westName;
    const margin = Math.abs(game.westScore - game.eastScore);
    const headline = tie
      ? `${game.westName} and ${game.eastName} finish level after a back-and-forth game.`
      : margin <= 2
        ? `${winner} survives a tight battle and edges ${loser}.`
        : `${winner} controls the result and finishes ahead of ${loser}.`;
    const body = tie
      ? `Neither side created enough separation, with the game ending ${game.westScore}-${game.eastScore}. Swipe through the team and player reports to see where each side made its impact.`
      : `${winner} finished the game ${Math.max(game.westScore,game.eastScore)}-${Math.min(game.westScore,game.eastScore)}. The following reports break down the team performance first, then each player's individual contribution.`;
    return { headline: clampWords(headline,18), body: clampWords(body,58) };
  }

  function statGrid(p) {
    return [['PTS',p.pts],['REB',p.reb],['AST',p.ast],['STL',p.stl],['BLK',p.blk],['TO',p.to],['FG%',p.fg === null ? '—' : `${p.fg}%`],['IMPACT',Math.round(p.impact*10)/10]];
  }

  function slideMarkup(slide, game) {
    const stats = slide.player ? `<div class="rp-story-stats">${statGrid(slide.player).map(([k,v])=>`<div class="rp-story-stat"><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join('')}</div>` : '';
    const art = slide.player?.art
      ? `<img class="rp-story-player-art" src="${esc(slide.player.art)}" alt="${esc(slide.player.name)}">`
      : slide.player ? `<div class="rp-story-player-fallback" aria-hidden="true">${esc(slide.player.name.charAt(0) || 'R')}</div>`
      : slide.type === 'team' ? `<div class="rp-story-team-mark" aria-hidden="true">${esc(slide.teamName)}</div>` : '';
    const score = slide.type === 'game' ? `<div class="rp-story-score"><b>${game.westScore}</b><span>${esc(game.westName)} · ${esc(game.eastName)}</span><b>${game.eastScore}</b></div>` : '';
    const kicker = slide.type === 'player' ? '' : `<span class="rp-story-kicker">${esc(slide.kicker)}</span>`;
    const winnerSide = game.westScore === game.eastScore ? null : (game.westScore > game.eastScore ? 'west' : 'east');
    const loserSide = winnerSide === 'west' ? 'east' : winnerSide === 'east' ? 'west' : null;
    const winnerLogo = winnerSide === 'west' ? game.westLogo : winnerSide === 'east' ? game.eastLogo : '';
    const loserLogo = loserSide === 'west' ? game.westLogo : loserSide === 'east' ? game.eastLogo : '';
    const winnerName = winnerSide === 'west' ? game.westName : winnerSide === 'east' ? game.eastName : '';
    const loserName = loserSide === 'west' ? game.westName : loserSide === 'east' ? game.eastName : '';
    const teamVisual = (name, logo, role) => logo
      ? `<img class="rp-story-game-team-logo ${role}" src="${esc(logo)}" alt="${esc(name)} team logo">`
      : `<div class="rp-story-game-team-fallback ${role}" aria-hidden="true">${esc(name.charAt(0) || 'T')}</div>`;
    const gameVersus = slide.type === 'game' && winnerSide
      ? `<div class="rp-story-game-versus" aria-label="${esc(winnerName)} versus ${esc(loserName)}">${teamVisual(winnerName,winnerLogo,'winner')}<div class="rp-story-game-vs">VS</div>${teamVisual(loserName,loserLogo,'loser')}</div>`
      : '';
    return `<article class="rp-story-slide" data-rp-story-slide>${art}${gameVersus}<div class="rp-story-content">${kicker}<h2 class="rp-story-headline">${esc(slide.headline)}</h2>${score}<p class="rp-story-body">${esc(slide.body)}</p>${stats}</div></article>`;
  }

  function buildDeck(game, rawPlayers) {
    const players = (Array.isArray(rawPlayers) ? rawPlayers : []).map(normalizePlayer).filter(p => ['west','east'].includes(p.team));
    const winner = game.westScore === game.eastScore ? null : game.westScore > game.eastScore ? 'west' : 'east';
    const first = winner || 'west';
    const second = first === 'west' ? 'east' : 'west';
    const slides = [];
    const gameStory = gameCopy(game);
    slides.push({type:'game',kicker:game.title,headline:gameStory.headline,body:gameStory.body});
    [first,second].forEach(side => {
      const teamPlayers = players.filter(p=>p.team===side).sort((a,b)=>b.impact-a.impact);
      const name = side === 'west' ? game.westName : game.eastName;
      const opponent = side === 'west' ? game.eastName : game.westName;
      const won = winner === side;
      const tc = teamCopy(side,teamPlayers,game,won);
      slides.push({type:'team',teamName:name,kicker:`${won ? 'WINNING' : winner ? 'LOSING' : 'TEAM'} REPORT`,headline:tc.headline,body:tc.body});
      teamPlayers.forEach(p => {
        const pc = playerCopy(p,won,name,opponent);
        slides.push({type:'player',player:p,kicker:`${name} · ${pc.grade}`,headline:pc.headline,body:pc.body});
      });
    });
    return slides;
  }

  function ensureViewer() {
    let viewer = document.querySelector('[data-rp-game-story-viewer]');
    if (viewer) return viewer;
    viewer = document.createElement('div');
    viewer.className = 'rp-story-viewer';
    viewer.dataset.rpGameStoryViewer = 'true';
    viewer.hidden = true;
    viewer.innerHTML = `<section class="rp-story-shell" role="dialog" aria-modal="true" aria-label="Game story"><div class="rp-story-top"><div class="rp-story-progress" data-rp-story-progress></div><div class="rp-story-nav"><small data-rp-story-position>GAME STORY</small><button class="rp-story-close" type="button" data-rp-story-close aria-label="Close story">×</button></div></div><div class="rp-story-track" data-rp-story-track></div><div class="rp-story-arrows"><button type="button" data-rp-story-prev aria-label="Previous story">‹</button><button type="button" data-rp-story-next aria-label="Next story">›</button></div></section>`;
    document.body.appendChild(viewer);
    viewer.querySelector('[data-rp-story-close]').addEventListener('click', close);
    viewer.addEventListener('click', e => { if (e.target === viewer) close(); });
    return viewer;
  }

  let active = { viewer:null, slides:[], index:0, startX:null, previousOverflow:'' };
  function renderIndex(index) {
    if (!active.viewer || !active.slides.length) return;
    active.index = Math.max(0,Math.min(index,active.slides.length-1));
    const track = active.viewer.querySelector('[data-rp-story-track]');
    track.style.transform = `translate3d(-${active.index*100}%,0,0)`;
    active.viewer.querySelectorAll('[data-rp-story-progress] i').forEach((el,i)=>{el.classList.toggle('active',i===active.index);el.classList.toggle('past',i<active.index);});
    active.viewer.querySelector('[data-rp-story-prev]').disabled = active.index === 0;
    active.viewer.querySelector('[data-rp-story-next]').disabled = active.index === active.slides.length-1;
    const slide = active.slides[active.index];
    active.viewer.querySelector('[data-rp-story-position]').textContent = `${slide.type === 'game' ? 'GAME' : slide.type === 'team' ? 'TEAM' : 'PLAYER'} · ${active.index+1}/${active.slides.length}`;
  }
  function close(){ if(!active.viewer) return; active.viewer.hidden=true; document.body.classList.remove('rp-story-open'); active.slides=[]; }
  async function open(card) {
    injectStyles();
    const game = readGameFromCard(card);
    if (!game.sessionId) return;
    const viewer = ensureViewer();
    active.viewer = viewer;
    viewer.hidden = false;
    document.body.classList.add('rp-story-open');
    const track = viewer.querySelector('[data-rp-story-track]');
    track.innerHTML = `<div class="rp-story-loading">BUILDING THE OFFICIAL GAME STORY…</div>`;
    viewer.querySelector('[data-rp-story-progress]').innerHTML = '<i class="active"></i>';
    try {
      const response = await fetch(`${API}/${game.sessionId}/replay`, {headers:{Accept:'application/json'},cache:'no-store'});
      if (!response.ok) throw new Error('Story stats unavailable');
      const data = await response.json();
      const rawPlayers = data?.playerStats || data?.players || [];
      active.slides = buildDeck(game,rawPlayers);
      track.innerHTML = active.slides.map(s=>slideMarkup(s,game)).join('');
      viewer.querySelector('[data-rp-story-progress]').innerHTML = active.slides.map(()=>'<i></i>').join('');
      renderIndex(0);
    } catch (error) {
      track.innerHTML = `<div class="rp-story-loading">STORY COULD NOT LOAD.<br><small>THE OFFICIAL GAME CARD IS STILL AVAILABLE.</small></div>`;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-rp-world-story-toggle]');
    if (!button) return;
    const card = button.closest('.rp-update-card.rp-update-result');
    if (!card) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    open(card);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!active.viewer || active.viewer.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') renderIndex(active.index-1);
    if (event.key === 'ArrowRight') renderIndex(active.index+1);
  });

  document.addEventListener('click', (event) => {
    if (!active.viewer || active.viewer.hidden) return;
    if (event.target.closest?.('[data-rp-story-prev]')) renderIndex(active.index-1);
    if (event.target.closest?.('[data-rp-story-next]')) renderIndex(active.index+1);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!active.viewer || active.viewer.hidden || !event.target.closest?.('[data-rp-story-track]')) return;
    active.startX = event.clientX;
  });
  document.addEventListener('pointerup', (event) => {
    if (active.startX === null || !active.viewer || active.viewer.hidden) return;
    const dx = event.clientX - active.startX; active.startX = null;
    if (Math.abs(dx) < 42) return;
    renderIndex(active.index + (dx < 0 ? 1 : -1));
  });

  window.RealPlayGameStoryViewer = { open, close };
})();
