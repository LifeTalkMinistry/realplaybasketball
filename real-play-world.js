(() => {
  if (window.__realPlayWorldInstalled) return;
  window.__realPlayWorldInstalled = true;

  const TOKEN_KEY = 'real_play_access_token';
  const COMMUNITY_URL = 'https://aydgnziueszxxhusatsv.supabase.co/functions/v1/real-play-community';

  let panel = null;
  let activeTab = 'world';
  let currentChannel = 'world';
  let me = null;
  let feed = [];
  let channels = [];
  let messages = [];
  let refreshing = false;
  let pollTimer = null;
  let forceChatBottom = true;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function initials(name) {
    const parts = String(name || 'RP').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'RP';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function timeLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Math.max(0, Date.now() - date.getTime());
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return 'NOW';
    if (diff < hour) return `${Math.floor(diff / minute)}M`;
    if (diff < day) return `${Math.floor(diff / hour)}H`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}D`;
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(date).toUpperCase();
  }

  function token() {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  }

  async function community(action, payload = {}) {
    const accessToken = token();
    if (!accessToken) {
      const error = new Error('Please log in to Real Play first.');
      error.status = 401;
      throw error;
    }

    const response = await fetch(COMMUNITY_URL, {
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
      const error = new Error(data?.error || 'Real Play World could not complete that request.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function createPanel() {
    if (panel || document.querySelector('[data-rp-world]')) {
      panel = document.querySelector('[data-rp-world]');
      return panel;
    }

    panel = document.createElement('section');
    panel.className = 'rp-world';
    panel.dataset.rpWorld = 'true';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="rp-world-shell">
        <header class="rp-world-topbar">
          <button class="rp-world-back" type="button" data-world-close aria-label="Back to Real Play">←</button>
          <div class="rp-world-title"><strong>WORLD</strong><span>REAL PLAY BASKETBALL</span></div>
          <span class="rp-world-online">COMMUNITY</span>
        </header>

        <nav class="rp-world-primary-tabs" aria-label="World navigation">
          <button type="button" class="active" data-world-tab="world">WORLD</button>
          <span aria-hidden="true">|</span>
          <button type="button" data-world-tab="chats">CHATS</button>
        </nav>

        <main class="rp-world-body">
          <section class="rp-world-view" data-world-view="world">
            <form class="rp-world-composer" data-world-post-form>
              <div class="rp-world-composer-avatar" data-world-me-avatar>RP</div>
              <label>
                <span class="sr-only">Create a World post</span>
                <textarea maxlength="1200" rows="3" placeholder="Share something with Real Play..." data-world-post-input required></textarea>
              </label>
              <div class="rp-world-composer-foot">
                <small>REAL PLAY COMMUNITY</small>
                <button type="submit" data-world-post-button>POST</button>
              </div>
            </form>
            <p class="rp-world-status" data-world-status aria-live="polite"></p>
            <div class="rp-world-feed" data-world-feed></div>
          </section>

          <section class="rp-world-view" data-world-view="chats" hidden>
            <div class="rp-chat-heading">
              <div><small>REAL PLAY CHAT</small><h1>Talk to your people.</h1></div>
              <span>TEAM + WORLD</span>
            </div>
            <div class="rp-chat-channels" data-chat-channels></div>
            <div class="rp-chat-thread-wrap">
              <header class="rp-chat-thread-head">
                <div><strong data-chat-title>WORLD CHAT</strong><span data-chat-subtitle>Everyone in Real Play</span></div>
                <b>●</b>
              </header>
              <div class="rp-chat-thread" data-chat-thread></div>
              <form class="rp-chat-form" data-chat-form>
                <textarea rows="1" maxlength="1000" placeholder="Message World Chat..." data-chat-input required></textarea>
                <button type="submit" aria-label="Send message" data-chat-send>↑</button>
              </form>
            </div>
            <p class="rp-world-status" data-chat-status aria-live="polite"></p>
          </section>
        </main>
      </div>`;

    document.body.appendChild(panel);

    panel.querySelector('[data-world-close]')?.addEventListener('click', closeWorld);
    panel.querySelectorAll('[data-world-tab]').forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.worldTab || 'world'));
    });

    panel.querySelector('[data-world-post-form]')?.addEventListener('submit', createPost);
    panel.querySelector('[data-chat-form]')?.addEventListener('submit', sendChat);

    panel.querySelector('[data-chat-input]')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        panel.querySelector('[data-chat-form]')?.requestSubmit();
      }
    });

    panel.querySelector('[data-world-feed]')?.addEventListener('click', handleFeedClick);
    panel.querySelector('[data-world-feed]')?.addEventListener('submit', handleFeedSubmit);
    panel.querySelector('[data-chat-channels]')?.addEventListener('click', handleChannelClick);

    return panel;
  }

  function setStatus(message = '', type = '') {
    const node = panel?.querySelector('[data-world-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  }

  function setChatStatus(message = '', type = '') {
    const node = panel?.querySelector('[data-chat-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', type === 'error');
    node.classList.toggle('success', type === 'success');
  }

  function renderMe() {
    const avatar = panel?.querySelector('[data-world-me-avatar]');
    if (avatar) avatar.textContent = initials(me?.playerName);
  }

  function renderFeed() {
    const root = panel?.querySelector('[data-world-feed]');
    if (!root) return;

    if (!feed.length) {
      root.innerHTML = `
        <div class="rp-world-empty">
          <strong>WORLD IS READY.</strong>
          <p>Start the first community post.</p>
        </div>`;
      return;
    }

    root.innerHTML = feed.map((post) => {
      const comments = Array.isArray(post.comments) ? post.comments : [];
      return `
        <article class="rp-world-post" data-post-id="${esc(post.id)}">
          <header class="rp-world-post-head">
            <div class="rp-world-avatar">${esc(initials(post.author?.playerName))}</div>
            <div class="rp-world-post-author">
              <strong>${esc(post.author?.playerName || 'REAL PLAY PLAYER')}</strong>
              <span>${esc(timeLabel(post.createdAt))}</span>
            </div>
          </header>
          <p class="rp-world-post-copy">${esc(post.body)}</p>
          <div class="rp-world-post-actions">
            <button type="button" class="${post.likedByMe ? 'active' : ''}" data-post-like>
              <span>♥</span> ${Number(post.likeCount || 0)}
            </button>
            <button type="button" data-post-comment-toggle>
              <span>●</span> ${comments.length ? `${comments.length} COMMENT${comments.length === 1 ? '' : 'S'}` : 'COMMENT'}
            </button>
          </div>
          <div class="rp-world-comments${comments.length ? ' has-comments' : ''}" data-post-comments>
            ${comments.map((comment) => `
              <div class="rp-world-comment">
                <div class="rp-world-comment-avatar">${esc(initials(comment.author?.playerName))}</div>
                <div>
                  <p><strong>${esc(comment.author?.playerName || 'REAL PLAY PLAYER')}</strong><span>${esc(timeLabel(comment.createdAt))}</span></p>
                  <b>${esc(comment.body)}</b>
                </div>
              </div>`).join('')}
            <form class="rp-world-comment-form" data-comment-form hidden>
              <input type="text" maxlength="500" placeholder="Write a comment..." data-comment-input required />
              <button type="submit">POST</button>
            </form>
          </div>
        </article>`;
    }).join('');
  }

  function renderChannels() {
    const root = panel?.querySelector('[data-chat-channels]');
    if (!root) return;

    root.innerHTML = channels.map((channel) => `
      <button type="button" class="rp-chat-channel${channel.id === currentChannel ? ' active' : ''}" data-chat-channel="${esc(channel.id)}">
        <span>${channel.type === 'world' ? '◎' : '◉'}</span>
        <div><strong>${esc(channel.name)}</strong><small>${esc(channel.subtitle)}</small></div>
      </button>`).join('');

    if (channels.length === 1) {
      root.insertAdjacentHTML('beforeend', `
        <div class="rp-chat-team-waiting">
          <strong>TEAM CHAT</strong>
          <span>Your team chat appears automatically once Real Play assigns your official team.</span>
        </div>`);
    }
  }

  function renderChat({ scroll = false } = {}) {
    const thread = panel?.querySelector('[data-chat-thread]');
    const title = panel?.querySelector('[data-chat-title]');
    const subtitle = panel?.querySelector('[data-chat-subtitle]');
    const input = panel?.querySelector('[data-chat-input]');
    if (!thread || !title || !subtitle || !input) return;

    const channel = channels.find((item) => item.id === currentChannel) || channels[0] || {
      id: 'world', name: 'WORLD CHAT', subtitle: 'Everyone in Real Play', type: 'world',
    };
    title.textContent = channel.name;
    subtitle.textContent = channel.subtitle;
    input.placeholder = `Message ${channel.name.replace(/ CHAT$/i, '')}...`;

    if (!messages.length) {
      thread.innerHTML = `
        <div class="rp-chat-empty">
          <strong>NO MESSAGES YET.</strong>
          <span>Start the conversation.</span>
        </div>`;
    } else {
      thread.innerHTML = messages.map((message) => `
        <div class="rp-chat-message${message.mine ? ' mine' : ''}">
          <div class="rp-chat-message-avatar">${esc(initials(message.author?.playerName))}</div>
          <div class="rp-chat-bubble">
            ${message.mine ? '' : `<strong>${esc(message.author?.playerName || 'REAL PLAY PLAYER')}</strong>`}
            <p>${esc(message.body)}</p>
            <span>${esc(timeLabel(message.createdAt))}</span>
          </div>
        </div>`).join('');
    }

    if (scroll || forceChatBottom) {
      window.requestAnimationFrame(() => {
        thread.scrollTop = thread.scrollHeight;
        forceChatBottom = false;
      });
    }
  }

  function renderTabs() {
    panel?.querySelectorAll('[data-world-tab]').forEach((button) => {
      const active = button.dataset.worldTab === activeTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    panel?.querySelectorAll('[data-world-view]').forEach((view) => {
      view.hidden = view.dataset.worldView !== activeTab;
    });
  }

  function renderAll() {
    renderTabs();
    renderMe();
    renderFeed();
    renderChannels();
    renderChat();
  }

  async function bootstrap({ quiet = false } = {}) {
    if (refreshing) return;
    refreshing = true;
    if (!quiet) setStatus('LOADING WORLD...');
    try {
      const data = await community('bootstrap');
      me = data.me || me;
      feed = Array.isArray(data.feed) ? data.feed : [];
      channels = Array.isArray(data.channels) && data.channels.length ? data.channels : [
        { id: 'world', type: 'world', key: 'world', name: 'WORLD CHAT', subtitle: 'Everyone in Real Play' },
      ];
      if (!channels.some((channel) => channel.id === currentChannel)) currentChannel = channels[0].id;
      setStatus('');
      renderAll();
      if (activeTab === 'chats') await refreshChat({ quiet: true });
    } catch (error) {
      if (!quiet) setStatus(error.message || 'World could not load.', 'error');
      if (error.status === 401) {
        closeWorld();
        document.querySelector('[data-auth-open]')?.click();
      }
    } finally {
      refreshing = false;
    }
  }

  async function refreshFeed({ quiet = true } = {}) {
    try {
      const data = await community('feed');
      feed = Array.isArray(data.feed) ? data.feed : [];
      renderFeed();
      if (!quiet) setStatus('');
    } catch (error) {
      if (!quiet) setStatus(error.message || 'Could not refresh World.', 'error');
    }
  }

  async function refreshChannels() {
    try {
      const data = await community('channels');
      channels = Array.isArray(data.channels) && data.channels.length ? data.channels : channels;
      if (!channels.some((channel) => channel.id === currentChannel)) currentChannel = channels[0]?.id || 'world';
      renderChannels();
    } catch (_error) {
      // Keep the last known channels available.
    }
  }

  async function refreshChat({ quiet = true, scroll = false } = {}) {
    if (!currentChannel) currentChannel = 'world';
    const thread = panel?.querySelector('[data-chat-thread]');
    const wasNearBottom = thread ? thread.scrollHeight - thread.scrollTop - thread.clientHeight < 90 : true;
    try {
      const data = await community('chat', { channel: currentChannel });
      messages = Array.isArray(data.messages) ? data.messages : [];
      renderChat({ scroll: scroll || wasNearBottom });
      if (!quiet) setChatStatus('');
    } catch (error) {
      if (!quiet) setChatStatus(error.message || 'Could not load chat.', 'error');
    }
  }

  async function createPost(event) {
    event.preventDefault();
    const input = panel?.querySelector('[data-world-post-input]');
    const button = panel?.querySelector('[data-world-post-button]');
    const body = String(input?.value || '').trim();
    if (!body || !input || !button) return;

    button.disabled = true;
    button.textContent = 'POSTING...';
    setStatus('');
    try {
      const data = await community('create_post', { body });
      feed = Array.isArray(data.feed) ? data.feed : feed;
      input.value = '';
      renderFeed();
      setStatus('POSTED TO WORLD.', 'success');
      window.setTimeout(() => setStatus(''), 1600);
    } catch (error) {
      setStatus(error.message || 'Could not post.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'POST';
    }
  }

  async function handleFeedClick(event) {
    const post = event.target.closest('[data-post-id]');
    if (!post) return;
    const postId = post.dataset.postId;

    if (event.target.closest('[data-post-comment-toggle]')) {
      const form = post.querySelector('[data-comment-form]');
      if (form) {
        form.hidden = !form.hidden;
        if (!form.hidden) form.querySelector('[data-comment-input]')?.focus();
      }
      return;
    }

    const like = event.target.closest('[data-post-like]');
    if (!like) return;
    like.disabled = true;
    try {
      const data = await community('toggle_like', { postId });
      feed = Array.isArray(data.feed) ? data.feed : feed;
      renderFeed();
    } catch (error) {
      setStatus(error.message || 'Could not update reaction.', 'error');
      like.disabled = false;
    }
  }

  async function handleFeedSubmit(event) {
    const form = event.target.closest('[data-comment-form]');
    if (!form) return;
    event.preventDefault();
    const post = form.closest('[data-post-id]');
    const input = form.querySelector('[data-comment-input]');
    const button = form.querySelector('button[type="submit"]');
    const body = String(input?.value || '').trim();
    const postId = post?.dataset.postId;
    if (!body || !postId || !input || !button) return;

    button.disabled = true;
    button.textContent = '...';
    try {
      const data = await community('create_comment', { postId, body });
      feed = Array.isArray(data.feed) ? data.feed : feed;
      renderFeed();
    } catch (error) {
      setStatus(error.message || 'Could not comment.', 'error');
      button.disabled = false;
      button.textContent = 'POST';
    }
  }

  async function handleChannelClick(event) {
    const button = event.target.closest('[data-chat-channel]');
    if (!button) return;
    const next = button.dataset.chatChannel || 'world';
    if (next === currentChannel) return;
    currentChannel = next;
    messages = [];
    forceChatBottom = true;
    renderChannels();
    renderChat();
    setChatStatus('LOADING CHAT...');
    await refreshChat({ quiet: false, scroll: true });
  }

  async function sendChat(event) {
    event.preventDefault();
    const input = panel?.querySelector('[data-chat-input]');
    const button = panel?.querySelector('[data-chat-send]');
    const body = String(input?.value || '').trim();
    if (!body || !input || !button) return;

    button.disabled = true;
    setChatStatus('');
    try {
      const data = await community('send_chat', { channel: currentChannel, body });
      messages = Array.isArray(data.messages) ? data.messages : messages;
      input.value = '';
      forceChatBottom = true;
      renderChat({ scroll: true });
    } catch (error) {
      setChatStatus(error.message || 'Could not send message.', 'error');
    } finally {
      button.disabled = false;
      input.focus();
    }
  }

  async function switchTab(tab) {
    activeTab = tab === 'chats' ? 'chats' : 'world';
    renderTabs();
    if (activeTab === 'world') {
      await refreshFeed({ quiet: true });
    } else {
      await refreshChannels();
      forceChatBottom = true;
      await refreshChat({ quiet: false, scroll: true });
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(() => {
      if (!panel?.classList.contains('open') || document.hidden) return;
      if (activeTab === 'world') refreshFeed({ quiet: true });
      else refreshChat({ quiet: true });
    }, 12000);
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function setWorldNavActive(active) {
    document.querySelectorAll('[data-rp-bottom-nav] .rp-nav-item').forEach((button) => {
      button.classList.toggle('active', active && button.dataset.rpNav === 'world');
    });
    if (!active) document.querySelector('[data-rp-nav="play"]')?.classList.add('active');
  }

  function openWorld() {
    createPanel();
    activeTab = 'world';
    currentChannel = 'world';
    messages = [];
    forceChatBottom = true;
    renderTabs();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-world-open');
    panel.scrollTop = 0;
    setWorldNavActive(true);
    setStatus('LOADING WORLD...');
    bootstrap();
    startPolling();
  }

  function closeWorld() {
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-world-open');
    setWorldNavActive(false);
    stopPolling();
  }

  function repurposeNavigation() {
    const app = document.querySelector('[data-rp-app]');
    if (!app) return false;

    const oldProfileNav = app.querySelector('[data-rp-nav="player"], [data-rp-nav="profile"]');
    if (oldProfileNav) {
      oldProfileNav.dataset.rpNav = 'world';
      oldProfileNav.innerHTML = '<span>◎</span>WORLD';
      oldProfileNav.setAttribute('aria-label', 'Open Real Play World');
    }

    const quickProfile = app.querySelector('[data-rp-action="profile"]');
    if (quickProfile) {
      quickProfile.dataset.rpAction = 'world';
      const strong = quickProfile.querySelector('strong');
      const copy = quickProfile.querySelector('span');
      if (strong) strong.textContent = 'WORLD';
      if (copy) copy.textContent = 'Posts & chat';
    }

    createPanel();
    return true;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-rp-nav="world"], [data-rp-action="world"]');
    if (!trigger || panel?.contains(trigger)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openWorld();
  }, true);

  window.addEventListener('focus', () => {
    if (!panel?.classList.contains('open')) return;
    if (activeTab === 'world') refreshFeed({ quiet: true });
    else refreshChat({ quiet: true });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel?.classList.contains('open')) closeWorld();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && panel?.classList.contains('open')) {
      if (activeTab === 'world') refreshFeed({ quiet: true });
      else refreshChat({ quiet: true });
    }
  });

  if (!repurposeNavigation()) {
    const observer = new MutationObserver(() => {
      if (repurposeNavigation()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.RealPlayWorld = { open: openWorld, close: closeWorld };
})();
