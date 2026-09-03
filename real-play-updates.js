(() => {
  if (window.__realPlayUpdatesInstalled) return;
  window.__realPlayUpdatesInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const UPDATES_URL = 'https://aydgnziueszxxhusatsv.supabase.co/functions/v1/real-play-updates';

  let panel = null;
  let updates = [];
  let filter = 'all';
  let admin = false;
  let loading = false;
  let pollTimer = null;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function timeAgo(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Math.max(0, Date.now() - date.getTime());
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return 'NOW';
    if (diff < hour) return `${Math.floor(diff / minute)}M AGO`;
    if (diff < day) return `${Math.floor(diff / hour)}H AGO`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}D AGO`;
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function formatEvent(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  async function api(action, payload = {}) {
    const accessToken = token();
    if (!accessToken) {
      const error = new Error('Please log in to Real Play first.');
      error.status = 401;
      throw error;
    }

    const response = await fetch(UPDATES_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || 'Real Play Updates could not complete that request.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function createPanel() {
    if (panel || document.querySelector('[data-rp-updates]')) {
      panel = document.querySelector('[data-rp-updates]');
      return panel;
    }

    panel = document.createElement('section');
    panel.className = 'rp-updates';
    panel.dataset.rpUpdates = 'true';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="rp-updates-shell">
        <header class="rp-updates-topbar">
          <button type="button" class="rp-updates-back" data-updates-close aria-label="Back to Real Play">←</button>
          <div class="rp-updates-title"><strong>UPDATES</strong><span>REAL PLAY BASKETBALL</span></div>
          <span class="rp-updates-official">OFFICIAL</span>
        </header>

        <section class="rp-updates-head">
          <small>REAL PLAY</small>
          <h1>WHAT'S HAPPENING.</h1>
          <p>Official schedules, results, and announcements from Real Play.</p>
        </section>

        <nav class="rp-updates-filters" aria-label="Update categories">
          <button type="button" class="active" data-update-filter="all">ALL</button>
          <button type="button" data-update-filter="schedule">SCHEDULES</button>
          <button type="button" data-update-filter="result">RESULTS</button>
          <button type="button" data-update-filter="announcement">ANNOUNCEMENTS</button>
        </nav>

        <div class="rp-updates-admin" data-updates-admin hidden>
          <button type="button" class="rp-updates-admin-open" data-updates-admin-open>+ PUBLISH UPDATE</button>
          <form class="rp-updates-admin-form" data-updates-admin-form hidden>
            <div class="rp-updates-admin-grid">
              <label>TYPE
                <select name="category" required>
                  <option value="announcement">ANNOUNCEMENT</option>
                  <option value="schedule">SCHEDULE</option>
                  <option value="result">RESULT</option>
                </select>
              </label>
              <label>DATE / TIME
                <input type="datetime-local" name="eventAt" />
              </label>
            </div>
            <label>TITLE
              <input name="title" maxlength="140" placeholder="WHAT PLAYERS NEED TO KNOW" required />
            </label>
            <label>DETAILS
              <textarea name="body" rows="4" maxlength="2400" placeholder="Add the official update details..."></textarea>
            </label>
            <label>LOCATION
              <input name="locationName" maxlength="180" placeholder="Optional court or venue" />
            </label>
            <label class="rp-updates-pin"><input type="checkbox" name="pinned" /> PIN THIS UPDATE</label>
            <div class="rp-updates-admin-actions">
              <button type="submit" data-updates-publish>PUBLISH</button>
              <button type="button" data-updates-admin-cancel>CANCEL</button>
            </div>
          </form>
        </div>

        <p class="rp-updates-status" data-updates-status aria-live="polite"></p>
        <main class="rp-updates-feed" data-updates-feed></main>
      </div>`;

    document.body.appendChild(panel);

    panel.querySelector('[data-updates-close]')?.addEventListener('click', closeUpdates);
    panel.querySelectorAll('[data-update-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        filter = button.dataset.updateFilter || 'all';
        renderFilters();
        renderFeed();
      });
    });

    panel.querySelector('[data-updates-admin-open]')?.addEventListener('click', () => {
      const form = panel.querySelector('[data-updates-admin-form]');
      if (form) form.hidden = false;
      panel.querySelector('[data-updates-admin-open]').hidden = true;
    });

    panel.querySelector('[data-updates-admin-cancel]')?.addEventListener('click', closeAdminForm);
    panel.querySelector('[data-updates-admin-form]')?.addEventListener('submit', publishUpdate);
    panel.querySelector('[data-updates-feed]')?.addEventListener('click', handleFeedClick);

    return panel;
  }

  function setStatus(message = '', type = '') {
    const node = panel?.querySelector('[data-updates-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  }

  function closeAdminForm() {
    const form = panel?.querySelector('[data-updates-admin-form]');
    const open = panel?.querySelector('[data-updates-admin-open]');
    if (form) {
      form.hidden = true;
      form.reset();
    }
    if (open) open.hidden = false;
  }

  function renderFilters() {
    panel?.querySelectorAll('[data-update-filter]').forEach((button) => {
      button.classList.toggle('active', button.dataset.updateFilter === filter);
    });
  }

  function categoryLabel(category) {
    if (category === 'schedule') return 'SCHEDULE';
    if (category === 'result') return 'RESULT';
    return 'ANNOUNCEMENT';
  }

  function categoryIcon(category) {
    if (category === 'schedule') return '◫';
    if (category === 'result') return '✓';
    return '!';
  }

  function resultBlock(update) {
    const meta = update?.metadata || {};
    const west = Number(meta.westScore);
    const east = Number(meta.eastScore);
    if (!Number.isFinite(west) || !Number.isFinite(east)) return '';
    return `
      <div class="rp-update-score">
        <div><span>WEST</span><strong>${west}</strong></div>
        <b>FINAL</b>
        <div><span>EAST</span><strong>${east}</strong></div>
      </div>`;
  }

  function scheduleMeta(update) {
    const pieces = [];
    const when = formatEvent(update.event_at || update.eventAt);
    if (when) pieces.push(`<span>${esc(when)}</span>`);
    const location = update.location_name || update.locationName;
    if (location) pieces.push(`<span>${esc(location)}</span>`);
    if (!pieces.length) return '';
    return `<div class="rp-update-event-meta">${pieces.join('')}</div>`;
  }

  function renderFeed() {
    const root = panel?.querySelector('[data-updates-feed]');
    if (!root) return;

    const visible = filter === 'all' ? updates : updates.filter((item) => item.category === filter);
    if (!visible.length) {
      root.innerHTML = `
        <div class="rp-updates-empty">
          <strong>NO ${filter === 'all' ? 'UPDATES' : categoryLabel(filter) + 'S'} YET.</strong>
          <p>Official Real Play information will appear here.</p>
        </div>`;
      return;
    }

    root.innerHTML = visible.map((update) => `
      <article class="rp-update-card rp-update-${esc(update.category)}${update.pinned ? ' pinned' : ''}" data-update-id="${esc(update.id)}">
        <header class="rp-update-card-head">
          <div class="rp-update-kind">
            <span>${categoryIcon(update.category)}</span>
            <div><strong>${categoryLabel(update.category)}</strong><small>${esc(timeAgo(update.published_at || update.publishedAt))}</small></div>
          </div>
          ${update.pinned ? '<b class="rp-update-pin">PINNED</b>' : ''}
        </header>
        <h2>${esc(update.title)}</h2>
        ${update.category === 'result' ? resultBlock(update) : ''}
        ${update.category === 'schedule' ? scheduleMeta(update) : ''}
        ${update.body ? `<p>${esc(update.body)}</p>` : ''}
        ${update.category !== 'schedule' && update.location_name ? `<div class="rp-update-location">${esc(update.location_name)}</div>` : ''}
        <footer>
          <span>REAL PLAY OFFICIAL</span>
          ${admin && !update.source_key ? `<button type="button" data-update-delete="${esc(update.id)}">DELETE</button>` : ''}
        </footer>
      </article>`).join('');
  }

  function renderAdmin() {
    const wrap = panel?.querySelector('[data-updates-admin]');
    if (!wrap) return;
    wrap.hidden = !admin;
    if (!admin) closeAdminForm();
  }

  async function refreshFeed({ quiet = false } = {}) {
    if (loading) return;
    loading = true;
    if (!quiet) setStatus('CHECKING REAL PLAY...');
    try {
      const data = await api('feed');
      updates = Array.isArray(data.updates) ? data.updates : [];
      renderFeed();
      if (!quiet) setStatus('');
    } catch (error) {
      if (!quiet) setStatus(error.message || 'Could not load official updates.', 'error');
      if (error.status === 401) {
        closeUpdates();
        document.querySelector('[data-auth-open]')?.click();
      }
    } finally {
      loading = false;
    }
  }

  async function detectAdmin() {
    if (new URLSearchParams(location.search).get('admin') !== '1') {
      admin = false;
      renderAdmin();
      return;
    }
    try {
      const data = await api('admin_status');
      admin = Boolean(data.admin);
    } catch (_error) {
      admin = false;
    }
    renderAdmin();
    renderFeed();
  }

  async function publishUpdate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[data-updates-publish]');
    const values = new FormData(form);
    const localEvent = String(values.get('eventAt') || '').trim();
    const payload = {
      category: String(values.get('category') || '').trim(),
      title: String(values.get('title') || '').trim(),
      body: String(values.get('body') || '').trim(),
      locationName: String(values.get('locationName') || '').trim(),
      eventAt: localEvent ? new Date(localEvent).toISOString() : null,
      pinned: values.get('pinned') === 'on',
    };

    if (!payload.title) return;
    button.disabled = true;
    button.textContent = 'PUBLISHING...';
    setStatus('');
    try {
      const data = await api('publish', payload);
      updates = Array.isArray(data.updates) ? data.updates : updates;
      closeAdminForm();
      renderFeed();
      setStatus('OFFICIAL UPDATE PUBLISHED.', 'success');
      setTimeout(() => setStatus(''), 1700);
    } catch (error) {
      setStatus(error.message || 'Could not publish update.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'PUBLISH';
    }
  }

  async function handleFeedClick(event) {
    const button = event.target.closest('[data-update-delete]');
    if (!button || !admin) return;
    const id = button.dataset.updateDelete;
    if (!id || !window.confirm('Delete this manual Real Play update?')) return;
    button.disabled = true;
    try {
      const data = await api('delete', { id });
      updates = Array.isArray(data.updates) ? data.updates : updates;
      renderFeed();
      setStatus('UPDATE DELETED.', 'success');
      setTimeout(() => setStatus(''), 1500);
    } catch (error) {
      setStatus(error.message || 'Could not delete update.', 'error');
      button.disabled = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      if (!panel?.classList.contains('open') || document.hidden) return;
      refreshFeed({ quiet: true });
    }, 15000);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function openUpdates() {
    createPanel();
    filter = 'all';
    renderFilters();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-updates-open');
    panel.scrollTop = 0;
    refreshFeed();
    detectAdmin();
    startPolling();
  }

  function closeUpdates() {
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-updates-open');
    stopPolling();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-rp-main-action="updates"], [data-rp-open-updates], [data-rp-action="updates"]');
    if (!trigger || panel?.contains(trigger)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openUpdates();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel?.classList.contains('open')) closeUpdates();
  });

  window.addEventListener('focus', () => {
    if (panel?.classList.contains('open')) refreshFeed({ quiet: true });
  });

  createPanel();
  window.RealPlayUpdates = { open: openUpdates, close: closeUpdates, refresh: refreshFeed };
})();
