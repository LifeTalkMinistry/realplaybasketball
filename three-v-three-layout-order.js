(() => {
  function mount() {
    const view = document.querySelector('.rp-3v3-view');
    const shell = view?.querySelector('.rp-3v3-shell');
    const session = shell?.querySelector('[data-rp-3v3-session]');
    if (!shell || !session) return false;

    let format = shell.querySelector('[data-rp-3v3-format]');
    if (!format) {
      format = document.createElement('div');
      format.className = 'rp-3v3-format rp-3v3-league-format';
      format.setAttribute('data-rp-3v3-format', '');
      format.innerHTML = `
        <div>
          <small>LEAGUE FORMAT</small>
          <strong>4 CLUBS · 2 SEMIFINALS · 1 FINAL</strong>
        </div>
        <b>RACE TO 8</b>
      `;
    }

    if (session.nextElementSibling !== format) {
      session.insertAdjacentElement('afterend', format);
    }

    return true;
  }

  if (mount()) return;

  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
