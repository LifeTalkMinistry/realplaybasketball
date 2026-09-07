(() => {
  if (window.__realPlayReplayMarkerCleanupInstalled) return;
  window.__realPlayReplayMarkerCleanupInstalled = true;

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function cleanMarker(marker) {
    if (!marker) return;
    const timestamp = marker.querySelector('small');
    if (!timestamp) return;
    timestamp.textContent = formatTime(Number(marker.dataset.rpCareerReplayMarker || 0));
  }

  function cleanMarkers(root = document) {
    root.querySelectorAll?.('[data-rp-career-replay-marker]').forEach(cleanMarker);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('[data-rp-career-replay-marker]')) cleanMarker(node);
        cleanMarkers(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cleanMarkers(), { once: true });
  } else {
    cleanMarkers();
  }
})();
