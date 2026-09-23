(() => {
  if (window.__realPlayTeamSupportTiersInstalled) return;
  window.__realPlayTeamSupportTiersInstalled = true;

  const PROMPT_DELAY_MS = 260;
  let baselineReady = false;
  let hadTeam = false;
  let promptTimer = 0;

  function ensureStyle() {
    if (document.getElementById('rp-team-support-tier-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-team-support-tier-style';
    style.textContent = `
      .rp-team-support-sheet{max-width:470px}
      .rp-team-support-copy{margin:0 0 12px;color:#a9bdc9;font-size:.76rem;line-height:1.5}
      .rp-team-support-copy strong{color:#f7fbff}
      .rp-team-support-grid{display:grid;gap:8px;margin:12px 0}
      .rp-team-support-tier{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;padding:11px 12px;border:1px solid rgba(76,214,255,.18);border-radius:12px;background:rgba(4,20,29,.72)}
      .rp-team-support-tier span{display:block;color:#53dcff;font-size:.58rem;font-weight:900;letter-spacing:.12em}
      .rp-team-support-tier strong{display:block;margin-top:2px;color:#f7fbff;font-size:.9rem;letter-spacing:.02em}
      .rp-team-support-tier b{color:#f7fbff;font-size:1rem;white-space:nowrap}
      .rp-team-support-tier b small{color:#7994a3;font-size:.48rem;font-weight:900;letter-spacing:.08em}
      .rp-team-support-tier p{grid-column:1/-1;margin:0;color:#8299a7;font-size:.62rem;line-height:1.4}
      .rp-team-support-tier.sponsor{border-color:rgba(255,211,91,.32);background:rgba(34,27,7,.38)}
      .rp-team-support-tier.sponsor span{color:#ffd35b}
      .rp-team-support-rule{margin:10px 0 12px;padding:9px 10px;border-left:2px solid #42d8ff;background:rgba(66,216,255,.055);color:#8199a7;font-size:.61rem;line-height:1.45}
      .rp-team-support-rule strong{color:#dff7ff}
      @media (min-width:560px){.rp-team-support-grid{grid-template-columns:1fr 1fr}.rp-team-support-tier{grid-template-columns:1fr}.rp-team-support-tier b{text-align:left}.rp-team-support-tier p{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function closePrompt() {
    const overlay = document.querySelector('[data-rp-team-support-overlay]');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => overlay.remove(), 180);
  }

  function openPrompt() {
    if (document.querySelector('[data-rp-team-support-overlay]')) return;
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.className = 'rp-team-sheet-overlay';
    overlay.dataset.rpTeamSupportOverlay = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <section class="rp-team-sheet rp-team-support-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-team-support-title">
        <div class="rp-team-sheet-grab" aria-hidden="true"></div>
        <div class="rp-team-sheet-head">
          <div><small>OPTIONAL COMMUNITY SUPPORT</small><h3 id="rp-team-support-title">YOUR TEAM IS SET.</h3></div>
          <button class="rp-team-sheet-close" type="button" aria-label="Close support options" data-rp-team-support-close>×</button>
        </div>

        <p class="rp-team-support-copy"><strong>Your team and session spot are already secured.</strong> You do not need to donate to play. If you want to help Real Play grow, these are the support levels we built for the community.</p>

        <div class="rp-team-support-grid" aria-label="Real Play monthly support levels">
          <article class="rp-team-support-tier">
            <div><span>SUPPORTER</span><strong>LEVEL 1</strong></div><b>₱99 <small>/ MONTH</small></b>
            <p>Supporter recognition · Basic profile customization</p>
          </article>
          <article class="rp-team-support-tier">
            <div><span>BUILDER</span><strong>LEVEL 2</strong></div><b>₱199 <small>/ MONTH</small></b>
            <p>More customization · Stronger jersey-number and legitimate booking priority</p>
          </article>
          <article class="rp-team-support-tier">
            <div><span>FOUNDING SUPPORTER</span><strong>LEVEL 3</strong></div><b>₱499 <small>/ MONTH</small></b>
            <p>Full available customization · Highest player-level support priority</p>
          </article>
          <article class="rp-team-support-tier sponsor">
            <div><span>SPONSOR</span><strong>LEVEL 4</strong></div><b>₱999 <small>/ MONTH</small></b>
            <p>Support recognition · Eligible business / brand visibility inside Real Play</p>
          </article>
        </div>

        <p class="rp-team-support-rule"><strong>SUPPORT NEVER BUYS BASKETBALL.</strong> It cannot change OVR, stats, MVP, matchmaking, or remove a spot another player already secured.</p>
        <button class="rp-team-sheet-submit" type="button" data-rp-team-support-close>CONTINUE TO MY TEAM</button>
      </section>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-rp-team-support-close]').forEach((button) => button.addEventListener('click', closePrompt));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closePrompt(); });
    window.requestAnimationFrame(() => {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
      window.setTimeout(() => overlay.querySelector('[data-rp-team-support-close]')?.focus(), 80);
    });
  }

  function queuePrompt() {
    if (promptTimer) window.clearTimeout(promptTimer);
    promptTimer = window.setTimeout(() => {
      promptTimer = 0;
      openPrompt();
    }, PROMPT_DELAY_MS);
  }

  function scanTeamState() {
    const board = document.querySelector('[data-rp-session-teams]');
    if (!board || !board.isConnected || board.hidden || !board.innerHTML.trim()) return;

    const hasTeam = Boolean(board.querySelector('.rp-session-team-card.is-yours'));
    if (!baselineReady) {
      baselineReady = true;
      hadTeam = hasTeam;
      return;
    }

    if (!hadTeam && hasTeam) queuePrompt();
    hadTeam = hasTeam;
  }

  const observer = new MutationObserver(scanTeamState);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });

  window.addEventListener('realplay:ranking-session-changed', () => window.setTimeout(scanTeamState, 80));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePrompt(); });

  scanTeamState();
})();
