(() => {
  if (window.__realPlayFourVFourCancellationControlInstalled) return;
  window.__realPlayFourVFourCancellationControlInstalled = true;

  const STYLE_ID = 'rp-4v4-cancellation-control-style';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rp-4v4-preference-panel[data-rp-cancel-available="1"] .rp-4v4-preference-cancel{
        flex:0 0 48px!important;
        width:48px!important;
        min-width:48px!important;
        max-width:48px!important;
        min-height:46px!important;
        margin:0!important;
        padding:0!important;
        display:grid!important;
        place-items:center!important;
        border:1px solid rgba(255,104,121,.42)!important;
        border-radius:14px!important;
        background:linear-gradient(180deg,rgba(58,15,24,.96),rgba(28,8,14,.98))!important;
        color:#ff9aa7!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 20px rgba(0,0,0,.18)!important;
        font-family:Arial,sans-serif!important;
        font-size:1.02rem!important;
        font-style:normal!important;
        font-weight:900!important;
        letter-spacing:0!important;
        line-height:1!important;
        cursor:pointer!important;
        opacity:1!important;
        transition:transform .16s ease,border-color .16s ease,background .16s ease!important;
      }
      .rp-4v4-preference-panel[data-rp-cancel-available="1"] .rp-4v4-preference-cancel[hidden]{display:grid!important}
      .rp-4v4-preference-panel[data-rp-cancel-available="1"] .rp-4v4-preference-cancel:hover:not(:disabled){
        border-color:rgba(255,104,121,.72)!important;
        background:linear-gradient(180deg,rgba(76,18,29,.98),rgba(38,9,17,.99))!important;
      }
      .rp-4v4-preference-panel[data-rp-cancel-available="1"] .rp-4v4-preference-cancel:active:not(:disabled){transform:scale(.96)!important}
      .rp-4v4-preference-panel[data-rp-cancel-available="1"] .rp-4v4-preference-cancel:disabled{opacity:.55!important;cursor:default!important}
      .rp-4v4-preference-panel[data-rp-cancel-available="1"] .rp-4v4-team-code-admin{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function playerIsJoined(panel) {
    const action = panel?.querySelector('[data-rp-4v4-preference-action]');
    if (!action) return false;
    if (action.classList.contains('is-selected')) return true;
    const text = String(action.textContent || '').trim().toUpperCase();
    return text.startsWith('JOINED') || text.startsWith('MY TEAM');
  }

  function ensureCancelButton(panel) {
    const actions = panel?.querySelector('.rp-4v4-preference-actions');
    if (!actions) return null;

    let cancel = actions.querySelector('[data-rp-4v4-preference-cancel]');
    if (!cancel) {
      cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'rp-4v4-preference-cancel';
      cancel.setAttribute('data-rp-4v4-preference-cancel', '');
      actions.appendChild(cancel);
    }

    if (cancel.textContent !== '✕') cancel.textContent = '✕';
    if (cancel.getAttribute('aria-label') !== 'Cancel my team spot') cancel.setAttribute('aria-label', 'Cancel my team spot');
    if (cancel.title !== 'Cancel my team spot') cancel.title = 'Cancel my team spot';
    return cancel;
  }

  function syncPanel(panel = document.querySelector('.rp-4v4-preference-panel')) {
    if (!panel) return false;
    const cancel = ensureCancelButton(panel);
    if (!cancel) return false;

    const joined = playerIsJoined(panel);
    const nextFlag = joined ? '1' : '0';
    if (panel.dataset.rpCancelAvailable !== nextFlag) panel.dataset.rpCancelAvailable = nextFlag;

    if (joined) {
      if (cancel.hidden) cancel.hidden = false;
    } else if (!cancel.hidden) {
      cancel.hidden = true;
    }
    return true;
  }

  function teamName(panel) {
    const explicit = String(panel?.querySelector('[data-rp-4v4-preference-team]')?.textContent || '').trim();
    if (explicit) return explicit.toUpperCase();
    const view = panel?.closest('[data-rp-4v4-static-view], .rp-4v4-static-view');
    const club = String(view?.dataset?.rpActiveClub || '').trim();
    return club ? club.toUpperCase() : 'THIS TEAM';
  }

  let queued = false;
  function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      syncPanel();
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const cancel = target?.closest('[data-rp-4v4-preference-cancel]');
    if (!cancel) return;

    const panel = cancel.closest('.rp-4v4-preference-panel');
    if (!panel || panel.dataset.rpCancelAvailable !== '1') return;

    const confirmed = window.confirm(`Cancel your spot on ${teamName(panel)}?\n\nYour roster spot will become available again.`);
    if (confirmed) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  function boot() {
    installStyle();
    syncPanel();
    new MutationObserver(queueSync).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'data-rp-active-club'],
    });
    window.addEventListener('realplay:4v4-open', queueSync);
    window.addEventListener('realplay:admin-render', queueSync);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
