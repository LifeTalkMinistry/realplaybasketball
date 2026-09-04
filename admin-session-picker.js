(() => {
  if (window.__realPlayAdminSessionPickerInstalledV3) return;
  window.__realPlayAdminSessionPickerInstalledV3 = true;

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

  function formatDate(value) {
    if (!value) return 'CHOOSE DATE';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return 'CHOOSE DATE';
    const names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${Number(day)} ${names[Number(month) - 1] || month} ${year}`;
  }

  function formatTime(value) {
    if (!value) return 'CHOOSE TIME';
    const [hourRaw, minute = '00'] = value.split(':');
    const hour = Number(hourRaw);
    if (!Number.isFinite(hour)) return 'CHOOSE TIME';
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${suffix}`;
  }

  function openNativePicker(input) {
    if (!input) return;
    try {
      input.focus({ preventScroll: true });
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
      input.click();
    } catch (_error) {
      try { input.click(); } catch (_ignored) {}
    }
  }

  function updateDisplay(form) {
    const dateInput = form.querySelector('[data-session-date]');
    const timeInput = form.querySelector('[data-session-time]');
    const dateValue = form.querySelector('[data-session-date-value]');
    const timeValue = form.querySelector('[data-session-time-value]');
    if (dateValue) dateValue.textContent = formatDate(dateInput?.value || '');
    if (timeValue) timeValue.textContent = formatTime(timeInput?.value || '');
  }

  function syncHidden(form) {
    const date = form.querySelector('[data-session-date]')?.value || '';
    const time = form.querySelector('[data-session-time]')?.value || '';
    const hidden = form.querySelector('input[name="startsAt"]');

    savedDate = date;
    savedTime = time;
    if (hidden) hidden.value = date && time ? `${date}T${time}:00+08:00` : '';
    updateDisplay(form);
  }

  function enhanceForm(form) {
    if (!form || form.dataset.dateTimePickerReadyV3 === 'true') return;

    const oldInput = form.querySelector('input[type="datetime-local"][name="startsAt"]');
    if (!oldInput) return;
    const oldLabel = oldInput.closest('label');
    if (!oldLabel) return;

    const group = document.createElement('div');
    group.className = 'rp-admin-datetime-grid rp-admin-datetime-grid-v2';
    group.innerHTML = `
      <div class="rp-admin-picker-field-v2">
        <span class="rp-admin-picker-label-v2">DATE</span>
        <button class="rp-admin-picker-button-v2" type="button" data-open-session-picker="date">
          <span class="rp-admin-picker-value-v2" data-session-date-value>CHOOSE DATE</span>
          <span class="rp-admin-picker-mark-v2" aria-hidden="true">▾</span>
        </button>
        <input class="rp-admin-native-picker-v2" type="date" data-session-date min="${manilaToday()}" aria-label="Session date" tabindex="-1">
      </div>
      <div class="rp-admin-picker-field-v2">
        <span class="rp-admin-picker-label-v2">TIME</span>
        <button class="rp-admin-picker-button-v2" type="button" data-open-session-picker="time">
          <span class="rp-admin-picker-value-v2" data-session-time-value>CHOOSE TIME</span>
          <span class="rp-admin-picker-mark-v2" aria-hidden="true">▾</span>
        </button>
        <input class="rp-admin-native-picker-v2" type="time" data-session-time step="60" aria-label="Session time" tabindex="-1">
      </div>
      <input type="hidden" name="startsAt">
    `;

    oldLabel.replaceWith(group);
    form.dataset.dateTimePickerReadyV3 = 'true';

    const dateInput = form.querySelector('[data-session-date]');
    const timeInput = form.querySelector('[data-session-time]');
    if (dateInput && savedDate) dateInput.value = savedDate;
    if (timeInput && savedTime) timeInput.value = savedTime;

    [dateInput, timeInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => syncHidden(form));
      input.addEventListener('change', () => syncHidden(form));
    });

    form.querySelector('[data-open-session-picker="date"]')?.addEventListener('click', () => openNativePicker(dateInput));
    form.querySelector('[data-open-session-picker="time"]')?.addEventListener('click', () => openNativePicker(timeInput));

    syncHidden(form);
  }

  function enhance() {
    document.querySelectorAll('[data-new-session-form]').forEach(enhanceForm);
  }

  const style = document.createElement('style');
  style.textContent = `
    .rp-admin-datetime-grid-v2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rp-admin-picker-field-v2{position:relative;min-width:0}
    .rp-admin-picker-label-v2{display:block;margin-bottom:6px;color:#7189a5;font-size:.56rem;font-weight:900;letter-spacing:.09em}
    .rp-admin-picker-button-v2{width:100%;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 14px;border:1px solid rgba(126,173,232,.18);border-radius:13px;outline:0;color:#f7fbff;background:#020812;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
    .rp-admin-picker-button-v2:hover{border-color:rgba(67,232,255,.35);background:#06101b}
    .rp-admin-picker-button-v2:active{transform:scale(.985);border-color:rgba(67,232,255,.55)}
    .rp-admin-picker-button-v2:focus-visible{border-color:rgba(67,232,255,.6);box-shadow:0 0 0 3px rgba(67,232,255,.08)}
    .rp-admin-picker-value-v2{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:900 .78rem var(--rp-body,Arial,sans-serif);letter-spacing:.01em}
    .rp-admin-picker-mark-v2{flex:0 0 auto;color:#43e8ff;font-size:.8rem;line-height:1}
    .rp-admin-native-picker-v2{position:absolute!important;left:0!important;bottom:0!important;width:1px!important;height:1px!important;min-height:1px!important;padding:0!important;border:0!important;opacity:0!important;pointer-events:none!important}
    @media(max-width:340px){.rp-admin-datetime-grid-v2{grid-template-columns:1fr}.rp-admin-picker-button-v2{min-height:56px}}
  `;
  document.head.appendChild(style);

  window.addEventListener('realplay:admin-render', () => {
    window.requestAnimationFrame(enhance);
  });
  enhance();
})();
