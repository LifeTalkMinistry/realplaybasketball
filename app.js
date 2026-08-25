document.documentElement.classList.add('js');

const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('en-PH');

const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-nav]');
const header = document.querySelector('[data-header]');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    });
  });
}

const updateHeader = () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 12);
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('visible'));
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function renderLedger(entries) {
  const list = document.querySelector('[data-ledger-list]');
  const supportEl = document.querySelector('[data-total-support]');
  const spentEl = document.querySelector('[data-put-into-play]');
  const availableEl = document.querySelector('[data-available]');
  const asOfEl = document.querySelector('[data-ledger-asof]');

  if (!list || !supportEl || !spentEl || !availableEl || !asOfEl) return;

  const verified = entries.filter((entry) => entry.status === 'confirmed');
  const support = verified
    .filter((entry) => entry.type === 'support_received')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const spent = verified
    .filter((entry) => entry.type === 'put_into_play')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const available = support - spent;

  supportEl.textContent = currency.format(support);
  spentEl.textContent = currency.format(spent);
  availableEl.textContent = currency.format(available);

  const sorted = [...verified].sort((a, b) => b.date.localeCompare(a.date));
  asOfEl.textContent = sorted.length ? `AS OF ${formatDate(sorted[0].date).toUpperCase()}` : 'NO ENTRIES YET';

  if (!sorted.length) return;

  list.innerHTML = '';
  sorted.forEach((entry) => {
    const outgoing = entry.type === 'put_into_play';
    const article = document.createElement('article');
    article.className = 'ledger-entry';

    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = formatDate(entry.date).toUpperCase();

    const body = document.createElement('div');
    const type = document.createElement('div');
    type.className = 'ledger-entry-type';
    type.textContent = outgoing ? 'PUT INTO PLAY' : 'SUPPORT RECEIVED';

    const title = document.createElement('h4');
    title.textContent = entry.title || (outgoing ? 'Real Play expense' : 'Community support');

    body.append(type, title);

    if (entry.location || entry.project) {
      const meta = document.createElement('p');
      meta.textContent = [entry.project, entry.location].filter(Boolean).join(' · ');
      body.append(meta);
    }

    if (entry.proof_url) {
      const proof = document.createElement('p');
      const link = document.createElement('a');
      link.href = entry.proof_url;
      link.textContent = 'View proof';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      proof.append(link);
      body.append(proof);
    }

    const amount = document.createElement('div');
    amount.className = `ledger-amount ${outgoing ? 'out' : 'in'}`;
    amount.textContent = `${outgoing ? '−' : '+'}${currency.format(Number(entry.amount || 0))}`;

    article.append(date, body, amount);
    list.append(article);
  });
}

function renderImpact(impact) {
  const status = document.querySelector('[data-impact-status]');
  const fields = {
    players: impact.players,
    games: impact.games,
    hours: impact.hours,
    courts: impact.courts,
  };

  Object.entries(fields).forEach(([key, value]) => {
    const el = document.querySelector(`[data-impact="${key}"]`);
    if (!el) return;
    const safeValue = Number(value || 0);
    el.textContent = key === 'hours' ? `${number.format(safeValue)}h` : number.format(safeValue);
  });

  if (!status) return;
  const total = Object.values(fields).reduce((sum, value) => sum + Number(value || 0), 0);
  status.textContent = total > 0
    ? `Public impact records updated ${impact.updated_at ? formatDate(impact.updated_at) : 'from the latest confirmed data'}.`
    : 'No public impact records yet. Confirmed Real Play activity will appear here as it is logged.';
}

async function loadPublicData() {
  try {
    const [ledgerResponse, impactResponse] = await Promise.all([
      fetch('data/ledger.json', { cache: 'no-store' }),
      fetch('data/impact.json', { cache: 'no-store' }),
    ]);

    if (!ledgerResponse.ok || !impactResponse.ok) throw new Error('Public data could not be loaded.');

    const ledger = await ledgerResponse.json();
    const impact = await impactResponse.json();

    renderLedger(Array.isArray(ledger.entries) ? ledger.entries : []);
    renderImpact(impact);
  } catch (error) {
    console.error(error);
    const status = document.querySelector('[data-impact-status]');
    if (status) status.textContent = 'Public data is temporarily unavailable. No amounts have been estimated.';
  }
}

