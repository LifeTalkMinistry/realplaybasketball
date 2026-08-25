(() => {
  function loadScript(src, onload) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    if (onload) script.onload = onload;
    document.head.appendChild(script);
  }

  if (!document.querySelector('link[href="support.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'support.css';
    document.head.appendChild(link);
  }

  const supportGrid = document.querySelector('#support .support-grid');
  if (supportGrid) {
    supportGrid.classList.add('support-grid-live');
    supportGrid.innerHTML = `
        <div class="support-copy reveal visible">
          <p class="eyebrow">SUPPORT MORE REAL PLAY</p>
          <h2>Help put the next ball on the court.</h2>
          <p>The Real Play Community Fund can support basketballs, court access, basic session supplies, youth participation, equipment, and direct community basketball costs.</p>
          <div class="support-principles">
            <span>ONE TIME OR RECURRING</span>
            <span>NO AUTOMATIC CHARGE</span>
            <span>ONLY VERIFIED MONEY COUNTS</span>
          </div>
          <p class="support-trust">A recurring support plan is a voluntary reminder commitment. Real Play never adds promised support to the public fund until the money is actually received and confirmed.</p>
        </div>

        <div class="support-card support-card-live reveal visible">
          <span class="support-card-number">01</span>
          <p class="support-form-kicker">BUILD YOUR SUPPORT PLAN</p>
          <h3>How would you like to support?</h3>

          <form class="support-form" data-support-form>
            <fieldset class="support-fieldset">
              <legend>Frequency</legend>
              <div class="support-choice-grid support-frequency-grid">
                <label class="support-choice active">
                  <input type="radio" name="frequency" value="one_time" checked />
                  <strong>ONE TIME</strong>
                  <span>Give once</span>
                </label>
                <label class="support-choice">
                  <input type="radio" name="frequency" value="weekly" />
                  <strong>WEEKLY</strong>
                  <span>Email reminder</span>
                </label>
                <label class="support-choice">
                  <input type="radio" name="frequency" value="monthly" />
                  <strong>MONTHLY</strong>
                  <span>Email reminder</span>
                </label>
              </div>
            </fieldset>

            <fieldset class="support-fieldset">
              <legend>Amount</legend>
              <div class="support-amounts" data-support-amounts>
                <button type="button" data-support-amount="50">₱50</button>
                <button type="button" data-support-amount="100" class="active">₱100</button>
                <button type="button" data-support-amount="250">₱250</button>
                <button type="button" data-support-amount="500">₱500</button>
              </div>
              <label class="support-input-label" for="support-custom-amount">Or enter your own amount</label>
              <div class="support-money-input">
                <span>₱</span>
                <input id="support-custom-amount" data-support-custom-amount name="amount" type="number" min="1" step="1" inputmode="decimal" value="100" required />
              </div>
            </fieldset>

            <div class="support-schedule" data-support-weekly hidden>
              <label for="support-weekly-day">Send my weekly reminder every</label>
              <select id="support-weekly-day" name="weekly_day">
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
                <option value="0">Sunday</option>
              </select>
            </div>

            <div class="support-schedule" data-support-monthly hidden>
              <label for="support-monthly-day">Send my monthly reminder on the</label>
              <select id="support-monthly-day" name="monthly_day">
                <option value="1">1st</option>
                <option value="5">5th</option>
                <option value="10">10th</option>
                <option value="15" selected>15th</option>
                <option value="20">20th</option>
                <option value="25">25th</option>
                <option value="28">28th</option>
              </select>
            </div>

            <fieldset class="support-fieldset">
              <legend>How will you give?</legend>
              <div class="support-methods">
                <label class="support-method active">
                  <input type="radio" name="payment_method" value="gcash" checked />
                  <span class="support-method-name">GCASH</span>
                  <small>Digital transfer</small>
                </label>
                <label class="support-method support-method-coming">
                  <input type="radio" name="payment_method" value="maya" disabled />
                  <span class="support-method-name">MAYA</span>
                  <small>Coming soon</small>
                </label>
                <label class="support-method">
                  <input type="radio" name="payment_method" value="cash_on_hand" />
                  <span class="support-method-name">CASH ON HAND</span>
                  <small>Give personally</small>
                </label>
              </div>
            </fieldset>

            <div class="support-method-note" data-support-method-note>
              <strong>GCASH</strong>
              <span>Your support plan can be saved now. The verified GCash recipient number will appear here once it is configured.</span>
            </div>

            <div class="support-email-block">
              <label class="support-input-label" for="support-email">Email</label>
              <input id="support-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
              <label class="support-consent" data-support-consent hidden>
                <input type="checkbox" name="email_opt_in" />
                <span>Email me according to the support schedule I selected. I understand this is only a reminder and will never automatically charge me.</span>
              </label>
            </div>

            <div class="support-reminder-preview" data-support-reminder-preview hidden>
              <span>NEXT REMINDER</span>
              <strong data-support-next-reminder>—</strong>
              <small>Reminder time: approximately 9:00 AM Philippine time.</small>
            </div>

            <button class="support-submit" type="submit">SAVE SUPPORT PLAN</button>
            <p class="support-form-status" data-support-status aria-live="polite"></p>
          </form>

          <div class="support-integrity-note">
            <strong>SUBMITTED ≠ RECEIVED</strong>
            <p>Your plan records what you intend to give. Only money actually received and verified becomes official Real Play support and can affect the Community Fund or support-based player-number priority.</p>
          </div>
        </div>`;
  }

  loadScript('auth-core.js', () => {
    loadScript('profile-experience.js', () => loadScript('support.js'));
  });
})();