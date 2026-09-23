(() => {
  let pendingOpenView = null;
  let pendingOpenTimer = 0;

  function openAuth(view = '') {
    const normalizedView = String(view || '').trim();
    if (typeof window.__realPlayOpenAuth === 'function') {
      window.__realPlayOpenAuth(normalizedView || undefined);
      pendingOpenView = null;
      return true;
    }

    pendingOpenView = normalizedView;
    if (pendingOpenTimer) return false;

    let attempts = 0;
    const retry = () => {
      pendingOpenTimer = 0;
      if (typeof window.__realPlayOpenAuth === 'function') {
        const nextView = pendingOpenView;
        pendingOpenView = null;
        window.__realPlayOpenAuth(nextView || undefined);
        return;
      }
      attempts += 1;
      if (attempts >= 120) return;
      pendingOpenTimer = window.setTimeout(retry, 50);
    };
    pendingOpenTimer = window.setTimeout(retry, 0);
    return false;
  }

  function closeAuth() {
    const close = document.querySelector('[data-auth-close]');
    if (close) {
      close.click();
      return true;
    }
    return false;
  }

  window.RealPlayAuth = {
    open: openAuth,
    close: closeAuth,
  };

  // Transitional compatibility for older feature fallbacks that still call
  // document.querySelector('[data-auth-open]')?.click(). This is not visible UI
  // and no longer depends on the retired historical landing page.
  if (!document.querySelector('[data-auth-open]')) {
    const compatibilityOpen = document.createElement('button');
    compatibilityOpen.type = 'button';
    compatibilityOpen.hidden = true;
    compatibilityOpen.tabIndex = -1;
    compatibilityOpen.dataset.authOpen = 'true';
    compatibilityOpen.setAttribute('aria-hidden', 'true');
    compatibilityOpen.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAuth();
    });
    document.body.appendChild(compatibilityOpen);
  }

  if (document.querySelector('[data-auth-overlay]')) return;

  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  overlay.dataset.authOverlay = 'true';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <section class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="real-play-auth-title">
      <button class="auth-close" type="button" aria-label="Close account window" data-auth-close>×</button>
      <p class="auth-kicker">REAL PLAY MEMBER ACCESS</p>
      <h2 class="auth-title" id="real-play-auth-title">YOUR COURT ID.</h2>
      <p class="auth-subtitle">Log in to your Real Play account or create the player identity that will hold your official on-court history.</p>

      <div class="auth-tabs" role="tablist" data-auth-tabs>
        <button class="auth-tab active" type="button" role="tab" aria-selected="true" data-auth-tab="login">LOG IN</button>
        <button class="auth-tab" type="button" role="tab" aria-selected="false" data-auth-tab="signup">CREATE PLAYER PROFILE</button>
      </div>

      <div class="auth-view" data-auth-view="login">
        <form class="auth-form" data-auth-login-form>
          <div class="auth-field"><label for="real-play-login-email">Email</label><input id="real-play-login-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
          <div class="auth-field"><label for="real-play-login-password">Password</label><input id="real-play-login-password" name="password" type="password" autocomplete="current-password" placeholder="Your password" required /></div>
          <button class="auth-submit" type="submit">LOG IN TO REAL PLAY</button>
        </form>
      </div>

      <div class="auth-view" data-auth-view="signup" hidden></div>
      <div class="auth-view" data-auth-view="complete" hidden></div>

      <div class="auth-view" data-auth-view="account" hidden>
        <div class="auth-account-card">
          <span class="auth-account-label">REAL PLAY PLAYER</span>
          <div class="auth-player-identity"><strong class="auth-player-number" data-auth-player-number>#--</strong><div><strong class="auth-account-name" data-auth-account-name>REAL PLAY PLAYER</strong><span class="auth-account-email" data-auth-account-email></span></div></div>
          <span class="auth-number-lock" data-auth-number-lock></span>
          <span class="auth-support-tier" data-auth-support-tier hidden></span>
        </div>
        <div class="auth-next-card" data-auth-next-card><span class="auth-account-label">NEXT MONTH</span><strong data-auth-next-number>No number change scheduled.</strong><p data-auth-next-status>Your current number remains protected through the end of this month.</p></div>
        <form class="auth-number-request" data-auth-number-request-form>
          <div class="auth-field"><label for="real-play-request-number">Want a different number next month?</label><div class="auth-number-request-row"><input id="real-play-request-number" name="player_number" type="number" min="0" max="99" inputmode="numeric" placeholder="#" required /><button class="auth-secondary-action" type="submit">CHECK / REQUEST</button></div></div>
          <p class="auth-note">If the number is owned, the current player keeps it through month-end. Higher confirmed Real Play support can earn next-month priority. Exact support amounts are never shown to other players.</p>
        </form>
        <div class="auth-notifications-wrap" data-auth-notifications-wrap hidden><div class="auth-divider"></div><span class="auth-account-label">NUMBER NOTICES</span><div class="auth-notifications" data-auth-notifications></div></div>
        <div class="auth-divider"></div>
        <p class="auth-note">Your basketball stats still come only from confirmed Real Play games. Number priority never changes points, assists, rebounds, wins, losses, or MVP results.</p>
        <div class="auth-divider"></div>
        <button class="auth-logout" type="button" data-auth-logout>LOG OUT</button>
      </div>
      <p class="auth-status" data-auth-status aria-live="polite"></p>
    </section>`;

  document.body.appendChild(overlay);
})();
