(() => {
  if (window.__realPlayVisitorPlayerClaimInstalled) return;
  window.__realPlayVisitorPlayerClaimInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const HOLD_MS = 650;
  const MOVE_CANCEL_PX = 12;

  let holdTimer = 0;
  let holdRow = null;
  let holdPlayerId = null;
  let startX = 0;
  let startY = 0;
  let consumedPlayerId = null;
  let consumedUntil = 0;
  let selectedPlayer = null;
  let modal = null;
  let busy = false;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  const isVisitor = () => Boolean(window.RealPlayVisitor?.isActive?.());

  function clearHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
    holdRow?.classList.remove('rp-visitor-claim-holding');
    holdRow = null;
    holdPlayerId = null;
  }

  function installStyles() {
    if (document.querySelector('[data-rp-visitor-player-claim-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpVisitorPlayerClaimStyles = '1';
    style.textContent = `
      .rp-world-player-row.rp-visitor-claim-holding{
        border-color:rgba(66,216,255,.45)!important;
        box-shadow:inset 0 0 0 1px rgba(66,216,255,.12),0 0 22px rgba(40,190,235,.08)!important;
      }
      .rp-visitor-claim-modal{position:fixed;inset:0;z-index:2147483500;display:none;place-items:center;padding:18px;background:rgba(0,3,8,.88);backdrop-filter:blur(12px)}
      .rp-visitor-claim-modal.open{display:grid}
      .rp-visitor-claim-card{position:relative;width:min(100%,430px);max-height:min(90dvh,760px);overflow:auto;padding:22px 18px 20px;border:1px solid rgba(71,215,255,.2);border-radius:22px;color:#eff9ff;background:radial-gradient(circle at 50% 0%,rgba(45,198,244,.12),transparent 34%),linear-gradient(180deg,#07121c,#03070d 74%);box-shadow:0 30px 90px rgba(0,0,0,.75)}
      .rp-visitor-claim-card::before{content:'';position:absolute;left:20%;right:20%;top:0;height:2px;background:linear-gradient(90deg,transparent,#55dcff,transparent)}
      .rp-visitor-claim-close{position:absolute;right:13px;top:13px;width:34px;height:34px;padding:0;border:1px solid rgba(255,255,255,.11);border-radius:50%;color:#aebdca;background:#0a141e;font-size:1.05rem;font-weight:900;cursor:pointer}
      .rp-visitor-claim-kicker{margin:2px 42px 5px 0;color:#51d9ff;font-size:.5rem;font-weight:1000;letter-spacing:.14em;text-transform:uppercase}
      .rp-visitor-claim-card h2{margin:0 42px 8px 0;font-family:var(--rp-display,Impact,Arial,sans-serif);font-size:1.35rem;font-style:italic;font-weight:1000;letter-spacing:.02em;text-transform:uppercase}
      .rp-visitor-claim-copy{margin:0 0 15px;color:#9eb1c1;font-size:.68rem;font-weight:650;line-height:1.55}
      .rp-visitor-claim-player{display:flex;align-items:center;gap:11px;margin:0 0 15px;padding:11px 12px;border:1px solid rgba(75,215,255,.13);border-radius:13px;background:rgba(5,15,23,.82)}
      .rp-visitor-claim-player span{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:11px;color:#071018;background:#4bdbff;font-family:var(--rp-display,Arial,sans-serif);font-size:.62rem;font-weight:1000}
      .rp-visitor-claim-player div{min-width:0}
      .rp-visitor-claim-player strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Arial,sans-serif);font-size:.8rem;font-style:italic;font-weight:1000;text-transform:uppercase}
      .rp-visitor-claim-player small{display:block;margin-top:3px;color:#70869a;font-size:.47rem;font-weight:900;letter-spacing:.07em}
      .rp-visitor-claim-form{display:grid;gap:10px}
      .rp-visitor-claim-field{display:grid;gap:5px}
      .rp-visitor-claim-field label{color:#8195a7;font-size:.48rem;font-weight:950;letter-spacing:.075em;text-transform:uppercase}
      .rp-visitor-claim-field input{width:100%;box-sizing:border-box;padding:12px 11px;border:1px solid rgba(255,255,255,.1);border-radius:11px;outline:none;color:#eef8ff;background:#08121c;font-size:.76rem;font-weight:700}
      .rp-visitor-claim-field input:focus{border-color:rgba(72,215,255,.55);box-shadow:0 0 0 2px rgba(72,215,255,.08)}
      .rp-visitor-claim-submit,.rp-visitor-claim-done{width:100%;margin-top:3px;padding:13px;border:0;border-radius:12px;color:#031018;background:linear-gradient(180deg,#5de4ff,#2bc6ef);font-family:var(--rp-display,Arial,sans-serif);font-size:.66rem;font-weight:1000;letter-spacing:.055em;cursor:pointer}
      .rp-visitor-claim-submit:disabled{opacity:.55;cursor:wait}
      .rp-visitor-claim-note{margin:11px 0 0;color:#667b8f;font-size:.55rem;font-weight:700;line-height:1.5;text-align:center}
      .rp-visitor-claim-status{min-height:18px;margin:8px 0 0;color:#ff8291;font-size:.58rem;font-weight:850;line-height:1.45;text-align:center}
      .rp-visitor-claim-status.success{color:#61e3a7}
      .rp-visitor-claim-success{display:grid;justify-items:center;gap:10px;padding:10px 2px 2px;text-align:center}
      .rp-visitor-claim-success-icon{display:grid;place-items:center;width:54px;height:54px;border:1px solid rgba(86,224,168,.32);border-radius:50%;color:#62e0a7;background:rgba(53,197,139,.08);font-size:1.45rem;font-weight:1000}
      .rp-visitor-claim-success h3{margin:2px 0 0;font-family:var(--rp-display,Arial,sans-serif);font-size:1.08rem;font-style:italic;font-weight:1000;text-transform:uppercase}
      .rp-visitor-claim-success p{margin:0;max-width:340px;color:#9eb1c1;font-size:.67rem;font-weight:650;line-height:1.55}
      .rp-visitor-claim-success b{color:#eefaff}
      @media(max-width:420px){.rp-visitor-claim-card{padding:20px 15px 17px;border-radius:19px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.className = 'rp-visitor-claim-modal';
    modal.dataset.rpVisitorClaimModal = '1';
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-rp-visitor-claim-close]')) closeModal();
    });
    return modal;
  }

  function closeModal() {
    if (!modal || busy) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    selectedPlayer = null;
  }

  function setStatus(message = '', success = false) {
    const node = modal?.querySelector('[data-rp-visitor-claim-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('success', success);
  }

  async function api(path, options = {}) {
    const headers = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = options.token || localStorage.getItem(TOKEN_KEY) || '';
    if (options.auth && token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Request failed (${response.status}).`);
      error.code = data?.code || null;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function resolvePlayer(playerId) {
    const data = await window.RealPlayWorld?.community?.('players');
    const players = Array.isArray(data?.players) ? data.players : [];
    return players.find((player) => positiveId(player?.playerId ?? player?.userId) === playerId) || null;
  }

  function renderClaimForm(player) {
    const dialog = ensureModal();
    const playerId = positiveId(player?.playerId ?? player?.userId);
    const publicPlayerId = String(player?.publicPlayerId || `RP-${String(playerId || 0).padStart(5, '0')}`);
    const playerName = String(player?.playerName || 'REAL PLAY PLAYER').trim();
    selectedPlayer = { ...player, playerId, publicPlayerId, playerName };

    dialog.innerHTML = `
      <section class="rp-visitor-claim-card" role="dialog" aria-modal="true" aria-labelledby="rp-visitor-claim-title">
        <button type="button" class="rp-visitor-claim-close" data-rp-visitor-claim-close aria-label="Close">×</button>
        <p class="rp-visitor-claim-kicker">CLAIM EXISTING PLAYER</p>
        <h2 id="rp-visitor-claim-title">IS THIS YOUR PROFILE?</h2>
        <p class="rp-visitor-claim-copy">Create the account that will be associated with this Real Play player. The profile will <b>not</b> become permanently yours yet — the claim still requires Admin review.</p>
        <div class="rp-visitor-claim-player"><span>#</span><div><strong>${esc(playerName)}</strong><small>${esc(publicPlayerId)} · EXISTING REAL PLAY PROFILE</small></div></div>
        <form class="rp-visitor-claim-form" data-rp-visitor-claim-form>
          <div class="rp-visitor-claim-field"><label for="rp-visitor-claim-name">Account Name</label><input id="rp-visitor-claim-name" name="name" type="text" minlength="2" maxlength="100" autocomplete="name" value="${esc(playerName)}" required /></div>
          <div class="rp-visitor-claim-field"><label for="rp-visitor-claim-email">Email</label><input id="rp-visitor-claim-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
          <div class="rp-visitor-claim-field"><label for="rp-visitor-claim-password">Password</label><input id="rp-visitor-claim-password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required /></div>
          <div class="rp-visitor-claim-field"><label for="rp-visitor-claim-confirm">Confirm Password</label><input id="rp-visitor-claim-confirm" name="confirm_password" type="password" minlength="8" autocomplete="new-password" placeholder="Repeat your password" required /></div>
          <button class="rp-visitor-claim-submit" type="submit">CREATE ACCOUNT & SUBMIT CLAIM</button>
          <p class="rp-visitor-claim-status" data-rp-visitor-claim-status aria-live="polite"></p>
        </form>
        <p class="rp-visitor-claim-note">Your stats, rank, games and history remain unchanged while ownership is under review.</p>
      </section>`;

    dialog.querySelector('[data-rp-visitor-claim-form]')?.addEventListener('submit', submitClaim);
    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => dialog.querySelector('#rp-visitor-claim-email')?.focus(), 30);
  }

  function renderSuccess(player, email) {
    const dialog = ensureModal();
    dialog.innerHTML = `
      <section class="rp-visitor-claim-card" role="dialog" aria-modal="true" aria-labelledby="rp-visitor-claim-success-title">
        <div class="rp-visitor-claim-success">
          <div class="rp-visitor-claim-success-icon">✓</div>
          <p class="rp-visitor-claim-kicker">ACCOUNT CREATED</p>
          <h3 id="rp-visitor-claim-success-title">PLAYER CLAIM PENDING ADMIN REVIEW</h3>
          <p><b>${esc(player.playerName)}</b> is now temporarily associated with <b>${esc(email)}</b>.</p>
          <p>Your Real Play history is protected. Full ownership and profile control become permanent only after an Admin approves this claim.</p>
          <button type="button" class="rp-visitor-claim-done" data-rp-visitor-claim-done>CONTINUE TO REAL PLAY</button>
        </div>
      </section>`;
    dialog.querySelector('[data-rp-visitor-claim-done]')?.addEventListener('click', () => window.location.reload());
    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
  }

  async function submitClaim(event) {
    event.preventDefault();
    if (busy || !selectedPlayer?.playerId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const confirm = String(data.get('confirm_password') || '');

    if (name.length < 2) return setStatus('Enter your name.');
    if (!email) return setStatus('Enter your email.');
    if (password.length < 8) return setStatus('Password must be at least 8 characters.');
    if (password !== confirm) return setStatus('Passwords do not match.');

    busy = true;
    const submit = form.querySelector('button[type="submit"]');
    const original = submit?.textContent || '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'CREATING ACCOUNT...';
    }
    setStatus('');

    try {
      const registration = await api('/api/real-play/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });
      const token = String(registration?.token || '');
      if (!token) throw new Error('Account was created but no session token was returned. Please log in and try claiming again.');

      localStorage.setItem(TOKEN_KEY, token);
      if (submit) submit.textContent = 'SUBMITTING CLAIM...';

      await api('/api/real-play/profile-ownership/claim', {
        method: 'POST',
        auth: true,
        token,
        body: { playerId: selectedPlayer.playerId },
      });

      try { window.RealPlayVisitor?.exit?.(); } catch (_error) {}
      window.dispatchEvent(new CustomEvent('realplay:player-claim-submitted', {
        detail: {
          playerId: selectedPlayer.playerId,
          publicPlayerId: selectedPlayer.publicPlayerId,
          playerName: selectedPlayer.playerName,
        },
      }));
      renderSuccess(selectedPlayer, email);
    } catch (error) {
      if (error.code === 'EMAIL_ALREADY_REGISTERED') {
        setStatus('That email already has a Real Play account. Log in first, then use CLAIM EXISTING PLAYER PROFILE.');
      } else if (error.code === 'PROFILE_NOT_CLAIMABLE') {
        setStatus('This player profile is no longer available to claim.');
      } else {
        setStatus(error.message || 'Could not submit this claim. Please try again.');
      }
    } finally {
      busy = false;
      if (submit?.isConnected) {
        submit.disabled = false;
        submit.textContent = original;
      }
    }
  }

  async function beginClaim(playerId, row) {
    if (!isVisitor()) return;
    consumedPlayerId = playerId;
    consumedUntil = Date.now() + 1200;
    row?.classList.remove('rp-visitor-claim-holding');

    try {
      const player = await resolvePlayer(playerId);
      if (!player) return;
      if (player.unclaimed !== true || String(player.ownershipStatus || '').toLowerCase() !== 'unclaimed') {
        return;
      }
      renderClaimForm(player);
    } catch (error) {
      console.warn('[Real Play] Visitor player claim could not start.', error);
    }
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isVisitor() || event.button > 0) return;
    const row = event.target.closest?.('.rp-world-player-row[data-world-player-id]');
    if (!row) return;
    const playerId = positiveId(row.dataset.worldPlayerId);
    if (!playerId) return;

    clearHold();
    holdRow = row;
    holdPlayerId = playerId;
    startX = Number(event.clientX) || 0;
    startY = Number(event.clientY) || 0;
    row.classList.add('rp-visitor-claim-holding');
    holdTimer = window.setTimeout(() => {
      const targetRow = holdRow;
      const targetId = holdPlayerId;
      holdTimer = 0;
      if (targetRow && targetId) beginClaim(targetId, targetRow);
    }, HOLD_MS);
  }, true);

  document.addEventListener('pointermove', (event) => {
    if (!holdTimer) return;
    const dx = Math.abs((Number(event.clientX) || 0) - startX);
    const dy = Math.abs((Number(event.clientY) || 0) - startY);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearHold();
  }, true);

  ['pointerup', 'pointercancel'].forEach((type) => {
    document.addEventListener(type, () => {
      if (holdTimer) clearHold();
      else {
        holdRow?.classList.remove('rp-visitor-claim-holding');
        holdRow = null;
        holdPlayerId = null;
      }
    }, true);
  });

  // A completed hold must not also execute the normal row click that opens the
  // public profile. This listener is installed from visitor-mode before the
  // visitor player directory listener, so it owns the consumed click.
  document.addEventListener('click', (event) => {
    if (!consumedPlayerId || Date.now() > consumedUntil) return;
    const row = event.target.closest?.('.rp-world-player-row[data-world-player-id]');
    if (!row || positiveId(row.dataset.worldPlayerId) !== consumedPlayerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    consumedPlayerId = null;
    consumedUntil = 0;
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('open') && !busy) closeModal();
  }, true);

  installStyles();
})();
