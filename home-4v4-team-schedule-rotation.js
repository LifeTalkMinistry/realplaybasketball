(() => {
  if (window.__realPlayTeamRotationPickerInstalled) return;
  window.__realPlayTeamRotationPickerInstalled = true;

  const API = 'https://api.clarapmc.com/api/real-play/public/updates';
  const STORE = 'real_play_4v4_time_slot';
  const DAYS = ['SATURDAY', 'SUNDAY'];
  let rotations = [];
  let modal = null;

  const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const clock = (v) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : '';
  const displayTime = (v) => { const [h,m] = v.split(':'); const n = Number(h); return `${n % 12 || 12}:${m} ${n >= 12 ? 'PM' : 'AM'}`; };
  const keys = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean))];

  function selected() { try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (_) { return null; } }
  function setSelected(item) {
    try { item ? sessionStorage.setItem(STORE, JSON.stringify(item)) : sessionStorage.removeItem(STORE); } catch (_) {}
    window.__realPlay4v4SelectedSlot = item || null;
    window.__realPlay4v4AssignedTeamKeys = item?.teamKeys || null;
    window.dispatchEvent(new CustomEvent('realplay:4v4-slot-context', { detail: { slot:item || null, rotation:item || null, filterMode:item ? 'assigned' : 'all', teamKeys:item?.teamKeys || null } }));
  }

  function latestUpdate(list) {
    const found = (Array.isArray(list) ? list : []).filter((u) => String(u?.category || '').toLowerCase() === 'schedule' && u?.metadata?.teamSchedule);
    return found.sort((a,b) => Date.parse(b?.published_at || '') - Date.parse(a?.published_at || ''))[0] || null;
  }
  function fromSchedule(schedule) {
    if (!schedule || schedule.mode === 'open' || !Array.isArray(schedule.blocks)) return [];
    const legacy = Number(schedule.version || 1) < 2 || !schedule.blocks.some((b) => b?.day);
    const seen = new Set();
    return schedule.blocks.slice(0, 12).map((b, i) => {
      const day = DAYS.includes(String(b?.day || '').toUpperCase()) ? String(b.day).toUpperCase() : DAYS[i % 2];
      const start = legacy ? '20:00' : (clock(b?.start) || '20:00');
      const end = legacy ? '22:00' : (clock(b?.end) || '22:00');
      const id = `${day.toLowerCase()}-${start.replace(':','')}-${end.replace(':','')}`;
      return { id, day, start, end, label:`${day} · ${displayTime(start)} – ${displayTime(end)}`, teamKeys:keys(b?.teamKeys), filterMode:'assigned' };
    }).filter((item) => item.teamKeys.length && !seen.has(item.id) && seen.add(item.id)).sort((a,b) => DAYS.indexOf(a.day)-DAYS.indexOf(b.day));
  }
  async function refresh() {
    try {
      const res = await fetch(API, { headers:{Accept:'application/json'}, cache:'no-store' });
      const data = res.ok ? await res.json() : {};
      rotations = fromSchedule(latestUpdate(data?.updates)?.metadata?.teamSchedule);
    } catch (_) { rotations = []; }
    const saved = selected();
    if (saved?.id) {
      const current = rotations.find((r) => r.id === saved.id);
      setSelected(current || null);
    }
    return rotations;
  }

  function styles() {
    if (document.getElementById('rp-team-rotation-style')) return;
    const s = document.createElement('style'); s.id='rp-team-rotation-style';
    s.textContent=`
      .rp-team-rotation-modal[hidden]{display:none!important}.rp-team-rotation-modal{position:fixed;inset:0;z-index:980;display:grid;place-items:center;padding:20px;background:rgba(0,5,12,.8);backdrop-filter:blur(8px)}
      .rp-team-rotation-card{width:min(100%,520px);padding:18px;border:1px solid rgba(47,216,255,.28);border-radius:24px;background:radial-gradient(circle at 15% 0%,rgba(0,174,255,.14),transparent 32%),radial-gradient(circle at 88% 8%,rgba(238,38,67,.12),transparent 30%),linear-gradient(180deg,#07131f,#02070d);color:#f4f8fb}
      .rp-team-rotation-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.rp-team-rotation-head h2{margin:0;font:950 italic 1.35rem/1.05 system-ui,sans-serif;text-transform:uppercase}.rp-team-rotation-close{width:42px;height:42px;border:1px solid rgba(47,216,255,.25);border-radius:14px;background:#06111c;color:#dce9f3;font-size:1.25rem;font-weight:900}
      .rp-team-rotation-help{margin:8px 0 16px;color:#8ca0b1;font:750 .64rem/1.45 system-ui,sans-serif}.rp-team-rotation-list{display:grid;gap:11px}
      .rp-team-rotation-option{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;width:100%;min-height:76px;padding:14px 16px;border:1px solid rgba(47,216,255,.24);border-radius:16px;background:#071522;color:#f5fbff;text-align:left;box-shadow:inset 3px 0 0 #28ccff}.rp-team-rotation-option small{display:block;margin-bottom:5px;color:#70879b;font-size:.58rem;font-weight:900;letter-spacing:.14em}.rp-team-rotation-option strong{font-size:1rem}.rp-team-rotation-option b{color:#28ccff;font-size:1.3rem}.rp-team-rotation-empty{padding:18px;border:1px dashed rgba(47,216,255,.2);border-radius:16px;color:#8295a5;text-align:center;font:850 .68rem/1.5 system-ui,sans-serif}
      .rp-4v4-team-slot{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;width:calc(100% - 28px);max-width:500px;margin:12px auto 4px;padding:11px 13px;border:1px solid rgba(47,216,255,.24);border-radius:13px;background:#071522;color:#eff9ff;text-align:left}.rp-4v4-team-slot small{display:block;color:#28ccff;font-size:.52rem;font-weight:900;letter-spacing:.11em}.rp-4v4-team-slot strong{font-size:.72rem}.rp-4v4-team-slot span:last-child{color:#7890a4;font-size:.56rem;font-weight:900}
    `; document.head.appendChild(s);
  }
  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal=document.createElement('div'); modal.className='rp-team-rotation-modal'; modal.hidden=true;
    modal.innerHTML=`<section class="rp-team-rotation-card"><div class="rp-team-rotation-head"><h2>TEAM SCHEDULE ROTATION</h2><button class="rp-team-rotation-close" type="button" aria-label="Close">×</button></div><p class="rp-team-rotation-help">Check which day your team is scheduled. If your team is not on Saturday, check Sunday.</p><div class="rp-team-rotation-list"></div></section>`;
    document.body.appendChild(modal); modal.querySelector('.rp-team-rotation-close').onclick=close; modal.onclick=(e)=>{if(e.target===modal)close();}; return modal;
  }
  function render() {
    const list=ensureModal().querySelector('.rp-team-rotation-list');
    if (!rotations.length) { list.innerHTML='<div class="rp-team-rotation-empty">TEAM ROTATION IS NOT PUBLISHED YET.</div>'; return; }
    list.innerHTML=rotations.map((r)=>`<button class="rp-team-rotation-option" type="button" data-id="${esc(r.id)}"><span><small>TEAM ROTATION</small><strong>${esc(r.label)}</strong></span><b>›</b></button>`).join('');
    list.querySelectorAll('[data-id]').forEach((b)=>b.onclick=()=>choose(rotations.find((r)=>r.id===b.dataset.id)));
  }
  async function open() { styles(); ensureModal().hidden=false; const list=modal.querySelector('.rp-team-rotation-list'); list.innerHTML='<div class="rp-team-rotation-empty">LOADING TEAM SCHEDULE ROTATION…</div>'; await refresh(); if(!modal.hidden) render(); }
  function close() { if(modal) modal.hidden=true; }

  function requestTeamView() {
    if (window.__realPlayFuture4v4CardCleanupInstalled !== true) {
      const script=document.createElement('script'); script.src='home-future-4v4-card-cleanup.js?v=20261001-team-schedule-rotation-v1'; script.async=false; document.head.appendChild(script);
    }
    let tries=0; const go=()=>{
      if (document.body.classList.contains('rp-4v4-static-open') || document.querySelector('[data-rp-4v4-static-view].open')) { banner(); return; }
      const trigger=document.querySelector('.rp-home-4v4-explore');
      if(trigger){ trigger.dataset.rpSlotHandoff='true'; trigger.click(); delete trigger.dataset.rpSlotHandoff; }
      else if(window.__realPlayFuture4v4CardCleanupInstalled===true){ const x=document.createElement('button'); x.className='rp-home-4v4-explore'; x.dataset.rpSlotHandoff='true'; x.hidden=true; document.body.appendChild(x); x.click(); x.remove(); }
      if(++tries<60)setTimeout(go,100);
    }; go();
  }
  function choose(item) { if(!item)return; setSelected(item); close(); const view=document.querySelector('[data-rp-4v4-static-view]'); if(view)view.remove(); document.body.classList.remove('rp-4v4-static-open'); setTimeout(requestTeamView,20); }
  function banner() {
    const view=document.querySelector('.rp-4v4-static-view'); const item=selected(); if(!view||!item)return;
    let b=view.querySelector('[data-rp-4v4-team-slot]'); if(!b){ b=document.createElement('button'); b.type='button'; b.className='rp-4v4-team-slot'; b.dataset.rp4v4TeamSlot='1'; b.onclick=open; const top=view.querySelector('.rp-3v3-topbar'); top?top.insertAdjacentElement('afterend',b):view.prepend(b); }
    b.innerHTML=`<span><small>TEAM SCHEDULE ROTATION</small><strong>${esc(item.label)}</strong></span><span>CHECK</span>`;
  }
  function enforce() { const b=document.querySelector('[data-rp-home-save-slot]'); if(b){b.textContent='CHECK TEAM SCHEDULE';b.setAttribute('aria-label','Check team schedule rotation');} if(document.body.classList.contains('rp-4v4-static-open'))banner(); }

  async function start(){ styles(); enforce(); await refresh(); setSelected(selected()); document.addEventListener('click',(e)=>{const b=e.target.closest?.('[data-rp-home-save-slot]'); if(b){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open();return;} const t=e.target.closest?.('.rp-home-4v4-explore'); if(t?.dataset?.rpSlotHandoff==='true')return; if(t&&!selected()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open();}},true); new MutationObserver(enforce).observe(document.documentElement,{childList:true,subtree:true}); window.addEventListener('realplay:home-schedule-changed',refresh); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
