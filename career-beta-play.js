(() => {
  const TOKEN_KEY = 'real_play_access_token';
  const API_BASE_URL = 'https://api.clarapmc.com';

  function mount() {
    const panel = document.querySelector('[data-rp-career-beta]');
    const card = panel?.querySelector('[data-career-next]');
    const action = panel?.querySelector('[data-session-action]');
    if (!panel || !card || !action) return false;
    if (card.dataset.oneClickCareerReady === 'true') return true;
    card.dataset.oneClickCareerReady = 'true';

    const title = panel.querySelector('[data-session-title]');
    const copy = panel.querySelector('[data-session-copy]');
    const status = panel.querySelector('[data-session-status]');

    const countWrap = document.createElement('div');
    countWrap.className = 'rp-confirmed-count';
    countWrap.hidden = true;
    countWrap.innerHTML = '<strong data-session-confirmed-count>0</strong><span>CONFIRMED PLAYERS</span>';
    copy?.insertAdjacentElement('afterend', countWrap);
    const countNode = countWrap.querySelector('[data-session-confirmed-count]');

    const error = document.createElement('p');
    error.className = 'rp-session-error';
    error.hidden = true;
    action.insertAdjacentElement('afterend', error);

    let currentSession = null;
    let loading = false;

    function render(session) {
      currentSession = session || null;
      error.hidden = true;
      error.textContent = '';

      if (!session) {
        card.classList.remove('has-session', 'rp-session-joined');
        if (status) status.textContent = 'NO SESSION POSTED';
        if (title) title.textContent = 'TO BE ANNOUNCED';
        if (copy) copy.textContent = 'When the next Beta Career session opens, tap PLAY once to join it.';
        countWrap.hidden = true;
        action.disabled = true;
        action.textContent = 'PLAY';
        return;
      }

      const confirmed = Number(session.confirmedCount ?? session.confirmed_count ?? 0) || 0;
      const capacityValue = session.capacity === null || session.capacity === undefined ? null : Number(session.capacity);
      const joined = Boolean(session.joined);
      const full = capacityValue !== null && confirmed >= capacityValue;
      const available = session.available !== false && !full;

      card.classList.add('has-session');
      card.classList.toggle('rp-session-joined', joined);
      if (status) status.textContent = joined ? 'YOU’RE IN' : full ? 'SESSION FULL' : 'SESSION OPEN';
      if (title) title.textContent = session.title || 'BETA CAREER SESSION';

      const details = [];
      if (session.locationName) details.push(session.locationName);
      if (session.startsAt) {
        const date = new Date(session.startsAt);
        if (!Number.isNaN(date.getTime())) {
          details.push(new Intl.DateTimeFormat('en-PH', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            timeZone: 'Asia/Manila',
          }).format(date));
        }
      }
      if (copy) copy.textContent = details.length
        ? details.join(' · ')
        : joined
          ? 'You are confirmed for this Beta Career session.'
          : 'Tap PLAY once and you’ll be added to the confirmed player count.';

      countWrap.hidden = false;
      if (countNode) countNode.textContent = capacityValue === null ? String(confirmed) : `${confirmed}/${capacityValue}`;

      if (joined) {
        action.disabled = true;
        action.textContent = '✓ YOU’RE IN';
      } else if (full || !available) {
        action.disabled = true;
        action.textContent = 'SESSION FULL';
      } else {
        action.disabled = false;
        action.textContent = 'PLAY';
      }
    }

    async function refresh() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/real-play/career/session`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        render(data?.session || null);
      } catch (_error) {
        // Keep the Career Hub usable if the network is temporarily unavailable.
      }
    }

    function refreshAuthoritativeState() {
      refresh();
      window.setTimeout(refresh, 180);
      window.setTimeout(refresh, 550);
    }

    async function play() {
      if (loading || !currentSession) return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      loading = true;
      action.disabled = true;
      action.textContent = 'JOINING…';
      error.hidden = true;

      try {
        const response = await fetch(`${API_BASE_URL}/api/real-play/career/play`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Unable to join this Career session.');
        }
        render(data?.session || currentSession);
      } catch (err) {
        error.textContent = err.message || 'Unable to join this Career session.';
        error.hidden = false;
        action.disabled = false;
        action.textContent = 'PLAY';
      } finally {
        loading = false;
      }
    }

    action.addEventListener('click', play);

    const observer = new MutationObserver(() => {
      if (panel.classList.contains('open')) refreshAuthoritativeState();
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('focus', () => {
      if (panel.classList.contains('open')) refreshAuthoritativeState();
    });

    refreshAuthoritativeState();
    return true;
  }

  if (mount()) return;
  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
