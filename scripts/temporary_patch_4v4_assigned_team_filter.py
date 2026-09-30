from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Could not find {label} in {path}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


# Slot picker: preserve the admin block's teamKeys in the selected-slot handoff.
path = Path('home-4v4-slot-picker-dynamic-v2.js')
replace_once(
    path,
    "  const CURRENT_4V4_RUNTIME_VERSION = '20260930-eight-team-runtime-v8';",
    "  const CURRENT_4V4_RUNTIME_VERSION = '20260930-assigned-team-filter-v9';",
    'runtime cache version',
)

replace_once(
    path,
    "  let availableSlots = [];\n  let slotsLoadPromise = null;\n\n  function escapeHtml(value) {",
    """  let availableSlots = [];
  let slotsLoadPromise = null;

  function normalizeTeamKeys(value) {
    const seen = new Set();
    return (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => {
        if (!item || seen.has(item)) return false;
        seen.add(item);
        return true;
      });
  }

  function publishSelectedSlotContext(slot) {
    const assigned = slot?.filterMode === 'assigned';
    const teamKeys = assigned ? normalizeTeamKeys(slot?.teamKeys) : null;
    window.__realPlay4v4SelectedSlot = slot || null;
    window.__realPlay4v4AssignedTeamKeys = assigned ? teamKeys : null;
    window.dispatchEvent(new CustomEvent('realplay:4v4-slot-context', {
      detail: {
        slot: slot || null,
        filterMode: assigned ? 'assigned' : 'all',
        teamKeys: assigned ? teamKeys : null,
      },
    }));
  }

  function escapeHtml(value) {""",
    'slot context helpers',
)

replace_once(
    path,
    """  function setSelectedSlot(slot) {
    selectedSlotMemory = slot || null;
    try {
      if (slot) sessionStorage.setItem(SLOT_KEY, JSON.stringify(slot));
      else sessionStorage.removeItem(SLOT_KEY);
    } catch (_error) {}
  }""",
    """  function setSelectedSlot(slot) {
    selectedSlotMemory = slot || null;
    try {
      if (slot) sessionStorage.setItem(SLOT_KEY, JSON.stringify(slot));
      else sessionStorage.removeItem(SLOT_KEY);
    } catch (_error) {}
    publishSelectedSlotContext(selectedSlotMemory);
  }""",
    'selected slot publisher',
)

replace_once(
    path,
    """  function slotFromTimes(start, end) {
    const startClock = normalizeClock(start);
    const endClock = normalizeClock(end);
    if (!startClock || !endClock || startClock === endClock) return null;
    return {
      id: `${clockToId(startClock)}-${clockToId(endClock)}`,
      label: `${formatClock(startClock)} – ${formatClock(endClock)}`,
      start: startClock,
      end: endClock,
      active: true,
    };
  }""",
    """  function slotFromTimes(start, end, options = {}) {
    const startClock = normalizeClock(start);
    const endClock = normalizeClock(end);
    if (!startClock || !endClock || startClock === endClock) return null;
    const filterMode = options?.filterMode === 'assigned' ? 'assigned' : 'all';
    return {
      id: `${clockToId(startClock)}-${clockToId(endClock)}`,
      label: `${formatClock(startClock)} – ${formatClock(endClock)}`,
      start: startClock,
      end: endClock,
      active: true,
      filterMode,
      ...(filterMode === 'assigned' ? { teamKeys: normalizeTeamKeys(options?.teamKeys) } : {}),
    };
  }""",
    'slot shape',
)

