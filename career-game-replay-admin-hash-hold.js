(() => {
  if (window.__realPlayReplayAdminHashHoldInstalled) return;
  window.__realPlayReplayAdminHashHoldInstalled = true;

  const HOLD_MS = 700;
  const MOVE_CANCEL_PX = 14;
  let timer = 0;
  let target = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let suppressNextClick = false;

  function activeReplay() {
    return document.querySelector('[data-rp-career-replay].open');
  }

  function hashButtonFrom(node) {
    if (!(node instanceof Element)) return null;
    const replay = node.closest('[data-rp-career-replay].open');
    const topbar = node.closest('.rp-career-replay-topbar');
    if (!replay || !topbar) return null;

    const candidate = node.closest('button,[role="button"]');
    if (candidate && topbar.contains(candidate) && String(candidate.textContent || '').trim() === '#') {
      return candidate;
    }

    return [...topbar.querySelectorAll('button,[role="button"]')]
      .find((item) => String(item.textContent || '').trim() === '#') || null;
  }

  function adminEditButton() {
    if (window.__realPlayAdminVerified !== true) return null;
    return activeReplay()?.querySelector('[data-rp-replay-admin-edit]') || null;
  }

  function clearHold() {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    target?.classList.remove('rp-replay-admin-hold-arming');
    target = null;
    pointerId = null;
  }

  document.addEventListener('pointerdown', (event) => {
    const hash = hashButtonFrom(event.target);
    if (!hash || window.__realPlayAdminVerified !== true) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    clearHold();
    target = hash;
    pointerId = event.pointerId;
    startX = Number(event.clientX || 0);
    startY = Number(event.clientY || 0);
    hash.classList.add('rp-replay-admin-hold-arming');

    timer = window.setTimeout(() => {
      timer = 0;
      if (target !== hash) return;
      const edit = adminEditButton();
      hash.classList.remove('rp-replay-admin-hold-arming');
      target = null;
      if (!edit) return;
      suppressNextClick = true;
      edit.click();
    }, HOLD_MS);
  }, true);

  document.addEventListener('pointermove', (event) => {
    if (!target || event.pointerId !== pointerId) return;
    if (Math.hypot(Number(event.clientX || 0) - startX, Number(event.clientY || 0) - startY) > MOVE_CANCEL_PX) {
      clearHold();
    }
  }, true);

  document.addEventListener('pointerup', (event) => {
    if (pointerId === null || event.pointerId === pointerId) clearHold();
  }, true);
  document.addEventListener('pointercancel', clearHold, true);

  document.addEventListener('click', (event) => {
    const hash = hashButtonFrom(event.target);
    if (!hash || !suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .rp-replay-admin-edit{display:none!important;pointer-events:none!important;}
    .rp-replay-admin-hold-arming{transform:scale(.96);filter:brightness(1.16);}
  `;
  document.head.appendChild(style);
})();
