(() => {
  if (window.__realPlayAdminPlayerScheduleInstalled) return;
  window.__realPlayAdminPlayerScheduleInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const API_URL = 'https://api.clarapmc.com/api/real-play/admin/player';
  let selectedPlayerId = null;
  let selectedPlayerIdentity = null;
  let sheetBody = null;
  let bodyObserver = null;
  let mainMarkup = '';
  let identityMarkup = '';
  let actionBusy = false;

  const esc = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } };

  async function adminCall(action, payload = {}) {
    const accessToken = token();
    if (!accessToken) throw new Error('Please log in to Real Play first.');
    const response = await fetch(API_URL, {
      method:'POST',
      headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},
      body:JSON.stringify({action,...payload}),
      cache:'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || 'Could not update the reservation.');
    return data;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-admin-player-schedule-styles]')) return;
    const style=document.createElement('style');
    style.dataset.rpAdminPlayerScheduleStyles='1';
    style.textContent=`
      .rp-player-admin-action.schedule{color:#66ddff;border-color:rgba(72,215,255,.2);background:rgba(20,112,153,.07)}
      .rp-admin-schedule-meta{display:grid;gap:4px;margin:11px 0;padding:12px 13px;border:1px solid rgba(72,215,255,.14);border-radius:13px;background:rgba(15,94,128,.06)}
      .rp-admin-schedule-meta span{color:#65dfff;font-size:.46rem;font-weight:950;letter-spacing:.09em}
      .rp-admin-schedule-meta strong{color:#dfeaf4;font-family:var(--rp-display,Arial,sans-serif);font-size:.65rem;font-weight:950;text-transform:uppercase}
      .rp-admin-schedule-meta small{color:#8091a5;font-size:.5rem;font-weight:800;line-height:1.4}
      .rp-admin-team-list{display:grid;gap:8px;margin-top:10px}
      .rp-admin-team-choice{min-height:58px!important}
      .rp-admin-team-choice>div{display:grid;gap:3px;text-align:left}
      .rp-admin-team-choice strong{font-size:.58rem}
      .rp-admin-team-choice small{color:#75869a;font-size:.48rem;line-height:1.3}
      .rp-admin-create-form{display:grid;gap:9px;margin-top:10px}
      .rp-admin-create-form input,.rp-admin-create-form select{width:100%;box-sizing:border-box;min-height:44px;border:1px solid rgba(72,215,255,.18);border-radius:11px;background:#050b12;color:#e7f4fb;padding:0 12px;font-weight:800}
    `;
    document.head.appendChild(style);
  }

  function capturePlayer(event) {
    const row=event.target instanceof Element ? event.target.closest('.rp-world-player-row[data-world-player-id]') : null;
    if (!row) return;
    const id=Number(row.dataset.worldPlayerId);
    if (Number.isSafeInteger(id)&&id>0) {
      selectedPlayerId=id;
      const label=String(row.querySelector('strong')?.textContent || row.textContent || '').trim();
      const numbered=label.match(/^(.*?)\s+#(\d{1,2})(?:\b|\s|$)/);
      selectedPlayerIdentity={
        id,
        name:(numbered?.[1] || label.split(/\n/)[0] || '').trim(),
        playerNumber:numbered ? Number(numbered[2]) : null,
      };
    }
  }

  function enhanceMain() {
    if (!sheetBody) return;
    const jersey=sheetBody.querySelector('[data-admin-menu-action="change_jersey"]');
    if (!jersey || sheetBody.querySelector('[data-admin-schedule-open]')) return;
    const view=sheetBody.querySelector('[data-admin-menu-action="view"]');
    const button=document.createElement('button');
    button.type='button'; button.className='rp-player-admin-action schedule'; button.dataset.adminScheduleOpen='1';
    button.disabled=Boolean(view?.disabled);
    button.innerHTML='MANAGE RESERVATION <span>›</span>';
    jersey.insertAdjacentElement('afterend',button);
  }

  function restoreMain() {
    if (!sheetBody||!mainMarkup) return;
    sheetBody.innerHTML=mainMarkup; mainMarkup=''; identityMarkup=''; actionBusy=false; enhanceMain();
  }

  function renderLoading() {
    sheetBody.innerHTML=`${identityMarkup}<p class="rp-player-admin-status">LOADING RESERVATION…</p><div class="rp-player-admin-form-actions"><button type="button" data-admin-schedule-back>BACK</button><button disabled>LOADING…</button></div>`;
  }

  function formatStart(value) {
    if (!value) return 'UPCOMING SESSION';
    const date=new Date(value);
    if (Number.isNaN(date.getTime())) return 'UPCOMING SESSION';
    return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);
  }

  function renderState(state,message='',type='') {
    const session=state?.session;
    const teams=Array.isArray(state?.teams)?state.teams:[];
    const currentId=Number(state?.currentTeamId||0);
    const current=teams.find(t=>Number(t.id)===currentId);
    const available=Boolean(state?.teamReservationAvailable);
    const teamButtons=teams.filter(t=>Number(t.memberCount||0)<Number(t.capacity||4) && Number(t.id)!==currentId).map(t=>`
      <button type="button" class="rp-player-admin-action rp-admin-team-choice" data-admin-team-id="${Number(t.id)}">
        <div><strong>${esc(t.name)}</strong><small>${Number(t.memberCount||0)}/${Number(t.capacity||4)} PLAYERS · \${String(t.visibility||'open').toUpperCase()} TEAM</small></div><span>›</span>
      </button>`).join('');

    sheetBody.innerHTML=`
      ${identityMarkup}
      <p class="rp-player-admin-status ${type}" data-rp-admin-schedule-status>${esc(message)}</p>
      ${session?`<div class="rp-admin-schedule-meta"><span>UPCOMING RANKING GAME</span><strong>${esc(session.title||'OPEN RANKING')}</strong><small>${esc(formatStart(session.startsAt))}</small><small>${current?`CURRENT TEAM · ${esc(current.name)}`:'NO TEAM YET'}</small></div>`:'<p class="rp-player-admin-warning">There is no open upcoming Ranking Game right now.</p>'}
      ${session && !current ? `
        <div class="rp-player-admin-actions">
          ${available?`<button type="button" class="rp-player-admin-action schedule" data-admin-reservation-op="random"><div><strong>RANDOM TEAM</strong><small>Place this player into the best available Open Team.</small></div><span>›</span></button>
          <button type="button" class="rp-player-admin-action schedule" data-admin-create-open><div><strong>CREATE TEAM FOR PLAYER</strong><small>Create a new team with this player occupying the first spot.</small></div><span>›</span></button>`:''}
          <button type="button" class="rp-player-admin-action" data-admin-reservation-op="standby"><div><strong>ADD AS STANDBY</strong><small>No secured spot until space becomes available.</small></div><span>›</span></button>
        </div>
        ${available && teamButtons?`<div class="rp-admin-team-list"><div class="rp-admin-schedule-meta"><span>ASSIGN TO EXISTING TEAM</span><small>Choose any existing team with an available slot.</small></div>${teamButtons}</div>`:''}
      ` : current ? `<div class="rp-admin-schedule-meta"><span>RESERVATION SET</span><strong>${esc(current.name)}</strong><small>This player already occupies a team slot for the upcoming session.</small></div>
        <button type="button" class="rp-player-admin-action danger" data-admin-reservation-cancel><div><strong>CANCEL RESERVATION</strong><small>Remove this player from the team and release their secured session spot.</small></div><span>›</span></button>` : ''}
      <div class="rp-player-admin-form-actions" style="margin-top:10px"><button type="button" data-admin-schedule-back>BACK</button><button type="button" disabled>TEAM RESERVATION</button></div>`;
  }

  function reservationPlayerPayload() {
    const payload={playerId:selectedPlayerId};
    if (selectedPlayerIdentity?.name) payload.playerName=selectedPlayerIdentity.name;
    if (Number.isInteger(selectedPlayerIdentity?.playerNumber)) payload.playerNumber=selectedPlayerIdentity.playerNumber;
    payload.allowUnclaimed=true;
    return payload;
  }

  async function loadState(message='',type='') {
    try { const state=await adminCall('team_reservation_access',reservationPlayerPayload()); renderState(state,message,type); }
    catch(error){ renderState(null,error.message||'Could not load reservation.','error'); }
  }

  async function openSchedule() {
    if (!sheetBody||!selectedPlayerId) return;
    mainMarkup=sheetBody.innerHTML;
    identityMarkup=sheetBody.querySelector('.rp-player-admin-identity')?.outerHTML||'';
    renderLoading(); await loadState();
  }

  async function cancelReservation() {
    if (actionBusy) return;
    if (!window.confirm('Cancel this player’s reservation? This will remove them from their team and release their secured session spot.')) return;
    actionBusy=true;
    sheetBody?.querySelectorAll('button').forEach(b=>{ if(!b.matches('[data-admin-schedule-back]')) b.disabled=true; });
    try {
      const result=await adminCall('team_reservation_cancel',reservationPlayerPayload());
      await loadState(result?.message||'Reservation cancelled.','success');
      try{window.RealPlayRankingGames?.refresh?.();}catch(_){}
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed',{detail:{source:'admin-player-schedule',playerId:selectedPlayerId}}));
    } catch(error) { await loadState(error.message||'Could not cancel reservation.','error'); }
    finally { actionBusy=false; }
  }

  async function updateReservation(payload) {
    if (actionBusy) return;
    actionBusy=true;
    sheetBody?.querySelectorAll('button').forEach(b=>{ if(!b.matches('[data-admin-schedule-back]')) b.disabled=true; });
    try {
      const result=await adminCall('team_reservation_update',{...reservationPlayerPayload(),...payload});
      renderState(result,result?.message||'Reservation updated.','success');
      try{window.RealPlayRankingGames?.refresh?.();}catch(_){}
      window.dispatchEvent(new CustomEvent('realplay:ranking-session-changed',{detail:{source:'admin-player-schedule',playerId:selectedPlayerId}}));
    } catch(error) { await loadState(error.message||'Could not update reservation.','error'); }
    finally { actionBusy=false; }
  }

  function renderCreateForm() {
    sheetBody.innerHTML=`${identityMarkup}<div class="rp-admin-schedule-meta"><span>CREATE TEAM FOR PLAYER</span><small>The player will appear normally as the team creator. No admin-assigned label is shown.</small></div>
      <form class="rp-admin-create-form" data-admin-create-form>
        <input name="name" maxlength="24" placeholder="TEAM NAME" required>
        <select name="visibility"><option value="open">OPEN TEAM — ANYONE CAN JOIN</option><option value="private">PRIVATE TEAM — 4-DIGIT CODE</option></select>
        <input name="code" inputmode="numeric" maxlength="4" placeholder="4-DIGIT CODE" hidden>
        <div class="rp-player-admin-form-actions"><button type="button" data-admin-create-cancel>BACK</button><button type="submit">CREATE TEAM</button></div>
      </form>`;
    const form=sheetBody.querySelector('[data-admin-create-form]');
    const code=form.elements.code;
    form.elements.visibility.addEventListener('change',()=>{code.hidden=form.elements.visibility.value!=='private';code.required=!code.hidden;});
    form.addEventListener('submit',e=>{e.preventDefault();updateReservation({operation:'create',name:form.elements.name.value,visibility:form.elements.visibility.value,code:code.value});});
  }

  function attachToSheet() {
    const next=document.querySelector('[data-rp-player-admin-sheet] [data-rp-player-admin-body]');
    if(!next)return false;
    if(sheetBody===next){enhanceMain();return true;}
    bodyObserver?.disconnect(); sheetBody=next;
    bodyObserver=new MutationObserver(()=>enhanceMain()); bodyObserver.observe(sheetBody,{childList:true,subtree:false}); enhanceMain(); return true;
  }

  installStyles();
  document.addEventListener('pointerdown',capturePlayer,true);
  document.addEventListener('contextmenu',capturePlayer,true);
  document.addEventListener('click',event=>{
    capturePlayer(event);
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    if(target.closest('[data-admin-schedule-open]')){event.preventDefault();openSchedule();return;}
    if(target.closest('[data-admin-schedule-back]')){event.preventDefault();restoreMain();return;}
    if(target.closest('[data-admin-create-open]')){event.preventDefault();renderCreateForm();return;}
    if(target.closest('[data-admin-reservation-cancel]')){event.preventDefault();cancelReservation();return;}
    if(target.closest('[data-admin-create-cancel]')){event.preventDefault();loadState();return;}
    const team=target.closest('[data-admin-team-id]');if(team){event.preventDefault();updateReservation({operation:'team',teamId:Number(team.dataset.adminTeamId)});return;}
    const op=target.closest('[data-admin-reservation-op]');if(op){event.preventDefault();updateReservation({operation:op.dataset.adminReservationOp});}
  });
  if(!attachToSheet()){const observer=new MutationObserver(()=>{if(attachToSheet())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}
})();