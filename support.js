(() => {
  const ENDPOINT = 'https://api.clarapmc.com/api/real-play/support/plans';
  const TOKEN_KEY = 'real_play_access_token';
  const form = document.querySelector('[data-support-form]');
  if (!form) return;

  const status = form.querySelector('[data-support-status]');
  const customAmount = form.querySelector('[data-support-custom-amount]');
  const amountButtons = [...form.querySelectorAll('[data-support-amount]')];
  const weeklyWrap = form.querySelector('[data-support-weekly]');
  const monthlyWrap = form.querySelector('[data-support-monthly]');
  const consent = form.querySelector('[data-support-consent]');
  const preview = form.querySelector('[data-support-reminder-preview]');
  const previewValue = form.querySelector('[data-support-next-reminder]');
  const methodNote = form.querySelector('[data-support-method-note]');
  const emailInput = form.querySelector('input[name="email"]');
  const submit = form.querySelector('.support-submit');

  function setStatus(message = '', type = '') {
    if (!status) return;
    status.textContent = message;
    status.className = `support-form-status${type ? ` ${type}` : ''}`;
  }

  function selected(name) {
    return form.querySelector(`input[name="${name}"]:checked`)?.value || '';
  }

  function syncChoiceStates() {
    form.querySelectorAll('.support-choice').forEach((label) => {
      label.classList.toggle('active', Boolean(label.querySelector('input:checked')));
    });
    form.querySelectorAll('.support-method').forEach((label) => {
      label.classList.toggle('active', Boolean(label.querySelector('input:checked')));
    });
  }

  function nextWeekly(day) {
    const now = new Date();
    const target = new Date(now);
    const delta = (Number(day) - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + delta);
    target.setHours(9, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 7);
    return target;
  }

  function nextMonthly(day) {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), Number(day), 9, 0, 0, 0);
    if (target <= now) target = new Date(now.getFullYear(), now.getMonth() + 1, Number(day), 9, 0, 0, 0);
    return target;
  }

  function renderPreview() {
    const frequency = selected('frequency');
    if (frequency === 'one_time') {
      preview.hidden = true;
      return;
    }
    const target = frequency === 'weekly'
      ? nextWeekly(form.weekly_day.value)
      : nextMonthly(form.monthly_day.value);
    preview.hidden = false;
    previewValue.textContent = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(target);
  }

  function syncFrequency() {
    const frequency = selected('frequency');
    weeklyWrap.hidden = frequency !== 'weekly';
    monthlyWrap.hidden = frequency !== 'monthly';
    consent.hidden = frequency === 'one_time';
    const checkbox = consent.querySelector('input');
    checkbox.required = frequency !== 'one_time';
    if (frequency === 'one_time') checkbox.checked = false;
    renderPreview();
    syncChoiceStates();
  }

  function syncMethod() {
    const method = selected('payment_method');
    if (!methodNote) return;
    if (method === 'cash_on_hand') {
      methodNote.innerHTML = '<strong>CASH ON HAND</strong><span>Give your support personally to an authorized Real Play organizer. It only becomes official support after it is physically received and confirmed.</span>';
    } else if (method === 'maya') {
      methodNote.innerHTML = '<strong>MAYA</strong><span>Maya is prepared as a future method but is not active yet.</span>';
    } else {
      methodNote.innerHTML = '<strong>GCASH</strong><span>Your support plan can be saved now. The verified GCash recipient number will appear here once it is configured.</span>';
    }
    syncChoiceStates();
  }

  amountButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const amount = Number(button.dataset.supportAmount);
      customAmount.value = String(amount);
      amountButtons.forEach((item) => item.classList.toggle('active', item === button));
    });
  });

  customAmount.addEventListener('input', () => {
    const amount = Number(customAmount.value);
    amountButtons.forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.supportAmount) === amount);
    });
  });

  form.querySelectorAll('input[name="frequency"]').forEach((input) => input.addEventListener('change', syncFrequency));
  form.querySelectorAll('input[name="payment_method"]').forEach((input) => input.addEventListener('change', syncMethod));
  form.querySelectorAll('select').forEach((select) => select.addEventListener('change', renderPreview));

  const profileEmail = document.querySelector('[data-auth-account-email]');
  if (profileEmail?.textContent?.trim() && !emailInput.value) {
    emailInput.value = profileEmail.textContent.trim();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const frequency = selected('frequency');
    const paymentMethod = selected('payment_method');
    const amount = Number(customAmount.value);
    const email = String(emailInput.value || '').trim();
    const emailOptIn = Boolean(form.querySelector('input[name="email_opt_in"]')?.checked);

    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus('Enter a valid support amount.', 'error');
      return;
    }
    if (!email || !emailInput.checkValidity()) {
      setStatus('Enter a valid email address.', 'error');
      return;
    }
    if (frequency !== 'one_time' && !emailOptIn) {
      setStatus('Please agree to email reminders for recurring support.', 'error');
      return;
    }

    const payload = {
      email,
      amount_php: amount,
      frequency,
      payment_method: paymentMethod,
      weekly_day: frequency === 'weekly' ? Number(form.weekly_day.value) : null,
      monthly_day: frequency === 'monthly' ? Number(form.monthly_day.value) : null,
      email_opt_in: frequency === 'one_time' ? false : emailOptIn,
    };

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'SAVING...';

    try {
      const token = window.localStorage.getItem(TOKEN_KEY) || '';
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.message || 'Support plan could not be saved.');

      if (frequency === 'one_time') {
        if (paymentMethod === 'cash_on_hand') {
          setStatus('Saved. Give it personally when ready. It will count only after Real Play confirms the cash was received.', 'success');
        } else {
          setStatus('Your one-time support intention is saved. The verified GCash receiving details still need to be configured before digital transfer can be completed.', 'warning');
        }
      } else if (data.emailDeliveryConfigured) {
        setStatus('Recurring support saved. Your email reminder schedule is active. No automatic charge will happen.', 'success');
      } else {
        setStatus('Recurring support saved. Your reminder schedule is recorded, but email delivery is not active yet while Real Play connects its mail service. No automatic charge will happen.', 'warning');
      }
    } catch (error) {
      setStatus(error?.message || 'Support plan could not be saved.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  });

  syncFrequency();
  syncMethod();
})();