(() => {
  if (window.__rpPlayerIdBadge) return;
  window.__rpPlayerIdBadge = true;

  const API = 'https://api.clarapmc.com';
  const TOKEN = 'real_play_access_token';

  function publicId(value) {
    const text = String(value || '').toUpperCase();
    const match = text.match(/RP-(\d+)/);
    if (match) return `RP-${String(Number(match[1])).padStart(5, '0')}`;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? `RP-${String(id).padStart(5, '0')}` : '';
  }

  function badge(panel) {
    const node = panel?.querySelector('.rp-profile-topbar > b');
    if (!node) return null;
    node.dataset.rpPlayerIdBadge = '1';
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    return node;
  }

  function publicIdentity(panel) {
    const player = panel?.__realPlayPublicPlayer;
    if (player) return {
      id: publicId(player.publicPlayerId || player.playerId),
      name: player.playerName || 'REAL PLAY PLAYER',
      status: player.unclaimed || player.ownershipStatus === 'unclaimed'
        ? 'UNCLAIMED PLAYER'
        : player.ownershipStatus === 'pending' ? 'PENDING VERIFICATION' : 'VERIFIED PLAYER',
    };
    const id = publicId(panel?.textContent);
    if (!id) return null;
    return {
      id,
      name: panel.querySelector('.rp-profile-name h1')?.textContent?.trim() || 'REAL PLAY PLAYER',
      status: 'REAL PLAY PLAYER',
    };
  }

  async function selfIdentity(panel) {
    if (panel.__rpPlayerIdentity) return panel.__rpPlayerIdentity;
    const token = localStorage.getItem(TOKEN) || '';
    if (!token) return null;
    const response = await fetch(`${API}/api/real-play/profile-ownership/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const owner = data?.ownership;
    if (!owner) return null;
    panel.__rpPlayerIdentity = {
      id: publicId(owner.publicPlayerId || owner.playerId),
      name: owner.playerName || panel.querySelector('.rp-profile-name h1')?.textContent?.trim() || 'REAL PLAY PLAYER',
      status: owner.ownershipStatus === 'pending' ? 'PENDING VERIFICATION' : 'VERIFIED PLAYER',
    };
    return panel.__rpPlayerIdentity;
  }

  function apply(panel, identity) {
    if (!identity?.id) return;
    panel.__rpPlayerIdentity = identity;
    const node = badge(panel);
    if (node) node.textContent = identity.id;
  }

  function sheet() {
    let root = document.querySelector('[data-rp-player-id-sheet]');
    if (root) return root;
    root = document.createElement('div');
    root.dataset.rpPlayerIdSheet = '1';
    root.className = 'rp-player-id-sheet';
    root.innerHTML = `<div class="rp-player-id-card"><button type="button" data-rp-player-id-close>×</button><small>PERMANENT REAL PLAY ID</small><strong data-rp-player-id-value>PLAYER ID</strong><h3 data-rp-player-id-name>REAL PLAY PLAYER</h3><span data-rp-player-id-status>REAL PLAY PLAYER</span><p>Jersey numbers can change. This Player ID stays with the same player profile.</p></div>`;
    document.body.appendChild(root);
    const close = () => root.classList.remove('open');
    root.querySelector('[data-rp-player-id-close]').addEventListener('click', close);
    root.addEventListener('click', (event) => { if (event.target === root) close(); });
    return root;
  }

  function show(identity) {
    if (!identity?.id) return;
    const root = sheet();
    root.querySelector('[data-rp-player-id-value]').textContent = identity.id;
    root.querySelector('[data-rp-player-id-name]').textContent = identity.name || 'REAL PLAY PLAYER';
    root.querySelector('[data-rp-player-id-status]').textContent = identity.status || 'REAL PLAY PLAYER';
    root.classList.add('open');
  }

  async function sync(panel) {
    if (!panel?.matches('.rp-profile')) return;
    badge(panel);
    if (panel.matches('[data-rp-public-profile], [data-rp-visitor-public-profile]')) {
      apply(panel, publicIdentity(panel));
      return;
    }
    if (panel.matches('[data-rp-profile]') && panel.classList.contains('open')) {
      apply(panel, await selfIdentity(panel));
    }
  }

  const style = document.createElement('style');
  style.textContent = `.rp-profile-topbar>[data-rp-player-id-badge]{cursor:pointer;white-space:nowrap}.rp-profile-topbar>[data-rp-player-id-badge]:focus-visible{outline:2px solid #48d7ff;outline-offset:2px}.rp-player-id-sheet{position:fixed;z-index:590;inset:0;display:none;align-items:flex-end;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}.rp-player-id-sheet.open{display:flex}.rp-player-id-card{position:relative;width:min(100%,390px);padding:24px 20px;border:1px solid rgba(72,215,255,.22);border-radius:24px;background:linear-gradient(145deg,#07111d,#04070d 66%,#10070b);text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.55)}.rp-player-id-card button{position:absolute;top:12px;right:12px;width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;background:#080d15;font-size:1rem}.rp-player-id-card small{display:block;color:#5fdcff;font-size:.48rem;font-weight:950;letter-spacing:.14em}.rp-player-id-card>strong{display:block;margin:12px 0 6px;font-family:var(--rp-display,Arial,sans-serif);font-size:2rem;font-style:italic;font-weight:950;letter-spacing:.04em}.rp-player-id-card h3{margin:0;font-family:var(--rp-display,Arial,sans-serif);font-size:1rem;font-style:italic;font-weight:950}.rp-player-id-card span{display:inline-block;margin-top:10px;padding:6px 9px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#8294a8;font-size:.45rem;font-weight:950;letter-spacing:.09em}.rp-player-id-card p{margin:14px auto 0;max-width:285px;color:#65778c;font-size:.54rem;line-height:1.55}`;
  document.head.appendChild(style);

  document.addEventListener('click', async (event) => {
    const node = event.target.closest('[data-rp-player-id-badge]');
    if (!node) return;
    const panel = node.closest('.rp-profile');
    if (!panel) return;
    event.preventDefault();
    let identity = panel.__rpPlayerIdentity || publicIdentity(panel);
    if (!identity?.id && panel.matches('[data-rp-profile]')) identity = await selfIdentity(panel);
    apply(panel, identity);
    show(identity);
  }, true);

  const observer = new MutationObserver(() => document.querySelectorAll('.rp-profile').forEach((panel) => sync(panel).catch(() => {})));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('realplay:public-profile-loaded', () => document.querySelectorAll('.rp-profile').forEach((panel) => sync(panel).catch(() => {})));
  document.querySelectorAll('.rp-profile').forEach((panel) => sync(panel).catch(() => {}));
})();