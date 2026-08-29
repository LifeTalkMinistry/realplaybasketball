(() => {
  if (window.__realPlayAdminSessionPickerInstalled) return;
  window.__realPlayAdminSessionPickerInstalled = true;

  let savedDate = '';
  let savedTime = '';

  function manilaToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function openNativePicker(input) {
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
    } catch (_error) {
      // Some browsers only allow showPicker during a direct user gesture.
    }
  }

  function syncHidden(form) {
    const date = form.querySelector('[data-session-date]')?.value || '';
    const time = form.querySelector('[data-session-time]')?.value || '';
    const hidden = form.querySelector('input[name="startsAt"]');

    savedDate = date;
    savedTime = time;

    if (!hidden) return;
    hidden.value = date && time ? `${date}T${time}:00+08:00` : '';
  }

  function enhanceForm(form) {
    if (!form || form.dataset.dateTimePickerReady === 'true') return;

    const oldInput = form.querySelector('input[type="datetime-local"][name="startsAt"]');
    if (!oldInput) return;

    const oldLabel = oldInput.closest('label');
    if (!oldLabel) return;

    const group = document.createElement('div');
    group.className = 'rp-admin-datetime-grid';
    group.innerHTML = `
      <label class="rp-admin-picker-field">
        DATE
        <div class="rp-admin-picker-control">
          <input type="date" data-session-date min="${manilaToday()}" aria-label="Session date">
          <span class="rp-admin-picker-icon" aria-hidden="true">CAL</span>
        </div>
      </label>
      <label class="rp-admin-picker-field">
        TIME
        <div class="rp-admin-picker-control">
          <input type="time" data-session-time step="900" aria-label="Session time">
          <span class="rp-admin-picker-icon" aria-hidden="true">TIME</span>
        </div>
      </label>
      <input type="hidden" name="startsAt">
    `;

    oldLabel.replaceWith(group);
    form.dataset.dateTimePickerReady = 'true';

    const dateInput = form.querySelector('[data-session-date]');
    const timeInput = form.querySelector('[data-session-time]');
    if (dateInput && savedDate) dateInput.value = savedDate;
    if (timeInput && savedTime) timeInput.value = savedTime;

    [dateInput, timeInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => syncHidden(form));
      input.addEventListener('change', () => syncHidden(form));
      input.closest('.rp-admin-picker-control')?.addEventListener('click', (event) => {
        if (event.target !== input) {
          input.focus({ preventScroll: true });
          openNativePicker(input);
        }
      });
    });

    syncHidden(form);
  }

  function enhance() {
    document.querySelectorAll('[data-new-session-form]').forEach(enhanceForm);
  }

  const style = document.createElement('style');
  style.textContent = `
    .rp-admin-datetime-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rp-admin-picker-field{min-width:0}
    .rp-admin-picker-control{position:relative;display:block;cursor:pointer}
    .rp-admin-picker-control input{padding-right:52px!important;color-scheme:dark;cursor:pointer}
    .rp-admin-picker-control input::-webkit-calendar-picker-indicator{opacity:1;cursor:pointer;filter:invert(1);margin-left:6px}
    .rp-admin-picker-icon{position:absolute;right:34px;top:50%;transform:translateY(-50%);pointer-events:none;color:#43e8ff;font:900 .48rem var(--rp-display,Arial,sans-serif);letter-spacing:.08em;opacity:.8}
    @media(max-width:360px){.rp-admin-datetime-grid{grid-template-columns:1fr}.rp-admin-picker-control input{min-height:48px}}
  `;
  document.head.appendChild(style);

  const root = document.querySelector('.rp-admin-control') || document.documentElement;
  const observer = new MutationObserver(enhance);
  observer.observe(root, { childList: true, subtree: true });
  enhance();
})();
