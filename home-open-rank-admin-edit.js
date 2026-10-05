(() => {
  if (window.__realPlayHomeOpenRankAdminEditInstalled) return;
  window.__realPlayHomeOpenRankAdminEditInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  const UPDATES_API_URL = 'https://api.clarapmc.com/api/real-play/updates';
  const SEASONS = ['TUNE UP SEASON 1', 'LEAGUE SEASON 1'];
  const DAY_INDEX = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };

  let admin = false;
  let verifiedToken = '';
  let currentOverride = null;
  let currentOpenRank = null;
  let saving = false;
  let bootObserver = null;
  let cardObserver = null;
  let periodicTimer = 0;
  let renderQueued = false;

  function token() {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  }

  function homeRoot() {
    return document.querySelector('[data-rp-simple-home]');
  }

  function card() {
    return homeRoot()?.querySelector('[data-rp-home-open-rank]') || null;
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function scheduleType(update) {
    const metadata = update?.metadata || {};
    const text = [
      update?.title,
      update?.body,
      update?.source_key,
      update?.sourceKey,
      metadata.gameType,
      metadata.game_type,
      metadata.mode,
      metadata.format,
      metadata.sessionType,
      metadata.session_type,
    ].filter(Boolean).join(' ').toLowerCase();
    return /\bopen[\s-]?rank(?:ing)?\b|\branking session\b|\bcareer session\b|\beast vs west\b/.test(text)
      ? 'open-rank'
      : '';
  }

  function isManualHomeOverride(update) {
    if (!update || update.category !== 'schedule') return false;
    const id = Number(update.id);
    if (!Number.isSafeInteger(id) || id <= 0) return false;
    if (update.source_key || update.sourceKey) return false;
    return /^\s*ENDS\s+.+?\s*·\s*\d{1,3}\s+(?:TEAM|PLAYER)\s+CAP\s*$/i.test(String(update.body || ''));
  }

  function parseCapacity(update) {
    const body = String(update?.body || '');
    const teamCap = Number(body.match(/\b(\d{1,2})\s+TEAM\s+CAP\b/i)?.[1]);
    if (Number.isFinite(teamCap) && teamCap > 0) return Math.min(4, Math.round(teamCap));

    // Legacy Home schedules stored individual player capacity. For current 4v4,
    // translate 16 PLAYER CAP into 4 TEAM CAP.
    const playerCap = Number(body.match(/\b(\d{1,3})\s+PLAYER\s+CAP\b/i)?.[1]);
    if (Number.isFinite(playerCap) && playerCap > 0) return Math.min(4, Math.ceil(playerCap / 4));

    const metadata = update?.metadata || {};
    const direct = Number(metadata.capacity ?? update?.capacity);
    if (Number.isFinite(direct) && direct > 0) return Math.min(4, Math.round(direct));
    return 4;
  }

  function parseEndLabel(update) {
    const match = String(update?.body || '').match(/\bENDS\s+(.+?)(?:\s*·|$)/i);
    return String(match?.[1] || '').trim().toUpperCase();
  }

  function formatDate(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function formatStartTime(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function formatEndTimeFrom24(value) {
    const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = match[2];
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return '';
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour %= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${suffix}`;
  }

  function endTime24FromLabel(label) {
    const match = String(label || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '23:00';
    let hour = Number(match[1]);
    const minute = match[2];
    const suffix = match[3].toUpperCase();
    if (suffix === 'AM' && hour === 12) hour = 0;
    if (suffix === 'PM' && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  function toManilaDateTimeInput(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  }

  function nextSundayDefault() {
    const now = new Date();
    const manilaParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const part = (type) => manilaParts.find((item) => item.type === type)?.value || '';
    const base = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00+08:00`);
    const day = base.getUTCDay();
    let add = (7 - day) % 7;
    const manilaHour = Number(part('hour') || 0);
    if (add === 0 && manilaHour >= 20) add = 7;
    base.setUTCDate(base.getUTCDate() + add);
    const dateText = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(base);
    return `${dateText}T20:00`;
  }

  function fromManilaDateTimeInput(value) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    return `${clean.length === 16 ? `${clean}:00` : clean}+08:00`;
  }

  function openRankMeta(update) {
    const start = update?.event_at || update?.eventAt;
    const date = formatDate(start);
    const startTime = formatStartTime(start);
    const endTime = parseEndLabel(update);
    const location = String(update?.location_name || update?.locationName || '').trim().toUpperCase();
    const timeRange = startTime ? `${startTime}${endTime ? ` – ${endTime}` : ''}` : '';
    return [date, timeRange, location].filter(Boolean).join(' · ');
  }

  function renderOverride() {
    if (!currentOverride) return;
    const root = homeRoot();
    if (!root) return;
    const title = root.querySelector('[data-rp-home-open-rank-title]');
    const meta = root.querySelector('[data-rp-home-open-rank-meta]');
    const nextTitle = String(currentOverride.title || 'SUNDAY OPEN RANKING').toUpperCase();
    const nextMeta = openRankMeta(currentOverride) || 'SUNDAY · 8:00 PM – 11:00 PM';
    if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
    if (meta && meta.textContent !== nextMeta) meta.textContent = nextMeta;
  }

  function queueRenderOverride() {
    if (renderQueued || !currentOverride) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      renderOverride();
    });
  }

  function ensureStyles() {
    if (document.querySelector('[data-rp-home-open-rank-admin-style]')) return;
    const style = document.createElement('style');
    style.dataset.rpHomeOpenRankAdminStyle = '1';
    style.textContent = `
      body.rp-simple-navigation-active [data-rp-home-open-rank]{position:relative!important}
      .rp-home-open-rank-edit{position:absolute;z-index:6;top:15px;right:15px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid rgba(74,224,255,.36);border-radius:50%;background:rgba(4,18,29,.88);color:#64e8ff;box-shadow:0 7px 18px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.04);cursor:pointer;-webkit-tap-highlight-color:transparent}
      .rp-home-open-rank-edit[hidden]{display:none!important}
      .rp-home-open-rank-edit svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .rp-home-open-rank-edit:active{transform:scale(.94)}
      .rp-home-open-rank-edit-backdrop{position:fixed;inset:0;z-index:1500;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,2,5,.76);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
      .rp-home-open-rank-edit-backdrop[hidden]{display:none!important}
      .rp-home-open-rank-edit-sheet{width:min(100%,620px);max-height:88dvh;overflow:auto;box-sizing:border-box;padding:18px 16px calc(20px + env(safe-area-inset-bottom));border:1px solid rgba(255,255,255,.09);border-bottom:0;border-radius:24px 24px 0 0;background:linear-gradient(180deg,#09111b,#03070c);box-shadow:0 -28px 70px rgba(0,0,0,.66)}
      .rp-home-open-rank-edit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:17px}
      .rp-home-open-rank-edit-head small{display:block;margin-bottom:5px;color:#55ddff;font:900 .48rem/1.2 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase}
      .rp-home-open-rank-edit-head strong{display:block;color:#f4f8fb;font-family:var(--rp-display,Impact,'Arial Narrow',Arial,sans-serif);font-size:1.2rem;font-style:italic;letter-spacing:.02em}
      .rp-home-open-rank-edit-close{width:34px;height:34px;flex:0 0 34px;border:1px solid rgba(255,255,255,.09);border-radius:50%;background:#0b131d;color:#b9c9d7;font-size:1.05rem;cursor:pointer}
      .rp-home-open-rank-edit-form{display:grid;gap:12px}
      .rp-home-open-rank-edit-form label{display:grid;gap:7px;color:#7790a6;font:900 .52rem/1.2 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase}
      .rp-home-open-rank-edit-form input,.rp-home-open-rank-edit-form select{width:100%;min-height:47px;box-sizing:border-box;padding:0 13px;border:1px solid rgba(114,164,193,.23);border-radius:12px;outline:none;background:#06101a;color:#edf8ff;font:800 16px/1.2 system-ui,sans-serif}
      .rp-home-open-rank-edit-form select{appearance:auto;cursor:pointer}
      .rp-home-open-rank-edit-form input:focus,.rp-home-open-rank-edit-form select:focus{border-color:rgba(73,225,255,.66);box-shadow:0 0 0 2px rgba(73,225,255,.08)}
      .rp-home-open-rank-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .rp-home-open-rank-edit-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:9px;margin-top:4px}
      .rp-home-open-rank-edit-actions button{min-height:48px;border-radius:12px;font:950 .63rem/1 var(--rp-display,Arial,sans-serif);font-style:italic;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}
      .rp-home-open-rank-edit-cancel{border:1px solid rgba(255,255,255,.09);background:#08111a;color:#9fb0bf}
      .rp-home-open-rank-edit-save{border:1px solid rgba(65,226,255,.42);background:linear-gradient(180deg,#1bd9f1,#12b8d3);color:#011016}
      .rp-home-open-rank-edit-save:disabled{opacity:.5;cursor:wait}
      .rp-home-open-rank-edit-status{min-height:17px;margin:0;color:#7f9aac;font:700 .64rem/1.45 system-ui,sans-serif}
      .rp-home-open-rank-edit-status.error{color:#ff9b9b}
      body.rp-home-open-rank-editing{overflow:hidden!important}
      @media(max-width:420px){.rp-home-open-rank-edit-grid{grid-template-columns:1fr}.rp-home-open-rank-edit{top:13px;right:13px}}
    `;
    document.head.appendChild(style);
  }

  function ensureEditor() {
    let backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'rp-home-open-rank-edit-backdrop';
    backdrop.dataset.rpHomeOpenRankEditor = '1';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="rp-home-open-rank-edit-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-home-open-rank-edit-title">
        <header class="rp-home-open-rank-edit-head">
          <div><small>HOME CARD ADMIN</small><strong id="rp-home-open-rank-edit-title">EDIT CURRENT REAL PLAY</strong></div>
          <button class="rp-home-open-rank-edit-close" type="button" data-rp-home-open-rank-edit-close aria-label="Close editor">×</button>
        </header>
        <form class="rp-home-open-rank-edit-form" data-rp-home-open-rank-edit-form>
          <label>Season
            <select name="title" required>
              <option value="TUNE UP SEASON 1">TUNE UP SEASON 1</option>
              <option value="LEAGUE SEASON 1">LEAGUE SEASON 1</option>
            </select>
          </label>
          <p class="rp-home-open-rank-edit-status" data-rp-home-open-rank-edit-status></p>
          <div class="rp-home-open-rank-edit-actions">
            <button class="rp-home-open-rank-edit-cancel" type="button" data-rp-home-open-rank-edit-cancel>CANCEL</button>
            <button class="rp-home-open-rank-edit-save" type="submit" data-rp-home-open-rank-edit-save>SAVE CHANGES</button>
          </div>
        </form>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('[data-rp-home-open-rank-edit-close],[data-rp-home-open-rank-edit-cancel]')) {
        closeEditor();
      }
    });
    backdrop.querySelector('[data-rp-home-open-rank-edit-form]')?.addEventListener('submit', saveEditor);
    return backdrop;
  }

  function editorStatus(text = '', isError = false) {
    const node = document.querySelector('[data-rp-home-open-rank-edit-status]');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('error', Boolean(isError));
  }

  function setEditorBusy(next) {
    saving = Boolean(next);
    const save = document.querySelector('[data-rp-home-open-rank-edit-save]');
    if (save) {
      save.disabled = saving;
      save.textContent = saving ? 'SAVING…' : 'SAVE CHANGES';
    }
  }

  function normalizedSeasonTitle(value) {
    const text = String(value || '').trim().toUpperCase();
    return /LEAGUE/.test(text) ? 'LEAGUE SEASON 1' : 'TUNE UP SEASON 1';
  }

  function nextOccurrenceForBlock(block) {
    const dayName = String(block?.day || '').trim().toUpperCase();
    const targetDay = DAY_INDEX[dayName];
    const start = String(block?.start || '').trim();
    if (!Number.isInteger(targetDay) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)) return '';

    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type) => dateParts.find((item) => item.type === type)?.value || '';
    const todayText = `${part('year')}-${part('month')}-${part('day')}`;
    const localNoon = new Date(`${todayText}T12:00:00+08:00`);
    const currentDay = localNoon.getUTCDay();
    let add = (targetDay - currentDay + 7) % 7;
    let candidate = new Date(`${todayText}T${start}:00+08:00`);
    if (add > 0) {
      candidate = new Date(candidate.getTime() + add * 86400000);
    } else if (candidate.getTime() <= now.getTime() + 60_000) {
      candidate = new Date(candidate.getTime() + 7 * 86400000);
    }
    return candidate.toISOString();
  }

  function primaryScheduleEnvelope(teamSchedule) {
    const active = (Array.isArray(teamSchedule?.blocks) ? teamSchedule.blocks : [])
      .filter((block) => block?.enabled)
      .map((block) => ({ block, eventAt: nextOccurrenceForBlock(block) }))
      .filter((entry) => entry.eventAt)
      .sort((a, b) => Date.parse(a.eventAt) - Date.parse(b.eventAt));
    return active[0] || null;
  }

  function openEditor() {
    if (!admin || saving) return;
    const backdrop = ensureEditor();
    const form = backdrop.querySelector('[data-rp-home-open-rank-edit-form]');
    if (!form) return;

    const update = currentOverride || currentOpenRank;
    const cardRoot = card();
    form.elements.title.value = normalizedSeasonTitle(update?.title || cardRoot?.querySelector('[data-rp-home-open-rank-title]')?.textContent);
    form.elements.title.dispatchEvent(new Event('change', { bubbles: true }));
    editorStatus('Choose the season here. Time, team cap and court/location are configured inside each active rotation day.');
    backdrop.hidden = false;
    document.body.classList.add('rp-home-open-rank-editing');
    window.setTimeout(() => form.elements.title.focus({ preventScroll: true }), 0);
  }

  function closeEditor() {
    if (saving) return;
    const backdrop = document.querySelector('[data-rp-home-open-rank-editor]');
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('rp-home-open-rank-editing');
  }

  async function updatesAction(body) {
    const auth = token();
    if (!auth) throw new Error('Admin session is not available. Log in again.');
    const response = await fetch(UPDATES_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status}).`);
    return data;
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (!admin || saving) return;
    const form = event.currentTarget;
    const title = normalizedSeasonTitle(form.elements.title.value);

    if (!SEASONS.includes(title)) return editorStatus('Choose a valid season.', true);

    const schedulingApi = window.__realPlayHomeTeamScheduling;
    if (!schedulingApi?.snapshot) return editorStatus('Team scheduling is still loading. Close this editor, reopen it, and try again.', true);
    const scheduleSnapshot = schedulingApi.snapshot();
    if (!scheduleSnapshot?.validation?.ok) return editorStatus(scheduleSnapshot?.validation?.message || 'Fix the team schedule before saving.', true);
    const teamSchedule = scheduleSnapshot.teamSchedule;
    const envelope = primaryScheduleEnvelope(teamSchedule);
    if (!envelope) return editorStatus('Turn on at least one valid rotation day.', true);
    const primaryBlock = envelope.block;
    const eventAt = envelope.eventAt;
    const endsAt = String(primaryBlock.end || '22:00');
    const capacity = Number(primaryBlock.capacity || 4);
    const locationName = String(primaryBlock.locationName || '').trim();

    setEditorBusy(true);
    editorStatus('Saving Home schedule…');
    const oldOverrideId = Number(currentOverride?.id);

    try {
      const published = await updatesAction({
        action: 'publish',
        category: 'schedule',
        title,
        body: `ENDS ${formatEndTimeFrom24(endsAt)} · ${Math.round(capacity)} TEAM CAP`,
        eventAt,
        locationName,
        pinned: true,
        metadata: { teamSchedule, scheduleScope: 'season-weekly-rotation', seasonTitle: title },
      });

      let updates = Array.isArray(published?.updates) ? published.updates : [];
      const savedSchedule = updates.find((item) => {
        if (!isManualHomeOverride(item)) return false;
        const itemEvent = Date.parse(item?.event_at || item?.eventAt || '');
        const requestedEvent = Date.parse(eventAt || '');
        return String(item?.title || '').trim() === title && Number.isFinite(itemEvent) && Number.isFinite(requestedEvent) && Math.abs(itemEvent - requestedEvent) < 60_000;
      });
      const echoedTeamSchedule = savedSchedule?.metadata?.teamSchedule || savedSchedule?.metadata?.team_schedule;
      if (!echoedTeamSchedule || String(echoedTeamSchedule.mode || '').toLowerCase() !== String(teamSchedule.mode || '').toLowerCase()) {
        throw new Error('The Home schedule saved without its team assignments. Please save again.');
      }
      if (Number.isSafeInteger(oldOverrideId) && oldOverrideId > 0) {
        try {
          const deleted = await updatesAction({ action: 'delete', id: oldOverrideId });
          if (Array.isArray(deleted?.updates)) updates = deleted.updates;
        } catch (cleanupError) {
          console.warn('[Real Play] Old Home schedule override could not be removed.', cleanupError);
        }
      }

      ingestUpdates(updates);
      renderOverride();
      editorStatus('Saved.');
      window.dispatchEvent(new CustomEvent('realplay:home-schedule-changed'));
      window.setTimeout(() => {
        setEditorBusy(false);
        closeEditor();
      }, 260);
    } catch (error) {
      editorStatus(error?.message || 'Unable to save the Home card.', true);
      setEditorBusy(false);
    }
  }

  function ingestUpdates(updates) {
    const list = Array.isArray(updates) ? updates : [];
    const now = Date.now();
    const candidates = list
      .filter((item) => item?.category === 'schedule' && (isManualHomeOverride(item) || scheduleType(item) === 'open-rank'))
      .map((item) => {
        const schedule = item?.metadata?.teamSchedule || item?.metadata?.team_schedule;
        return { item, time: Date.parse(item.event_at || item.eventAt || ''), recurring: Number(schedule?.version || 0) >= 4 && schedule?.rotationType === 'weekly' };
      })
      .filter((entry) => entry.recurring || (Number.isFinite(entry.time) && entry.time >= now - 60_000))
      .sort((left, right) => left.time - right.time);

    const overrides = candidates
      .filter((entry) => isManualHomeOverride(entry.item))
      .sort((left, right) => new Date(right.item.published_at || 0) - new Date(left.item.published_at || 0));

    currentOverride = overrides[0]?.item || null;
    currentOpenRank = currentOverride;
  }

  async function refreshOpenRankState() {
    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      ingestUpdates(data?.updates);
      renderOverride();
    } catch (_error) {
      // The base Home authority retains its own fallback when public updates fail.
    }
  }

  function syncEditButton() {
    admin = Boolean(token() && window.__realPlayAdminVerified === true);
    const homeCard = card();
    if (!homeCard) return false;
    let button = homeCard.querySelector('[data-rp-home-open-rank-edit]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'rp-home-open-rank-edit';
      button.dataset.rpHomeOpenRankEdit = '1';
      button.setAttribute('aria-label', 'Edit Home schedule');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openEditor();
      });
      homeCard.appendChild(button);
    }
    button.hidden = !admin;

    if (!cardObserver) {
      cardObserver = new MutationObserver(queueRenderOverride);
      cardObserver.observe(homeCard, { childList: true, subtree: true, characterData: true });
    }
    return true;
  }

  async function verifyAdmin(force = false) {
    const auth = token();
    if (!auth) {
      admin = false;
      verifiedToken = '';
      syncEditButton();
      return false;
    }

    verifiedToken = auth;
    admin = window.__realPlayAdminVerified === true;
    syncEditButton();
    return admin;
  }

  async function boot() {
    ensureStyles();
    ensureEditor();
    if (!syncEditButton()) {
      bootObserver = new MutationObserver(() => {
        if (!syncEditButton()) return;
        bootObserver?.disconnect();
        bootObserver = null;
      });
      bootObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    await refreshOpenRankState();
  }

  window.addEventListener('focus', () => {
    syncEditButton();
    refreshOpenRankState();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;
    verifiedToken = '';
    admin = false;
    syncEditButton();
  });
  window.addEventListener('realplay:visitorchange', () => {
    verifiedToken = '';
    admin = false;
    syncEditButton();
  });
  window.addEventListener('realplay:home-schedule-changed', refreshOpenRankState);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeEditor();
  });

  periodicTimer = window.setInterval(() => {
    if (document.hidden) return;
    syncEditButton();
    if (currentOverride) renderOverride();
  }, 5000);

  window.addEventListener('beforeunload', () => {
    if (periodicTimer) window.clearInterval(periodicTimer);
    cardObserver?.disconnect();
    bootObserver?.disconnect();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();