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