replace_once(
    path,
    """    if (mode === 'assigned' && Array.isArray(schedule.blocks)) {
      schedule.blocks.forEach((block) => {
        const slot = slotFromTimes(block?.start, block?.end);
        if (!slot || seen.has(slot.id)) return;
        seen.add(slot.id);
        slots.push(slot);
      });
    } else if (mode === 'open') {
      const start = eventClockInManila(update?.event_at || update?.eventAt);
      const endText = String(update?.body || '').match(/\\bENDS\\s+(.+?)\\s*·/i)?.[1] || '';
      const end = parseTwelveHourClock(endText);
      const slot = slotFromTimes(start, end);
      if (slot) slots.push(slot);
    }""",
    """    if (mode === 'assigned' && Array.isArray(schedule.blocks)) {
      schedule.blocks.forEach((block) => {
        const recoveredLegacy = Boolean(schedule?.recoveredLegacy || block?.recoveredLegacy);
        const slot = slotFromTimes(block?.start, block?.end, {
          filterMode: recoveredLegacy ? 'all' : 'assigned',
          teamKeys: block?.teamKeys,
        });
        if (!slot || seen.has(slot.id)) return;
        seen.add(slot.id);
        slots.push(slot);
      });
    } else if (mode === 'open') {
      const start = eventClockInManila(update?.event_at || update?.eventAt);
      const endText = String(update?.body || '').match(/\\bENDS\\s+(.+?)\\s*·/i)?.[1] || '';
      const end = parseTwelveHourClock(endText);
      const slot = slotFromTimes(start, end, { filterMode: 'all' });
      if (slot) slots.push(slot);
    }""",
    'assigned block normalization',
)

replace_once(
    path,
    """  function chooseSlot(slot) {
    if (!slot?.id || !availableSlots.some((item) => item.id === slot.id)) return;
    setSelectedSlot(slot);
    closeSlotPicker();
    if (document.body.classList.contains('rp-4v4-static-open')) {
      ensureTeamSlotBanner();
      return;
    }
    window.setTimeout(openTeamSelection, 20);
  }""",
    """  function resetOpenTeamSelection() {
    const view = document.querySelector('[data-rp-4v4-static-view]');
    const wasOpen = Boolean(view?.classList.contains('open') || document.body.classList.contains('rp-4v4-static-open'));
    if (view) view.remove();
    document.body.classList.remove('rp-4v4-static-open');
    return wasOpen;
  }

  function chooseSlot(slot) {
    if (!slot?.id || !availableSlots.some((item) => item.id === slot.id)) return;
    const wasOpen = document.body.classList.contains('rp-4v4-static-open') || Boolean(document.querySelector('[data-rp-4v4-static-view].open'));
    setSelectedSlot(slot);
    closeSlotPicker();
    if (wasOpen) resetOpenTeamSelection();
    window.setTimeout(openTeamSelection, 20);
  }""",
    'slot change rebuild',
)

replace_once(
    path,
    """    window.addEventListener('realplay:home-schedule-changed', async () => {
      await refreshSlots();
      if (slotOverlay && !slotOverlay.hidden) renderSlotOptions();
      if (document.body.classList.contains('rp-4v4-static-open')) ensureTeamSlotBanner();
    });""",
    """    window.addEventListener('realplay:home-schedule-changed', async () => {
      const wasOpen = document.body.classList.contains('rp-4v4-static-open') || Boolean(document.querySelector('[data-rp-4v4-static-view].open'));
      await refreshSlots();
      if (slotOverlay && !slotOverlay.hidden) renderSlotOptions();
      if (!wasOpen) return;
      resetOpenTeamSelection();
      if (isSelectedSlotValid()) window.setTimeout(openTeamSelection, 20);
      else window.setTimeout(openSlotPicker, 20);
    });""",
    'schedule refresh rebuild',
)

