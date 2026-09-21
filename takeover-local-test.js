(() => {
  if (window.__realPlayTakeoverLocalTestInstalled) return;
  window.__realPlayTakeoverLocalTestInstalled = true;

  const DB_NAME = 'real_play_takeover_local_test_v1';
  const STORE_NAME = 'drafts';
  const RECORD_KEY = 'next-launch';
  const PENDING_KEY = 'real_play_takeover_local_test_pending';

  function clean(value, max = 500) {
    return String(value ?? '').trim().slice(0, max);
  }

  function setStatus(message, kind = '') {
    const node = document.querySelector('[data-rp-takeover-status]');
    if (!node) return;
    node.textContent = message || '';
    node.className = `rp-takeover-status${kind ? ` ${kind}` : ''}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('This browser cannot store a local takeover test.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open local test storage.'));
    });
  }

  async function writeRecord(record) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Unable to save local takeover test.'));
        tx.onabort = () => reject(tx.error || new Error('Unable to save local takeover test.'));
      });
    } finally {
      db.close();
    }
  }

  async function takeRecord() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(RECORD_KEY);
        let value = null;
        request.onsuccess = () => {
          value = request.result || null;
          store.delete(RECORD_KEY);
        };
        request.onerror = () => reject(request.error || new Error('Unable to read local takeover test.'));
        tx.oncomplete = () => resolve(value);
        tx.onerror = () => reject(tx.error || new Error('Unable to read local takeover test.'));
        tx.onabort = () => reject(tx.error || new Error('Unable to read local takeover test.'));
      });
    } finally {
      db.close();
    }
  }

  function draftFromAdmin() {
    const admin = document.querySelector('[data-rp-takeover-admin]');
    if (!admin) return null;

    const file = admin.querySelector('[data-rp-takeover-file]')?.files?.[0] || null;
    const mediaUrl = clean(admin.querySelector('[data-rp-takeover-url]')?.value, 1600);
    const selectedType = clean(admin.querySelector('[data-rp-takeover-type]')?.value, 20).toLowerCase();
    const fit = clean(admin.querySelector('[data-rp-takeover-fit]')?.value, 20).toLowerCase() === 'cover' ? 'cover' : 'contain';
    const campaignId = clean(admin.querySelector('[data-rp-takeover-id]')?.value, 160) || `local-test-${Date.now()}`;

    return {
      campaignId,
      active: true,
      mediaType: file?.type?.startsWith('video/') || (!file && selectedType === 'video') ? 'video' : 'image',
      mediaUrl,
      file: file || null,
      fit,
      label: clean(admin.querySelector('[data-rp-takeover-label-input]')?.value, 60),
      alt: clean(admin.querySelector('[data-rp-takeover-alt]')?.value, 180) || 'Real Play announcement',
      loop: Boolean(admin.querySelector('[data-rp-takeover-loop]')?.checked),
    };
  }

  async function queueNextLaunchTest() {
    const draft = draftFromAdmin();
    if (!draft || (!draft.file && !draft.mediaUrl)) {
      setStatus('Choose a photo/video or paste a media URL first.', 'error');
      return;
    }

    setStatus('Preparing a local app-open test…');
    try {
      await writeRecord({
        campaignId: draft.campaignId,
        active: true,
        mediaType: draft.mediaType,
        mediaUrl: draft.file ? '' : draft.mediaUrl,
        blob: draft.file || null,
        fit: draft.fit,
        label: draft.label,
        alt: draft.alt,
        loop: draft.loop,
        createdAt: Date.now(),
      });
      localStorage.setItem(PENDING_KEY, '1');
      setStatus('Ready. Reloading so you can experience it exactly like an app-open takeover.', 'ok');
      window.setTimeout(() => window.location.reload(), 220);
    } catch (error) {
      setStatus(error?.message || 'Unable to prepare the local takeover test.', 'error');
    }
  }

  function installButton() {
    const actions = document.querySelector('[data-rp-takeover-admin] .rp-takeover-actions');
    if (!actions || actions.querySelector('[data-rp-takeover-test-launch]')) return Boolean(actions);

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rpTakeoverTestLaunch = 'true';
    button.textContent = 'TEST ON NEXT APP OPEN';
    button.style.gridColumn = '1 / -1';
    button.style.background = '#111a29';
    button.style.color = '#ffffff';
    button.style.borderColor = 'rgba(66,216,255,.38)';
    button.addEventListener('click', queueNextLaunchTest);

    const publish = actions.querySelector('.rp-takeover-publish-btn');
    if (publish) actions.insertBefore(button, publish);
    else actions.appendChild(button);
    return true;
  }

  async function waitForTakeoverApi(timeoutMs = 6000) {
    const started = Date.now();
    while (!window.RealPlayTakeover?.preview && Date.now() - started < timeoutMs) {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    }
    return window.RealPlayTakeover || null;
  }

  async function runPendingLaunchTest() {
    if (localStorage.getItem(PENDING_KEY) !== '1') return;
    localStorage.removeItem(PENDING_KEY);

    try {
      const record = await takeRecord();
      if (!record) return;
      const takeoverApi = await waitForTakeoverApi();
      if (!takeoverApi?.preview) return;

      let objectUrl = '';
      const mediaUrl = record.blob ? (objectUrl = URL.createObjectURL(record.blob)) : clean(record.mediaUrl, 1600);
      if (!mediaUrl) return;

      const shown = takeoverApi.preview({
        campaignId: record.campaignId || `local-test-${Date.now()}`,
        active: true,
        mediaType: record.mediaType === 'video' ? 'video' : 'image',
        mediaUrl,
        fit: record.fit === 'cover' ? 'cover' : 'contain',
        label: record.label || '',
        alt: record.alt || 'Real Play announcement',
        loop: record.loop !== false,
      });

      if (shown && objectUrl) {
        window.addEventListener('beforeunload', () => {
          try { URL.revokeObjectURL(objectUrl); } catch (_error) {}
        }, { once: true });
        window.setTimeout(() => {
          try { URL.revokeObjectURL(objectUrl); } catch (_error) {}
        }, 30 * 60 * 1000);
      }
    } catch (error) {
      console.warn('[Real Play] Local takeover launch test could not run.', error);
    }
  }

  const observer = new MutationObserver(() => installButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  [0, 250, 700, 1500, 2600].forEach((delay) => window.setTimeout(installButton, delay));
  window.setTimeout(() => observer.disconnect(), 5000);

  const start = () => window.setTimeout(runPendingLaunchTest, 120);
  if (document.documentElement.classList.contains('rp-shell-ready')) start();
  else window.addEventListener('realplay:app-ready', start, { once: true });
})();
