(() => {
  if (window.__realPlayCaptainEligibilityInstalled) return;
  window.__realPlayCaptainEligibilityInstalled = true;

  const CAPTAIN_RANK_LIMIT = 4;
  let modal = null;
  let modalTitle = null;
  let modalRank = null;
  let modalPlayer = null;
  let scheduled = false;

  function installStyles() {
    if (document.querySelector('[data-rp-captain-eligibility-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpCaptainEligibilityStyles = '1';
    style.textContent = `
      .rp-world-player-row{position:relative}
      .rp-world-player-row.has-captain-eligibility .rp-world-player-name{padding-right:118px}
      .rp-captain-eligibility-badge{
        position:absolute;right:72px;top:50%;z-index:3;display:inline-flex;align-items:center;justify-content:center;
        min-height:24px;padding:0 9px;border:1px solid rgba(72,216,255,.34);border-radius:999px;
        color:#65ddff;background:linear-gradient(180deg,rgba(15,45,61,.82),rgba(5,17,26,.9));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 0 16px rgba(45,201,244,.08);
        font-family:var(--rp-display,Arial,sans-serif);font-size:.43rem;font-style:italic;font-weight:1000;
        letter-spacing:.055em;line-height:1;white-space:nowrap;text-transform:uppercase;
        transform:translateY(-50%);cursor:pointer;transition:border-color .16s ease,color .16s ease,background .16s ease,box-shadow .16s ease,transform .16s ease;
      }
      .rp-captain-eligibility-badge::before{content:'';width:5px;height:5px;margin-right:5px;border-radius:50%;background:#4bd9ff;box-shadow:0 0 9px rgba(75,217,255,.72)}
      .rp-captain-eligibility-badge:hover{color:#f5fcff;border-color:rgba(89,226,255,.7);background:linear-gradient(180deg,rgba(20,62,82,.92),rgba(6,24,36,.96));box-shadow:0 0 18px rgba(45,201,244,.16)}
      .rp-captain-eligibility-badge:active{transform:translateY(-50%) scale(.96)}

      .rp-captain-eligibility-modal{
        position:fixed;inset:0;z-index:2147483000;display:none;place-items:center;padding:20px;
        background:rgba(0,3,7,.78);backdrop-filter:blur(9px);
      }
      .rp-captain-eligibility-modal.open{display:grid}
      .rp-captain-eligibility-card{
        position:relative;width:min(100%,420px);overflow:hidden;padding:24px 22px 21px;
        border:1px solid rgba(72,216,255,.28);border-radius:22px;color:#eef8ff;
        background:radial-gradient(circle at 75% 0%,rgba(23,138,181,.16),transparent 38%),linear-gradient(180deg,#08121c,#040910 68%);
        box-shadow:0 28px 80px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.04);
      }
      .rp-captain-eligibility-card::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,#47d8ff,transparent)}
      .rp-captain-eligibility-close{position:absolute;top:12px;right:12px;width:34px;height:34px;padding:0;border:1px solid rgba(255,255,255,.1);border-radius:50%;color:#9eb0c2;background:#0b1520;font-size:1rem;font-weight:900;line-height:1;cursor:pointer}
      .rp-captain-eligibility-kicker{margin:0 42px 7px 0;color:#4bd9ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.56rem;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}
      .rp-captain-eligibility-card h2{margin:0;font-family:var(--rp-display,Arial,sans-serif);font-size:1.35rem;font-style:italic;font-weight:1000;letter-spacing:.018em;text-transform:uppercase}
      .rp-captain-eligibility-player{display:flex;align-items:baseline;gap:8px;margin:13px 0 16px;padding:11px 12px;border:1px solid rgba(72,216,255,.12);border-radius:13px;background:rgba(4,12,19,.82)}
      .rp-captain-eligibility-player strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--rp-display,Arial,sans-serif);font-size:.86rem;font-style:italic;font-weight:1000;text-transform:uppercase}
      .rp-captain-eligibility-player b{margin-left:auto;flex:none;color:#4bd9ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.84rem;font-style:italic;font-weight:1000}
      .rp-captain-eligibility-card p{margin:0 0 11px;color:#a9bac9;font-size:.72rem;font-weight:650;line-height:1.62}
      .rp-captain-eligibility-card p strong{color:#f1f8fd}
      .rp-captain-eligibility-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:17px 0 15px}
      .rp-captain-eligibility-facts div{padding:11px 10px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.025)}
      .rp-captain-eligibility-facts small{display:block;margin-bottom:4px;color:#62778a;font-size:.46rem;font-weight:950;letter-spacing:.075em;text-transform:uppercase}
      .rp-captain-eligibility-facts strong{display:block;color:#eaf6ff;font-family:var(--rp-display,Arial,sans-serif);font-size:.67rem;font-style:italic;font-weight:1000;text-transform:uppercase}
      .rp-captain-eligibility-note{margin:0!important;padding-top:13px;border-top:1px solid rgba(255,255,255,.075);color:#708397!important;font-size:.61rem!important;line-height:1.5!important}

      @media(max-width:420px){
        .rp-world-player-row.has-captain-eligibility .rp-world-player-name{padding-right:103px}
        .rp-captain-eligibility-badge{right:65px;min-height:22px;padding-inline:7px;font-size:.38rem;letter-spacing:.04em}
        .rp-captain-eligibility-badge::before{width:4px;height:4px;margin-right:4px}
        .rp-captain-eligibility-card{padding:22px 18px 19px;border-radius:19px}
      }
      @media(max-width:355px){
        .rp-world-player-row.has-captain-eligibility .rp-world-player-name{padding-right:78px}
        .rp-captain-eligibility-badge{right:61px;padding-inline:6px;font-size:0;letter-spacing:0}
        .rp-captain-eligibility-badge::after{content:'CAPTAIN';font-size:.37rem;letter-spacing:.035em}
        .rp-captain-eligibility-facts{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;

    modal = document.createElement('div');
    modal.className = 'rp-captain-eligibility-modal';
    modal.dataset.rpCaptainEligibilityModal = 'true';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <section class="rp-captain-eligibility-card" role="dialog" aria-modal="true" aria-labelledby="rp-captain-eligibility-title">
        <button type="button" class="rp-captain-eligibility-close" data-captain-modal-close aria-label="Close captain eligibility information">×</button>
        <p class="rp-captain-eligibility-kicker">FUTURE REAL PLAY LEAGUE</p>
        <h2 id="rp-captain-eligibility-title">CAPTAIN ELIGIBLE</h2>
        <div class="rp-captain-eligibility-player"><strong data-captain-modal-player>REAL PLAY PLAYER</strong><b data-captain-modal-rank>RANK #—</b></div>
        <p>This player is currently eligible to become a <strong>Team Captain</strong> in an upcoming Real Play League because they hold an official Top 4 rank.</p>
        <p>Captain eligibility is earned through the <strong>official Real Play ranking system</strong> — not voting, popularity, or payment.</p>
        <p>When the League opens, eligible Captains will lead separate teams. Other eligible Real Play players will be able to choose which Captain they want to play under.</p>
        <div class="rp-captain-eligibility-facts">
          <div><small>Current Requirement</small><strong>Top 4 Official Rank</strong></div>
          <div><small>League Format</small><strong>4v4</strong></div>
          <div><small>Maximum Roster</small><strong>5 Players</strong></div>
          <div><small>Status</small><strong>Eligibility — Not Locked</strong></div>
        </div>
        <p class="rp-captain-eligibility-note">Captain eligibility may change if the official Rank changes before League captains and rosters are formally locked.</p>
      </section>`;

    document.body.appendChild(modal);
    modalTitle = modal.querySelector('#rp-captain-eligibility-title');
    modalRank = modal.querySelector('[data-captain-modal-rank]');
    modalPlayer = modal.querySelector('[data-captain-modal-player]');

    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-captain-modal-close]')) closeModal();
    });
    return modal;
  }

  function openModal(row) {
    const rank = Number(row?.dataset?.officialRank);
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > CAPTAIN_RANK_LIMIT) return;

    const name = String(row.querySelector('.rp-world-player-name strong')?.textContent || 'REAL PLAY PLAYER').trim();
    const dialog = ensureModal();
    if (modalPlayer) modalPlayer.textContent = name;
    if (modalRank) modalRank.textContent = `RANK #${rank}`;
    if (modalTitle) modalTitle.textContent = 'CAPTAIN ELIGIBLE';
    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
    dialog.querySelector('[data-captain-modal-close]')?.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const rank = Number(row.dataset.officialRank);
    const isEligible = Number.isSafeInteger(rank) && rank >= 1 && rank <= CAPTAIN_RANK_LIMIT;
    let badge = row.querySelector('[data-captain-eligibility]');

    if (!isEligible) {
      badge?.remove();
      row.classList.remove('has-captain-eligibility');
      return;
    }

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'rp-captain-eligibility-badge';
      badge.dataset.captainEligibility = 'true';
      badge.title = 'Why is this player Captain Eligible?';
      badge.textContent = 'CAPTAIN ELIGIBLE';
      row.appendChild(badge);
    }

    badge.dataset.captainRank = String(rank);
    row.classList.add('has-captain-eligibility');
  }

  function renderAll() {
    scheduled = false;
    document.querySelectorAll('.rp-world-player-row').forEach(renderRow);
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(renderAll);
  }

  document.addEventListener('click', (event) => {
    const badge = event.target.closest?.('[data-captain-eligibility]');
    if (!badge) return;
    const row = badge.closest('.rp-world-player-row');
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openModal(row);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList' || mutation.attributeName === 'data-official-rank')) scheduleRender();
  });

  installStyles();
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-official-rank'],
  });
  scheduleRender();
})();
