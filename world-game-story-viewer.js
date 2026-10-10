(() => {
  const load = (src) => new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  load('world-game-story-viewer-core-v12.js?v=20261010-unified-small-headlines-v19')
    .then(() => load('world-game-story-editor.js?v=20261007-story-view-backend-v4'))
    .catch((error) => console.error('[Real Play] Game story viewer failed to load.', error));
})();
