(() => {
  function ensureUpdatesLayer() {
    if (window.__realPlayUpdatesInstalled || document.querySelector('[data-rp-updates-fallback]')) return;

    if (!document.querySelector('link[href*="real-play-updates.css"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'real-play-updates.css?v=20260903-official-updates-v1';
      css.dataset.rpUpdatesFallback = 'true';
      document.head.appendChild(css);
    }

    const script = document.createElement('script');
    script.src = 'real-play-updates.js?v=20260903-official-updates-v1';
    script.async = false;
    script.dataset.rpUpdatesFallback = 'true';
    document.head.appendChild(script);
  }

  ensureUpdatesLayer();

  function install() {
    const panel = document.querySelector('[data-rp-world]');
    const channelsRoot = panel?.querySelector('[data-chat-channels]');
    const chatStatus = panel?.querySelector('[data-chat-status]');
    if (!panel || !channelsRoot) return false;
    if (panel.dataset.chatCleanupInstalled === 'true') return true;
    panel.dataset.chatCleanupInstalled = 'true';

    panel.querySelector('.rp-chat-heading')?.remove();

    function normalizeChannels() {
      channelsRoot.querySelectorAll('.rp-chat-channel').forEach((button) => {
        const strong = button.querySelector('strong');
        const small = button.querySelector('small');
        const id = button.dataset.chatChannel || '';
        const isWorld = id === 'world';
        if (strong) {
          const desired = isWorld
            ? 'WORLD'
            : String(strong.textContent || 'TEAM').replace(/\s+CHAT$/i, '').trim() || 'TEAM';
          if (strong.textContent !== desired) strong.textContent = desired;
        }
        if (small) {
          const desired = isWorld ? 'ALL PLAYERS' : 'YOUR TEAM ONLY';
          if (small.textContent !== desired) small.textContent = desired;
        }
      });

      const waiting = channelsRoot.querySelector('.rp-chat-team-waiting');
      if (waiting && waiting.dataset.chatLockedNormalized !== 'true') {
        waiting.dataset.chatLockedNormalized = 'true';
        waiting.setAttribute('role', 'button');
        waiting.setAttribute('tabindex', '0');
        waiting.setAttribute('aria-disabled', 'true');
        waiting.setAttribute('aria-label', 'Team Chat locked until official team assignment');
        waiting.innerHTML = '<strong>TEAM</strong><span>LOCKED UNTIL TEAM ASSIGNMENT</span>';
      }
    }

    function explainLockedTeam() {
      if (!chatStatus) return;
      chatStatus.textContent = 'TEAM CHAT UNLOCKS AFTER REAL PLAY ASSIGNS YOUR OFFICIAL TEAM.';
      chatStatus.classList.remove('error', 'success');
      chatStatus.classList.add('team-locked');
      window.setTimeout(() => {
        if (chatStatus.textContent === 'TEAM CHAT UNLOCKS AFTER REAL PLAY ASSIGNS YOUR OFFICIAL TEAM.') {
          chatStatus.textContent = '';
          chatStatus.classList.remove('team-locked');
        }
      }, 3200);
    }

    channelsRoot.addEventListener('click', (event) => {
      if (event.target.closest('.rp-chat-team-waiting')) explainLockedTeam();
    });
    channelsRoot.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.rp-chat-team-waiting')) {
        event.preventDefault();
        explainLockedTeam();
      }
    });

    new MutationObserver(normalizeChannels).observe(channelsRoot, { childList: true, subtree: true });
    normalizeChannels();
    return true;
  }

  if (install()) return;
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts > 120) window.clearInterval(timer);
  }, 50);
})();
