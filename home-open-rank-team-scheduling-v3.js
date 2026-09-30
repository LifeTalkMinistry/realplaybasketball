(() => {
  if (window.__realPlayHomeTeamSchedulingV3Installed) return;
  window.__realPlayHomeTeamSchedulingV3Installed = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const UPDATES_API_URL = `${API_BASE_URL}/api/real-play/updates`;
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;
  const TEAM_ASSET_DIRECTORY_API = 'https://api.github.com/repos/LifeTalkMinistry/realplaybasketball/contents/assets/3v3/clubs?ref=main';
  const TEAM_IMAGE_PATTERN = /\.(?:png|jpe?g|webp|svg)$/i;
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
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function installStyles() {
    if (document.querySelector('[data-rp-home-team-schedule-v3-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomeTeamScheduleV3Style = '1';
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
      .rp-home-team-block-time{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:9px}
      .rp-home-team-block-time label{display:block;color:#718696;font:900 .43rem/1.2 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase}
      .rp-home-team-block-time input{box-sizing:border-box;width:100%;height:39px;margin-top:5px;padding:0 9px;border:1px solid rgba(110,154,183,.28);border-radius:9px;outline:none;background:#07121b;color:#ecf5fb;font:900 .62rem/1 system-ui,sans-serif;color-scheme:dark}
      .rp-home-team-block-time input:focus{border-color:rgba(53,211,255,.72);box-shadow:0 0 0 2px rgba(43,203,255,.08)}
      .rp-home-team-selected{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;min-height:30px;align-items:center}
      .rp-home-team-selected-empty{color:#637887;font:800 .49rem/1.3 system-ui,sans-serif;letter-spacing:.035em}
      .rp-home-team-chip{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 8px 0 10px;border:1px solid rgba(52,211,255,.36);border-radius:999px;background:rgba(7,58,79,.5);color:#dff8ff;font:950 .49rem/1 system-ui,sans-serif;letter-spacing:.055em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-chip-x{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:rgba(255,255,255,.08);color:#8feaff;font:900 .64rem/1 system-ui,sans-serif}
      .rp-home-team-picker-shell{position:relative;margin-top:7px}
      .rp-home-team-add-team{min-height:34px;padding:0 11px;border:1px solid rgba(55,211,255,.28);border-radius:9px;background:rgba(6,48,65,.35);color:#59dcff;font:950 .48rem/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-add-team:disabled{opacity:.48;cursor:default}
      .rp-home-team-picker{margin-top:6px;padding:6px;border:1px solid rgba(58,208,255,.22);border-radius:11px;background:#071019;box-shadow:0 16px 35px rgba(0,0,0,.34)}
      .rp-home-team-picker[hidden]{display:none!important}
      .rp-home-team-picker-option{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:36px;padding:0 10px;border:0;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:#d7e5ef;font:900 .51rem/1 system-ui,sans-serif;letter-spacing:.055em;text-align:left;text-transform:uppercase;cursor:pointer}
      .rp-home-team-picker-option:last-child{border-bottom:0}
      .rp-home-team-picker-option:hover,.rp-home-team-picker-option:focus-visible{background:rgba(34,184,229,.09);outline:none}
      .rp-home-team-picker-option::after{content:'+';color:#58dcff;font-size:.8rem}
      .rp-home-team-picker-empty{display:block;padding:9px;color:#687d8d;font:800 .49rem/1.3 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
      .rp-home-team-schedule-actions{display:flex;align-items:center;gap:7px;margin-top:9px}
      .rp-home-team-add-block{min-height:34px;padding:0 10px;border:1px solid rgba(55,211,255,.24);border-radius:9px;background:rgba(6,48,65,.35);color:#59dcff;font:950 .48rem/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}
      .rp-home-team-schedule-note{min-height:14px;margin:8px 1px 0;color:#718594;font:750 .5rem/1.35 system-ui,sans-serif}
      .rp-home-team-schedule-note.warning{color:#f1c66f}
      .rp-home-team-schedule-note.error{color:#ff8f98}
      @media(max-width:390px){.rp-home-team-schedule{padding:11px}.rp-home-team-schedule-head{gap:7px}.rp-home-team-chip{max-width:100%}}
    `;
    document.head.appendChild(style);
  }

  function editorStatus(message = '', isError = false) {
    const node = document.querySelector('[data-rp-home-open-rank-edit-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
  }

  function section() {
    return mountedForm?.querySelector('[data-rp-home-team-schedule]') || null;
  }

  function selectedMode() {
    return section()?.dataset?.mode === 'open' ? 'open' : 'assigned';
  }

  function sessionStartClock() {
    const value = String(mountedForm?.elements?.startsAt?.value || '');
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11, 16) : '';
  }

  function sessionEndClock() {
    return String(mountedForm?.elements?.endsAt?.value || '').slice(0, 5);
  }

  function minutes(clock) {
    const match = String(clock || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return NaN;
    return (Number(match[1]) * 60) + Number(match[2]);
  }

  function clockFromMinutes(value) {
    const bounded = Math.max(0, Math.min(1439, Number(value) || 0));
    return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(bounded % 60).padStart(2, '0')}`;
  }

  function teamFromAsset(fileName, downloadUrl = '') {
    const name = String(fileName || '').trim();
    if (!name || name.startsWith('.') || !TEAM_IMAGE_PATTERN.test(name)) return null;
    const stem = name.replace(TEAM_IMAGE_PATTERN, '').replace(/(?:[-_\s]+logo)$/i, '').trim();
    const key = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!key) return null;
    return {
      key,
      name: key.split('-').filter(Boolean).join(' ').toUpperCase(),
      logoUrl: String(downloadUrl || ''),
    };
  }

  function orderTeamList(list) {
    return [...list].sort((left, right) => {
      const leftOrder = PREFERRED_TEAM_ORDER.has(left.key) ? PREFERRED_TEAM_ORDER.get(left.key) : Number.MAX_SAFE_INTEGER;
      const rightOrder = PREFERRED_TEAM_ORDER.has(right.key) ? PREFERRED_TEAM_ORDER.get(right.key) : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name);
    });
  }

  function normalizeAssetDirectory(entries) {
    if (!Array.isArray(entries)) return [];
    const byKey = new Map();
    entries.forEach((entry) => {
      if (String(entry?.type || '').toLowerCase() !== 'file') return;
      const team = teamFromAsset(entry?.name, entry?.download_url);
      if (!team || byKey.has(team.key)) return;
      byKey.set(team.key, team);
    });
    return orderTeamList([...byKey.values()]);
  }

  async function loadTeams() {
    try {
      const response = await nativeFetch(TEAM_ASSET_DIRECTORY_API, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Team asset directory returned ${response.status}.`);
      const list = normalizeAssetDirectory(await response.json().catch(() => []));
      if (list.length) return list;
    } catch (error) {
      console.warn('[Real Play] Could not read team logos from assets/3v3/clubs; using the deployed asset fallback.', error);
    }
    return [...ASSET_FALLBACK_TEAMS];
  }

  function manualScheduleCandidates(updates) {
    return (Array.isArray(updates) ? updates : []).filter((update) => {
      if (!update || update.category !== 'schedule') return false;
      if (update.source_key || update.sourceKey) return false;
      return /^\s*ENDS\s+.+?\s*·\s*\d{1,3}\s+(?:TEAM|PLAYER)\s+CAP\s*$/i.test(String(update.body || ''));
    });
  }

  function matchingSchedule(updates) {
    const list = manualScheduleCandidates(updates);
    if (!list.length) return null;
    const title = String(mountedForm?.elements?.title?.value || '').trim().toLowerCase();
    const startsAt = String(mountedForm?.elements?.startsAt?.value || '').trim();
    const localMs = startsAt ? Date.parse(`${startsAt}:00+08:00`) : NaN;
    const exact = list.filter((item) => {
      const sameTitle = !title || String(item?.title || '').trim().toLowerCase() === title;
      const itemMs = Date.parse(item?.event_at || item?.eventAt || '');
      const sameMinute = !Number.isFinite(localMs) || (Number.isFinite(itemMs) && Math.abs(itemMs - localMs) < 60_000);
      return sameTitle && sameMinute;
    }).sort((a, b) => Date.parse(b?.published_at || '') - Date.parse(a?.published_at || ''))[0];
    if (exact) return exact;
    return list.sort((a, b) => Date.parse(b?.published_at || '') - Date.parse(a?.published_at || ''))[0] || null;
  }

  async function loadPublishedTeamSchedule() {
    try {
      const response = await nativeFetch(PUBLIC_UPDATES_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      return matchingSchedule(data?.updates)?.metadata?.teamSchedule || null;
    } catch (_error) {
      return null;
    }
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
    if (normalized === 'assigned' && !root.querySelector('[data-rp-team-block]')) addBlock();
    updateNote();
  }

  function defaultBlockTimes() {
    const start = sessionStartClock();
    const end = sessionEndClock();
    const existing = [...(section()?.querySelectorAll('[data-rp-team-block]') || [])];
    if (!existing.length) return { start, end };
    const previousEnd = existing.at(-1)?.querySelector('[data-rp-team-block-end]')?.value || '';
    const sessionEnd = minutes(end);
    const nextStart = minutes(previousEnd);
    if (Number.isFinite(nextStart) && Number.isFinite(sessionEnd) && nextStart < sessionEnd) return { start: previousEnd, end };
    if (Number.isFinite(nextStart) && nextStart < 1380) return { start: previousEnd, end: clockFromMinutes(nextStart + 60) };
    return { start: '', end: '' };
  }

  function teamName(key) {
    return teams.find((team) => team.key === key)?.name || String(key || '').replaceAll('-', ' ').toUpperCase();
  }

  function selectedTeamKeys(block) {
    return [...(block?.querySelectorAll('[data-rp-team-selected-key]') || [])]
      .map((node) => String(node.dataset.rpTeamSelectedKey || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function closeOtherPickers(exceptBlock = null) {
    section()?.querySelectorAll('[data-rp-team-block]').forEach((block) => {
      if (block === exceptBlock) return;
      block.dataset.pickerOpen = '0';
      const picker = block.querySelector('[data-rp-team-picker]');
      if (picker) picker.hidden = true;
    });
  }

  function renderBlockTeams(block, selectedKeys = selectedTeamKeys(block), pickerOpen = block?.dataset?.pickerOpen === '1') {
    if (!block) return;
    const selected = [...new Set((selectedKeys || []).map((key) => String(key).trim().toLowerCase()).filter(Boolean))];
    const selectedSet = new Set(selected);
    const selectedWrap = block.querySelector('[data-rp-team-selected]');
    const picker = block.querySelector('[data-rp-team-picker]');
    const toggle = block.querySelector('[data-rp-team-picker-toggle]');
    const available = teams.filter((team) => !selectedSet.has(team.key));

    if (selectedWrap) {
      selectedWrap.innerHTML = selected.length
        ? selected.map((key) => `
            <button class="rp-home-team-chip" type="button" data-rp-team-selected-key="${esc(key)}" aria-label="Remove ${esc(teamName(key))}">
              <span>${esc(teamName(key))}</span><span class="rp-home-team-chip-x" aria-hidden="true">×</span>
            </button>`).join('')
        : '<span class="rp-home-team-selected-empty">NO TEAMS ADDED YET.</span>';
    }

    if (picker) {
      picker.innerHTML = available.length
        ? available.map((team) => `<button class="rp-home-team-picker-option" type="button" data-rp-team-picker-option="${esc(team.key)}">${esc(team.name)}</button>`).join('')
        : '<span class="rp-home-team-picker-empty">ALL TEAMS ARE ALREADY IN THIS BLOCK.</span>';
      picker.hidden = !(pickerOpen && available.length);
    }

    if (toggle) {
      toggle.disabled = !available.length;
      toggle.textContent = available.length ? '+ ADD TEAM' : 'ALL TEAMS ADDED';
      toggle.setAttribute('aria-expanded', pickerOpen && available.length ? 'true' : 'false');
    }
    block.dataset.pickerOpen = pickerOpen && available.length ? '1' : '0';
  }

  function togglePicker(block) {
    const opening = block.dataset.pickerOpen !== '1';
    closeOtherPickers(block);
    renderBlockTeams(block, selectedTeamKeys(block), opening);
  }

  function addTeamToBlock(block, key) {
    const selected = selectedTeamKeys(block);
    if (!selected.includes(key)) selected.push(key);
    renderBlockTeams(block, selected, true);
    updateNote();
  }

  function removeTeamFromBlock(block, key) {
    renderBlockTeams(block, selectedTeamKeys(block).filter((value) => value !== key), false);
    updateNote();
  }

  function addBlock(preset = null) {
    const list = section()?.querySelector('[data-rp-team-schedule-blocks]');
    if (!list) return;
    const defaults = preset || defaultBlockTimes();
    const block = document.createElement('div');
    block.className = 'rp-home-team-block';
    block.dataset.rpTeamBlock = '1';
    block.dataset.pickerOpen = '0';
    block.innerHTML = `
      <div class="rp-home-team-block-head">
        <strong data-rp-team-block-title>TIME BLOCK</strong>
        <button class="rp-home-team-block-remove" type="button" data-rp-team-block-remove aria-label="Remove time block">×</button>
      </div>
      <div class="rp-home-team-block-time">
        <label>START<input type="time" value="${esc(defaults?.start || '')}" data-rp-team-block-start></label>
        <label>END<input type="time" value="${esc(defaults?.end || '')}" data-rp-team-block-end></label>
      </div>
      <span class="rp-home-team-schedule-label">TEAMS IN THIS BLOCK</span>
      <div class="rp-home-team-selected" data-rp-team-selected></div>
      <div class="rp-home-team-picker-shell" data-rp-team-picker-shell>
        <button class="rp-home-team-add-team" type="button" data-rp-team-picker-toggle aria-expanded="false">+ ADD TEAM</button>
        <div class="rp-home-team-picker" data-rp-team-picker hidden></div>
      </div>`;
    list.appendChild(block);

    block.querySelector('[data-rp-team-block-remove]')?.addEventListener('click', () => {
      block.remove();
      if (!list.querySelector('[data-rp-team-block]')) addBlock();
      renumberBlocks();
      updateNote();
    });
    block.addEventListener('click', (event) => {
      const removeTeam = event.target.closest?.('[data-rp-team-selected-key]');
      if (removeTeam) {
        event.preventDefault();
        event.stopPropagation();
        removeTeamFromBlock(block, String(removeTeam.dataset.rpTeamSelectedKey || '').toLowerCase());
        return;
      }
      const option = event.target.closest?.('[data-rp-team-picker-option]');
      if (option) {
        event.preventDefault();
        event.stopPropagation();
        addTeamToBlock(block, String(option.dataset.rpTeamPickerOption || '').toLowerCase());
        return;
      }
      if (event.target.closest?.('[data-rp-team-picker-toggle]')) {
        event.preventDefault();
        event.stopPropagation();
        togglePicker(block);
      }
    });
    block.addEventListener('input', updateNote);
    block.addEventListener('change', updateNote);
    renderBlockTeams(block, defaults?.teamKeys || [], false);
    renumberBlocks();
    updateNote();
  }

  function renumberBlocks() {
    section()?.querySelectorAll('[data-rp-team-block]').forEach((block, index) => {
      const title = block.querySelector('[data-rp-team-block-title]');
      if (title) title.textContent = `TIME BLOCK ${index + 1}`;
    });
  }

  function buildTeamSchedule() {
    if (selectedMode() === 'open') return { version: 1, mode: 'open', blocks: [] };
    const blocks = [...(section()?.querySelectorAll('[data-rp-team-block]') || [])].map((block) => {
      const teamKeys = selectedTeamKeys(block);
      return {
        start: String(block.querySelector('[data-rp-team-block-start]')?.value || ''),
        end: String(block.querySelector('[data-rp-team-block-end]')?.value || ''),
        teamKeys,
        teamNames: teamKeys.map(teamName),
      };
    });
    return { version: 1, mode: 'assigned', blocks };
  }

  function validateSchedule(schedule = buildTeamSchedule()) {
    if (schedule.mode === 'open') return { ok: true, warning: '' };
    if (!schedule.blocks.length) return { ok: false, message: 'Add at least one team time block.' };
    const ranges = [];
    const uses = new Map();
    const sessionStart = minutes(sessionStartClock());
    const sessionEnd = minutes(sessionEndClock());
    const sessionRangeIsSimple = Number.isFinite(sessionStart) && Number.isFinite(sessionEnd) && sessionEnd > sessionStart;

    for (let index = 0; index < schedule.blocks.length; index += 1) {
      const block = schedule.blocks[index];
      const start = minutes(block.start);
      const end = minutes(block.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { ok: false, message: `Time Block ${index + 1} needs a valid start and end time.` };
      if (!block.teamKeys.length) return { ok: false, message: `Assign at least one team to Time Block ${index + 1}.` };
      if (sessionRangeIsSimple && (start < sessionStart || end > sessionEnd)) return { ok: false, message: `Time Block ${index + 1} must stay inside the session time.` };
      ranges.push({ index, start, end });
      block.teamKeys.forEach((key) => uses.set(key, (uses.get(key) || 0) + 1));
    }

    const ordered = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].start < ordered[index - 1].end) return { ok: false, message: `Time Blocks ${ordered[index - 1].index + 1} and ${ordered[index].index + 1} overlap. Put simultaneous teams in one block.` };
    }

    const repeated = [...uses.entries()].filter(([, count]) => count > 1).map(([key]) => teamName(key));
    return { ok: true, warning: repeated.length ? `${repeated.join(', ')} ${repeated.length === 1 ? 'is' : 'are'} assigned to more than one block — allowed.` : '' };
  }

  function updateNote() {
    const note = section()?.querySelector('[data-rp-team-schedule-note]');
    if (!note) return;
    if (selectedMode() === 'open') {
      note.textContent = 'All available teams use the normal rotation for the full session.';
      note.className = 'rp-home-team-schedule-note';
      return;
    }
    const result = validateSchedule();
    if (!result.ok) {
      note.textContent = result.message;
      note.className = 'rp-home-team-schedule-note error';
      return;
    }
    note.textContent = result.warning || 'Each block controls which teams are expected during that court window.';
    note.className = `rp-home-team-schedule-note${result.warning ? ' warning' : ''}`;
  }

  function applySchedule(schedule) {
    const root = section();
    if (!root) return;
    const list = root.querySelector('[data-rp-team-schedule-blocks]');
    if (list) list.innerHTML = '';
    const mode = schedule?.mode === 'open' ? 'open' : 'assigned';

    if (mode === 'assigned' && Array.isArray(schedule?.blocks) && schedule.blocks.length) {
      schedule.blocks.slice(0, 12).forEach((block) => {
        const storedKeys = Array.isArray(block?.teamKeys) ? block.teamKeys.map((value) => String(value).toLowerCase()) : [];
        const storedNames = Array.isArray(block?.teamNames) ? block.teamNames : [];
        storedKeys.forEach((key, index) => {
          if (!key || teams.some((team) => team.key === key)) return;
          teams.push({ key, name: String(storedNames[index] || key).replaceAll('-', ' ').toUpperCase() });
        });
        addBlock({ start: block?.start || '', end: block?.end || '', teamKeys: storedKeys });
      });
    }

    teams = orderTeamList(teams);
    setMode(mode);
    if (mode === 'assigned' && !root.querySelector('[data-rp-team-block]')) addBlock();
    renderTeamCount();
    updateNote();
  }

  function renderTeamCount() {
    const count = section()?.querySelector('[data-rp-team-schedule-count]');
    if (count) count.textContent = `${teams.length} CURRENT TEAM${teams.length === 1 ? '' : 'S'}`;
  }

  function rebuildPickersPreservingSelection() {
    section()?.querySelectorAll('[data-rp-team-block]').forEach((block) => {
      renderBlockTeams(block, selectedTeamKeys(block), false);
    });
    renderTeamCount();
    updateNote();
  }

  async function hydrate() {
    const currentToken = ++hydrationToken;
    const [loadedTeams, published] = await Promise.all([loadTeams(), loadPublishedTeamSchedule()]);
    if (currentToken !== hydrationToken || !mountedForm) return;
    teams = loadedTeams;
    rebuildPickersPreservingSelection();
    if (published) applySchedule(published);
    else if (!section()?.querySelector('[data-rp-team-block]')) applySchedule({ mode: 'assigned', blocks: [] });
  }

  function renameCapacityLabel(form) {
    const input = form?.elements?.capacity;
    const label = input?.closest?.('label');
    if (!label || label.dataset.rpTeamCapRenamed === '1') return;
    label.dataset.rpTeamCapRenamed = '1';
    const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim());
    if (textNode) textNode.textContent = 'SESSION TEAM CAP';
  }

  function mount() {
    installStyles();
    const form = document.querySelector('[data-rp-home-open-rank-edit-form]');
    if (!form) return false;
    mountedForm = form;
    renameCapacityLabel(form);

    let root = form.querySelector('[data-rp-home-team-schedule]');
    if (!root) {
      root = document.createElement('section');
      root.className = 'rp-home-team-schedule';
      root.dataset.rpHomeTeamSchedule = '1';
      root.dataset.mode = 'assigned';
      root.innerHTML = `
        <div class="rp-home-team-schedule-head">
          <div><small>TEAM SCHEDULING</small><strong>WHO PLAYS WHEN?</strong></div>
          <span class="rp-home-team-schedule-count" data-rp-team-schedule-count>LOADING TEAMS</span>
        </div>
        <div class="rp-home-team-schedule-modes" role="group" aria-label="Team scheduling mode">
          <button class="rp-home-team-schedule-mode" type="button" data-rp-team-schedule-mode="open" aria-pressed="false">OPEN ROTATION</button>
          <button class="rp-home-team-schedule-mode is-active" type="button" data-rp-team-schedule-mode="assigned" aria-pressed="true">ASSIGNED TIME BLOCKS</button>
        </div>
        <p class="rp-home-team-schedule-open-note" data-rp-team-schedule-open-note hidden>No team is tied to a specific court window. Normal rotation applies for the whole session.</p>
        <div class="rp-home-team-schedule-blocks" data-rp-team-schedule-blocks-wrap>
          <div data-rp-team-schedule-blocks></div>
          <div class="rp-home-team-schedule-actions"><button class="rp-home-team-add-block" type="button" data-rp-team-add-block>+ ADD TIME BLOCK</button></div>
        </div>
        <p class="rp-home-team-schedule-note" data-rp-team-schedule-note aria-live="polite"></p>`;

      const status = form.querySelector('[data-rp-home-open-rank-edit-status]');
      if (status) form.insertBefore(root, status);
      else form.appendChild(root);

      root.querySelectorAll('[data-rp-team-schedule-mode]').forEach((button) => {
        button.addEventListener('click', () => setMode(button.dataset.rpTeamScheduleMode));
      });
      root.querySelector('[data-rp-team-add-block]')?.addEventListener('click', () => addBlock());

      form.addEventListener('submit', (event) => {
        const result = validateSchedule();
        if (result.ok) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        editorStatus(result.message, true);
        updateNote();
      }, true);

      form.elements?.startsAt?.addEventListener('change', updateNote);
      form.elements?.endsAt?.addEventListener('change', updateNote);
    }

    if (!root.querySelector('[data-rp-team-block]')) addBlock();
    renderTeamCount();
    updateNote();
    return true;
  }

  window.fetch = function realPlayTeamScheduleFetch(input, init = {}) {
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
    if (event.target.closest?.('[data-rp-team-picker-shell]')) return;
    closeOtherPickers();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-home-open-rank-edit]')) return;
    window.setTimeout(() => {
      if (mount()) hydrate();
    }, 30);
  }, true);

  window.addEventListener('realplay:home-schedule-changed', () => {
    window.setTimeout(() => {
      if (mount()) hydrate();
    }, 180);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (mount()) hydrate(); }, { once: true });
  } else if (mount()) {
    hydrate();
  }
})();