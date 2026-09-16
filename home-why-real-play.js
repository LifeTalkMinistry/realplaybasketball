(() => {
  if (window.__realPlayHomeWhyRealPlayInstalled) return;
  window.__realPlayHomeWhyRealPlayInstalled = true;

  const TRIGGER_ATTR = 'data-rp-home-why-real-play';
  const OVERLAY_ATTR = 'data-rp-home-story-overlay';
  let overlay = null;
  let currentIndex = 0;
  let pointerStart = null;
  let lastTrigger = null;
  let positionFrame = 0;

  function storySource() {
    return document.querySelector('[data-public-experience="story"]');
  }

  function homeRoot() {
    return document.querySelector('.rp-simple-home.rp-home-command-center');
  }

  function slides() {
    return overlay ? Array.from(overlay.querySelectorAll('[data-carousel-slide]')) : [];
  }

  function render(index) {
    if (!overlay) return;
    const track = overlay.querySelector('[data-carousel-track]');
    const allSlides = slides();
    if (!track || !allSlides.length) return;

    currentIndex = Math.max(0, Math.min(index, allSlides.length - 1));
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    allSlides.forEach((slide, slideIndex) => {
      const active = slideIndex === currentIndex;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    const dots = Array.from(overlay.querySelectorAll('[data-carousel-dots] button'));
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === currentIndex;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });

    const count = overlay.querySelector('[data-carousel-count]');
    if (count) count.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(allSlides.length).padStart(2, '0')}`;

    const prev = overlay.querySelector('[data-carousel-prev]');
    const next = overlay.querySelector('[data-carousel-next]');
    if (prev) prev.disabled = currentIndex === 0;
    if (next) next.disabled = currentIndex === allSlides.length - 1;
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rp-home-story-open');
    pointerStart = null;
    try { lastTrigger?.focus({ preventScroll: true }); } catch (_error) {}
  }

  function buildOverlay() {
    if (overlay?.isConnected) return overlay;

    const source = storySource();
    if (!source) return null;

    overlay = source.cloneNode(true);
    overlay.removeAttribute('id');
    overlay.removeAttribute('data-public-experience');
    overlay.setAttribute(OVERLAY_ATTR, 'true');
    overlay.setAttribute('aria-label', 'Why Real Play');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.add('rp-home-story-overlay');
    overlay.hidden = true;

    overlay.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));

    const dotsHost = overlay.querySelector('[data-carousel-dots]');
    if (dotsHost) dotsHost.replaceChildren();

    const allSlides = Array.from(overlay.querySelectorAll('[data-carousel-slide]'));
    allSlides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === 0);
      slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
    });

    allSlides.forEach((_, dotIndex) => {
      if (!dotsHost) return;
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to slide ${dotIndex + 1}`);
      dot.addEventListener('click', () => render(dotIndex));
      dotsHost.appendChild(dot);
    });

    overlay.querySelector('[data-carousel-prev]')?.addEventListener('click', () => render(currentIndex - 1));
    overlay.querySelector('[data-carousel-next]')?.addEventListener('click', () => render(currentIndex + 1));
    overlay.querySelector('[data-carousel-close]')?.addEventListener('click', close);

    const viewport = overlay.querySelector('[data-carousel-viewport]');
    viewport?.addEventListener('pointerdown', (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    });
    viewport?.addEventListener('pointerup', (event) => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
      render(currentIndex + (dx < 0 ? 1 : -1));
    });
    viewport?.addEventListener('pointercancel', () => { pointerStart = null; });

    overlay.querySelectorAll('[data-public-create]').forEach((button) => {
      button.removeAttribute('data-public-create');
      button.textContent = 'BACK TO HOME';
      button.addEventListener('click', close);
    });

    document.body.appendChild(overlay);
    render(0);
    return overlay;
  }

  function open(trigger) {
    lastTrigger = trigger || document.querySelector(`[${TRIGGER_ATTR}]`);
    const panel = buildOverlay();
    if (!panel) return false;

    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rp-home-story-open');
    render(0);
    window.setTimeout(() => {
      try { panel.querySelector('[data-carousel-viewport]')?.focus({ preventScroll: true }); } catch (_error) {}
    }, 0);
    return true;
  }

  function positionTrigger(trigger) {
    const root = homeRoot();
    const lockup = root?.querySelector('.rp-home-brand-lockup');
    const tagline = lockup?.querySelector('small');
    const session = root?.querySelector('[data-rp-home-open-rank]');
    if (!root || !tagline || !trigger) return;

    const rootRect = root.getBoundingClientRect();
    const taglineRect = tagline.getBoundingClientRect();
    const sessionRect = session?.getBoundingClientRect();

    // The control belongs visually to the tagline, not to the session card.
    // Measure the rendered tagline so font size / viewport changes cannot move
    // the button onto the wordmark or the card again.
    let top = taglineRect.bottom - rootRect.top + 11;

    if (sessionRect) {
      const sessionTop = sessionRect.top - rootRect.top;
      top = Math.min(top, sessionTop - 36);
    }

    trigger.style.top = `${Math.max(0, Math.round(top))}px`;
  }

  function queuePosition(trigger) {
    if (!trigger) return;
    if (positionFrame) cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      positionTrigger(trigger);
    });
  }

  function ensureTrigger() {
    const root = homeRoot();
    const lockup = root?.querySelector('.rp-home-brand-lockup');
    if (!root || !lockup) return false;

    let trigger = root.querySelector(`[${TRIGGER_ATTR}]`);
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'rp-home-why-real-play';
      trigger.setAttribute(TRIGGER_ATTR, 'true');
      trigger.setAttribute('aria-label', 'Why Real Play? Open the Real Play story');
      trigger.innerHTML = 'WHY REAL PLAY? <span aria-hidden="true">i</span>';
      trigger.addEventListener('click', () => open(trigger));
    }

    // Keep this as a sibling of the masthead. Putting it inside the absolutely
    // positioned lockup makes percentage positioning depend on the lockup's
    // computed box and caused the previous overlap/large-gap bugs.
    if (trigger.parentElement !== root) root.appendChild(trigger);
    queuePosition(trigger);
    window.setTimeout(() => queuePosition(trigger), 250);
    window.setTimeout(() => queuePosition(trigger), 900);
    return true;
  }

  function install(attempt = 0) {
    const triggerReady = ensureTrigger();
    const sourceReady = Boolean(storySource());
    if (triggerReady && sourceReady) return;
    if (attempt >= 30) return;
    window.setTimeout(() => install(attempt + 1), 120);
  }

  document.addEventListener('keydown', (event) => {
    if (!overlay || overlay.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') render(currentIndex - 1);
    if (event.key === 'ArrowRight') render(currentIndex + 1);
  });

  window.addEventListener('resize', () => queuePosition(document.querySelector(`[${TRIGGER_ATTR}]`)));
  window.addEventListener('orientationchange', () => window.setTimeout(() => queuePosition(document.querySelector(`[${TRIGGER_ATTR}]`)), 120));

  window.RealPlayWhyRealPlay = { open: () => open(), close };
  install();
})();
