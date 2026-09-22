(() => {
  if (window.__realPlayTakeoverLocalTestInstalled) return;
  window.__realPlayTakeoverLocalTestInstalled = true;

  const DB_NAME = 'real_play_takeover_local_test_v1';
  const STORE_NAME = 'drafts';
  const RECORD_KEY = 'next-launch';
  const PENDING_KEY = 'real_play_takeover_local_test_pending';
  const API_BASE_URL = 'https://api.clarapmc.com';
  const ADMIN_ENDPOINT = `${API_BASE_URL}/api/real-play/admin/takeover`;
  const TOKEN_KEY = 'real_play_access_token';

  let adminSyncInstalled = false;
  let adminClassObserver = null;
  let statusObserver = null;
  let adminRefreshTimer = 0;

  function clean(value, max = 500) {
    return String(value ?? '').trim().slice(0, max);
  }

  function setStatus(message, kind = '') {
    const node = document.querySelector('[data-rp-takeover-status]');
    if (!node) return;
    node.textContent = message || '';
    node.className = `rp-takeover-status${kind ? ` ${kind}` : ''}`;
  }

  function normalizeServerTakeover(payload) {
    const source = payload?.takeover ?? payload?.announcement ?? payload?.data ?? payload ?? {};
    return {
      campaignId: clean(source.campaignId ?? source.campaign_id ?? source.version ?? source.id, 160),
      active: source.active === true || String(source.active ?? '').toLowerCase() === 'true',
      mediaType: clean(source.mediaType ?? source.media_type ?? source.type, 20).toLowerCase() === 'video' ? 'video' : 'image',
      mediaUrl: clean(source.mediaUrl ?? source.media_url ?? source.url, 1600),
      fit: clean(source.fit ?? source.objectFit, 20).toLowerCase() === 'cover' ? 'cover' : 'contain',
      label: clean(source.label ?? source.kicker, 60),
      alt: clean(source.alt ?? source.description, 180) || 'Real Play announcement',
      loop: source.loop !== false && String(source.loop ?? 'true').toLowerCase() !== 'false',
    };
  }

  function renderSavedTakeover(itemInput) {
    const admin = document.querySelector('[data-rp-takeover-admin]');
    if (!admin) return false;
    const item = normalizeServerTakeover(itemInput);
    if (!item.campaignId && !item.mediaUrl) return false;

    const idInput = admin.querySelector('[data-rp-takeover-id]');
    const typeInput = admin.querySelector('[data-rp-takeover-type]');
    const fitInput = admin.querySelector('[data-rp-takeover-fit]');
    const fileInput = admin.querySelector('[data-rp-takeover-file]');
    const urlInput = admin.querySelector('[data-rp-takeover-url]');
    const labelInput = admin.querySelector('[data-rp-takeover-label-input]');
    const altInput = admin.querySelector('[data-rp-takeover-alt]');
    const activeInput = admin.querySelector('[data-rp-takeover-active]');
    const loopInput = admin.querySelector('[data-rp-takeover-loop]');
    const previewBox = admin.querySelector('[data-rp-takeover-preview-box]');

    if (idInput) idInput.value = item.campaignId || '';
    if (typeInput) typeInput.value = item.mediaType;
    if (fitInput) fitInput.value = item.fit;
    if (urlInput) urlInput.value = item.mediaUrl || '';
    if (labelInput) labelInput.value = item.label || '';
    if (altInput) altInput.value = item.alt === 'Real Play announcement' ? '' : item.alt;
    if (activeInput) activeInput.checked = item.active;
    if (loopInput) loopInput.checked = item.loop;

    // Browsers intentionally do not allow repopulating a file input after navigation.
    // The authoritative saved media is restored through its backend media URL instead.
    if (fileInput) fileInput.value = '';

    if (previewBox) {
      previewBox.innerHTML = '';
      if (!item.mediaUrl) {
        previewBox.innerHTML = '<div class="rp-takeover-preview-empty">NO SAVED MEDIA</div>';
      } else {
        const node = document.createElement(item.mediaType === 'video' ? 'video' : 'img');
        node.src = item.mediaUrl;
        node.style.objectFit = item.fit;
        if (item.mediaType === 'video') {
          node.muted = true;
          node.playsInline = true;
          node.loop = item.loop;
          node.autoplay = true;
          node.addEventListener('canplay', () => node.play().catch(() => {}), { once: true });
        } else {
          node.alt = item.alt;
        }
        node.addEventListener('error', () => {
          previewBox.innerHTML = '<div class="rp-takeover-preview-empty">SAVED MEDIA COULD NOT BE LOADED</div>';
        }, { once: true });
        previewBox.appendChild(node);
      }
    }

    return true;
  }

  async function loadSavedAdminTakeover({ quiet = false } = {}) {
    const admin = document.querySelector('[data-rp-takeover-admin]');
    if (!admin?.classList.contains('open')) return false;
    const token = window.localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return false;

    try {
      const response = await fetch(ADMIN_ENDPOINT, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({}));
      const restored = renderSavedTakeover(data);
      if (restored && !quiet) setStatus('Saved takeover loaded from server.', 'ok');
      return restored;
    } catch (_error) {
      return false;
    }
  }

  function queueAdminRefresh() {
    if (adminRefreshTimer) window.clearTimeout(adminRefreshTimer);
    adminRefreshTimer = window.setTimeout(() => {
      loadSavedAdminTakeover().catch(() => {});
    }, 180);
  }

  function installAdminPersistenceSync() {
    if (adminSyncInstalled) return true;
    const admin = document.querySelector('[data-rp-takeover-admin]');
    if (!admin) return false;
    adminSyncInstalled = true;

    adminClassObserver = new MutationObserver(() => {
      if (!admin.classList.contains('open')) return;
      queueAdminRefresh();
      window.setTimeout(() => loadSavedAdminTakeover({ quiet: true }), 550);
    });
    adminClassObserver.observe(admin, { attributes: true, attributeFilter: ['class'] });

    const status = admin.querySelector('[data-rp-takeover-status]');
    if (status) {
      statusObserver = new MutationObserver(() => {
        const text = clean(status.textContent, 240);
        if (text === 'Current takeover loaded.' || text.startsWith('No backend takeover endpoint')) {
          loadSavedAdminTakeover().catch(() => {});
          return;
        }

        if (text === 'Takeover published. A new campaign/version will show again to everyone.') {
          const active = Boolean(admin.querySelector('[data-rp-takeover-active]')?.checked);
          if (!active) {
            setStatus('Saved, but inactive. Turn on Active and publish again to show it on app open.', 'error');
            return;
          }

          const campaignId = clean(admin.querySelector('[data-rp-takeover-id]')?.value, 160);
          if (campaignId) {
            try { window.localStorage.removeItem(`real_play_takeover_seen:${campaignId}`); } catch (_error) {}
          }
          setStatus('Takeover published and active. It will show on the next app open.', 'ok');
        }
      });
      statusObserver.observe(status, { childList: true, characterData: true, subtree: true });
    }

    if (admin.classList.contains('open')) queueAdminRefresh();
    return true;
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
        request.onerror = () => reject(request.error || new Error('Unable to read local test storage.'));
        tx.oncomplete = () => resolve(value);
        tx.onerror = () => reject(tx.error || new Error('Unable to read local test storage.'));
        tx.onabort = () => reject(tx.error || new Error('Unable to read local test storage.'));
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
    installAdminPersistenceSync();
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

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-rp-settings-action="takeover"]')) return;
    window.setTimeout(queueAdminRefresh, 120);
  }, true);

  const observer = new MutationObserver(() => installButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  [0, 250, 700, 1500, 2600].forEach((delay) => window.setTimeout(installButton, delay));
  window.setTimeout(() => observer.disconnect(), 5000);

  const start = () => window.setTimeout(runPendingLaunchTest, 120);
  if (document.documentElement.classList.contains('rp-shell-ready')) start();
  else window.addEventListener('realplay:app-ready', start, { once: true });
})();