# Team screen: resolve the selected slot's teamKeys against the existing eight-team registry.
path = Path('home-future-4v4-card-cleanup.js')
club_block = """  const CLUBS = [
    { id: 'lions', name: 'LIONS', verse: 'Proverbs 28:1', art: 'assets/3v3/clubs/lions-logo.png' },
    { id: 'valiant', name: 'VALIANT', verse: 'Joshua 1:9', art: 'assets/3v3/clubs/valiant-logo.png' },
    { id: 'watchmen', name: 'WATCHMEN', verse: 'Isaiah 62:6', art: 'assets/3v3/clubs/watchmen-logo.png' },
    { id: 'conquerors', name: 'CONQUERORS', verse: 'Romans 8:37', art: 'assets/3v3/clubs/conquerors-logo.png' },
    { id: 'chosen', name: 'CHOSEN', verse: '1 Peter 2:9', art: 'assets/3v3/clubs/chosen-logo.png' },
    { id: 'eagles', name: 'EAGLES', verse: 'Isaiah 40:31', art: 'assets/3v3/clubs/eagles-logo.png' },
    { id: 'steadfast', name: 'STEADFAST', verse: '1 Corinthians 15:58', art: 'assets/3v3/clubs/steadfast-logo.png' },
    { id: 'warriors', name: 'WARRIORS', verse: 'Exodus 15:3', art: 'assets/3v3/clubs/warriors-logo.png' },
  ];"""
replace_once(
    path,
    club_block,
    club_block + """

  function assignedTeamKeys() {
    if (!Array.isArray(window.__realPlay4v4AssignedTeamKeys)) return null;
    const seen = new Set();
    return window.__realPlay4v4AssignedTeamKeys
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => {
        if (!item || seen.has(item)) return false;
        seen.add(item);
        return true;
      });
  }

  function currentClubFilterSignature() {
    const keys = assignedTeamKeys();
    return keys === null ? 'all' : `assigned:${keys.join(',')}`;
  }

  function currentClubs() {
    const keys = assignedTeamKeys();
    if (keys === null) return CLUBS;
    const byId = new Map(CLUBS.map((club) => [club.id, club]));
    return keys.map((key) => byId.get(key)).filter(Boolean);
  }""",
    'team filter helpers',
)

replace_once(
    path,
    """  function ensureView() {
    let view = document.querySelector(`[${VIEW_ATTR}]`);
    if (view) return view;

    view = document.createElement('section');""",
    """  function ensureView() {
    const filterSignature = currentClubFilterSignature();
    let view = document.querySelector(`[${VIEW_ATTR}]`);
    if (view && view.dataset.rpClubFilterSignature !== filterSignature) {
      view.remove();
      view = null;
    }
    if (view) return view;
    const clubs = currentClubs();

    view = document.createElement('section');""",
    'dynamic club list',
)

replace_once(
    path,
    """    view.setAttribute(VIEW_ATTR, 'true');
    view.setAttribute('aria-hidden', 'true');
    view.innerHTML = `""",
    """    view.setAttribute(VIEW_ATTR, 'true');
    view.setAttribute('aria-hidden', 'true');
    view.dataset.rpClubFilterSignature = filterSignature;
    if (!clubs.length && filterSignature.startsWith('assigned:')) view.dataset.rpNoAssignedTeams = 'true';
    view.innerHTML = `""",
    'filter signature marker',
)

text = path.read_text(encoding='utf-8')
if '${CLUBS.map((club, index) => `' not in text:
    raise SystemExit('Could not find carousel CLUBS map')
text = text.replace('${CLUBS.map((club, index) => `', '${clubs.map((club, index) => `', 1)
if "${CLUBS.map(() => '<i></i>').join('')}" not in text:
    raise SystemExit('Could not find dot CLUBS map')
text = text.replace("${CLUBS.map(() => '<i></i>').join('')}", "${clubs.map(() => '<i></i>').join('')}", 1)
count = text.count('      const club = CLUBS[activeIndex];')
if count != 4:
    raise SystemExit(f'Expected 4 active CLUBS references, found {count}')
text = text.replace('      const club = CLUBS[activeIndex];', '      const club = clubs[activeIndex];')
path.write_text(text, encoding='utf-8')

