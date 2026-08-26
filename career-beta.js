(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const pick=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!=='');
  const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function mount(){
    const app=document.querySelector('[data-rp-app]');
    if(!app)return false;
    if(document.querySelector('[data-rp-career-beta]'))return true;

    const cards=[...app.querySelectorAll('.rp-mode-card')];
    const career=app.querySelector('.rp-mode-career');
    const rating=app.querySelector('.rp-player-rating strong');
    const ratingLabel=app.querySelector('.rp-player-rating span');

    cards.forEach(card=>{
      const live=card===career||card.dataset.mode==='Career Mode';
      const button=card.querySelector('.rp-play-button');
      const type=card.querySelector('.rp-mode-type');
      card.classList.toggle('rp-beta-live',live);
      card.classList.toggle('rp-beta-locked',!live);
      if(live){
        if(type)type.textContent='BETA SEASON · LIVE';
        if(button){button.disabled=false;button.innerHTML='ENTER CAREER <span>→</span>';}
      }else if(button){
        button.disabled=true;
        button.removeAttribute('data-rp-select-mode');
        button.textContent='COMING SOON';
      }
    });
    if(rating)rating.textContent='BETA';
    if(ratingLabel)ratingLabel.textContent='RANKING LIVE';

    const panel=document.createElement('section');
    panel.className='rp-career-beta';
    panel.dataset.rpCareerBeta='true';
    panel.setAttribute('aria-hidden','true');
    panel.innerHTML=`
      <div class="rp-career-shell">
        <header class="rp-career-topbar">
          <button class="rp-career-back" type="button" data-career-close aria-label="Back to Play">←</button>
          <div class="rp-career-title"><strong>CAREER</strong><span>REAL PLAY BASKETBALL</span></div>
          <div class="rp-beta-pill">BETA SEASON</div>
        </header>

        <section class="rp-career-hero">
          <div class="rp-career-identity">
            <div class="rp-career-number" data-career-number>#--</div>
            <div class="rp-career-name"><small>REAL PLAY PLAYER</small><strong data-career-name>YOUR PLAYER</strong></div>
            <div class="rp-career-ovr"><strong data-career-ovr>—</strong><span>BETA OVR</span></div>
          </div>
          <p class="rp-career-rankline" data-career-rankline><strong>RANKING STARTS NOW.</strong> Your first verified Career game begins your Beta record.</p>
          <div class="rp-career-record">
            <article><span>GAMES</span><strong data-career-games>0</strong></article>
            <article><span>WINS</span><strong data-career-wins>0</strong></article>
            <article><span>LOSSES</span><strong data-career-losses>0</strong></article>
          </div>
        </section>

        <section class="rp-career-section">
          <div class="rp-career-section-head"><div><small>OFFICIAL CAREER</small><h2>Your Stats</h2></div><span>BETA SEASON</span></div>
          <div class="rp-career-stats">
            <article class="rp-career-stat"><span>PTS</span><strong data-career-pts>0</strong></article>
            <article class="rp-career-stat"><span>AST</span><strong data-career-ast>0</strong></article>
            <article class="rp-career-stat"><span>REB</span><strong data-career-reb>0</strong></article>
            <article class="rp-career-stat"><span>TO</span><strong data-career-to>0</strong></article>
          </div>
        </section>

        <section class="rp-career-section">
          <div class="rp-career-section-head"><div><small>GET BACK ON COURT</small><h2>Next Career Game</h2></div></div>
          <article class="rp-next-game" data-career-next>
            <div class="rp-next-game-status"><span>CAREER MODE</span><b data-session-status>NO SESSION POSTED</b></div>
            <h3 data-session-title>TO BE ANNOUNCED</h3>
            <p data-session-copy>When the first official Beta Career session is confirmed, the court, date, time and available spots will appear here.</p>
            <button type="button" data-session-action disabled>SECURE SPOT</button>
          </article>
        </section>

        <section class="rp-career-section">
          <div class="rp-career-section-head"><div><small>WHO'S MOVING UP?</small><h2>Beta Leaderboard</h2></div><span data-career-rank>RANK —</span></div>
          <div class="rp-leaderboard-tabs">
            <button class="rp-board-tab active" type="button">OVR</button>
            <button class="rp-board-tab" type="button" disabled>PTS</button>
            <button class="rp-board-tab" type="button" disabled>AST</button>
            <button class="rp-board-tab" type="button" disabled>REB</button>
          </div>
          <div class="rp-board-list" data-career-board>
            <div class="rp-empty-career"><strong>THE BOARD STARTS WITH THE FIRST GAME.</strong><p>No fake rankings. Verified Beta Career results will build this leaderboard.</p></div>
          </div>
        </section>

        <section class="rp-career-section">
          <div class="rp-career-section-head"><div><small>EVERY GAME STAYS</small><h2>Recent Games</h2></div></div>
          <div class="rp-game-list" data-career-game-list>
            <div class="rp-empty-career"><strong>NO CAREER GAMES YET.</strong><p>Your verified game result, stat line and OVR movement will appear here after you play.</p></div>
          </div>
        </section>
      </div>`;
    document.body.appendChild(panel);

    const q=s=>panel.querySelector(s);
    const nameNode=app.querySelector('[data-rp-name]');
    const numberNode=app.querySelector('[data-rp-number]');
    const set=(s,v)=>{const n=q(s);if(n)n.textContent=String(v);};

    function syncIdentity(){
      set('[data-career-name]',(nameNode?.textContent||'YOUR PLAYER').trim());
      set('[data-career-number]',(numberNode?.textContent||'#--').trim());
    }
    function open(){syncIdentity();panel.classList.add('open');panel.setAttribute('aria-hidden','false');document.body.classList.add('rp-career-open');panel.scrollTop=0;refresh();}
    function close(){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');document.body.classList.remove('rp-career-open');}

    function renderBoard(rows,me){
      const host=q('[data-career-board]');
      if(!host||!Array.isArray(rows)||!rows.length)return;
      host.innerHTML=rows.slice(0,10).map((row,i)=>{
        const name=pick(row.player_name,row.playerName,row.name,'PLAYER');
        const ovr=pick(row.ovr,row.rating,'—');
        const rank=pick(row.rank,i+1);
        const mine=String(name).trim().toLowerCase()===String(me||'').trim().toLowerCase();
        return `<article class="rp-board-row"><em>#${esc(rank)}</em><strong>${esc(name)}${mine?' · YOU':''}</strong><span>${esc(ovr)}</span></article>`;
      }).join('');
    }

    function renderGames(rows){
      const host=q('[data-career-game-list]');
      if(!host||!Array.isArray(rows)||!rows.length)return;
      host.innerHTML=rows.slice(0,8).map((g,i)=>{
        const result=String(pick(g.result,g.outcome,'VERIFIED')).toUpperCase();
        const label=pick(g.label,g.game_label,g.gameLabel,`CAREER GAME #${String(i+1).padStart(2,'0')}`);
        const pts=num(pick(g.pts,g.points),0),ast=num(pick(g.ast,g.assists),0),reb=num(pick(g.reb,g.rebounds),0);
        const before=pick(g.ovr_before,g.ovrBefore),after=pick(g.ovr_after,g.ovrAfter);
        const move=before!==undefined&&after!==undefined?`${before} → ${after}`:pick(g.ovr,'');
        return `<article class="rp-game-row"><div><small>${esc(result)}</small><strong>${esc(label)}</strong><p>${pts} PTS · ${ast} AST · ${reb} REB</p></div><b>${esc(move)}</b></article>`;
      }).join('');
    }

    function renderSession(s){
      if(!s||typeof s!=='object')return;
      const card=q('[data-career-next]');
      const title=pick(s.title,s.location_name,s.locationName,s.location,'CAREER GAME');
      const date=pick(s.date_label,s.dateLabel,s.date,''),time=pick(s.time_label,s.timeLabel,s.time,'');
      const cap=pick(s.capacity,s.player_capacity,s.playerCapacity),reserved=pick(s.reserved,s.reserved_count,s.reservedCount);
      const details=[date,time,cap!==undefined&&reserved!==undefined?`${reserved}/${cap} spots`:''].filter(Boolean).join(' · ');
      const bookable=Boolean(pick(s.bookable,s.canBook,s.can_book,false));
      card?.classList.add('has-session');
      set('[data-session-status]',bookable?'BOOKING OPEN':'SCHEDULED');set('[data-session-title]',title);set('[data-session-copy]',details||'Official Beta Career session');
      const action=q('[data-session-action]');if(action){action.disabled=!bookable;action.textContent=bookable?'SECURE SPOT':'BOOKING SOON';}
    }

    function render(state){
      const profile=state?.profile||{};
      const c=state?.career||state?.careerSummary||state?.career_summary||profile?.career||{};
      const s=state?.careerStats||state?.career_stats||c?.stats||state?.stats||{};
      const pname=pick(profile.player_name,profile.playerName,profile.name,nameNode?.textContent,'YOUR PLAYER');
      const pnum=pick(state?.currentNumber?.number,profile.player_number,profile.playerNumber,profile.number);
      if(pname)set('[data-career-name]',String(pname).toUpperCase());if(pnum!==undefined)set('[data-career-number]',`#${String(pnum).replace(/^#/,'')}`);
      const ovr=pick(state?.ovr,profile.ovr,c.ovr,c.rating,profile.rating),rank=pick(state?.rank,c.rank,profile.rank);
      set('[data-career-ovr]',ovr!==undefined?ovr:'—');set('[data-career-rank]',rank!==undefined?`RANK #${rank}`:'RANK —');
      set('[data-career-games]',num(pick(c.games,c.gamesPlayed,c.games_played,s.games,s.gamesPlayed),0));set('[data-career-wins]',num(pick(c.wins,s.wins),0));set('[data-career-losses]',num(pick(c.losses,s.losses),0));
      set('[data-career-pts]',num(pick(s.pts,s.points,c.pts,c.points),0));set('[data-career-ast]',num(pick(s.ast,s.assists,c.ast,c.assists),0));set('[data-career-reb]',num(pick(s.reb,s.rebounds,c.reb,c.rebounds),0));set('[data-career-to]',num(pick(s.to,s.turnovers,c.to,c.turnovers),0));
      if(rating)rating.textContent=ovr!==undefined?`${ovr} OVR`:'BETA';if(ratingLabel)ratingLabel.textContent=ovr!==undefined?'BETA RANKED':'RANKING LIVE';
      const line=q('[data-career-rankline]');if(line)line.innerHTML=ovr!==undefined?`<strong>${rank!==undefined?`RANK #${esc(rank)}`:'BETA RANKED'}.</strong> Every verified Career game can move your record.`:'<strong>RANKING STARTS NOW.</strong> Your first verified Career game begins your Beta record.';
      renderBoard(pick(state?.leaderboard,c?.leaderboard,state?.ovrLeaderboard,state?.ovr_leaderboard),pname);
      renderGames(pick(state?.recentGames,state?.recent_games,c?.recentGames,c?.recent_games,state?.games));
      renderSession(pick(state?.nextCareerSession,state?.next_career_session,state?.upcomingCareerSession,state?.upcoming_career_session));
    }

    async function refresh(){
      const token=localStorage.getItem(TOKEN_KEY);if(!token)return;
      try{const r=await fetch(`${API_BASE_URL}/api/real-play/me`,{headers:{Accept:'application/json',Authorization:`Bearer ${token}`}});if(r.ok)render(await r.json());}catch(_e){}
    }

    document.addEventListener('click',e=>{
      const trigger=e.target.closest('[data-rp-select-mode="Career Mode"], [data-rp-nav="career"]');
      if(!trigger)return;e.preventDefault();e.stopImmediatePropagation();open();
    },true);
    q('[data-career-close]')?.addEventListener('click',close);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('open'))close();});
    [nameNode,numberNode].forEach(n=>{if(n)new MutationObserver(syncIdentity).observe(n,{childList:true,characterData:true,subtree:true});});
    syncIdentity();refresh();return true;
  }

  if(mount())return;
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
