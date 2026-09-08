(() => {
  if (window.__realPlayOpenRankAutoIdInstalled) return;
  window.__realPlayOpenRankAutoIdInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';

  let officialSessionNumber = null;
  let officialSessionId = null;
  let identityRequestInFlight = false;
  let lastIdentityFetchAt = 0;

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

    // Session numbers are permanent historical identities. Remove the old
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
  }

  window.addEventListener('realplay:admin-render', () => {
    refineSessionForm();
    refreshOfficialSessionIdentity({ force: true });
  });
  document.addEventListener('DOMContentLoaded', () => {
    refineSessionForm();
    refreshOfficialSessionIdentity({ force: true });
  }, { once: true });

  const observer = new MutationObserver(() => refineSessionForm());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  refineSessionForm();
  refreshOfficialSessionIdentity({ force: true });
})();