replace_once(
    path,
    """    document.body.appendChild(view);

    const cards = [...view.querySelectorAll('[data-rp-4v4-card]')];""",
    """    document.body.appendChild(view);

    const preferencePanel = view.querySelector('.rp-4v4-preference-panel');
    if (!clubs.length) {
      const browse = view.querySelector('[data-rp-4v4-browse]');
      if (browse) browse.innerHTML = '<div class=\"rp-4v4-preference-empty\">NO TEAMS ARE ASSIGNED TO THIS TIME SLOT YET.</div>';
      if (preferencePanel) preferencePanel.hidden = true;
    }

    const cards = [...view.querySelectorAll('[data-rp-4v4-card]')];""",
    'empty assigned state',
)

replace_once(
    path,
    "    const normalize = (index) => (index + cards.length) % cards.length;",
    "    const normalize = (index) => cards.length ? (index + cards.length) % cards.length : 0;",
    'zero-card normalize',
)

replace_once(
    path,
    """    function renderPreferenceBoard() {
      const club = clubs[activeIndex];
      const players = sortedClubPlayers(club.id);
      preferenceTeam.textContent = club.name;""",
    """    function renderPreferenceBoard() {
      const club = clubs[activeIndex];
      if (!club) {
        if (preferenceTeam) preferenceTeam.textContent = 'THIS SLOT';
        if (preferenceCount) preferenceCount.textContent = '0';
        if (preferenceAction) {
          preferenceAction.disabled = true;
          preferenceAction.textContent = 'NO TEAM AVAILABLE';
        }
        if (preferenceCancel) preferenceCancel.hidden = true;
        if (preferenceList) preferenceList.innerHTML = '<p class=\"rp-4v4-preference-empty\">NO TEAMS ARE ASSIGNED TO THIS TIME SLOT YET.</p>';
        return;
      }
      const players = sortedClubPlayers(club.id);
      preferenceTeam.textContent = club.name;""",
    'empty preference guard',
)

replace_once(
    path,
    """    async function savePreference() {
      if (teamCodeOwnsControls()) return;
      const club = clubs[activeIndex];
      if (!token()) {""",
    """    async function savePreference() {
      if (teamCodeOwnsControls()) return;
      const club = clubs[activeIndex];
      if (!club) return;
      if (!token()) {""",
    'save guard',
)

replace_once(
    path,
    """    async function clearPreference() {
      if (teamCodeOwnsControls()) return;
      const club = clubs[activeIndex];
      if (!token()) {""",
    """    async function clearPreference() {
      if (teamCodeOwnsControls()) return;
      const club = clubs[activeIndex];
      if (!club) return;
      if (!token()) {""",
    'clear guard',
)

replace_once(
    path,
    """    function render(index = activeIndex) {
      activeIndex = normalize(index);
      const previous = normalize(activeIndex - 1);""",
    """    function render(index = activeIndex) {
      if (!cards.length || !clubs.length) {
        delete view.dataset.rpActiveClub;
        setStatus('NO TEAMS ARE ASSIGNED TO THIS TIME SLOT YET.', 'error');
        renderPreferenceBoard();
        return;
      }
      activeIndex = normalize(index);
      const previous = normalize(activeIndex - 1);""",
    'empty render guard',
)

# Cache bust the loader chain.
path = Path('home-4v4-slot-picker.js')
replace_once(
    path,
    'home-4v4-slot-picker-dynamic-v2.js?v=20260930-eight-team-catalog-v5',
    'home-4v4-slot-picker-dynamic-v2.js?v=20260930-assigned-team-filter-v6',
    'slot picker cache key',
)

path = Path('index.html')
replace_once(
    path,
    'data-rp-deploy="20260930-eight-team-catalog-v150"',
    'data-rp-deploy="20260930-assigned-team-filter-v151"',
    'deploy marker',
)
replace_once(
    path,
    'home-4v4-slot-picker.js?v=20260930-eight-team-catalog-v11',
    'home-4v4-slot-picker.js?v=20260930-assigned-team-filter-v12',
    'outer slot loader cache key',
)