loadPublicData();

function installCultureSection() {
  const mission = document.querySelector('#mission');
  const impact = document.querySelector('#impact');
  if (!mission || !impact || document.querySelector('#culture')) return;

  const heroNote = document.querySelector('.hero-note');
  if (heroNote) heroNote.textContent = 'Against excessive screen time. Not against technology.';

  const cultureNav = document.createElement('a');
  cultureNav.href = '#culture';
  cultureNav.textContent = 'Culture';
  const impactNav = nav?.querySelector('a[href="#impact"]');
  if (impactNav) impactNav.before(cultureNav);

  cultureNav.addEventListener('click', () => {
    if (!menuButton || !nav) return;
    menuButton.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  });

  const culture = document.createElement('section');
  culture.className = 'section culture-section';
  culture.id = 'culture';
  culture.innerHTML = `
    <div class="shell culture-grid">
      <div class="section-heading culture-heading">
        <p class="eyebrow">REAL PLAY CULTURE</p>
        <h2>Play hard.<br />Keep it basketball.</h2>
        <p class="culture-lock">COMPETITIVE WITHOUT HOSTILITY.<br />OPEN TO EVERYONE.<br /><strong>ROOTED IN CHRIST.</strong></p>
      </div>

      <div class="culture-copy">
        <p class="culture-intro">Real Play is built for genuine competition, genuine community, and a court atmosphere people want to return to. We do not make basketball soft. We make sure competition stays basketball.</p>

        <div class="culture-accordion" aria-label="Real Play community culture">
          <details class="culture-item">
            <summary>COMPETE HARD.</summary>
            <div class="culture-answer">
              <p>Play hard. Celebrate. Challenge each other. Talk a little trash. Want to win. Chase your stats. Ask for the rematch.</p>
              <p>Competition belongs here. But when it becomes personal, threatening, humiliating, or designed to provoke a fight, it stops being Real Play.</p>
            </div>
          </details>

          <details class="culture-item">
            <summary>KEEP IT SPORTY.</summary>
            <div class="culture-answer">
              <p>Competitive gestures are part of basketball. Aggressive escalation is not. Threats, fight gestures, excessive hostile trash talk, intimidation, and behavior meant to inflame a situation will be called out immediately.</p>
              <p><strong>Real Play Court Stewards</strong> watch the atmosphere and step in early. They can call it out, separate players, warn, cool the situation down, sit someone out, or remove someone when necessary.</p>
              <p class="culture-rule">IF IT RAISES THE GAME, PLAY ON.<br />IF IT RAISES THE TEMPERATURE, WE STEP IN.</p>
            </div>
          </details>

          <details class="culture-item culture-item-faith">
            <summary>ROOTED IN CHRIST.</summary>
            <div class="culture-answer">
              <p>Real Play welcomes people regardless of church background or personal beliefs. We are not tied to a specific church or denomination. But we are openly rooted in Jesus Christ.</p>
              <p>If you spend time with Real Play, expect to hear about Jesus, the Gospel, and the salvation He offers. We share naturally during breaks, timeouts, waiting time, after games, and ordinary moments together — not by interrupting play or turning every possession into a sermon.</p>
              <p>No one has to pretend to believe in order to play. But no one should be surprised that Christ is part of this community.</p>
              <p class="culture-youth-note">For youth sessions, parents and guardians should know that Christ-centered conversations are part of the Real Play community.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  `;

  mission.insertAdjacentElement('afterend', culture);

  culture.querySelectorAll('details').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      culture.querySelectorAll('details').forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  const style = document.createElement('style');
  style.textContent = `
    .culture-section {
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(circle at 84% 18%, rgba(18,108,255,.16), transparent 27%),
        radial-gradient(circle at 12% 88%, rgba(255,29,41,.07), transparent 24%),
        linear-gradient(180deg, #05080d, #020306);
      border-top: 1px solid rgba(22,216,255,.14);
      border-bottom: 1px solid rgba(105,150,214,.18);
    }
    .culture-section::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(118deg, transparent 0 68%, rgba(18,108,255,.07) 68.1% 69%, transparent 69.1%),
        linear-gradient(118deg, transparent 0 74%, rgba(22,216,255,.035) 74.1% 74.6%, transparent 74.7%);
    }
    .culture-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: .82fr 1.18fr;
      gap: clamp(48px, 8vw, 110px);
      align-items: start;
    }
    .culture-heading h2 {
      max-width: 560px;
    }
    .culture-lock {
      margin: 34px 0 0;
      color: #8996a8;
      font-family: var(--display);
      font-size: clamp(1.05rem, 2vw, 1.45rem);
      line-height: 1.35;
      font-weight: 800;
      letter-spacing: .055em;
    }
    .culture-lock strong {
      color: #f5f8fc;
    }
    .culture-intro {
      margin: 0 0 34px;
      max-width: 720px;
      color: #b6c0ce;
      font-size: clamp(1.05rem, 1.8vw, 1.24rem);
      line-height: 1.7;
    }
    .culture-accordion {
      border-top: 2px solid rgba(22,216,255,.72);
      box-shadow: 0 22px 70px rgba(0,0,0,.18);
    }
    .culture-item {
      border-bottom: 1px solid rgba(144,176,220,.20);
      background: rgba(8,12,18,.58);
    }
    .culture-item summary {
      position: relative;
      cursor: pointer;
      list-style: none;
      padding: 22px 64px 22px 22px;
      color: #f4f7fb;
      font-family: var(--display);
      font-size: clamp(1.55rem, 3vw, 2.35rem);
      line-height: 1;
      font-weight: 900;
      font-style: italic;
      letter-spacing: .025em;
      transition: background .18s ease, color .18s ease;
    }
    .culture-item summary::-webkit-details-marker { display: none; }
    .culture-item summary::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      bottom: 20%;
      width: 4px;
      background: linear-gradient(180deg, var(--cyan), var(--blue));
      transform: skewX(-16deg);
    }
    .culture-item summary::after {
      content: '+';
      position: absolute;
      right: 22px;
      top: 50%;
      transform: translateY(-52%);
      color: var(--cyan);
      font-family: var(--mono);
      font-size: 1.55rem;
      font-style: normal;
      font-weight: 400;
    }
    .culture-item[open] summary {
      color: #fff;
      background: rgba(18,108,255,.08);
    }
    .culture-item[open] summary::after { content: '−'; }
    .culture-item-faith summary::before {
      background: linear-gradient(180deg, var(--red), #ff5660);
    }
    .culture-item-faith summary::after { color: #ff4650; }
    .culture-answer {
      padding: 0 30px 26px 22px;
      color: #9eabbc;
      font-size: .98rem;
      line-height: 1.72;
    }
    .culture-answer p {
      margin: 0 0 13px;
      max-width: 760px;
    }
    .culture-answer p:last-child { margin-bottom: 0; }
    .culture-answer strong { color: #e8edf4; }
    .culture-rule {
      margin-top: 22px !important;
      padding: 17px 18px;
      border-left: 3px solid var(--cyan);
      background: rgba(18,108,255,.08);
      color: #eaf2ff;
      font-family: var(--display);
      font-size: clamp(1.05rem, 2vw, 1.35rem);
      font-weight: 900;
      font-style: italic;
      letter-spacing: .035em;
      line-height: 1.35;
    }
    .culture-youth-note {
      margin-top: 20px !important;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,.10);
      color: #77869a;
      font-size: .84rem;
    }
    @media (max-width: 860px) {
      .culture-grid {
        grid-template-columns: 1fr;
        gap: 38px;
      }
      .culture-lock { margin-top: 24px; }
    }
    @media (max-width: 560px) {
      .culture-item summary {
        padding: 19px 54px 19px 18px;
      }
      .culture-item summary::after { right: 17px; }
      .culture-answer { padding: 0 20px 22px 18px; }
    }
  `;
  document.head.append(style);
}

installCultureSection();
