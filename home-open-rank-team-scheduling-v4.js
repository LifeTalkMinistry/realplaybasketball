(() => {
  if (window.__realPlayHomeTeamSchedulingV4Installed) return;
  window.__realPlayHomeTeamSchedulingV4Installed = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const UPDATES_API_URL = `${API_BASE_URL}/api/real-play/updates`;
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const TEAM_ASSET_DIRECTORY_API = 'https://api.github.com/repos/LifeTalkMinistry/realplaybasketball/contents/assets/3v3/clubs?ref=main';
  const TEAM_IMAGE_PATTERN = /\.(?:png|jpe?g|webp|svg)$/i;
  const DEFAULT_START = '20:00';
  const DEFAULT_END = '22:00';
  const ROTATION_DAYS = ['SATURDAY', 'SUNDAY'];
  const ASSET_FALLBACK_TEAMS = [
    { key: 'lions', name: 'LIONS' },
    { key: 'valiant', name: 'VALIANT' },
    { key: 'watchmen', name: 'WATCHMEN' },
    { key: 'conquerors', name: 'CONQUERORS' },
    { key: 'chosen', name: 'CHOSEN' },
    { key: 'eagles', name: 'EAGLES' },
    { key: 'steadfast', name: 'STEADFAST' },
    { key: 'warriors', name: 'WARRIORS' },
  ];
  const PREFERRED_TEAM_ORDER = new Map(ASSET_FALLBACK_TEAMS.map((team, index) => [team.key, index]));

  const nativeFetch = window.fetch.bind(window);
  let mountedForm = null;
  let teams = [...ASSET_FALLBACK_TEAMS];
  let hydrationToken = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function installStyles() {
    if (document.querySelector('[data-rp-home-team-schedule-v4-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomeTeamScheduleV4Style = '1';
    style.textContent = `
      .rp-home-team-schedule{margin:15px 0 3px;padding:13px;border:1px solid rgba(54,205,255,.22);border-radius:14px;background:linear-gradient(180deg,rgba(4,17,27,.72),rgba(3,10,17,.7));box-shadow:inset 0 0 0 1px rgba(255,255,255,.012)}
      .rp-home-team-schedule-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .rp-home-team-schedule-head small,.rp-home-team-schedule-label{display:block;color:#48d8ff;font:950 .48rem/1.2 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase}
      .rp-home-team-schedule-head strong{display:block;margin-top:4px;color:#f5f8fb;font:950 .78rem/1.1 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-style:italic;letter-spacing:.025em}
      .rp-home-team-schedule-count{flex:0 0 auto;padding:5px 7px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#91a6b7;background:#07111a;font:900 .46rem/1 system-ui,sans-serif;letter-spacing:.07em;white-space:nowrap}
      .rp-home-team-schedule-modes{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:11px}
      .rp-home-team-schedule-mode{min-height:39px;padding:0 9px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#07121c;color:#8397a7;font:950 .5rem/1 system-ui,sans-serif;letter-spacing:.065em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-schedule-mode.is-active{border-color:rgba(49,211,255,.68);background:linear-gradient(180deg,rgba(12,91,119,.58),rgba(5,47,66,.72));color:#6ee5ff;box-shadow:0 0 0 1px rgba(45,211,255,.08) inset}
      .rp-home-team-schedule-open-note{margin:0;padding:10px 11px;border:1px dashed rgba(255,255,255,.1);border-radius:10px;color:#8195a5;background:rgba(0,0,0,.14);font:700 .58rem/1.45 system-ui,sans-serif}
      .rp-home-team-schedule-blocks[hidden],.rp-home-team-schedule-open-note[hidden]{display:none!important}
      .rp-home-team-block{margin-top:9px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(4,10,16,.78)}
      .rp-home-team-block:first-child{margin-top:0}
      .rp-home-team-block-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
      .rp-home-team-block-head strong{color:#dfe8ef;font:950 .56rem/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      .rp-home-team-block-remove{width:27px;height:27px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,102,116,.2);border-radius:50%;background:rgba(82,17,25,.22);color:#ff808b;font:900 .8rem/1 system-ui,sans-serif;cursor:pointer}
      .rp-home-team-day{margin-bottom:8px}
      .rp-home-team-day label,.rp-home-team-block-time label{display:block;color:#718696;font:900 .43rem/1.2 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase}
      .rp-home-team-day select,.rp-home-team-block-time input{box-sizing:border-box;width:100%;height:39px;margin-top:5px;padding:0 9px;border:1px solid rgba(110,154,183,.28);border-radius:9px;outline:none;background:#07121b;color:#ecf5fb;font:900 .62rem/1 system-ui,sans-serif;color-scheme:dark}
      .rp-home-team-day select:focus,.rp-home-team-block-time input:focus{border-color:rgba(53,211,255,.72);box-shadow:0 0 0 2px rgba(43,203,255,.08)}
      .rp-home-team-block-time{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:9px}
      .rp-home-team-selected{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;min-height:30px;align-items:center}
      .rp-home-team-selected-empty{color:#637887;font:800 .49rem/1.3 system-ui,sans-serif;letter-spacing:.035em}
      .rp-home-team-chip{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 8px 0 10px;border:1px solid rgba(52,211,255,.36);border-radius:999px;background:rgba(7,58,79,.5);color:#dff8ff;font:950 .49rem/1 system-ui,sans-serif;letter-spacing:.055em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-chip-x{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:rgba(255,255,255,.08);color:#8feaff;font:900 .64rem/1 system-ui,sans-serif}
      .rp-home-team-picker-shell{position:relative;margin-top:7px}
      .rp-home-team-add-team,.rp-home-team-add-block{min-height:34px;padding:0 11px;border:1px solid rgba(55,211,255,.28);border-radius:9px;background:rgba(6,48,65,.35);color:#59dcff;font:950 .48rem/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-add-team:disabled{opacity:.48;cursor:default}
      .rp-home-team-picker{margin-top:6px;padding:6px;border:1px solid rgba(58,208,255,.22);border-radius:11px;background:#071019;box-shadow:0 16px 35px rgba(0,0,0,.34)}
      .rp-home-team-picker[hidden]{display:none!important}
      .rp-home-team-picker-option{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:36px;padding:0 10px;border:0;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:#d7e5ef;font:900 .51rem/1 system-ui,sans-serif;letter-spacing:.055em;text-align:left;text-transform:uppercase;cursor:pointer}
      .rp-home-team-picker-option:last-child{border-bottom:0}.rp-home-team-picker-option::after{content:'+';color:#58dcff;font-size:.8rem}
      .rp-home-team-picker-empty{display:block;padding:9px;color:#687d8d;font:800 .49rem/1.3 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
      .rp-home-team-schedule-actions{display:flex;align-items:center;gap:7px;margin-top:9px}
      .rp-home-team-schedule-note{min-height:14px;margin:8px 1px 0;color:#718594;font:750 .5rem/1.35 system-ui,sans-serif}.rp-home-team-schedule-note.warning{color:#f1c66f}.rp-home-team-schedule-note.error{color:#ff8f98}
    `;
    document.head.appendChild(style);
  }

  function section() { return mountedForm?.querySelector('[data-rp-home-team-schedule]') || null; }
  function selectedMode() { return section()?.dataset?.mode === 'open' ? 'open' : 'assigned'; }
  function normalizeDay(value, index = 0) {
    const day = String(value || '').trim().toUpperCase();
    return ROTATION_DAYS.includes(day) ? day : ROTATION_DAYS[index % ROTATION_DAYS.length];
  }
  function teamName(key) { return teams.find((team) => team.key === key)?.name || String(key || '').replaceAll('-', ' ').toUpperCase(); }
  function orderTeamList(list) {
    return [...list].sort((a, b) => (PREFERRED_TEAM_ORDER.get(a.key) ?? 999) - (PREFERRED_TEAM_ORDER.get(b.key) ?? 999) || a.name.localeCompare(b.name));
  }
  function teamFromAsset(fileName, downloadUrl = '') {
    const name = String(fileName || '').trim();
    if (!name || name.startsWith('.') || !TEAM_IMAGE_PATTERN.test(name)) return null;
    const stem = name.replace(TEAM_IMAGE_PATTERN, '').replace(/(?:[-_\s]+logo)$/i, '').trim();
    const key = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return key ? { key, name: key.split('-').filter(Boolean).join(' ').toUpperCase(), logoUrl: String(downloadUrl || '') } : null;
  }
  async function loadTeams() {
    try {
      const response = await nativeFetch(TEAM_ASSET_DIRECTORY_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (!response.ok) throw new Error();
      const entries = await response.json();
      const map = new Map();
      (Array.isArray(entries) ? entries : []).forEach((entry) => {
        if (entry?.type !== 'file') return;
        const team = teamFromAsset(entry.name, entry.download_url);
        if (team && !map.has(team.key)) map.set(team.key, team);
      });
      if (map.size) return orderTeamList([...map.values()]);
    } catch (_error) {}
    return [...ASSET_FALLBACK_TEAMS];
  }

  function scheduleCandidates(updates) {
    return (Array.isArray(updates) ? updates : []).filter((update) => update?.category === 'schedule' && update?.metadata?.teamSchedule);
  }
  function chooseLatestSchedule(updates) {
    return scheduleCandidates(updates).sort((a, b) => Date.parse(b?.published_at || b?.publishedAt || '') - Date.parse(a?.published_at || a?.publishedAt || ''))[0] || null;
  }
  async function loadPublishedTeamSchedule() {
    try {
      const response = await nativeFetch(PUBLIC_UPDATES_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      return chooseLatestSchedule(data?.updates)?.metadata?.teamSchedule || null;
    } catch (_error) { return null; }
  }

  function selectedTeamKeys(block) {
    return [...(block?.querySelectorAll('[data-rp-team-selected-key]') || [])].map((node) => String(node.dataset.rpTeamSelectedKey || '').toLowerCase()).filter(Boolean);
  }
  function closeOtherPickers(except = null) {
    section()?.querySelectorAll('[data-rp-team-block]').forEach((block) => {
      if (block === except) return;
      block.dataset.pickerOpen = '0';
      const picker = block.querySelector('[data-rp-team-picker]');
      if (picker) picker.hidden = true;
    });
  }
  function renderBlockTeams(block, selectedKeys = selectedTeamKeys(block), pickerOpen = false) {
    const selected = [...new Set((selectedKeys || []).map((v) => String(v).toLowerCase()).filter(Boolean))];
    const selectedSet = new Set(selected);
    const selectedWrap = block.querySelector('[data-rp-team-selected]');
    const picker = block.querySelector('[data-rp-team-picker]');
    const toggle = block.querySelector('[data-rp-team-picker-toggle]');
    const available = teams.filter((team) => !selectedSet.has(team.key));
    selectedWrap.innerHTML = selected.length ? selected.map((key) => `<button class="rp-home-team-chip" type="button" data-rp-team-selected-key="${esc(key)}"><span>${esc(teamName(key))}</span><span class="rp-home-team-chip-x">×</span></button>`).join('') : '<span class="rp-home-team-selected-empty">NO TEAMS ADDED YET.</span>';
    picker.innerHTML = available.length ? available.map((team) => `<button class="rp-home-team-picker-option" type="button" data-rp-team-picker-option="${esc(team.key)}">${esc(team.name)}</button>`).join('') : '<span class="rp-home-team-picker-empty">ALL TEAMS ARE ALREADY ON THIS ROTATION DAY.</span>';
    picker.hidden = !(pickerOpen && available.length);
    toggle.disabled = !available.length;
    toggle.textContent = available.length ? '+ ADD TEAM' : 'ALL TEAMS ADDED';
    block.dataset.pickerOpen = pickerOpen && available.length ? '1' : '0';
  }

  function renumberBlocks() {
    section()?.querySelectorAll('[data-rp-team-block]').forEach((block, index) => {
      const title = block.querySelector('[data-rp-team-block-title]');
      const day = normalizeDay(block.querySelector('[data-rp-team-block-day]')?.value, index);
      if (title) title.textContent = `${day} ROTATION`;
    });
  }

  function addBlock(preset = {}) {
    const list = section()?.querySelector('[data-rp-team-schedule-blocks]');
    if (!list) return;
    const index = list.querySelectorAll('[data-rp-team-block]').length;
    const day = normalizeDay(preset.day, index);
    const block = document.createElement('div');
    block.className = 'rp-home-team-block';
    block.dataset.rpTeamBlock = '1';
    block.dataset.pickerOpen = '0';
    block.innerHTML = `
      <div class="rp-home-team-block-head"><strong data-rp-team-block-title>${esc(day)} ROTATION</strong><button class="rp-home-team-block-remove" type="button" data-rp-team-block-remove aria-label="Remove rotation day">×</button></div>
      <div class="rp-home-team-day"><label>DAY<select data-rp-team-block-day>${ROTATION_DAYS.map((value) => `<option value="${value}"${value === day ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <div class="rp-home-team-block-time"><label>START<input type="time" value="${esc(preset.start || DEFAULT_START)}" data-rp-team-block-start></label><label>END<input type="time" value="${esc(preset.end || DEFAULT_END)}" data-rp-team-block-end></label></div>
      <span class="rp-home-team-schedule-label">TEAMS ON THIS DAY</span><div class="rp-home-team-selected" data-rp-team-selected></div>
      <div class="rp-home-team-picker-shell"><button class="rp-home-team-add-team" type="button" data-rp-team-picker-toggle>+ ADD TEAM</button><div class="rp-home-team-picker" data-rp-team-picker hidden></div></div>`;
    list.appendChild(block);
    renderBlockTeams(block, preset.teamKeys || [], false);
    block.addEventListener('click', (event) => {
      const remove = event.target.closest?.('[data-rp-team-selected-key]');
      if (remove) { renderBlockTeams(block, selectedTeamKeys(block).filter((key) => key !== remove.dataset.rpTeamSelectedKey), false); updateNote(); return; }
      const option = event.target.closest?.('[data-rp-team-picker-option]');
      if (option) { const keys = selectedTeamKeys(block); if (!keys.includes(option.dataset.rpTeamPickerOption)) keys.push(option.dataset.rpTeamPickerOption); renderBlockTeams(block, keys, true); updateNote(); return; }
      if (event.target.closest?.('[data-rp-team-picker-toggle]')) { closeOtherPickers(block); renderBlockTeams(block, selectedTeamKeys(block), block.dataset.pickerOpen !== '1'); }
    });
    block.querySelector('[data-rp-team-block-remove]')?.addEventListener('click', () => { block.remove(); if (!list.querySelector('[data-rp-team-block]')) addBlock(); renumberBlocks(); updateNote(); });
    block.addEventListener('change', () => { renumberBlocks(); updateNote(); });
    block.addEventListener('input', updateNote);
    renumberBlocks();
    updateNote();
  }

  function setMode(mode) {
    const root = section(); if (!root) return;
    const normalized = mode === 'open' ? 'open' : 'assigned';
    root.dataset.mode = normalized;
    root.querySelectorAll('[data-rp-team-schedule-mode]').forEach((button) => { const active = button.dataset.rpTeamScheduleMode === normalized; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false'); });
    root.querySelector('[data-rp-team-schedule-blocks-wrap]').hidden = normalized !== 'assigned';
    root.querySelector('[data-rp-team-schedule-open-note]').hidden = normalized !== 'open';
    if (normalized === 'assigned' && !root.querySelector('[data-rp-team-block]')) { addBlock({ day: 'SATURDAY' }); addBlock({ day: 'SUNDAY' }); }
    updateNote();
  }

  function buildTeamSchedule() {
    if (selectedMode() === 'open') return { version: 2, mode: 'open', rotationType: 'weekly', blocks: [] };
    const blocks = [...(section()?.querySelectorAll('[data-rp-team-block]') || [])].map((block, index) => {
      const teamKeys = selectedTeamKeys(block);
      return { day: normalizeDay(block.querySelector('[data-rp-team-block-day]')?.value, index), start: String(block.querySelector('[data-rp-team-block-start]')?.value || DEFAULT_START), end: String(block.querySelector('[data-rp-team-block-end]')?.value || DEFAULT_END), teamKeys, teamNames: teamKeys.map(teamName) };
    });
    return { version: 2, mode: 'assigned', rotationType: 'weekly', blocks };
  }
  function validateSchedule(schedule = buildTeamSchedule()) {
    if (schedule.mode === 'open') return { ok: true, warning: '' };
    if (!schedule.blocks.length) return { ok: false, message: 'Add at least one rotation day.' };
    const uses = new Map();
    for (let i = 0; i < schedule.blocks.length; i += 1) {
      const block = schedule.blocks[i];
      if (!ROTATION_DAYS.includes(block.day)) return { ok: false, message: `Rotation ${i + 1} needs a valid day.` };
      if (!/^\d{2}:\d{2}$/.test(block.start) || !/^\d{2}:\d{2}$/.test(block.end) || block.start >= block.end) return { ok: false, message: `${block.day} needs a valid start and end time.` };
      if (!block.teamKeys.length) return { ok: false, message: `Assign at least one team to ${block.day}.` };
      block.teamKeys.forEach((key) => uses.set(key, (uses.get(key) || 0) + 1));
    }
    const repeated = [...uses.entries()].filter(([, count]) => count > 1).map(([key]) => teamName(key));
    return { ok: true, warning: repeated.length ? `${repeated.join(', ')} ${repeated.length === 1 ? 'appears' : 'appear'} on more than one rotation day — allowed for intentional scheduling.` : '' };
  }
  function updateNote() {
    const note = section()?.querySelector('[data-rp-team-schedule-note]'); if (!note) return;
    if (selectedMode() === 'open') { note.textContent = 'All teams use the normal rotation without a published Saturday/Sunday assignment.'; note.className = 'rp-home-team-schedule-note'; return; }
    const result = validateSchedule();
    note.textContent = result.ok ? (result.warning || 'Players use this as a schedule checker: Saturday or Sunday, 8:00 PM – 10:00 PM.') : result.message;
    note.className = `rp-home-team-schedule-note${result.ok ? (result.warning ? ' warning' : '') : ' error'}`;
  }

  function normalizePublished(schedule) {
    if (!schedule || typeof schedule !== 'object') return null;
    if (Number(schedule.version) >= 2 && Array.isArray(schedule.blocks)) return schedule;
    if (!Array.isArray(schedule.blocks)) return schedule;
    return { version: 2, mode: schedule.mode || 'assigned', rotationType: 'weekly', migratedFromLegacy: true, blocks: schedule.blocks.slice(0, 2).map((block, index) => ({ ...block, day: ROTATION_DAYS[index], start: DEFAULT_START, end: DEFAULT_END })) };
  }
  function applySchedule(input) {
    const schedule = normalizePublished(input);
    const root = section(); if (!root) return;
    const list = root.querySelector('[data-rp-team-schedule-blocks]'); list.innerHTML = '';
    if (schedule?.mode === 'assigned' && Array.isArray(schedule.blocks) && schedule.blocks.length) schedule.blocks.forEach((block, index) => addBlock({ day: normalizeDay(block.day, index), start: block.start || DEFAULT_START, end: block.end || DEFAULT_END, teamKeys: block.teamKeys || [] }));
    setMode(schedule?.mode === 'open' ? 'open' : 'assigned');
    if (schedule?.mode !== 'open' && !list.querySelector('[data-rp-team-block]')) { addBlock({ day: 'SATURDAY' }); addBlock({ day: 'SUNDAY' }); }
  }
  function renderTeamCount() { const node = section()?.querySelector('[data-rp-team-schedule-count]'); if (node) node.textContent = `${teams.length} CURRENT TEAMS`; }

  function mount() {
    installStyles();
    const form = document.querySelector('[data-rp-home-open-rank-edit-form]'); if (!form) return false;
    mountedForm = form;
    let root = form.querySelector('[data-rp-home-team-schedule]');
    if (!root) {
      root = document.createElement('section'); root.className = 'rp-home-team-schedule'; root.dataset.rpHomeTeamSchedule = '1'; root.dataset.mode = 'assigned';
      root.innerHTML = `<div class="rp-home-team-schedule-head"><div><small>TEAM SCHEDULING</small><strong>TEAM SCHEDULE ROTATION</strong></div><span class="rp-home-team-schedule-count" data-rp-team-schedule-count>LOADING TEAMS</span></div>
        <div class="rp-home-team-schedule-modes" role="group" aria-label="Team scheduling mode"><button class="rp-home-team-schedule-mode" type="button" data-rp-team-schedule-mode="open">OPEN ROTATION</button><button class="rp-home-team-schedule-mode is-active" type="button" data-rp-team-schedule-mode="assigned">ASSIGNED ROTATION</button></div>
        <p class="rp-home-team-schedule-open-note" data-rp-home-team-schedule-open-note hidden>No fixed Saturday/Sunday group is published. Normal rotation applies.</p>
        <div class="rp-home-team-schedule-blocks" data-rp-team-schedule-blocks-wrap><div data-rp-team-schedule-blocks></div><div class="rp-home-team-schedule-actions"><button class="rp-home-team-add-block" type="button" data-rp-team-add-block>+ ADD ROTATION DAY</button></div></div>
        <p class="rp-home-team-schedule-note" data-rp-team-schedule-note></p>`;
      const status = form.querySelector('[data-rp-home-open-rank-edit-status]'); if (status) form.insertBefore(root, status); else form.appendChild(root);
      root.querySelectorAll('[data-rp-team-schedule-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.rpTeamScheduleMode)));
      root.querySelector('[data-rp-team-add-block]')?.addEventListener('click', () => addBlock());
      form.addEventListener('submit', (event) => { const result = validateSchedule(); if (result.ok) return; event.preventDefault(); event.stopImmediatePropagation(); const statusNode = form.querySelector('[data-rp-home-open-rank-edit-status]'); if (statusNode) statusNode.textContent = result.message; }, true);
    }
    renderTeamCount(); updateNote(); return true;
  }

  async function hydrate() {
    const token = ++hydrationToken;
    const [loadedTeams, published] = await Promise.all([loadTeams(), loadPublishedTeamSchedule()]);
    if (token !== hydrationToken || !mountedForm) return;
    teams = loadedTeams; renderTeamCount();
    applySchedule(published || { version: 2, mode: 'assigned', blocks: [{ day: 'SATURDAY', start: DEFAULT_START, end: DEFAULT_END, teamKeys: [] }, { day: 'SUNDAY', start: DEFAULT_START, end: DEFAULT_END, teamKeys: [] }] });
  }

  window.__realPlayHomeTeamScheduling = { getSchedule: buildTeamSchedule, validate: validateSchedule, snapshot() { const teamSchedule = buildTeamSchedule(); return { teamSchedule, validation: validateSchedule(teamSchedule) }; } };
  window.fetch = function realPlayRotationScheduleFetch(input, init = {}) {
    try {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
      if (url === UPDATES_API_URL && method === 'POST' && typeof init?.body === 'string' && mountedForm && section()) {
        const payload = JSON.parse(init.body);
        if (String(payload?.action || '').toLowerCase() === 'publish' && String(payload?.category || '').toLowerCase() === 'schedule') {
          const teamSchedule = buildTeamSchedule(); const result = validateSchedule(teamSchedule);
          if (result.ok) { payload.metadata = { ...(payload.metadata || {}), teamSchedule }; init = { ...init, body: JSON.stringify(payload) }; }
        }
      }
    } catch (_error) {}
    return nativeFetch(input, init);
  };

  const observer = new MutationObserver(() => { if (mountedForm?.isConnected) return; if (mount()) hydrate(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', (event) => { if (!event.target.closest?.('[data-rp-home-open-rank-edit]')) return; setTimeout(() => { if (mount()) hydrate(); }, 30); }, true);
  document.addEventListener('click', (event) => { if (!event.target.closest?.('.rp-home-team-picker-shell')) closeOtherPickers(); });
  window.addEventListener('realplay:home-schedule-changed', () => setTimeout(() => { if (mount()) hydrate(); }, 180));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { if (mount()) hydrate(); }, { once: true }); else if (mount()) hydrate();
})();
