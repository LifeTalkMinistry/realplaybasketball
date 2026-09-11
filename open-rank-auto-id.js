(() => {
  if (window.__realPlayOpenRankAutoIdInstalled) return;
  window.__realPlayOpenRankAutoIdInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const PUBLIC_UPDATES_URL = `${API_BASE_URL}/api/real-play/public/updates`;

  let officialSessionNumber = null;
  let officialSessionId = null;
  let identityRequestInFlight = false;
  let lastIdentityFetchAt = 0;

  // Public result cards are the actual published game history players see.
  // Number those results by their official publish order so gaps in internal
  // database/session ids never leak into OPEN RANKING SESSION #001, #002, etc.
  let officialResultNumbers = new Map();
  let officialResultUpdates = new Map();
  let resultIdentityRequestInFlight = false;
  let lastResultIdentityFetchAt = 0;
  let resultIdentityTimer = null;

  function permanentSessionLabel(value) {
    const match = String(value || '').trim().match(/^(?:CAREER|OPEN\s+RANK(?:ING\s+SESSION)?)\s*#\s*(\d+)$/i);
    if (!match) return null;
    return `OPEN RANKING SESSION #${String(Number(match[1])).padStart(3, '0')}`;
  }

  function canonicalSessionLabel() {
    if (!Number.isSafeInteger(officialSessionNumber) || officialSessionNumber < 1) return null;
    return `OPEN RANKING SESSION #${String(officialSessionNumber).padStart(3, '0')}`;
  }

  function applyCanonicalSessionLabel() {
    const control = document.querySelector('.rp-admin-control');
    if (!control) return;

    const canonical = canonicalSessionLabel();
    control.querySelectorAll('.rp-admin-card-head strong, .rp-admin-session-manage-head span').forEach((node) => {
      const legacy = permanentSessionLabel(node.textContent);
      if (canonical && (legacy || node.closest('.rp-admin-session-summary'))) {
        if (node.textContent !== canonical) node.textContent = canonical;
        return;
      }
      if (legacy && node.textContent !== legacy) node.textContent = legacy;
    });
  }

  function sessionIdFromUpdate(value) {
    const candidates = [
      value?.id,
      value?.source_key,
      value?.sourceKey,
      value?.metadata?.source_key,
      value?.metadata?.sourceKey,
    ];
    for (const candidate of candidates) {
      const match = String(candidate || '').match(/(?:^|\b)career-(\d+)-result(?:\b|$)/i);
      if (!match) continue;
      const id = Number(match[1]);
      if (Number.isSafeInteger(id) && id > 0) return id;
    }
    return null;
  }

  function sessionIdFromResultCard(card) {
    const match = String(card?.dataset?.updateId || '').match(/^career-(\d+)-result$/i);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function resultPublishedAt(update) {
    const value = update?.published_at ?? update?.publishedAt ?? update?.event_at ?? update?.eventAt ?? '';
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : 0;
  }

  function titleParts(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(.*?)(\s*·\s*(?:WEST WINS|EAST WINS|FINAL SCORE|TIED|FINAL))$/i);
    if (!match) return { base: text, suffix: '' };
    return { base: match[1].trim(), suffix: match[2] };
  }

  function updateResultSuffix(update, currentTitle = '') {
    const fromUpdate = titleParts(update?.title || '').suffix;
    if (fromUpdate) return fromUpdate;

    const current = titleParts(currentTitle).suffix;
    if (current) return current;

    const west = Number(update?.metadata?.westScore ?? update?.metadata?.west_score);
    const east = Number(update?.metadata?.eastScore ?? update?.metadata?.east_score);
    if (Number.isFinite(west) && Number.isFinite(east)) {
      if (west > east) return ' · WEST WINS';
      if (east > west) return ' · EAST WINS';
      return ' · FINAL SCORE';
    }
    return '';
  }

  function isAutomaticOpenRankTitle(value) {
    const base = titleParts(value).base;
    return /^(?:CAREER|OPEN\s+RANK(?:ING)?(?:\s+SESSION)?)\s*#\s*\d+$/i.test(base);
  }

  function officialResultLabel(sessionId, currentTitle = '') {
    const number = officialResultNumbers.get(Number(sessionId));
    if (!Number.isSafeInteger(number) || number < 1) return null;
    const update = officialResultUpdates.get(Number(sessionId));
    const suffix = updateResultSuffix(update, currentTitle);
    return `OPEN RANKING SESSION #${String(number).padStart(3, '0')}${suffix}`;
  }

  function applyOfficialResultLabels() {
    let missingIdentity = false;

    document.querySelectorAll('[data-rp-updates] .rp-update-result[data-update-id]').forEach((card) => {
      const sessionId = sessionIdFromResultCard(card);
      if (!sessionId) return;

      const number = officialResultNumbers.get(sessionId);
      if (!Number.isSafeInteger(number) || number < 1) {
        missingIdentity = true;
        return;
      }

      const heading = card.querySelector('.rp-update-session-name-row > h2, :scope > h2');
      if (!heading) return;

      // Preserve intentionally custom matchup names. Automatic/legacy numbered
      // titles, however, always follow the real published-result sequence.
      const alreadyOwned = card.dataset.rpOfficialUploadNumber === String(number);
      if (alreadyOwned || isAutomaticOpenRankTitle(heading.textContent)) {
        const next = officialResultLabel(sessionId, heading.textContent);
        if (next && heading.textContent !== next) heading.textContent = next;
        card.dataset.rpOfficialUploadNumber = String(number);
      }

      // The result number is system-owned now. Keep DELETE and optional naming,
      // but remove the old manual SET # control so history cannot drift again.
      card.querySelectorAll('[data-rp-set-open-rank-number]').forEach((button) => button.remove());
    });

    return missingIdentity;
  }

  async function refreshOfficialResultIdentity({ force = false } = {}) {
    if (resultIdentityRequestInFlight) return;
    const now = Date.now();
    if (!force && now - lastResultIdentityFetchAt < 1500) {
      applyOfficialResultLabels();
      return;
    }

    resultIdentityRequestInFlight = true;
    lastResultIdentityFetchAt = now;
    try {
      const response = await fetch(PUBLIC_UPDATES_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const results = (Array.isArray(data?.updates) ? data.updates : [])
        .filter((item) => String(item?.category || '').toLowerCase() === 'result')
        .map((item) => ({ item, sessionId: sessionIdFromUpdate(item) }))
        .filter((entry) => entry.sessionId)
        .sort((a, b) => {
          const timeDiff = resultPublishedAt(a.item) - resultPublishedAt(b.item);
          if (timeDiff) return timeDiff;
          return a.sessionId - b.sessionId;
        });

      const numbers = new Map();
      const updates = new Map();
      results.forEach((entry, index) => {
        numbers.set(entry.sessionId, index + 1);
        updates.set(entry.sessionId, entry.item);
      });

      officialResultNumbers = numbers;
      officialResultUpdates = updates;
      applyOfficialResultLabels();
    } catch (_error) {
      // The result feed still renders normally if numbering metadata cannot load.
    } finally {
      resultIdentityRequestInFlight = false;
    }
  }

  function scheduleOfficialResultIdentity({ force = false } = {}) {
    if (resultIdentityTimer) clearTimeout(resultIdentityTimer);
    resultIdentityTimer = setTimeout(() => {
      const missingIdentity = applyOfficialResultLabels();
      if (force || missingIdentity || !officialResultNumbers.size) {
        refreshOfficialResultIdentity({ force }).catch(() => {});
      }
    }, 30);
  }

  async function refreshOfficialSessionIdentity({ force = false } = {}) {
    const control = document.querySelector('.rp-admin-control');
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!control || !token || identityRequestInFlight) return;

    const now = Date.now();
    if (!force && now - lastIdentityFetchAt < 1500) {
      applyCanonicalSessionLabel();
      return;
    }

    identityRequestInFlight = true;
    lastIdentityFetchAt = now;
    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/admin/career/control`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const session = data?.control?.session || null;
      if (!session) {
        officialSessionNumber = null;
        officialSessionId = null;
        return;
      }

      const number = Number(session.openRankNumber ?? session.open_rank_number ?? 0);
      officialSessionNumber = Number.isSafeInteger(number) && number > 0 ? number : null;
      officialSessionId = Number(session.id || 0) || null;
      applyCanonicalSessionLabel();
    } catch (_error) {
      // The base admin UI owns network/error messaging. This layer only refines
      // the identity when the canonical control response is available.
    } finally {
      identityRequestInFlight = false;
    }
  }

  function cleanLegacySessionIdentityUi() {
    const control = document.querySelector('.rp-admin-control');
    if (control) {
      applyCanonicalSessionLabel();

      control.querySelectorAll('.rp-admin-empty strong').forEach((node) => {
        if (node.textContent.trim() === 'NO CAREER SESSION OPEN') node.textContent = 'NO OPEN RANKING SESSION';
      });
      control.querySelectorAll('.rp-admin-empty p').forEach((node) => {
        if (node.textContent.includes('Open a Career session first.')) {
          node.textContent = 'Open an Open Ranking session first.';
        } else if (node.textContent.includes('Create the next Beta Career session')) {
          node.textContent = 'Create the next Open Ranking session below.';
        }
      });
    }

    // Session numbers are system-owned historical identities. Remove the old
    // manual renumber control so an admin cannot accidentally rewrite history.
    document.querySelectorAll('[data-rp-set-open-rank-number]').forEach((button) => button.remove());
  }

  function refineSessionForm() {
    const form = document.querySelector('[data-new-session-form]');
    if (form) {
      const titleInput = form.querySelector('input[name="title"]');
      if (titleInput && !titleInput.dataset.openRankAutoIdReady) {
        titleInput.dataset.openRankAutoIdReady = 'true';
        titleInput.required = false;
        titleInput.placeholder = 'OPTIONAL — E.G. AMAZING VS IBC';

        const label = titleInput.closest('label');
        if (label) {
          const firstText = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          if (firstText) firstText.textContent = 'Optional display name';

          const helper = document.createElement('small');
          helper.textContent = 'SESSION NUMBER IS ASSIGNED AUTOMATICALLY AND STAYS WITH THAT SESSION.';
          helper.style.color = '#61748a';
          helper.style.fontSize = '.48rem';
          helper.style.fontWeight = '900';
          helper.style.letterSpacing = '.07em';
          helper.style.lineHeight = '1.45';
          label.appendChild(helper);
        }
      }

      const card = form.closest('.rp-admin-card');
      if (card) {
        const heading = card.querySelector('.rp-admin-card-head > strong');
        if (heading && (heading.textContent.trim() === 'OPEN NEW SESSION' || heading.textContent.trim() === 'NEW SESSION')) {
          heading.textContent = 'CREATE NEXT OPEN RANKING SESSION';
        }
      }

      const submit = form.querySelector('button[type="submit"]');
      if (submit && !submit.disabled && (submit.textContent.trim() === 'OPEN SESSION' || submit.textContent.trim() === 'OPEN NEXT RANK')) {
        submit.textContent = 'OPEN NEXT SESSION';
      }

      const adminTitle = document.querySelector('.rp-admin-title');
      if (adminTitle) {
        const kicker = adminTitle.querySelector('.rp-admin-kicker');
        if (kicker?.textContent.trim() === 'BETA OPERATIONS') kicker.textContent = 'OPEN RANKING OPERATIONS';
        const copy = adminTitle.querySelector('p');
        if (copy?.textContent.includes('Open the game your testers can join')) {
          copy.textContent = 'Create the next Open Ranking session. Its official session number is assigned automatically and remains permanent.';
        }
      }
    }

    cleanLegacySessionIdentityUi();
    applyOfficialResultLabels();
  }

  // Shared read-only identity helper for replay/other surfaces that want the
  // same published-game numbering without inventing another counter.
  window.RealPlayOpenRankIdentity = {
    ...(window.RealPlayOpenRankIdentity || {}),
    labelForSession(sessionId, currentTitle = '') {
      return officialResultLabel(Number(sessionId), currentTitle);
    },
    numberForSession(sessionId) {
      return officialResultNumbers.get(Number(sessionId)) || null;
    },
    refresh() {
      return refreshOfficialResultIdentity({ force: true });
    },
  };

  window.addEventListener('realplay:admin-render', () => {
    refineSessionForm();
    refreshOfficialSessionIdentity({ force: true });
    scheduleOfficialResultIdentity({ force: true });
  });
  document.addEventListener('DOMContentLoaded', () => {
    refineSessionForm();
    refreshOfficialSessionIdentity({ force: true });
    scheduleOfficialResultIdentity({ force: true });
  }, { once: true });

  const observer = new MutationObserver(() => {
    refineSessionForm();
    scheduleOfficialResultIdentity();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  refineSessionForm();
  refreshOfficialSessionIdentity({ force: true });
  scheduleOfficialResultIdentity({ force: true });
})();
