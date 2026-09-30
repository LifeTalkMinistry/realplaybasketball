(() => {
  if (window.__realPlayFourVFourLegacyScheduleFallbackInstalled) return;
  window.__realPlayFourVFourLegacyScheduleFallbackInstalled = true;

  const PUBLIC_UPDATES_URL = 'https://api.clarapmc.com/api/real-play/public/updates';
  const previousFetch = window.fetch.bind(window);

  function requestUrl(input) {
    return typeof input === 'string' ? input : String(input?.url || '');
  }

  function requestMethod(input, init = {}) {
    return String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
  }

  function hasTeamSchedule(update) {
    const metadata = update?.metadata;
    return Boolean(metadata && typeof metadata === 'object' && (metadata.teamSchedule || metadata.team_schedule));
  }

  function isLegacyHomeSchedule(update) {
    if (!update || String(update.category || '').toLowerCase() !== 'schedule') return false;
    if (update.source_key || update.sourceKey) return false;
    return /^\s*ENDS\s+.+?\s*·\s*\d{1,3}\s+(?:TEAM|PLAYER)\s+CAP\s*$/i.test(String(update.body || ''));
  }

  function backfillTeamSchedule(data) {
    if (!data || !Array.isArray(data.updates)) return data;
    let changed = false;
    const updates = data.updates.map((update) => {
      if (!isLegacyHomeSchedule(update) || hasTeamSchedule(update)) return update;
      changed = true;
      return {
        ...update,
        metadata: {
          ...(update?.metadata && typeof update.metadata === 'object' ? update.metadata : {}),
          // Older Home schedules were published before time-block metadata existed.
          // Treat that schedule's own start/end as one open slot so players can
          // immediately see the current court window instead of an empty picker.
          teamSchedule: { version: 1, mode: 'open', blocks: [] },
        },
      };
    });
    return changed ? { ...data, updates } : data;
  }

  window.fetch = async function realPlayLegacyHomeScheduleFetch(input, init = {}) {
    const response = await previousFetch(input, init);
    try {
      if (requestMethod(input, init) !== 'GET' || requestUrl(input) !== PUBLIC_UPDATES_URL || !response.ok) {
        return response;
      }

      const data = await response.clone().json();
      const patched = backfillTeamSchedule(data);
      if (patched === data) return response;

      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.delete('Content-Length');
      headers.delete('Content-Encoding');
      headers.delete('Transfer-Encoding');
      return new Response(JSON.stringify(patched), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (_error) {
      return response;
    }
  };
})();