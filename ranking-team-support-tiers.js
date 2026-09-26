(() => {
  if (window.__realPlayTeamSupportTiersInstalled) return;
  window.__realPlayTeamSupportTiersInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const SUPPORT_TIER_ENDPOINT = `${API_BASE_URL}/api/real-play/support/tier`;
  const PAYMENT_CONFIG_ENDPOINT = `${API_BASE_URL}/api/real-play/support/payment-config`;
  const PROMPT_DELAY_MS = 260;
  let baselineReady = false;
  let hadTeam = false;
  let promptTimer = 0;
  let paymentConfig = null;
  let lastPaymentResult = null;

  function ensureStyle() {
    if (document.getElementById('rp-team-support-tier-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-team-support-tier-style';
    style.textContent = `
      .rp-team-support-sheet{max-width:480px}
      .rp-team-support-copy{margin:0 0 12px;color:#a9bdc9;font-size:.76rem;line-height:1.5}
      .rp-team-support-copy strong{color:#f7fbff}
      .rp-team-support-footnote{margin:11px 0 0;color:#78909d;font-size:.61rem;line-height:1.45;text-align:center}
      .rp-team-support-footnote strong{color:#cfefff}
      .rp-team-support-actions{display:grid;gap:8px;margin-top:14px}
      .rp-team-support-secondary,.rp-team-support-tertiary,.rp-team-support-path,.rp-team-support-role{
        width:100%;border:1px solid rgba(76,214,255,.18);border-radius:12px;background:rgba(4,20,29,.72);color:#f7fbff;text-align:left;cursor:pointer
      }
      .rp-team-support-secondary{padding:12px 13px;font-size:.7rem;font-weight:900;letter-spacing:.05em}
      .rp-team-support-secondary span{display:block;margin-top:4px;color:#8199a7;font-size:.58rem;font-weight:700;letter-spacing:0;line-height:1.35}
      .rp-team-support-tertiary{padding:10px 12px;border-color:transparent;background:transparent;color:#7d96a4;text-align:center;font-size:.61rem;font-weight:900;letter-spacing:.05em}
      .rp-team-support-paths{display:grid;gap:9px;margin:13px 0}
      .rp-team-support-path{padding:14px}
      .rp-team-support-path small{display:block;color:#53dcff;font-size:.55rem;font-weight:950;letter-spacing:.13em}
      .rp-team-support-path strong{display:block;margin:4px 0 5px;font-size:.95rem;letter-spacing:.02em}
      .rp-team-support-path p{margin:0;color:#8299a7;font-size:.64rem;line-height:1.4}
      .rp-team-support-path.money{border-color:rgba(255,211,91,.28);background:rgba(34,27,7,.32)}
      .rp-team-support-path.money small{color:#ffd35b}
      .rp-team-support-roles{display:grid;gap:8px;margin:12px 0}
      .rp-team-support-role{padding:11px 12px;cursor:pointer}
      .rp-team-support-role span{display:block;color:#53dcff;font-size:.55rem;font-weight:950;letter-spacing:.11em}
      .rp-team-support-role strong{display:block;margin:3px 0;color:#f7fbff;font-size:.82rem}
      .rp-team-support-role p{margin:0;color:#8299a7;font-size:.62rem;line-height:1.4}
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
      .rp-team-support-impact{display:grid;gap:7px;margin:12px 0}
      .rp-team-support-impact div{padding:9px 10px;border-left:2px solid rgba(76,214,255,.55);background:rgba(66,216,255,.045)}
      .rp-team-support-impact strong{display:block;color:#eefbff;font-size:.66rem;letter-spacing:.04em}
      .rp-team-support-impact span{display:block;margin-top:2px;color:#8299a7;font-size:.61rem;line-height:1.38}
      .rp-team-support-back{display:inline-flex;align-items:center;gap:5px;margin:0 0 10px;padding:0;border:0;background:transparent;color:#74dfff;font-size:.58rem;font-weight:950;letter-spacing:.08em;cursor:pointer}
      .rp-team-support-money-intro{margin:0 0 12px;color:#91a9b7;font-size:.67rem;line-height:1.45}
      .rp-team-support-benefits{display:grid;gap:8px;margin:10px 0 12px}
      .rp-team-support-benefit{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start;padding:11px 12px;border:1px solid rgba(76,214,255,.14);border-radius:12px;background:rgba(4,20,29,.68)}
      .rp-team-support-benefit-icon{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:rgba(66,216,255,.10);color:#62e2ff;font-size:.68rem;font-weight:950;line-height:1}
      .rp-team-support-benefit strong{display:block;margin:0;color:#f7fbff;font-size:.72rem;letter-spacing:.01em}
      .rp-team-support-benefit p{margin:3px 0 0;color:#8199a7;font-size:.61rem;line-height:1.4}
      .rp-team-support-payment-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 13px;padding:12px 13px;border:1px solid rgba(76,214,255,.2);border-radius:13px;background:rgba(4,20,29,.76)}
      .rp-team-support-payment-summary span{display:block;color:#7e98a7;font-size:.55rem;font-weight:900;letter-spacing:.1em}
      .rp-team-support-payment-summary strong{display:block;margin-top:3px;color:#f7fbff;font-size:.86rem}
      .rp-team-support-payment-summary b{color:#62e2ff;font-size:1rem;white-space:nowrap}
      .rp-team-support-payment-label{display:block;margin:11px 0 6px;color:#7f98a8;font-size:.55rem;font-weight:950;letter-spacing:.1em}
      .rp-team-support-methods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:11px}
      .rp-team-support-method{min-height:43px;padding:8px 5px;border:1px solid rgba(76,214,255,.17);border-radius:11px;background:rgba(4,20,29,.72);color:#91a8b5;font-size:.6rem;font-weight:950;letter-spacing:.04em;cursor:pointer}
      .rp-team-support-method.is-selected{border-color:#42d8ff;background:rgba(25,167,205,.16);color:#ecfbff;box-shadow:inset 0 0 0 1px rgba(66,216,255,.1)}
      .rp-team-support-field{display:grid;gap:5px;margin:9px 0}
      .rp-team-support-field span{color:#7f98a8;font-size:.54rem;font-weight:950;letter-spacing:.09em}
      .rp-team-support-field input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid rgba(76,214,255,.18);border-radius:11px;outline:0;background:#061521;color:#f7fbff;font:inherit;font-size:.7rem}
      .rp-team-support-field input:focus{border-color:#42d8ff;box-shadow:0 0 0 2px rgba(66,216,255,.09)}
      .rp-team-support-payment-pane{margin:11px 0;padding:12px;border:1px solid rgba(76,214,255,.14);border-radius:12px;background:rgba(4,20,29,.62)}
      .rp-team-support-payment-pane[hidden]{display:none!important}
      .rp-team-support-payment-pane>strong{display:block;color:#eefbff;font-size:.7rem}
      .rp-team-support-payment-pane>p{margin:4px 0 0;color:#8299a7;font-size:.61rem;line-height:1.45}
      .rp-team-support-recipient{display:grid;gap:7px;margin:10px 0}
      .rp-team-support-recipient div{padding:8px 9px;border-radius:9px;background:rgba(66,216,255,.055)}
      .rp-team-support-recipient span{display:block;color:#7893a2;font-size:.5rem;font-weight:950;letter-spacing:.08em}
      .rp-team-support-recipient b{display:block;margin-top:2px;color:#f7fbff;font-size:.72rem;word-break:break-word}
      .rp-team-support-qr{display:block;width:min(190px,72%);height:auto;margin:10px auto;border-radius:12px;background:#fff;padding:7px}
      .rp-team-support-upload{display:block;margin-top:10px;padding:10px;border:1px dashed rgba(76,214,255,.28);border-radius:10px;cursor:pointer;text-align:center}
      .rp-team-support-upload input{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}
      .rp-team-support-upload strong{display:block;color:#60ddff;font-size:.61rem;letter-spacing:.05em}
      .rp-team-support-upload small{display:block;margin-top:3px;color:#78909d;font-size:.55rem}
      .rp-team-support-payment-status{min-height:18px;margin:8px 0 0;color:#8ea6b4;font-size:.59rem;line-height:1.4;text-align:center}
      .rp-team-support-payment-status.is-error{color:#ff8c9a}
      .rp-team-support-login-card,.rp-team-support-success-card{padding:14px;border:1px solid rgba(76,214,255,.18);border-radius:13px;background:rgba(4,20,29,.7);text-align:center}
      .rp-team-support-login-card strong,.rp-team-support-success-card strong{display:block;color:#f7fbff;font-size:.84rem}
      .rp-team-support-login-card p,.rp-team-support-success-card p{margin:7px 0 0;color:#8aa1af;font-size:.64rem;line-height:1.5}
      .rp-team-support-success-check{display:flex;align-items:center;justify-content:center;width:42px;height:42px;margin:0 auto 10px;border-radius:999px;background:rgba(66,216,255,.12);color:#62e2ff;font-size:1.2rem;font-weight:950}
      @media (min-width:560px){
        .rp-team-support-grid{grid-template-columns:1fr 1fr}
        .rp-team-support-tier{grid-template-columns:1fr}
        .rp-team-support-tier b{text-align:left}
        .rp-team-support-tier p{grid-column:auto}
        .rp-team-support-paths{grid-template-columns:1fr 1fr}
      }
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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function token() {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  }

  function currentAccountEmail() {
    return String(
      document.querySelector('.rp-settings-overlay [data-rp-settings-email]')?.textContent ||
      document.querySelector('[data-auth-account-email]')?.textContent ||
      document.querySelector('.auth-account-email')?.textContent ||
      ''
    ).trim().toLowerCase();
  }

  function shell(kicker, title, body) {
    return `
      <div class="rp-team-sheet-grab" aria-hidden="true"></div>
      <div class="rp-team-sheet-head">
        <div><small>${kicker}</small><h3 id="rp-team-support-title">${title}</h3></div>
        <button class="rp-team-sheet-close" type="button" aria-label="Close support options" data-rp-team-support-close>×</button>
      </div>
      ${body}
    `;
  }

  function mainScreen() {
    return shell('REAL PLAY COMMUNITY', 'YOUR TEAM IS SET.', `
      <p class="rp-team-support-copy"><strong>Before you go:</strong> is Real Play helping you stay physically active, enjoy real competition, and build friendships through a healthy basketball community?</p>
      <p class="rp-team-support-copy">If yes, there are different ways you can help keep Real Play going. <strong>Money is only one of them.</strong></p>
      <div class="rp-team-support-actions">
        <button class="rp-team-sheet-submit" type="button" data-rp-team-support-screen="help">SEE HOW I CAN HELP</button>
        <button class="rp-team-support-secondary" type="button" data-rp-team-support-screen="playing">FOR NOW, I'LL SUPPORT BY PLAYING<span>Showing up, competing well, and being part of the community already matters.</span></button>
        <button class="rp-team-support-tertiary" type="button" data-rp-team-support-close>NOT NOW — TAKE ME TO MY TEAM</button>
      </div>
      <p class="rp-team-support-footnote"><strong>Your team and session spot are already secured.</strong> Helping Real Play is completely optional.</p>
    `);
  }

  function helpScreen() {
    return shell('HELP REAL PLAY CONTINUE', 'HOW WOULD YOU LIKE TO HELP?', `
      <button class="rp-team-sheet-close rp-team-support-header-back" type="button" aria-label="Back" data-rp-team-support-screen="main">←</button>
      <p class="rp-team-support-copy">Every player can contribute differently. Choose the kind of support that fits you right now.</p>
      <div class="rp-team-support-paths">
        <button class="rp-team-support-path" type="button" data-rp-team-support-screen="volunteer">
          <small>NON-MONETARY SUPPORT</small>
          <strong>GIVE TIME / RESOURCES</strong>
          <p>Volunteer during games, help with operations, record footage, or lend equipment temporarily.</p>
        </button>
        <button class="rp-team-support-path money" type="button" data-rp-team-support-screen="money">
          <small>MONETARY SUPPORT</small>
          <strong>HELP FUND REAL PLAY</strong>
          <p>Help support courts, equipment, media, operations, and future sessions.</p>
        </button>
      </div>
      <button class="rp-team-support-tertiary" type="button" data-rp-team-support-close>TAKE ME TO MY TEAM</button>
    `);
  }

  const VOLUNTEER_ROLES = {
    game_operations: {
      kicker: 'GAME OPERATIONS',
      title: 'VOLUNTEER AS A GAME AUDITOR / SCORER',
      copy: 'Help verify what happens on the court and support accurate game records.',
    },
    media_crew: {
      kicker: 'MEDIA CREW',
      title: 'VOLUNTEER AS A CAMERAMAN',
      copy: 'Help capture games, highlights, and moments players can look back on.',
    },
    extra_camera: {
      kicker: 'EXTRA CAMERA ANGLE',
      title: 'LEND YOUR PHONE AS A GAME CAMERA',
      copy: 'Your phone stays yours. Real Play only borrows it during the game so we can record from more than one angle.',
    },
    session_support: {
      kicker: 'SESSION SUPPORT',
      title: 'HELP WITH SETUP AND GAME OPERATIONS',
      copy: 'Assist with organizing players, preparing the court flow, and keeping the session moving.',
    },
  };

  function volunteerScreen() {
    return shell('', 'HELP WITHOUT SPENDING', `
      <div class="rp-team-support-roles" aria-label="Ways to help without spending">
        <button class="rp-team-support-role" type="button" data-rp-team-support-volunteer-role="game_operations"><strong>GAME OPERATIONS</strong></button>
        <button class="rp-team-support-role" type="button" data-rp-team-support-volunteer-role="media_crew"><strong>MEDIA CREW</strong></button>
        <button class="rp-team-support-role" type="button" data-rp-team-support-volunteer-role="extra_camera"><strong>EXTRA CAMERA ANGLE</strong></button>
        <button class="rp-team-support-role" type="button" data-rp-team-support-volunteer-role="session_support"><strong>SESSION SUPPORT</strong></button>
      </div>
    `);
  }

  function volunteerDetailScreen(roleKey) {
    const role = VOLUNTEER_ROLES[roleKey] || VOLUNTEER_ROLES.game_operations;
    const descriptions = {
      game_operations: 'Help operate official games by recording scores and player stats, verifying game events, correcting mistakes when needed, and making sure the final game record is accurate.',
      media_crew: 'Help record games and capture clear footage of plays, highlights, and player moments that Real Play can use for game content and player profiles.',
      extra_camera: 'Lend your phone during games so Real Play can record an additional camera angle. Your phone stays yours and is only used temporarily during the game.',
      session_support: 'Help keep the session organized by assisting with player flow, game preparation, court setup, rotations, and other simple tasks that keep games moving smoothly.',
    };
    return shell('', role.title, `
      <div class="rp-team-support-role-description">
        <strong>JOB DESCRIPTION:</strong>
        <p>${descriptions[roleKey] || role.copy}</p>
      </div>
      <button class="rp-team-sheet-submit" type="button" data-rp-team-support-interest="${roleKey}">I'M INTERESTED</button>
      <p class="rp-team-support-interest-status" data-rp-team-support-interest-status aria-live="polite"></p>
    `);
  }

  const MONEY_TIERS = {
    supporter: {
      backendCode: 'supporter',
      name: 'SUPPORTER',
      price: '₱99',
      amount: 99,
      intro: 'A simple way to support Real Play and unlock your first identity perks.',
      cta: 'SUPPORT REAL PLAY',
      benefits: [
        ['Supporter Badge', 'Show that you help keep Real Play moving.'],
        ['Basic Profile Customization', 'Unlock simple profile personalization.'],
        ['Supporter Recognition', 'Recognized as an active Real Play supporter.'],
      ],
    },
    builder: {
      backendCode: 'builder',
      name: 'BUILDER',
      price: '₱199',
      amount: 199,
      intro: 'For players who want stronger identity perks and added convenience.',
      cta: 'BECOME A BUILDER',
      benefits: [
        ['Everything in Supporter', 'Includes all Supporter benefits.'],
        ['Builder Badge', 'A higher supporter status on your profile.'],
        ['Enhanced Profile Customization', 'Unlock more ways to personalize your identity.'],
        ['4 Play Tokens', 'Get 4 Play Tokens each month to secure protected session reservations.'],
      ],
    },
    founding_supporter: {
      backendCode: 'founding',
      name: 'FOUNDING SUPPORTER',
      price: '₱499',
      amount: 499,
      intro: 'Premium early-supporter status with stronger Real Play identity benefits.',
      cta: 'BECOME A FOUNDING SUPPORTER',
      benefits: [
        ['Everything in Builder', 'Includes all Builder benefits.'],
        ['Founding Supporter Badge', 'Stand out as an early Real Play supporter.'],
        ['Premium Profile Customization', 'Unlock the highest player-profile presentation level.'],
        ['Higher Jersey Number Priority', 'Stronger priority during monthly number conflicts.'],
      ],
    },
    sponsor: {
      backendCode: 'sponsor',
      name: 'SPONSOR',
      price: '₱999',
      amount: 999,
      intro: 'For supporters or brands who want official visibility inside Real Play.',
      cta: 'BECOME A SPONSOR',
      benefits: [
        ['Everything in Founding Supporter', 'Includes all Founding Supporter benefits.'],
        ['Sponsor Status', 'Recognized as an official Real Play supporter.'],
        ['Sponsor Visibility', 'Display your name, brand, or approved logo inside Real Play.'],
        ['Featured Sponsor Recognition', 'Enhanced visibility in designated sponsor spaces.'],
      ],
    },
  };

  function moneyScreen() {
    return shell('', 'HELP FUND REAL PLAY', `
      <div class="rp-team-support-roles" aria-label="Real Play monthly support levels">
        <button class="rp-team-support-role" type="button" data-rp-team-support-money-tier="supporter"><strong>₱99 / MONTH — SUPPORTER</strong></button>
        <button class="rp-team-support-role" type="button" data-rp-team-support-money-tier="builder"><strong>₱199 / MONTH — BUILDER</strong></button>
        <button class="rp-team-support-role" type="button" data-rp-team-support-money-tier="founding_supporter"><strong>₱499 / MONTH — FOUNDING SUPPORTER</strong></button>
        <button class="rp-team-support-role" type="button" data-rp-team-support-money-tier="sponsor"><strong>₱999 / MONTH — SPONSOR</strong></button>
      </div>
    `);
  }

  function moneyDetailScreen(tierKey) {
    const tier = MONEY_TIERS[tierKey] || MONEY_TIERS.supporter;
    const benefits = tier.benefits.map(([title, description]) => `
      <div class="rp-team-support-benefit">
        <span class="rp-team-support-benefit-icon" aria-hidden="true">✓</span>
        <div>
          <strong>${title}</strong>
          <p>${description}</p>
        </div>
      </div>
    `).join('');

    return shell('', tier.name, `
      <div class="rp-team-support-role-description">
        <strong>${tier.price} / MONTH</strong>
        <p><strong>WHAT YOU GET</strong></p>
      </div>
      <p class="rp-team-support-money-intro">${tier.intro}</p>
      <div class="rp-team-support-benefits">${benefits}</div>
      <button class="rp-team-sheet-submit" type="button" data-rp-team-support-start-payment="${tierKey}">${tier.cta} — ${tier.price}/MONTH</button>
    `);
  }

  function emptyPaymentConfig() {
    return {
      gcash: { enabled: true, account_name: '', number: '', qr_image: '' },
      maya: { enabled: true, account_name: '', number: '', qr_image: '' },
      cash_on_hand: { enabled: true },
    };
  }

  async function loadPaymentConfig() {
    if (paymentConfig) return paymentConfig;
    try {
      const response = await fetch(PAYMENT_CONFIG_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('Payment configuration unavailable.');
      const data = await response.json();
      paymentConfig = { ...emptyPaymentConfig(), ...(data || {}) };
    } catch (_error) {
      paymentConfig = emptyPaymentConfig();
    }
    return paymentConfig;
  }

  function digitalPaymentMarkup(method) {
    const config = paymentConfig?.[method] || {};
    const label = method === 'maya' ? 'MAYA' : 'GCASH';
    const qr = config.qr_image
      ? `<img class="rp-team-support-qr" src="${config.qr_image}" alt="Real Play ${label} QR code">`
      : '';
    const recipients = [
      config.account_name ? `<div><span>ACCOUNT NAME</span><b>${escapeHtml(config.account_name)}</b></div>` : '',
      config.number ? `<div><span>${label} NUMBER</span><b>${escapeHtml(config.number)}</b></div>` : '',
    ].filter(Boolean).join('');
    const hasDestination = Boolean(config.qr_image || config.number);

    return `
      <div class="rp-team-support-payment-pane" data-rp-support-payment-pane="${method}" ${method === 'gcash' ? '' : 'hidden'}>
        <strong>${hasDestination ? `PAY WITH ${label}` : `${label} DETAILS UNAVAILABLE`}</strong>
        <p>${hasDestination ? 'Send the exact monthly support amount using the verified details below, then upload your transfer confirmation.' : `Real Play has not published ${label} receiving details yet. Choose another payment method for now.`}</p>
        ${qr}
        ${recipients ? `<div class="rp-team-support-recipient">${recipients}</div>` : ''}
        ${hasDestination ? `
          <label class="rp-team-support-upload">
            <input type="file" accept="image/png,image/jpeg,image/webp" data-rp-support-proof="${method}">
            <strong>UPLOAD PAYMENT PROOF</strong>
            <small data-rp-support-proof-name>PNG, JPG, or WEBP · max 2 MB after processing</small>
          </label>` : ''}
      </div>`;
  }

  function paymentScreen(tierKey) {
    const tier = MONEY_TIERS[tierKey] || MONEY_TIERS.supporter;
    const email = currentAccountEmail();
    const sponsorFields = tierKey === 'sponsor' ? `
      <label class="rp-team-support-field">
        <span>SPONSOR DISPLAY NAME</span>
        <input type="text" maxlength="120" data-rp-support-sponsor-name placeholder="Player, business, or brand name">
      </label>
      <label class="rp-team-support-field">
        <span>WEBSITE / SOCIAL LINK · OPTIONAL</span>
        <input type="url" maxlength="300" data-rp-support-sponsor-url placeholder="https://...">
      </label>` : '';

    return shell('MONTHLY SUPPORT', `COMPLETE ${tier.name}`, `
      <div class="rp-team-support-payment-summary">
        <div><span>SUPPORT LEVEL</span><strong>${tier.name}</strong></div>
        <b>${tier.price}/MO</b>
      </div>
      <span class="rp-team-support-payment-label">PAYMENT METHOD</span>
      <div class="rp-team-support-methods" role="group" aria-label="Choose payment method">
        <button class="rp-team-support-method is-selected" type="button" data-rp-support-method="gcash">GCASH</button>
        <button class="rp-team-support-method" type="button" data-rp-support-method="maya">MAYA</button>
        <button class="rp-team-support-method" type="button" data-rp-support-method="cash_on_hand">CASH</button>
      </div>
      <label class="rp-team-support-field">
        <span>REAL PLAY EMAIL</span>
        <input type="email" data-rp-support-email value="${escapeHtml(email)}" placeholder="you@example.com" autocomplete="email">
      </label>
      ${sponsorFields}
      ${digitalPaymentMarkup('gcash')}
      ${digitalPaymentMarkup('maya')}
      <div class="rp-team-support-payment-pane" data-rp-support-payment-pane="cash_on_hand" hidden>
        <strong>CASH ON HAND</strong>
        <p>No screenshot is needed. Submit the request here, then give the exact amount to an authorized Real Play organizer. Your status activates only after the cash is confirmed received.</p>
      </div>
      <button class="rp-team-sheet-submit" type="button" data-rp-support-submit="${tierKey}">SUBMIT GCASH PROOF — ${tier.price}</button>
      <p class="rp-team-support-payment-status" data-rp-support-payment-status aria-live="polite"></p>
    `);
  }

  function loginRequiredScreen(tierKey) {
    const tier = MONEY_TIERS[tierKey] || MONEY_TIERS.supporter;
    return shell('REAL PLAY ACCOUNT', 'LOG IN TO CONTINUE', `
      <div class="rp-team-support-login-card">
        <strong>${tier.name} · ${tier.price}/MONTH</strong>
        <p>Your support status must be connected to your Real Play account so payment verification can activate the correct benefits.</p>
      </div>
      <button class="rp-team-sheet-submit" type="button" data-rp-support-login>LOG IN TO REAL PLAY</button>
    `);
  }

  function paymentSuccessScreen() {
    const result = lastPaymentResult || {};
    const tier = MONEY_TIERS[result.tierKey] || MONEY_TIERS.supporter;
    const cash = result.method === 'cash_on_hand';
    return shell('SUPPORT RECEIVED', cash ? 'CASH REQUEST RECORDED' : 'PAYMENT SUBMITTED', `
      <div class="rp-team-support-success-card">
        <span class="rp-team-support-success-check">✓</span>
        <strong>${tier.name} · ${tier.price}/MONTH</strong>
        <p>${cash
          ? 'Give the cash to an authorized Real Play organizer. Your support level activates after the cash is confirmed received.'
          : 'Your payment proof is now pending verification. Your support level activates after Real Play confirms the contribution.'}</p>
        ${['builder', 'founding_supporter', 'sponsor'].includes(result.tierKey)
          ? '<p><strong>4 Play Tokens</strong> are issued when this monthly support is verified.</p>'
          : ''}
      </div>
      <button class="rp-team-sheet-submit" type="button" data-rp-team-support-close>DONE</button>
    `);
  }

  function playingScreen() {
    return shell('', 'THANK YOU FOR PLAYING.', `
      <p class="rp-team-support-copy rp-team-support-playing-quote">Every time you choose the court, bring your effort, and play with respect, you give Real Play a reason to exist. You are not just playing — you are helping build this community. Thank you for showing up and making Real Play real.</p>
      <p class="rp-team-support-footnote"><strong>— REAL PLAY BASKETBALL</strong></p>
      <button class="rp-team-sheet-submit" type="button" data-rp-team-support-close>CONTINUE TO MY TEAM</button>
    `);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read that payment image.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to open that payment image.'));
      image.src = src;
    });
  }

  async function prepareProofImage(file) {
    if (!file) throw new Error('Upload your payment proof first.');
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type || '')) {
      throw new Error('Use a PNG, JPG, JPEG, or WEBP payment screenshot.');
    }
    if (file.size <= 1.8 * 1024 * 1024) return readFileAsDataUrl(file);
    if (file.size > 8 * 1024 * 1024) throw new Error('Choose a payment screenshot smaller than 8 MB.');

    const raw = await readFileAsDataUrl(file);
    const image = await loadImage(raw);
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the payment screenshot.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', 0.82);
    const base64 = compressed.split(',')[1] || '';
    const approximateBytes = Math.floor(base64.length * 3 / 4);
    if (!approximateBytes || approximateBytes > 2 * 1024 * 1024) {
      throw new Error('The payment screenshot is still too large. Crop it closer and try again.');
    }
    return compressed;
  }

  function setPaymentMethod(panel, method) {
    if (!['gcash', 'maya', 'cash_on_hand'].includes(method)) return;
    panel.dataset.rpSupportPaymentMethod = method;
    panel.querySelectorAll('[data-rp-support-method]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.rpSupportMethod === method);
    });
    panel.querySelectorAll('[data-rp-support-payment-pane]').forEach((pane) => {
      pane.hidden = pane.dataset.rpSupportPaymentPane !== method;
    });
    const submit = panel.querySelector('[data-rp-support-submit]');
    if (submit) {
      const tier = MONEY_TIERS[submit.dataset.rpSupportSubmit] || MONEY_TIERS.supporter;
      submit.textContent = method === 'cash_on_hand'
        ? `SUBMIT CASH REQUEST — ${tier.price}`
        : `SUBMIT ${method === 'maya' ? 'MAYA' : 'GCASH'} PROOF — ${tier.price}`;
    }
    const status = panel.querySelector('[data-rp-support-payment-status]');
    if (status) {
      status.textContent = '';
      status.classList.remove('is-error');
    }
  }

  async function submitSupportPayment(overlay, panel, button) {
    const tierKey = button.dataset.rpSupportSubmit;
    const tier = MONEY_TIERS[tierKey];
    const method = panel.dataset.rpSupportPaymentMethod || 'gcash';
    const status = panel.querySelector('[data-rp-support-payment-status]');
    const auth = token();

    const fail = (message) => {
      if (status) {
        status.textContent = message;
        status.classList.add('is-error');
      }
    };

    if (!auth) {
      renderScreen(overlay, `login:${tierKey}`);
      return;
    }

    const email = String(panel.querySelector('[data-rp-support-email]')?.value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail('Enter the email connected to your Real Play account.');
      return;
    }

    let sponsorName = '';
    let sponsorUrl = '';
    if (tierKey === 'sponsor') {
      sponsorName = String(panel.querySelector('[data-rp-support-sponsor-name]')?.value || '').trim();
      sponsorUrl = String(panel.querySelector('[data-rp-support-sponsor-url]')?.value || '').trim();
      if (!sponsorName) {
        fail('Add the player, business, or brand name to display as the sponsor.');
        return;
      }
    }

    let proofImageDataUrl = null;
    if (method !== 'cash_on_hand') {
      const config = paymentConfig?.[method] || {};
      if (!config.qr_image && !config.number) {
        fail(`${method === 'maya' ? 'Maya' : 'GCash'} receiving details are not available yet. Choose another payment method.`);
        return;
      }
      const proofInput = panel.querySelector(`[data-rp-support-proof="${method}"]`);
      const file = proofInput?.files?.[0] || null;
      try {
        proofImageDataUrl = await prepareProofImage(file);
      } catch (error) {
        fail(error.message || 'Upload a valid payment proof.');
        return;
      }
    }

    button.disabled = true;
    if (status) {
      status.classList.remove('is-error');
      status.textContent = method === 'cash_on_hand' ? 'Recording cash support request…' : 'Submitting payment proof…';
    }

    try {
      const response = await fetch(SUPPORT_TIER_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({
          tierCode: tier.backendCode,
          paymentMethod: method,
          email,
          proofImageDataUrl,
          ...(tierKey === 'sponsor' ? { sponsorName, sponsorUrl } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Support payment could not be submitted.');

      lastPaymentResult = { tierKey, method, support: data?.support || null };
      window.dispatchEvent(new CustomEvent('realplay:support-tier-submitted', {
        detail: { tierKey, method, support: data?.support || null },
      }));
      renderScreen(overlay, 'payment-success');
    } catch (error) {
      button.disabled = false;
      fail(error.message || 'Support payment could not be submitted.');
    }
  }

  async function startPaymentFlow(overlay, tierKey, button) {
    if (!MONEY_TIERS[tierKey]) return;
    if (!token()) {
      renderScreen(overlay, `login:${tierKey}`);
      return;
    }
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'LOADING PAYMENT OPTIONS…';
    await loadPaymentConfig();
    button.disabled = false;
    button.textContent = originalText;
    renderScreen(overlay, `payment:${tierKey}`);
  }

  function renderScreen(overlay, screenName) {
    const panel = overlay.querySelector('[data-rp-team-support-panel]');
    if (!panel) return;

    const screens = {
      main: mainScreen,
      help: helpScreen,
      volunteer: volunteerScreen,
      money: moneyScreen,
      playing: playingScreen,
      'payment-success': paymentSuccessScreen,
    };

    if (screenName.startsWith('volunteer:')) {
      panel.innerHTML = volunteerDetailScreen(screenName.slice('volunteer:'.length));
    } else if (screenName.startsWith('payment:')) {
      panel.innerHTML = paymentScreen(screenName.slice('payment:'.length));
    } else if (screenName.startsWith('login:')) {
      panel.innerHTML = loginRequiredScreen(screenName.slice('login:'.length));
    } else if (screenName.startsWith('money:')) {
      panel.innerHTML = moneyDetailScreen(screenName.slice('money:'.length));
    } else {
      panel.innerHTML = (screens[screenName] || mainScreen)();
    }

    if (screenName === 'volunteer' || screenName === 'money') {
      const closeButton = panel.querySelector('[data-rp-team-support-close]');
      if (closeButton) {
        closeButton.removeAttribute('data-rp-team-support-close');
        closeButton.setAttribute('aria-label', 'Back');
        closeButton.textContent = '←';
        closeButton.addEventListener('click', () => renderScreen(overlay, 'help'));
      }
    }

    if (screenName.startsWith('volunteer:')) {
      const closeButton = panel.querySelector('[data-rp-team-support-close]');
      if (closeButton) {
        closeButton.removeAttribute('data-rp-team-support-close');
        closeButton.setAttribute('aria-label', 'Back to volunteer roles');
        closeButton.textContent = '←';
        closeButton.addEventListener('click', () => renderScreen(overlay, 'volunteer'));
      }
    }

    if (screenName.startsWith('money:')) {
      const closeButton = panel.querySelector('[data-rp-team-support-close]');
      if (closeButton) {
        closeButton.removeAttribute('data-rp-team-support-close');
        closeButton.setAttribute('aria-label', 'Back to support levels');
        closeButton.textContent = '←';
        closeButton.addEventListener('click', () => renderScreen(overlay, 'money'));
      }
    }

    if (screenName.startsWith('payment:') || screenName.startsWith('login:')) {
      const tierKey = screenName.slice(screenName.indexOf(':') + 1);
      const closeButton = panel.querySelector('[data-rp-team-support-close]');
      if (closeButton) {
        closeButton.removeAttribute('data-rp-team-support-close');
        closeButton.setAttribute('aria-label', 'Back to support level');
        closeButton.textContent = '←';
        closeButton.addEventListener('click', () => renderScreen(overlay, `money:${tierKey}`));
      }
    }

    if (screenName.startsWith('payment:')) {
      panel.dataset.rpSupportPaymentMethod = 'gcash';
    } else {
      delete panel.dataset.rpSupportPaymentMethod;
    }

    panel.querySelectorAll('[data-rp-team-support-close]').forEach((button) => button.addEventListener('click', closePrompt));
    panel.querySelectorAll('[data-rp-team-support-screen]').forEach((button) => button.addEventListener('click', () => {
      renderScreen(overlay, button.dataset.rpTeamSupportScreen || 'main');
    }));
    panel.querySelectorAll('[data-rp-team-support-volunteer-role]').forEach((button) => button.addEventListener('click', () => {
      renderScreen(overlay, `volunteer:${button.dataset.rpTeamSupportVolunteerRole}`);
    }));
    panel.querySelectorAll('[data-rp-team-support-money-tier]').forEach((button) => button.addEventListener('click', () => {
      renderScreen(overlay, `money:${button.dataset.rpTeamSupportMoneyTier}`);
    }));
    panel.querySelectorAll('[data-rp-team-support-start-payment]').forEach((button) => button.addEventListener('click', () => {
      startPaymentFlow(overlay, button.dataset.rpTeamSupportStartPayment, button);
    }));
    panel.querySelectorAll('[data-rp-support-method]').forEach((button) => button.addEventListener('click', () => {
      setPaymentMethod(panel, button.dataset.rpSupportMethod);
    }));
    panel.querySelectorAll('[data-rp-support-proof]').forEach((input) => input.addEventListener('change', () => {
      const name = input.closest('.rp-team-support-upload')?.querySelector('[data-rp-support-proof-name]');
      if (name) name.textContent = input.files?.[0]?.name || 'PNG, JPG, or WEBP · max 2 MB after processing';
    }));
    panel.querySelectorAll('[data-rp-support-submit]').forEach((button) => button.addEventListener('click', () => {
      submitSupportPayment(overlay, panel, button);
    }));
    panel.querySelectorAll('[data-rp-support-login]').forEach((button) => button.addEventListener('click', () => {
      closePrompt();
      window.setTimeout(() => document.querySelector('[data-auth-open]')?.click(), 220);
    }));
    panel.querySelectorAll('[data-rp-team-support-interest]').forEach((button) => button.addEventListener('click', async () => {
      const status = panel.querySelector('[data-rp-team-support-interest-status]');
      const auth = token();
      if (!auth) {
        if (status) status.textContent = 'Log in to your Real Play account first.';
        return;
      }
      button.disabled = true;
      if (status) status.textContent = 'Saving your interest…';
      try {
        const response = await fetch(`${API_BASE_URL}/api/real-play/volunteer/interest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
          body: JSON.stringify({ role: button.dataset.rpTeamSupportInterest }),
        });
        if (!response.ok) throw new Error('Volunteer interest could not be saved.');
        if (status) status.textContent = 'You’re on the interested list.';
        button.textContent = 'INTEREST RECORDED';
      } catch (_error) {
        button.disabled = false;
        if (status) status.textContent = 'Could not save your interest. Please try again.';
      }
    }));

    window.setTimeout(() => {
      const preferred = panel.querySelector('.rp-team-sheet-submit, [data-rp-team-support-screen], [data-rp-team-support-close]');
      preferred?.focus();
    }, 50);
  }

  function openPrompt() {
    if (document.querySelector('[data-rp-team-support-overlay]')) return;
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.className = 'rp-team-sheet-overlay';
    overlay.dataset.rpTeamSupportOverlay = 'true';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<section class="rp-team-sheet rp-team-support-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-team-support-title" data-rp-team-support-panel></section>';

    document.body.appendChild(overlay);
    renderScreen(overlay, 'main');
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closePrompt(); });
    window.requestAnimationFrame(() => {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
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