(() => {
  if (window.__realPlayWorldPlayerFiltersInstalled) return;
  window.__realPlayWorldPlayerFiltersInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const COMMUNITY_URL = 'https://api.clarapmc.com/api/real-play/community';
  let panel = null, controls = null, list = null, listObserver = null;
  let sortKey = 'name';
  const directions = { ovr: 'desc', name: 'asc', jersey: 'asc' };
  let scheduled = false, rankSyncPromise = null, listVersion = 0, rankSyncVersion = 0;

  function installStyles() {
    if (document.querySelector('[data-rp-world-player-filter-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayerFilterStyles = '1';
    style.textContent = `
      .rp-world-player-sort{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:2px 0 1px}
      .rp-world-player-sort button{min-width:0;min-height:36px;padding:0 8px;border:1px solid rgba(255,255,255,.07);border-radius:11px;color:#64758a;background:#060b12;font-family:var(--rp-display,Arial,sans-serif);font-size:.5rem;font-weight:950;letter-spacing:.075em;white-space:nowrap}
      .rp-world-player-sort button.active{color:#dff9ff;border-color:rgba(54,205,255,.25);background:rgba(24,111,164,.11)}
      .rp-world-player-sort button.active b{color:#49d8ff}
      .rp-world-player-sort button:focus-visible{outline:2px solid rgba(72,215,255,.65);outline-offset:2px}
      .rp-world-player-sort b{margin-left:3px;color:#52667b;font-size:.55rem}
      .rp-world-player-directory-head{position:relative}
      .rp-world-player-ovr-info{position:absolute;top:0;right:1px;width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid rgba(72,216,255,.24);border-radius:50%;background:rgba(5,12,19,.82);color:#48d8ff;font-family:Georgia,serif;font-size:1rem;font-style:italic;font-weight:900;line-height:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);z-index:2}
      .rp-world-player-ovr-info:hover{border-color:rgba(72,216,255,.46);background:rgba(13,54,72,.35)}
      .rp-world-player-ovr-info:active{transform:scale(.96)}
      .rp-world-player-ovr-info:focus-visible{outline:2px solid rgba(72,215,255,.7);outline-offset:2px}
      .rp-world-player-rank{flex:none;color:#48d7ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.68rem;font-style:italic;font-weight:950;letter-spacing:.02em;line-height:1}
      .rp-world-player-name > b{display:none !important}
      @media(max-width:360px){.rp-world-player-sort{gap:5px}.rp-world-player-sort button{padding-inline:5px;font-size:.46rem;letter-spacing:.055em}.rp-world-player-ovr-info{width:34px;height:34px}.rp-world-player-rank{font-size:.64rem}}
    `;
    document.head.appendChild(style);
  }

  function rowIds() {
    return list ? [...list.querySelectorAll('.rp-world-player-row')].map(row => String(row.dataset.worldPlayerId || '').trim()) : [];
  }

  function buildCanonicalRankMap(players) {
    const map = new Map();
    (Array.isArray(players) ? players : []).forEach((player) => {
      const id = String(player?.userId ?? '').trim();
      const rank = Number(player?.rank);
      if (!id || !Number.isFinite(rank) || rank <= 0) return;
      map.set(id, rank);
    });
    return map;
  }

  function renderRankLabels() {
    if(!list) return;
    list.querySelectorAll('.rp-world-player-row').forEach(row=>{
      const nameNode=row.querySelector('.rp-world-player-name');
      if(!nameNode) return;
      const rankValue=Number.parseInt(String(row.dataset.playerRank||'').trim(),10);
      const official=Number.isFinite(rankValue)&&rankValue>0;
      let rankNode=nameNode.querySelector('[data-world-player-rank]');
      if(sortKey!=='ovr'||!official){rankNode?.remove();return;}
      if(!rankNode){
        rankNode=document.createElement('span');
        rankNode.className='rp-world-player-rank';
        rankNode.dataset.worldPlayerRank='true';
        const playerName=nameNode.querySelector('strong');
        if(playerName) nameNode.insertBefore(rankNode,playerName); else nameNode.prepend(rankNode);
      }
      rankNode.textContent=`#${rankValue}`;
      rankNode.setAttribute('aria-label',`Rank ${rankValue}`);
    });
  }

  async function syncRankMap() {
    if(!list) return;
    const accessToken=localStorage.getItem(TOKEN_KEY)||'';
    if(!accessToken) return;
    const requestedVersion=listVersion, requestedIds=rowIds();
    if(!requestedIds.length) return;
    if(rankSyncPromise) return rankSyncPromise;
    const syncVersion=++rankSyncVersion;
    rankSyncPromise=fetch(COMMUNITY_URL,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify({action:'players'}),cache:'no-store'})
      .then(r=>r.ok?r.json():null).then(data=>{
        if(syncVersion!==rankSyncVersion||requestedVersion!==listVersion)return;
        const current=rowIds();
        if(current.length!==requestedIds.length||current.some((id,i)=>id!==requestedIds[i]))return;
        const rankMap=buildCanonicalRankMap(data?.players);
        list.querySelectorAll('.rp-world-player-row').forEach(row=>{const id=String(row.dataset.worldPlayerId||'').trim();row.dataset.playerRank=rankMap.has(id)?String(rankMap.get(id)):'unranked'});
        renderRankLabels();
      }).catch(()=>{}).finally(()=>{rankSyncPromise=null;if(requestedVersion!==listVersion&&sortKey==='ovr')syncRankMap().then(scheduleSort)});
    return rankSyncPromise;
  }

  function rowMeta(row) {
    const name=String(row.querySelector('.rp-world-player-name strong')?.textContent||'').trim();
    const jerseyText=String(row.querySelector('.rp-world-player-name b')?.textContent||'').trim();
    const match=jerseyText.match(/#\s*(\d{1,2})/);
    const jersey=match?Number(match[1]):null;
    const ovrNode=row.querySelector('.rp-world-player-ovr');
    const rank=Number.parseInt(String(row.dataset.playerRank||'').trim(),10);
    const official=Number.isFinite(rank)&&rank>0;
    // OVR is an independent player attribute. Official rank eligibility must never
    // determine whether a player's OVR can participate in OVR sorting.
    const ovr=!ovrNode||ovrNode.classList.contains('unranked')?null:Number.parseFloat(String(ovrNode.textContent||'').replace(/[^0-9.\-]/g,''));
    return {row,name,jersey:Number.isFinite(jersey)?jersey:null,ovr:Number.isFinite(ovr)?ovr:null};
  }

  function compareName(a,b){return a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true})}
  function compareNullableNumber(a,b,key,direction){const av=a[key],bv=b[key],am=av==null,bm=bv==null;if(am!==bm)return am?1:-1;if(am&&bm)return compareName(a,b);if(av===bv)return compareName(a,b);return direction==='asc'?av-bv:bv-av}
  function sortedRows(){
    if(!list)return[];
    const rows=[...list.querySelectorAll('.rp-world-player-row')].map(rowMeta),direction=directions[sortKey];
    rows.sort((a,b)=>sortKey==='ovr'?compareNullableNumber(a,b,'ovr',direction):sortKey==='jersey'?compareNullableNumber(a,b,'jersey',direction):((r=compareName(a,b))=>direction==='asc'?r:-r)());
    return rows.map(x=>x.row);
  }

  function applySort(){
    scheduled=false;if(!list)return;renderRankLabels();
    const next=sortedRows(),current=[...list.querySelectorAll('.rp-world-player-row')];
    if(!next.length||current.length===next.length&&current.every((r,i)=>r===next[i]))return;
    if(listObserver)listObserver.disconnect();
    const fragment=document.createDocumentFragment();next.forEach(row=>fragment.appendChild(row));list.appendChild(fragment);
    if(listObserver&&list.isConnected)listObserver.observe(list,{childList:true});
  }
  function scheduleSort(){if(scheduled)return;scheduled=true;requestAnimationFrame(applySort)}
  function directionArrow(key){return key===sortKey?(directions[key]==='asc'?'↑':'↓'):''}
  function renderControls(){if(!controls)return;controls.querySelectorAll('[data-player-sort]').forEach(button=>{const key=button.dataset.playerSort,active=key===sortKey;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));const arrow=button.querySelector('b');if(arrow)arrow.textContent=directionArrow(key)});renderRankLabels()}
  async function selectSort(key){if(!['ovr','name','jersey'].includes(key))return;if(sortKey===key)directions[key]=directions[key]==='asc'?'desc':'asc';else sortKey=key;renderControls();if(sortKey==='ovr')await syncRankMap();scheduleSort()}

  function ensureOvrInfoButton(playersView){
    const header=playersView?.querySelector('.rp-world-player-directory-head');if(!header||header.querySelector('[data-world-ovr-simulator]'))return;
    const button=document.createElement('button');button.type='button';button.className='rp-world-player-ovr-info';button.dataset.worldOvrSimulator='true';button.setAttribute('aria-label','Open OVR simulator and calculation guide');button.title='How OVR works';button.textContent='i';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();window.location.href='ovr-simulator.html'});header.appendChild(button);
  }

  function install(){
    panel=document.querySelector('[data-rp-world]');if(!panel)return false;
    const playersView=panel.querySelector('[data-world-view="players"]');list=playersView?.querySelector('[data-world-player-list]')||null;const status=playersView?.querySelector('[data-world-player-status]')||null;if(!playersView||!list||!status)return false;
    ensureOvrInfoButton(playersView);
    controls=playersView.querySelector('[data-world-player-sort]');
    if(!controls){
      controls=document.createElement('div');controls.className='rp-world-player-sort';controls.dataset.worldPlayerSort='true';controls.setAttribute('aria-label','Sort players');
      controls.innerHTML='<button type="button" data-player-sort="ovr" aria-pressed="false">OVR / RANK <b></b></button><button type="button" data-player-sort="name" aria-pressed="true">NAME <b></b></button><button type="button" data-player-sort="jersey" aria-pressed="false">JERSEY # <b></b></button>';
      status.insertAdjacentElement('beforebegin',controls);controls.addEventListener('click',event=>{const button=event.target.closest('[data-player-sort]');if(button)selectSort(button.dataset.playerSort)});
    }
    renderControls();if(listObserver)listObserver.disconnect();
    listObserver=new MutationObserver(()=>{listVersion++;if(sortKey==='ovr')syncRankMap().then(scheduleSort);else scheduleSort()});
    listObserver.observe(list,{childList:true});scheduleSort();return true;
  }

  installStyles();
  if(!install()){const observer=new MutationObserver(()=>{if(install())observer.disconnect()});observer.observe(document.documentElement,{childList:true,subtree:true})}
})();
