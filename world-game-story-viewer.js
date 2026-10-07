(() => {
  const load = (src) => new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  load('world-game-story-viewer-core-v12.js?v=20261007-player-art-frame-v12')
    .then(() => load('world-game-story-editor.js?v=20261007-story-view-editor-navlock-v3'))
    .catch((error) => console.error('[Real Play] Game story viewer failed to load.', error));
})();
