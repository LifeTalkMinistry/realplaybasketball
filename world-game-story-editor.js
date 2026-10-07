(() => {
  if (window.__realPlayGameStoryEditorInstalled) return;
  window.__realPlayGameStoryEditorInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STORAGE_PREFIX = 'real_play_story_art_view_v1:';
  const REGISTRY_URL = 'assets/profile-art/registry.json';

  let ownPlayerId = null;
  let ownArtSrc = '';
  let identityPromise = null;
  let activeFrame = null;
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const tapState = new WeakMap();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const positiveId = (value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };

  function storageKey(playerId) { return `${STORAGE_PREFIX}${playerId}`; }
  function normalizeView(raw = {}) {
    const panX = Number(raw.panX), panY = Number(raw.panY), scale = Number(raw.scale);
    return {
      panX: Number.isFinite(panX) ? clamp(panX, -45, 45) : 0,
      panY: Number.isFinite(panY) ? clamp(panY, -45, 45) : 0,
      scale: Number.isFinite(scale) ? clamp(scale, .72, 2.2) : 1,
    };
  }
  function loadView() {
    if (!ownPlayerId) return normalizeView();
    try { return normalizeView(JSON.parse(localStorage.getItem(storageKey(ownPlayerId)) || '{}')); }
    catch (_error) { return normalizeView(); }
  }
  function saveView(view) {
    if (!ownPlayerId) return;
    try { localStorage.setItem(storageKey(ownPlayerId), JSON.stringify(normalizeView(view))); }
    catch (_error) {}
  }
  function resolveSrc(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    try {
      if (value.startsWith('/api/')) return new URL(value, API_BASE_URL).href;
      return new URL(value, window.location.href).href;
    } catch (_error) { return value; }
  }

  async function resolveIdentity() {
    if (identityPromise) return identityPromise;
    identityPromise = (async () => {
      const token = localStorage.getItem(TOKEN_KEY) || '';
      if (!token) return null;
      try {
        const accessResponse = await fetch(`${API_BASE_URL}/api/real-play/admin/profile-art/access`, {
          headers: { Accept:'application/json', Authorization:`Bearer ${token}` }, cache:'no-store',
        });
        if (!accessResponse.ok) return null;
        const access = await accessResponse.json().catch(() => ({}));
        ownPlayerId = positiveId(access?.userId ?? access?.adminUserId);
        if (!ownPlayerId) return null;
        try {
          const artResponse = await fetch(`${API_BASE_URL}/api/real-play/profile-art?playerId=${encodeURIComponent(ownPlayerId)}`, {
            headers: { Accept:'application/json' }, cache:'no-store',
          });
          if (artResponse.ok) {
            const data = await artResponse.json().catch(() => ({}));
            if (data?.art && data.art.enabled !== false && data.art.src) {
              ownArtSrc = resolveSrc(data.art.src);
              return { playerId:ownPlayerId, src:ownArtSrc };
            }
          }
        } catch (_error) {}
        try {
          const registryResponse = await fetch(`${REGISTRY_URL}?v=20261007-story-view-editor-v1`, {
            headers: { Accept:'application/json' }, cache:'no-store',
          });
          if (registryResponse.ok) {
            const registry = await registryResponse.json().catch(() => ({}));
            const entry = (Array.isArray(registry?.players) ? registry.players : []).find((item) =>
              positiveId(item?.playerId ?? item?.player_id ?? item?.userId ?? item?.user_id) === ownPlayerId
            );
            if (entry?.src) ownArtSrc = resolveSrc(entry.src);
          }
        } catch (_error) {}
        return { playerId:ownPlayerId, src:ownArtSrc };
      } catch (_error) { return null; }
    })();
    return identityPromise;
  }

  function frameView(frame) {
    return normalizeView({ panX:frame?.dataset?.rpStoryPanX, panY:frame?.dataset?.rpStoryPanY, scale:frame?.dataset?.rpStoryScale });
  }
  function applyView(frame, view) {
    if (!frame) return;
    const next = normalizeView(view);
    frame.dataset.rpStoryPanX = String(next.panX);
    frame.dataset.rpStoryPanY = String(next.panY);
    frame.dataset.rpStoryScale = String(next.scale);
    const image = frame.querySelector('.rp-story-player-art');
    image?.style.setProperty('--rp-story-player-pan-x', `${next.panX}%`);
    image?.style.setProperty('--rp-story-player-pan-y', `${next.panY}%`);
    image?.style.setProperty('--rp-story-player-art-scale', String(next.scale));
  }
  function editorMarkup() {
    return `<span class="rp-story-player-edit-hint" aria-hidden="true">DOUBLE TAP TO ADJUST</span><div class="rp-story-player-edit-tools" data-rp-story-edit-tools><span>STORY VIEW</span><div><button type="button" data-rp-story-edit-action="zoom-out" aria-label="Zoom out">−</button><button type="button" data-rp-story-edit-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-rp-story-edit-action="reset">RESET</button><button type="button" data-rp-story-edit-action="cancel">CANCEL</button><button type="button" data-rp-story-edit-action="save">SAVE</button></div></div>`;
  }
  function sameSource(image) {
    if (!ownArtSrc || !image) return false;
    const imageSrc = resolveSrc(image.currentSrc || image.src);
    if (imageSrc === ownArtSrc) return true;
    try { const a = new URL(imageSrc), b = new URL(ownArtSrc); return a.origin === b.origin && a.pathname === b.pathname; }
    catch (_error) { return false; }
  }
  async function decorate(root = document) {
    const identity = await resolveIdentity();
    if (!identity?.playerId || !identity?.src) return;
    root.querySelectorAll?.('.rp-story-player-art-frame').forEach((frame) => {
      if (frame.classList.contains('rp-story-view-editor-ready')) return;
      const image = frame.querySelector('.rp-story-player-art');
      if (!sameSource(image)) return;
      frame.classList.add('rp-story-view-editor-ready','is-own');
      frame.dataset.rpStoryPlayerId = String(identity.playerId);
      applyView(frame, loadView());
      if (!frame.querySelector('[data-rp-story-edit-tools]')) frame.insertAdjacentHTML('beforeend', editorMarkup());
    });
  }

  function beginEdit(frame) {
    if (!frame?.classList.contains('is-own')) return;
    if (activeFrame && activeFrame !== frame) finishEdit(false);
    frame.dataset.rpStoryOriginalView = JSON.stringify(frameView(frame));
    frame.classList.add('is-editing');
    activeFrame = frame; pointers.clear(); drag = null; pinch = null;
  }
  function finishEdit(save) {
    const frame = activeFrame; if (!frame) return;
    if (save) saveView(frameView(frame));
    else { try { applyView(frame, JSON.parse(frame.dataset.rpStoryOriginalView || '{}')); } catch (_error) {} }
    frame.classList.remove('is-editing'); delete frame.dataset.rpStoryOriginalView;
    pointers.clear(); drag = null; pinch = null; activeFrame = null;
  }
  function zoom(frame, delta) { const current = frameView(frame); applyView(frame,{...current,scale:current.scale+delta}); }

  function injectStyles() {
    if (document.getElementById('rp-story-view-editor-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-story-view-editor-style';
    style.textContent = `
      .rp-story-player-art-frame .rp-story-player-art{object-position:center center!important;transform:translate(var(--rp-story-player-pan-x,0%),var(--rp-story-player-pan-y,0%)) scale(var(--rp-story-player-art-scale,1))!important;transform-origin:center center!important;user-select:none!important;-webkit-user-drag:none!important}
      .rp-story-player-art-frame.is-own{pointer-events:auto!important;touch-action:pan-y;cursor:zoom-in}
      .rp-story-player-edit-hint{position:absolute;z-index:6;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;min-height:24px;padding:0 10px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(2,7,12,.78);color:#d9edf5;font:900 .42rem/1 Arial,sans-serif;letter-spacing:.10em;white-space:nowrap;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none}
      .rp-story-player-edit-tools{position:absolute;z-index:8;left:8px;right:8px;bottom:8px;display:none;padding:7px;border:1px solid rgba(255,255,255,.11);border-radius:13px;background:rgba(2,7,12,.91);box-shadow:0 12px 30px rgba(0,0,0,.42);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
      .rp-story-player-edit-tools>span{display:block;margin-bottom:6px;color:#7f92a5;font:900 .40rem/1 Arial,sans-serif;letter-spacing:.12em;text-align:center}.rp-story-player-edit-tools>div{display:grid;grid-template-columns:34px 34px 1fr 1fr 1fr;gap:5px}
      .rp-story-player-edit-tools button{min-width:0;height:31px;padding:0 5px;border:1px solid rgba(255,255,255,.10);border-radius:8px;background:#09121c;color:#eef8ff;font:950 .46rem/1 Arial,sans-serif;letter-spacing:.035em;cursor:pointer}.rp-story-player-edit-tools button[data-rp-story-edit-action="save"]{color:#031018;border-color:#61dcff;background:#61dcff}
      .rp-story-player-art-frame.is-editing{z-index:12!important;touch-action:none!important;cursor:grab;border-color:rgba(var(--rp-story-club-rgb),.72)!important;box-shadow:0 24px 58px rgba(0,0,0,.60),0 0 0 2px rgba(var(--rp-story-club-rgb),.20)!important}.rp-story-player-art-frame.is-editing:active{cursor:grabbing}.rp-story-player-art-frame.is-editing .rp-story-player-edit-hint{display:none}.rp-story-player-art-frame.is-editing .rp-story-player-edit-tools{display:block}.rp-story-player-art-frame.is-editing .rp-story-player-art-shade{opacity:.34}
      @media(max-width:380px){.rp-story-player-edit-tools{left:6px;right:6px;bottom:6px;padding:6px}.rp-story-player-edit-tools>span{display:none}.rp-story-player-edit-tools>div{grid-template-columns:30px 30px 1fr 1fr 1fr;gap:4px}.rp-story-player-edit-tools button{height:29px;font-size:.42rem}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('dblclick',(event)=>{ const frame=event.target.closest?.('.rp-story-player-art-frame.is-own'); if(!frame||frame.classList.contains('is-editing'))return; event.preventDefault();event.stopPropagation();beginEdit(frame); },true);
  document.addEventListener('pointerup',(event)=>{ const frame=event.target.closest?.('.rp-story-player-art-frame.is-own'); if(!frame||frame.classList.contains('is-editing'))return; const state=tapState.get(frame)||{time:0,x:0,y:0}; const now=Date.now(); const closeEnough=Math.hypot(event.clientX-state.x,event.clientY-state.y)<24; if(now-state.time<=330&&closeEnough){tapState.set(frame,{time:0,x:0,y:0});event.preventDefault();event.stopPropagation();beginEdit(frame);}else tapState.set(frame,{time:now,x:event.clientX,y:event.clientY}); },true);
  document.addEventListener('click',(event)=>{ const button=event.target.closest?.('[data-rp-story-edit-action]'); if(!button||!activeFrame||!button.closest('.rp-story-player-art-frame.is-editing'))return; event.preventDefault();event.stopPropagation(); const action=button.dataset.rpStoryEditAction; if(action==='zoom-out')zoom(activeFrame,-.06); else if(action==='zoom-in')zoom(activeFrame,.06); else if(action==='reset')applyView(activeFrame,{panX:0,panY:0,scale:1}); else if(action==='cancel')finishEdit(false); else if(action==='save')finishEdit(true); },true);
  document.addEventListener('pointerdown',(event)=>{ const frame=event.target.closest?.('.rp-story-player-art-frame.is-editing'); if(!frame||frame!==activeFrame||event.target.closest?.('[data-rp-story-edit-tools]'))return; event.preventDefault();event.stopPropagation(); try{frame.setPointerCapture(event.pointerId)}catch(_error){} pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); const view=frameView(frame); if(pointers.size===1){drag={x:event.clientX,y:event.clientY,panX:view.panX,panY:view.panY};pinch=null}else if(pointers.size===2){const pts=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)),scale:view.scale};drag=null} },true);
  document.addEventListener('pointermove',(event)=>{ if(!activeFrame||!pointers.has(event.pointerId))return; event.preventDefault();event.stopPropagation(); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); if(pointers.size>=2){const pts=[...pointers.values()].slice(0,2);const distance=Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y));if(pinch){const current=frameView(activeFrame);applyView(activeFrame,{...current,scale:pinch.scale*(distance/pinch.distance)})}return} if(!drag)return; const rect=activeFrame.getBoundingClientRect();if(!rect.width||!rect.height)return;const current=frameView(activeFrame);applyView(activeFrame,{...current,panX:drag.panX+((event.clientX-drag.x)/rect.width)*100,panY:drag.panY+((event.clientY-drag.y)/rect.height)*100}); },true);
  const releasePointer=(event)=>{ if(!activeFrame||!pointers.has(event.pointerId))return; pointers.delete(event.pointerId);pinch=null;const remaining=[...pointers.values()];if(remaining.length===1){const current=frameView(activeFrame);drag={x:remaining[0].x,y:remaining[0].y,panX:current.panX,panY:current.panY}}else drag=null; };
  document.addEventListener('pointerup',releasePointer,true); document.addEventListener('pointercancel',releasePointer,true);
  document.addEventListener('wheel',(event)=>{ const frame=event.target.closest?.('.rp-story-player-art-frame.is-editing'); if(!frame||frame!==activeFrame)return; event.preventDefault();zoom(frame,event.deltaY>0?-.05:.05); },{passive:false,capture:true});
  document.addEventListener('click',(event)=>{ if(activeFrame&&event.target.closest?.('[data-rp-story-prev],[data-rp-story-next],[data-rp-story-close]'))finishEdit(false); },true);

  const observer=new MutationObserver((mutations)=>{ const relevant=mutations.some((mutation)=>[...mutation.addedNodes].some((node)=>node instanceof HTMLElement&&(node.matches?.('.rp-story-player-art-frame,.rp-story-track')||node.querySelector?.('.rp-story-player-art-frame')))); if(relevant)setTimeout(()=>decorate(document),30); if(activeFrame&&!activeFrame.isConnected){activeFrame=null;pointers.clear();drag=null;pinch=null;} });
  injectStyles(); observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('storage',(event)=>{ if(event.key===TOKEN_KEY){ownPlayerId=null;ownArtSrc='';identityPromise=null;setTimeout(()=>decorate(document),20)} });
  setTimeout(()=>decorate(document),40);
})();
