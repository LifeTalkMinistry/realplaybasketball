(() => {
  if (window.__realPlayHomeTeamSchedulingV5Installed) return;
  window.__realPlayHomeTeamSchedulingV5Installed = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const UPDATES_API_URL = `${API_BASE_URL}/api/real-play/updates`;
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const TEAM_ASSET_DIRECTORY_API = 'https://api.github.com/repos/LifeTalkMinistry/realplaybasketball/contents/assets/3v3/clubs?ref=main';
  const TEAM_IMAGE_PATTERN = /\.(?:png|jpe?g|webp|svg)$/i;
  const DEFAULT_START = '20:00';
  const DEFAULT_END = '22:00';
  const DEFAULT_TEAM_CAP = 4;
  const ROTATION_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const DEFAULT_ACTIVE_DAYS = new Set(['SUNDAY']);
  const FALLBACK_TEAMS = [
    { key: 'lions', name: 'LIONS' },
    { key: 'valiant', name: 'VALIANT' },
    { key: 'watchmen', name: 'WATCHMEN' },
    { key: 'conquerors', name: 'CONQUERORS' },
    { key: 'chosen', name: 'CHOSEN' },
    { key: 'eagles', name: 'EAGLES' },
    { key: 'steadfast', name: 'STEADFAST' },
    { key: 'warriors', name: 'WARRIORS' },
  ];
  const PREFERRED_ORDER = new Map(FALLBACK_TEAMS.map((team, index) => [team.key, index]));

  const nativeFetch = window.fetch.bind(window);
  let mountedForm = null;
  let teams = [...FALLBACK_TEAMS];
  let hydrationToken = 0;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function installStyles() {
    if (document.querySelector('[data-rp-home-team-schedule-v5-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomeTeamScheduleV5Style = '1';
    style.textContent = `
      .rp-home-team-schedule{margin:15px 0 3px;padding:13px;border:1px solid rgba(54,205,255,.22);border-radius:14px;background:linear-gradient(180deg,rgba(4,17,27,.72),rgba(3,10,17,.7))}
      .rp-home-team-schedule-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .rp-home-team-schedule-head small,.rp-home-team-schedule-label{display:block;color:#48d8ff;font:950 .48rem/1.2 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase}
      .rp-home-team-schedule-head strong{display:block;margin-top:4px;color:#f5f8fb;font:950 .78rem/1.1 var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-style:italic;letter-spacing:.025em}
      .rp-home-team-schedule-count{flex:0 0 auto;padding:5px 7px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#91a6b7;background:#07111a;font:900 .46rem/1 system-ui,sans-serif;letter-spacing:.07em;white-space:nowrap}
      .rp-home-team-schedule-modes{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:11px}
      .rp-home-team-schedule-mode{min-height:39px;padding:0 9px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#07121c;color:#8397a7;font:950 .5rem/1 system-ui,sans-serif;letter-spacing:.065em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-schedule-mode.is-active{border-color:rgba(49,211,255,.68);background:linear-gradient(180deg,rgba(12,91,119,.58),rgba(5,47,66,.72));color:#6ee5ff}
      .rp-home-team-schedule-open-note{margin:0;padding:10px 11px;border:1px dashed rgba(255,255,255,.1);border-radius:10px;color:#8195a5;background:rgba(0,0,0,.14);font:700 .58rem/1.45 system-ui,sans-serif}
      .rp-home-team-schedule-blocks[hidden],.rp-home-team-schedule-open-note[hidden]{display:none!important}
      .rp-home-team-block{margin-top:9px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(4,10,16,.78)}
      .rp-home-team-block:first-child{margin-top:0}
      .rp-home-team-block.is-disabled{border-color:rgba(255,255,255,.055);background:rgba(4,10,16,.42);opacity:.68;filter:saturate(.55)}
      .rp-home-team-block.is-disabled .rp-home-team-block-fields,.rp-home-team-block.is-disabled .rp-home-team-schedule-label,.rp-home-team-block.is-disabled .rp-home-team-selected,.rp-home-team-block.is-disabled .rp-home-team-picker-shell{display:none!important}
      .rp-home-team-block-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
      .rp-home-team-block-head strong{color:#dfe8ef;font:950 .56rem/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      .rp-home-team-day-toggle{flex:0 0 auto;min-width:47px;height:28px;padding:0 9px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:#07111a;color:#7f93a3;font:950 .48rem/1 system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
      .rp-home-team-day-toggle.is-on{border-color:rgba(49,211,255,.58);background:rgba(7,72,96,.72);color:#71e6ff;box-shadow:0 0 0 1px rgba(49,211,255,.08) inset}
      .rp-home-team-block-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0 10px}
      .rp-home-team-block-field{display:grid;gap:5px;color:#71899c;font:900 .45rem/1.15 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}
      .rp-home-team-block-field.is-wide{grid-column:1 / -1}
      .rp-home-team-block-field input{box-sizing:border-box;width:100%;min-width:0;height:38px;padding:0 9px;border:1px solid rgba(99,153,181,.2);border-radius:9px;outline:none;background:#06101a;color:#eef8ff;font:850 .67rem/1.1 system-ui,sans-serif}
      .rp-home-team-block-field input:focus{border-color:rgba(49,211,255,.58);box-shadow:0 0 0 2px rgba(49,211,255,.07)}
      .rp-home-team-selected{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;min-height:30px;align-items:center}
      .rp-home-team-selected-empty{color:#637887;font:800 .49rem/1.3 system-ui,sans-serif;letter-spacing:.035em}
      .rp-home-team-chip{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 8px 0 10px;border:1px solid rgba(52,211,255,.36);border-radius:999px;background:rgba(7,58,79,.5);color:#dff8ff;font:950 .49rem/1 system-ui,sans-serif;letter-spacing:.055em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-chip-x{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:rgba(255,255,255,.08);color:#8feaff;font:900 .64rem/1 system-ui,sans-serif}
      .rp-home-team-picker-shell{position:relative;margin-top:7px}.rp-home-team-picker[hidden]{display:none!important}
      .rp-home-team-add-team{min-height:34px;padding:0 11px;border:1px solid rgba(55,211,255,.28);border-radius:9px;background:rgba(6,48,65,.35);color:#59dcff;font:950 .48rem/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-add-team:disabled{opacity:.48;cursor:default}
      .rp-home-team-picker{margin-top:6px;padding:6px;border:1px solid rgba(58,208,255,.22);border-radius:11px;background:#071019;box-shadow:0 16px 35px rgba(0,0,0,.34)}
      .rp-home-team-picker-option{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:36px;padding:0 10px;border:0;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:#d7e5ef;font:900 .51rem/1 system-ui,sans-serif;letter-spacing:.055em;text-align:left;text-transform:uppercase;cursor:pointer}
      .rp-home-team-picker-option:last-child{border-bottom:0}.rp-home-team-picker-option::after{content:'+';color:#58dcff;font-size:.8rem}
      .rp-home-team-picker-empty{display:block;padding:9px;color:#687d8d;font:800 .49rem/1.3 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
      .rp-home-team-schedule-note{min-height:14px;margin:8px 1px 0;color:#718594;font:750 .5rem/1.35 system-ui,sans-serif}.rp-home-team-schedule-note.warning{color:#f1c66f}.rp-home-team-schedule-note.error{color:#ff8f98}
    `;
    document.head.appendChild(style);
  }

  function form() { return document.querySelector('[data-rp-home-open-rank-edit-form]'); }
  function section() { return mountedForm?.querySelector('[data-rp-home-team-schedule]') || null; }
  function selectedMode() { return section()?.dataset?.mode === 'open' ? 'open' : 'assigned'; }
  function normalizeDay(value, index = 0) {
    const day = String(value || '').trim().toUpperCase();
    return ROTATION_DAYS.includes(day) ? day : ROTATION_DAYS[index % ROTATION_DAYS.length];
  }
  function teamName(key) { return teams.find((team) => team.key === key)?.name || String(key || '').replaceAll('-', ' ').toUpperCase(); }
  function orderTeams(list) {
    return [...list].sort((a, b) => (PREFERRED_ORDER.get(a.key) ?? 999) - (PREFERRED_ORDER.get(b.key) ?? 999) || a.name.localeCompare(b.name));
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
      if (!response.ok) throw new Error(`Team directory returned ${response.status}`);
      const entries = await response.json();
      const byKey = new Map();
      (Array.isArray(entries) ? entries : []).forEach((entry) => {
        if (entry?.type !== 'file') return;
        const team = teamFromAsset(entry.name, entry.download_url);
        if (team && !byKey.has(team.key)) byKey.set(team.key, team);
      });
      if (byKey.size) return orderTeams([...byKey.values()]);
    } catch (_error) {}
    return [...FALLBACK_TEAMS];
  }

  function teamScheduleOf(update) {
    return update?.metadata?.teamSchedule || update?.metadata?.team_schedule || null;
  }
  function scheduleCandidates(updates) {
    return (Array.isArray(updates) ? updates : []).filter((update) => String(update?.category || '').toLowerCase() === 'schedule' && teamScheduleOf(update));
  }
  function manilaDateKey(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
      const year = parts.find((part) => part.type === 'year')?.value;
      const month = parts.find((part) => part.type === 'month')?.value;
      const day = parts.find((part) => part.type === 'day')?.value;
      return year && month && day ? `${year}-${month}-${day}` : '';
    } catch (_error) { return ''; }
  }
  function matchingSchedule(updates) {
    const list = scheduleCandidates(updates);
    if (!list.length || !mountedForm) return null;
    const title = String(mountedForm.elements?.title?.value || '').trim().toLowerCase();
    const startsAt = String(mountedForm.elements?.startsAt?.value || '').trim();
    const localMs = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startsAt) ? Date.parse(`${startsAt.slice(0,16)}:00+08:00`) : NaN;
    const localDate = /^\d{4}-\d{2}-\d{2}/.test(startsAt) ? startsAt.slice(0, 10) : '';
    const newest = (items) => items.sort((a, b) => Date.parse(b?.published_at || b?.publishedAt || '') - Date.parse(a?.published_at || a?.publishedAt || ''))[0] || null;

    if (Number.isFinite(localMs)) {
      const exact = newest(list.filter((item) => {
        const sameTitle = !title || String(item?.title || '').trim().toLowerCase() === title;
        const itemMs = Date.parse(item?.event_at || item?.eventAt || '');
        return sameTitle && Number.isFinite(itemMs) && Math.abs(itemMs - localMs) < 60_000;
      }));
      if (exact) return exact;
      if (localDate) {
        const sameDay = newest(list.filter((item) => {
          const sameTitle = !title || String(item?.title || '').trim().toLowerCase() === title;
          return sameTitle && manilaDateKey(item?.event_at || item?.eventAt) === localDate;
        }));
        if (sameDay) return sameDay;
      }
      return null;
    }

    if (title) {
      return list.filter((item) => String(item?.title || '').trim().toLowerCase() === title)
        .sort((a, b) => Date.parse(b?.published_at || b?.publishedAt || '') - Date.parse(a?.published_at || a?.publishedAt || ''))[0] || null;
    }
    return list.sort((a, b) => Date.parse(b?.published_at || b?.publishedAt || '') - Date.parse(a?.published_at || a?.publishedAt || ''))[0] || null;
  }
  async function loadPublishedTeamSchedule() {
    try {
      const response = await nativeFetch(PUBLIC_UPDATES_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      const update = matchingSchedule(data?.updates);
      const schedule = teamScheduleOf(update);
      if (!schedule || typeof schedule !== 'object') return null;
      const body = String(update?.body || '');
      const legacyTeamCap = Number(body.match(/\b(\d{1,2})\s+TEAM\s+CAP\b/i)?.[1]);
      const legacyCapacity = Number.isFinite(legacyTeamCap) && legacyTeamCap > 0 ? capacityValue(legacyTeamCap) : DEFAULT_TEAM_CAP;
      return {
        ...schedule,
        legacyCapacity,
        legacyLocationName: String(update?.location_name || update?.locationName || '').trim(),
      };
    } catch (_error) { return null; }
  }

  function blockEnabled(block) { return block?.dataset?.enabled === '1'; }
  function clockValue(value, fallback) {
    const text = String(value || '').trim();
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
  }
  function capacityValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(DEFAULT_TEAM_CAP, Math.round(parsed))) : DEFAULT_TEAM_CAP;
  }
  function blockCapacity(block) {
    return capacityValue(block?.querySelector?.('[data-rp-team-block-capacity]')?.value);
  }
  function selectedTeamKeys(block) {
    return [...(block?.querySelectorAll('[data-rp-team-selected-key]') || [])]
      .map((node) => String(node.dataset.rpTeamSelectedKey || '').trim().toLowerCase()).filter(Boolean);
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
    if (!block) return;
    const selected = [...new Set((selectedKeys || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
    const selectedSet = new Set(selected);
    const selectedWrap = block.querySelector('[data-rp-team-selected]');
    const picker = block.querySelector('[data-rp-team-picker]');
    const toggle = block.querySelector('[data-rp-team-picker-toggle]');
    const dayToggle = block.querySelector('[data-rp-team-day-toggle]');
    const enabled = blockEnabled(block);
    const capacity = blockCapacity(block);
    const roomAvailable = selected.length < capacity;
    const available = roomAvailable ? teams.filter((team) => !selectedSet.has(team.key)) : [];

    block.classList.toggle('is-disabled', !enabled);
    if (dayToggle) {
      dayToggle.classList.toggle('is-on', enabled);
      dayToggle.textContent = enabled ? 'ON' : 'OFF';
      dayToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      dayToggle.setAttribute('aria-label', `${block.dataset.rpTeamBlockDay || 'Rotation day'} ${enabled ? 'active' : 'inactive'}`);
    }

    if (selectedWrap) selectedWrap.innerHTML = selected.length
      ? selected.map((key) => `<button class="rp-home-team-chip" type="button" data-rp-team-selected-key="${esc(key)}" aria-label="Remove ${esc(teamName(key))}"><span>${esc(teamName(key))}</span><span class="rp-home-team-chip-x" aria-hidden="true">×</span></button>`).join('')
      : '<span class="rp-home-team-selected-empty">NO TEAMS ADDED YET.</span>';
    if (picker) {
      picker.innerHTML = available.length
        ? available.map((team) => `<button class="rp-home-team-picker-option" type="button" data-rp-team-picker-option="${esc(team.key)}">${esc(team.name)}</button>`).join('')
        : '<span class="rp-home-team-picker-empty">ALL TEAMS ARE ALREADY ON THIS ROTATION DAY.</span>';
      picker.hidden = !(pickerOpen && available.length);
    }
    if (toggle) {
      toggle.disabled = !enabled || !available.length;
      toggle.textContent = available.length ? '+ ADD TEAM' : (selected.length >= capacity ? 'TEAM CAP REACHED' : 'ALL TEAMS ADDED');
      toggle.setAttribute('aria-expanded', enabled && pickerOpen && available.length ? 'true' : 'false');
    }
    block.dataset.pickerOpen = enabled && pickerOpen && available.length ? '1' : '0';
  }

  function addRotationBlock(day, config = {}) {
    const list = section()?.querySelector('[data-rp-team-schedule-blocks]');
    if (!list) return;
    const teamKeys = Array.isArray(config?.teamKeys) ? config.teamKeys : [];
    const enabled = typeof config?.enabled === 'boolean' ? config.enabled : DEFAULT_ACTIVE_DAYS.has(day);
    const start = clockValue(config?.start, DEFAULT_START);
    const end = clockValue(config?.end, DEFAULT_END);
    const capacity = capacityValue(config?.capacity);
    const locationName = String(config?.locationName || config?.location_name || '').trim();

    const block = document.createElement('div');
    block.className = 'rp-home-team-block';
    block.dataset.rpTeamBlock = '1';
    block.dataset.rpTeamBlockDay = day;
    block.dataset.enabled = enabled ? '1' : '0';
    block.dataset.pickerOpen = '0';
    block.innerHTML = `
      <div class="rp-home-team-block-head"><strong data-rp-team-block-title>${esc(day)} ROTATION</strong><button class="rp-home-team-day-toggle" type="button" data-rp-team-day-toggle aria-pressed="${enabled ? 'true' : 'false'}">${enabled ? 'ON' : 'OFF'}</button></div>
      <div class="rp-home-team-block-fields">
        <label class="rp-home-team-block-field">START TIME<input type="time" value="${esc(start)}" data-rp-team-block-start></label>
        <label class="rp-home-team-block-field">END TIME<input type="time" value="${esc(end)}" data-rp-team-block-end></label>
        <label class="rp-home-team-block-field">TEAM CAP<input type="number" min="1" max="${DEFAULT_TEAM_CAP}" inputmode="numeric" value="${capacity}" data-rp-team-block-capacity></label>
        <label class="rp-home-team-block-field is-wide">COURT / LOCATION<input type="text" maxlength="180" value="${esc(locationName)}" placeholder="Optional" data-rp-team-block-location></label>
      </div>
      <span class="rp-home-team-schedule-label">TEAMS ON THIS DAY</span>
      <div class="rp-home-team-selected" data-rp-team-selected></div>
      <div class="rp-home-team-picker-shell">
        <button class="rp-home-team-add-team" type="button" data-rp-team-picker-toggle aria-expanded="false">+ ADD TEAM</button>
        <div class="rp-home-team-picker" data-rp-team-picker hidden></div>
      </div>`;
    list.appendChild(block);
    renderBlockTeams(block, teamKeys, false);

    block.addEventListener('input', (event) => {
      if (event.target?.matches?.('[data-rp-team-block-capacity]')) {
        renderBlockTeams(block, selectedTeamKeys(block), false);
      }
      if (event.target?.matches?.('[data-rp-team-block-start],[data-rp-team-block-end],[data-rp-team-block-capacity],[data-rp-team-block-location]')) updateNote();
    });
    block.addEventListener('change', (event) => {
      if (event.target?.matches?.('[data-rp-team-block-start],[data-rp-team-block-end],[data-rp-team-block-capacity],[data-rp-team-block-location]')) updateNote();
    });

    block.addEventListener('click', (event) => {
      const dayToggle = event.target.closest?.('[data-rp-team-day-toggle]');
      if (dayToggle) {
        event.preventDefault();
        const nextEnabled = !blockEnabled(block);
        block.dataset.enabled = nextEnabled ? '1' : '0';
        closeOtherPickers();
        renderBlockTeams(block, selectedTeamKeys(block), false);
        updateNote();
        return;
      }
      if (!blockEnabled(block)) return;
      const remove = event.target.closest?.('[data-rp-team-selected-key]');
      if (remove) {
        event.preventDefault();
        renderBlockTeams(block, selectedTeamKeys(block).filter((key) => key !== String(remove.dataset.rpTeamSelectedKey || '').toLowerCase()), false);
        updateNote();
        return;
      }
      const option = event.target.closest?.('[data-rp-team-picker-option]');
      if (option) {
        event.preventDefault();
        const selected = selectedTeamKeys(block);
        const key = String(option.dataset.rpTeamPickerOption || '').toLowerCase();
        if (key && !selected.includes(key) && selected.length < blockCapacity(block)) selected.push(key);
        renderBlockTeams(block, selected, true);
        updateNote();
        return;
      }
      if (event.target.closest?.('[data-rp-team-picker-toggle]')) {
        event.preventDefault();
        const opening = block.dataset.pickerOpen !== '1';
        closeOtherPickers(block);
        renderBlockTeams(block, selectedTeamKeys(block), opening);
      }
    });
  }

  function ensureAssignedBlocks(schedule = null) {
    const list = section()?.querySelector('[data-rp-team-schedule-blocks]');
    if (!list) return;
    list.innerHTML = '';
    ROTATION_DAYS.forEach((day) => {
      const source = schedule?.blocks?.find((block, index) => normalizeDay(block?.day, index) === day);
      addRotationBlock(day, source || { enabled: DEFAULT_ACTIVE_DAYS.has(day) });
    });
  }

  function setMode(mode) {
    const root = section();
    if (!root) return;
    const normalized = mode === 'open' ? 'open' : 'assigned';
    root.dataset.mode = normalized;
    root.querySelectorAll('[data-rp-team-schedule-mode]').forEach((button) => {
      const active = button.dataset.rpTeamScheduleMode === normalized;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const blocks = root.querySelector('[data-rp-team-schedule-blocks-wrap]');
    const openNote = root.querySelector('[data-rp-team-schedule-open-note]');
    if (blocks) blocks.hidden = normalized !== 'assigned';
    if (openNote) openNote.hidden = normalized !== 'open';
    if (normalized === 'assigned' && !root.querySelector('[data-rp-team-block]')) ensureAssignedBlocks();
    updateNote();
  }

  function buildTeamSchedule() {
    if (selectedMode() === 'open') return { version: 4, mode: 'open', rotationType: 'weekly', blocks: [] };
    const blocks = ROTATION_DAYS.map((day) => {
      const block = section()?.querySelector(`[data-rp-team-block-day="${day}"]`);
      const teamKeys = selectedTeamKeys(block);
      return {
        day,
        enabled: blockEnabled(block),
        start: clockValue(block?.querySelector('[data-rp-team-block-start]')?.value, DEFAULT_START),
        end: clockValue(block?.querySelector('[data-rp-team-block-end]')?.value, DEFAULT_END),
        capacity: blockCapacity(block),
        locationName: String(block?.querySelector('[data-rp-team-block-location]')?.value || '').trim(),
        teamKeys,
        teamNames: teamKeys.map(teamName),
      };
    });
    return { version: 4, mode: 'assigned', rotationType: 'weekly', blocks };
  }

  function validateSchedule(schedule = buildTeamSchedule()) {
    if (schedule.mode === 'open') return { ok: true, warning: '' };
    const activeBlocks = schedule.blocks.filter((block) => block?.enabled);
    if (!activeBlocks.length) return { ok: false, message: 'Turn on at least one rotation day.' };
    const uses = new Map();
    for (const block of activeBlocks) {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(block.start || '')) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(block.end || ''))) {
        return { ok: false, message: `Choose a valid start and end time for ${block.day}.` };
      }
      const [startHour, startMinute] = block.start.split(':').map(Number);
      const [endHour, endMinute] = block.end.split(':').map(Number);
      if ((endHour * 60 + endMinute) <= (startHour * 60 + startMinute)) {
        return { ok: false, message: `${block.day} end time must be later than its start time.` };
      }
      if (!Number.isFinite(Number(block.capacity)) || Number(block.capacity) < 1 || Number(block.capacity) > DEFAULT_TEAM_CAP) {
        return { ok: false, message: `${block.day} team cap must be between 1 and ${DEFAULT_TEAM_CAP}.` };
      }
      if (!block.teamKeys.length) return { ok: false, message: `Assign at least one team to ${block.day} or turn that day off.` };
      if (block.teamKeys.length > Number(block.capacity)) {
        return { ok: false, message: `${block.day} has ${block.teamKeys.length} teams but its team cap is ${block.capacity}.` };
      }
      block.teamKeys.forEach((key) => {
        const days = uses.get(key) || [];
        days.push(block.day);
        uses.set(key, days);
      });
    }
    const repeated = [...uses.entries()].filter(([, days]) => days.length > 1).map(([key]) => teamName(key));
    return { ok: true, warning: repeated.length ? `${repeated.join(', ')} ${repeated.length === 1 ? 'appears' : 'appear'} on multiple active days — allowed, but double-check the weekly rotation.` : '' };
  }

  function updateNote() {
    const note = section()?.querySelector('[data-rp-team-schedule-note]');
    if (!note) return;
    if (selectedMode() === 'open') {
      note.textContent = 'No fixed team schedule will be published.';
      note.className = 'rp-home-team-schedule-note';
      return;
    }
    const schedule = buildTeamSchedule();
    const result = validateSchedule(schedule);
    const activeDays = schedule.blocks.filter((block) => block.enabled).map((block) => block.day);
    note.textContent = result.ok ? (result.warning || `${activeDays.join(', ')} active. Each active day keeps its own time, team cap and court/location.`) : result.message;
    note.className = `rp-home-team-schedule-note${result.ok ? (result.warning ? ' warning' : '') : ' error'}`;
  }

  function normalizePublished(schedule) {
    if (!schedule || typeof schedule !== 'object') return null;
    if (schedule.mode === 'open') return { version: 4, mode: 'open', rotationType: 'weekly', blocks: [] };
    if (!Array.isArray(schedule.blocks)) return null;

    if (Number(schedule.version || 1) >= 2 && schedule.blocks.some((block) => block?.day)) {
      return {
        version: 4,
        mode: 'assigned',
        rotationType: 'weekly',
        blocks: ROTATION_DAYS.map((day) => {
          const block = schedule.blocks.find((item) => String(item?.day || '').toUpperCase() === day);
          const enabled = typeof block?.enabled === 'boolean' ? block.enabled : DEFAULT_ACTIVE_DAYS.has(day);
          return {
            day,
            enabled,
            start: clockValue(block?.start, DEFAULT_START),
            end: clockValue(block?.end, DEFAULT_END),
            capacity: capacityValue(block?.capacity ?? schedule?.legacyCapacity),
            locationName: String(block?.locationName || block?.location_name || schedule?.legacyLocationName || '').trim(),
            teamKeys: Array.isArray(block?.teamKeys) ? block.teamKeys : [],
          };
        }),
      };
    }

    const legacyBlocks = schedule.blocks.slice(0, 2);
    const hasAssignedTeams = legacyBlocks.some((block) => Array.isArray(block?.teamKeys) && block.teamKeys.length);
    if (!hasAssignedTeams) return null;
    return {
      version: 4,
      mode: 'assigned',
      rotationType: 'weekly',
      migratedFromLegacy: true,
      blocks: ROTATION_DAYS.map((day) => {
        const legacy = day === 'SATURDAY' ? legacyBlocks[0] : day === 'SUNDAY' ? legacyBlocks[1] : null;
        return {
          day,
          start: clockValue(legacy?.start, DEFAULT_START),
          end: clockValue(legacy?.end, DEFAULT_END),
          capacity: capacityValue(schedule?.legacyCapacity),
          locationName: String(schedule?.legacyLocationName || '').trim(),
          enabled: DEFAULT_ACTIVE_DAYS.has(day),
          teamKeys: Array.isArray(legacy?.teamKeys) ? legacy.teamKeys : [],
        };
      }),
    };
  }

  function applySchedule(input) {
    const schedule = normalizePublished(input);
    if (schedule?.mode === 'open') {
      ensureAssignedBlocks();
      setMode('open');
      return;
    }
    ensureAssignedBlocks(schedule);
    setMode('assigned');
  }

  function renderTeamCount() {
    const node = section()?.querySelector('[data-rp-team-schedule-count]');
    if (node) node.textContent = `${teams.length} CURRENT TEAM${teams.length === 1 ? '' : 'S'}`;
  }


  function mount() {
    installStyles();
    const nextForm = form();
    if (!nextForm) return false;
    mountedForm = nextForm;

    let root = mountedForm.querySelector('[data-rp-home-team-schedule]');
    if (!root) {
      root = document.createElement('section');
      root.className = 'rp-home-team-schedule';
      root.dataset.rpHomeTeamSchedule = '1';
      root.dataset.mode = 'assigned';
      root.innerHTML = `
        <div class="rp-home-team-schedule-head">
          <div><small>TEAM SCHEDULING</small><strong>TEAM SCHEDULE ROTATION</strong></div>
          <span class="rp-home-team-schedule-count" data-rp-team-schedule-count>LOADING TEAMS</span>
        </div>
        <div class="rp-home-team-schedule-modes" role="group" aria-label="Team scheduling mode">
          <button class="rp-home-team-schedule-mode" type="button" data-rp-team-schedule-mode="open" aria-pressed="false">OPEN ROTATION</button>
          <button class="rp-home-team-schedule-mode is-active" type="button" data-rp-team-schedule-mode="assigned" aria-pressed="true">ASSIGNED ROTATION</button>
        </div>
        <p class="rp-home-team-schedule-open-note" data-rp-team-schedule-open-note hidden>No fixed team schedule is published. Normal rotation applies.</p>
        <div class="rp-home-team-schedule-blocks" data-rp-team-schedule-blocks-wrap><div data-rp-team-schedule-blocks></div></div>
        <p class="rp-home-team-schedule-note" data-rp-team-schedule-note aria-live="polite"></p>`;
      const status = mountedForm.querySelector('[data-rp-home-open-rank-edit-status]');
      if (status) mountedForm.insertBefore(root, status); else mountedForm.appendChild(root);

      root.querySelectorAll('[data-rp-team-schedule-mode]').forEach((button) => {
        button.addEventListener('click', () => setMode(button.dataset.rpTeamScheduleMode));
      });
      mountedForm.addEventListener('submit', (event) => {
        const result = validateSchedule();
        if (result.ok) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const statusNode = mountedForm.querySelector('[data-rp-home-open-rank-edit-status]');
        if (statusNode) statusNode.textContent = result.message;
        updateNote();
      }, true);
    }

    if (!root.querySelector('[data-rp-team-block]')) ensureAssignedBlocks();
    const seasonField = mountedForm.elements?.title;
    if (seasonField && seasonField.dataset.rpTeamScheduleSeasonBound !== '1') {
      seasonField.dataset.rpTeamScheduleSeasonBound = '1';
      seasonField.addEventListener('change', () => hydrate());
    }
    renderTeamCount();
    updateNote();
    return true;
  }

  async function hydrate() {
    const token = ++hydrationToken;
    const [loadedTeams, published] = await Promise.all([loadTeams(), loadPublishedTeamSchedule()]);
    if (token !== hydrationToken || !mountedForm?.isConnected) return;
    teams = loadedTeams;
    applySchedule(published);
    renderTeamCount();
    updateNote();
  }

  window.__realPlayHomeTeamScheduling = {
    getSchedule: buildTeamSchedule,
    validate: validateSchedule,
    snapshot() {
      const teamSchedule = buildTeamSchedule();
      return { teamSchedule, validation: validateSchedule(teamSchedule) };
    },
  };

  window.fetch = function realPlayRotationScheduleFetch(input, init = {}) {
    try {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
      if (url === UPDATES_API_URL && method === 'POST' && typeof init?.body === 'string' && mountedForm && section()) {
        const payload = JSON.parse(init.body);
        if (String(payload?.action || '').toLowerCase() === 'publish' && String(payload?.category || '').toLowerCase() === 'schedule') {
          const teamSchedule = buildTeamSchedule();
          const result = validateSchedule(teamSchedule);
          if (result.ok) {
            payload.metadata = { ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}), teamSchedule };
            init = { ...init, body: JSON.stringify(payload) };
          }
        }
      }
    } catch (_error) {}
    return nativeFetch(input, init);
  };

  const observer = new MutationObserver(() => {
    if (mountedForm?.isConnected) return;
    if (mount()) hydrate();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-home-open-rank-edit]')) return;
    window.setTimeout(() => { if (mount()) hydrate(); }, 30);
  }, true);
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.rp-home-team-picker-shell')) return;
    closeOtherPickers();
  });
  window.addEventListener('realplay:home-schedule-changed', () => {
    window.setTimeout(() => { if (mount()) hydrate(); }, 180);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (mount()) hydrate(); }, { once: true });
  } else if (mount()) hydrate();
})();
