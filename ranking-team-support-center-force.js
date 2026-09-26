(() => {
  if (window.__realPlayTeamSupportCenterForceInstalled) return;
  window.__realPlayTeamSupportCenterForceInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const VOLUNTEER_ROLE_TITLES = {
    game_operations: 'GAME OPERATIONS',
    media_crew: 'MEDIA CREW',
    extra_camera: 'EXTRA CAMERA ANGLE',
    session_support: 'SESSION SUPPORT',
  };

  function closeSupportOverlay(overlay) {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => overlay.remove(), 180);
  }

  function getSupportOverlay(root = document) {
    if (root?.matches?.('[data-rp-team-support-overlay]')) return root;
    const ancestor = root?.closest?.('[data-rp-team-support-overlay]');
    if (ancestor) return ancestor;
    return root?.querySelector?.('[data-rp-team-support-overlay]') || null;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function ensureVolunteerFlowStyle() {
    if (document.getElementById('rp-volunteer-followup-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-volunteer-followup-style';
    style.textContent = `
      .rp-volunteer-followup-card{margin:12px 0 14px;padding:14px;border:1px solid rgba(76,214,255,.2);border-radius:13px;background:rgba(4,20,29,.72);text-align:center}
      [data-rp-volunteer-flow-view="choice"] [data-rp-team-support-panel]{text-align:center}
      [data-rp-volunteer-flow-view="choice"] .rp-team-sheet-head{position:relative;justify-content:center;text-align:center}
      [data-rp-volunteer-flow-view="choice"] .rp-team-sheet-head>div{width:100%;text-align:center}
      [data-rp-volunteer-flow-view="choice"] .rp-team-sheet-head h3{text-align:center}
      [data-rp-volunteer-flow-view="choice"] .rp-team-sheet-close{position:absolute;right:0;top:50%;transform:translateY(-50%)}
      [data-rp-volunteer-flow-view="choice"] .rp-team-support-actions button{text-align:center}
      .rp-volunteer-followup-check{display:flex;align-items:center;justify-content:center;width:42px;height:42px;margin:0 auto 10px;border-radius:999px;background:rgba(66,216,255,.12);color:#62e2ff;font-size:1.2rem;font-weight:950}
      .rp-volunteer-followup-card strong{display:block;color:#f7fbff;font-size:.82rem;letter-spacing:.02em}
      .rp-volunteer-followup-card p{margin:6px 0 0;color:#8aa1af;font-size:.64rem;line-height:1.5}
      .rp-volunteer-roster-list{display:grid;gap:8px;margin:12px 0}
      .rp-volunteer-roster-person{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border:1px solid rgba(76,214,255,.16);border-radius:12px;background:rgba(4,20,29,.72)}
      .rp-volunteer-roster-person strong{display:block;color:#f7fbff;font-size:.75rem;line-height:1.3}
      .rp-volunteer-roster-person small{display:block;margin-top:3px;color:#7893a2;font-size:.54rem;font-weight:900;letter-spacing:.08em}
      .rp-volunteer-roster-badge{flex:0 0 auto;padding:5px 7px;border-radius:999px;background:rgba(66,216,255,.1);color:#62e2ff;font-size:.49rem;font-weight:950;letter-spacing:.08em}
      .rp-volunteer-roster-empty{margin:14px 0;padding:16px 12px;border:1px dashed rgba(76,214,255,.17);border-radius:12px;color:#8199a7;text-align:center;font-size:.63rem;line-height:1.45}
      .rp-volunteer-roster-note{margin:0 0 12px;color:#8299a7;font-size:.63rem;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function volunteerChoiceMarkup(roleKey) {
    const roleTitle = VOLUNTEER_ROLE_TITLES[roleKey] || 'REAL PLAY VOLUNTEER';
    return `
      <div class="rp-team-sheet-grab" aria-hidden="true"></div>
      <div class="rp-team-sheet-head">
        <div><h3 id="rp-team-support-title">INTEREST RECORDED</h3></div>
        <button class="rp-team-sheet-close" type="button" aria-label="Close" data-rp-volunteer-flow-close>×</button>
      </div>
      <div class="rp-volunteer-followup-card">
        <span class="rp-volunteer-followup-check" aria-hidden="true">✓</span>
        <strong>${escapeHtml(roleTitle)}</strong>
      </div>
      <div class="rp-team-support-actions">
        <button class="rp-team-sheet-submit" type="button" data-rp-volunteer-roster-status="active">SHOW MY TEAM NOW</button>
        <button class="rp-team-support-secondary" type="button" data-rp-volunteer-roster-status="interested">SEE INTERESTED WORKERS</button>
      </div>
    `;
  }

  function renderVolunteerChoice(overlay, roleKey) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;
    const selectedRole = VOLUNTEER_ROLE_TITLES[roleKey] ? roleKey : 'game_operations';
    ensureVolunteerFlowStyle();
    overlay.dataset.rpVolunteerFlowRole = selectedRole;
    overlay.dataset.rpVolunteerFlowView = 'choice';
    panel.innerHTML = volunteerChoiceMarkup(selectedRole);
  }

  function rosterShell(roleKey, status) {
    const isActive = status === 'active';
    const title = isActive ? 'MY TEAM' : 'INTERESTED WORKERS';
    const intro = isActive
      ? 'People currently approved or active in this Real Play role.'
      : 'People who have recorded interest in helping with this Real Play role.';
    return `
      <div class="rp-team-sheet-grab" aria-hidden="true"></div>
      <div class="rp-team-sheet-head">
        <div><small>${escapeHtml(VOLUNTEER_ROLE_TITLES[roleKey] || 'TEAM & VOLUNTEERS')}</small><h3 id="rp-team-support-title">${title}</h3></div>
        <button class="rp-team-sheet-close" type="button" aria-label="Back" data-rp-volunteer-flow-back>←</button>
      </div>
      <p class="rp-volunteer-roster-note">${intro}</p>
      <div class="rp-volunteer-roster-list" data-rp-volunteer-roster-list>
        <div class="rp-volunteer-roster-empty">Loading people…</div>
      </div>
    `;
  }

  async function renderVolunteerRoster(overlay, status) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;
    const roleKey = VOLUNTEER_ROLE_TITLES[overlay.dataset.rpVolunteerFlowRole]
      ? overlay.dataset.rpVolunteerFlowRole
      : 'game_operations';
    const wantedStatus = status === 'active' ? 'active' : 'interested';
    ensureVolunteerFlowStyle();
    overlay.dataset.rpVolunteerFlowView = wantedStatus;
    panel.innerHTML = rosterShell(roleKey, wantedStatus);

    const list = panel.querySelector('[data-rp-volunteer-roster-list]');
    const auth = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!auth) {
      if (list) list.innerHTML = '<div class="rp-volunteer-roster-empty">Log in to your Real Play account to see this list.</div>';
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/real-play/volunteer/roster?role=${encodeURIComponent(roleKey)}`, {
        headers: { Authorization: `Bearer ${auth}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Roster unavailable.');
      const data = await response.json();
      const rows = (Array.isArray(data?.volunteers) ? data.volunteers : [])
        .filter((row) => String(row?.status || '').toLowerCase() === wantedStatus);

      if (!list || overlay.dataset.rpVolunteerFlowView !== wantedStatus) return;
      if (!rows.length) {
        list.innerHTML = `<div class="rp-volunteer-roster-empty">${wantedStatus === 'active' ? 'No active team members are listed for this role yet.' : 'No other interested workers are listed for this role yet.'}</div>`;
        return;
      }

      list.innerHTML = rows.map((row) => `
        <div class="rp-volunteer-roster-person">
          <div><strong>${escapeHtml(row?.player_name || 'REAL PLAY PLAYER')}</strong><small>${escapeHtml(VOLUNTEER_ROLE_TITLES[roleKey])}</small></div>
          <span class="rp-volunteer-roster-badge">${wantedStatus === 'active' ? 'ACTIVE' : 'INTERESTED'}</span>
        </div>
      `).join('');
    } catch (_error) {
      if (list && overlay.dataset.rpVolunteerFlowView === wantedStatus) {
        list.innerHTML = '<div class="rp-volunteer-roster-empty">Could not load this list right now. Please try again.</div>';
      }
    }
  }

  function syncVolunteerInterestFlow(overlay) {
    if (!overlay || overlay.dataset.rpVolunteerFlowView) return;
    const panel = overlay.querySelector('[data-rp-team-support-panel]');
    if (!panel) return;
    const status = panel.querySelector('[data-rp-team-support-interest-status]');
    const interestButton = panel.querySelector('[data-rp-team-support-interest]');
    const statusText = String(status?.textContent || '').trim().toLowerCase();
    if (!interestButton || !statusText.includes('interested list')) return;
    renderVolunteerChoice(overlay, interestButton.dataset.rpTeamSupportInterest || 'game_operations');
  }

  function syncMainChoice(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    const actions = panel.querySelector('.rp-team-support-actions');
    const helpButton = actions?.querySelector('[data-rp-team-support-screen="help"]');
    const isMainChoice = Boolean(actions && helpButton);

    overlay.dataset.rpTeamSupportMainChoice = isMainChoice ? 'true' : 'false';
    if (!isMainChoice) return;

    const title = panel.querySelector('#rp-team-support-title');
    if (title && title.textContent !== 'WOULD YOU LIKE TO HELP US?') {
      title.textContent = 'WOULD YOU LIKE TO HELP US?';
    }

    panel.querySelectorAll('.rp-team-support-copy, .rp-team-support-footnote, .rp-team-support-tertiary')
      .forEach((node) => node.remove());
    panel.querySelector('.rp-team-sheet-close')?.remove();

    if (helpButton.textContent !== 'SEE HOW I CAN HELP') {
      helpButton.textContent = 'SEE HOW I CAN HELP';
    }

    const playingButton = actions.querySelector('[data-rp-team-support-screen="playing"]');
    if (playingButton && playingButton.textContent !== "I'LL SUPPORT BY PLAYING") {
      playingButton.textContent = "I'LL SUPPORT BY PLAYING";
    }
  }

  function syncHelpChoice(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    const paths = panel.querySelector('.rp-team-support-paths');
    const volunteer = paths?.querySelector('[data-rp-team-support-screen="volunteer"]');
    const money = paths?.querySelector('[data-rp-team-support-screen="money"]');
    const isHelpChoice = Boolean(paths && volunteer && money);

    overlay.dataset.rpTeamSupportHelpChoice = isHelpChoice ? 'true' : 'false';
    if (!isHelpChoice) return;

    const title = panel.querySelector('#rp-team-support-title');
    if (title && title.textContent !== 'HOW WOULD YOU LIKE TO HELP?') {
      title.textContent = 'HOW WOULD YOU LIKE TO HELP?';
    }

    panel.querySelector('.rp-team-sheet-head small')?.remove();
    panel.querySelector('.rp-team-sheet-close:not(.rp-team-support-header-back)')?.remove();
    panel.querySelector('.rp-team-support-back')?.remove();
    panel.querySelectorAll('.rp-team-support-copy, .rp-team-support-tertiary')
      .forEach((node) => node.remove());
    paths.querySelectorAll('p').forEach((node) => node.remove());
  }

  function syncTierBenefitCopy(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    panel.querySelectorAll('.rp-team-support-benefit').forEach((benefit) => {
      const title = benefit.querySelector('strong');
      const description = benefit.querySelector('p');
      const currentTitle = String(title?.textContent || '').trim();
      if (!title || !['Earlier Booking Access', 'Play Token Protection', '4 Play Tokens'].includes(currentTitle)) return;

      const wantedTitle = '4 Play Tokens';
      const wantedDescription = 'Get 4 Play Tokens each month to secure protected session reservations.';

      if (currentTitle !== wantedTitle) title.textContent = wantedTitle;
      if (description && String(description.textContent || '').trim() !== wantedDescription) {
        description.textContent = wantedDescription;
      }
    });
  }

  function syncDigitalPaymentChrome(overlay) {
    const panel = overlay?.querySelector?.('[data-rp-team-support-panel]');
    if (!panel) return;

    panel.querySelectorAll(
      '[data-rp-support-payment-pane="gcash"], [data-rp-support-payment-pane="maya"]'
    ).forEach((pane) => {
      const heading = pane.querySelector(':scope > strong');
      const copy = pane.querySelector(':scope > p');
      const headingText = String(heading?.textContent || '').trim();

      // Keep the unavailable-state message because it is actionable.
      // When payment details are available, the QR/account details already make
      // the selected method obvious, so the extra heading and instruction copy
      // are intentionally removed.
      if (!headingText.includes('DETAILS UNAVAILABLE')) {
        heading?.remove();
        copy?.remove();
      }
    });
  }

  function normalizeOverlay(root = document) {
    const overlay = getSupportOverlay(root);
    if (!overlay) return;

    if (overlay.classList.contains('rp-team-sheet-overlay')) {
      overlay.classList.remove('rp-team-sheet-overlay');
    }
    if (!overlay.classList.contains('rp-team-support-overlay')) {
      overlay.classList.add('rp-team-support-overlay');
    }

    const panel = overlay.querySelector('[data-rp-team-support-panel]');
    if (panel) {
      if (panel.classList.contains('rp-team-sheet')) panel.classList.remove('rp-team-sheet');
      if (!panel.classList.contains('rp-team-support-card')) panel.classList.add('rp-team-support-card');
    }

    syncMainChoice(overlay);
    syncHelpChoice(overlay);
    syncTierBenefitCopy(overlay);
    syncDigitalPaymentChrome(overlay);
    syncVolunteerInterestFlow(overlay);
  }

  const observer = new MutationObserver((mutations) => {
    const overlays = new Set();

    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        const owner = mutation.target.closest('[data-rp-team-support-overlay]');
        if (owner) overlays.add(owner);
      }

      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[data-rp-team-support-overlay]')) overlays.add(node);
        const nested = node.querySelector?.('[data-rp-team-support-overlay]');
        if (nested) overlays.add(nested);
      }
    }

    overlays.forEach((overlay) => normalizeOverlay(overlay));
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const overlay = event.target?.closest?.('[data-rp-team-support-overlay]');
    if (!overlay) return;

    const close = event.target.closest?.('[data-rp-volunteer-flow-close]');
    if (close) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSupportOverlay(overlay);
      return;
    }

    const back = event.target.closest?.('[data-rp-volunteer-flow-back]');
    if (back) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderVolunteerChoice(overlay, overlay.dataset.rpVolunteerFlowRole || 'game_operations');
      return;
    }

    const roster = event.target.closest?.('[data-rp-volunteer-roster-status]');
    if (roster) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderVolunteerRoster(overlay, roster.dataset.rpVolunteerRosterStatus);
    }
  }, true);

  document.addEventListener('click', (event) => {
    const overlay = document.querySelector('[data-rp-team-support-overlay]');
    if (!overlay || overlay.dataset.rpTeamSupportMainChoice !== 'true') return;
    if (event.target !== overlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const overlay = document.querySelector('[data-rp-team-support-overlay]');
    if (!overlay || overlay.dataset.rpTeamSupportMainChoice !== 'true') return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  normalizeOverlay(document);
})();