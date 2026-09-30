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

  function normalizeClock(value) {
    const clock = String(value || '').trim();
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock) ? clock : '';
  }

  function eventClockInManila(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date);
      const hour = parts.find((part) => part.type === 'hour')?.value;
      const minute = parts.find((part) => part.type === 'minute')?.value;
      return normalizeClock(`${hour}:${minute}`);
    } catch (_error) {
      return '';
    }
  }

  function parseTwelveHourClock(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return '';
    const period = match[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function recoveredTeamSchedule(update) {
    const start = eventClockInManila(update?.event_at || update?.eventAt);
    const endLabel = String(update?.body || '').match(/\bENDS\s+(.+?)(?:\s*·|$)/i)?.[1] || '';
    const end = parseTwelveHourClock(endLabel);

    if (!start || !end || start === end) {
      return { version: 1, mode: 'open', blocks: [] };
    }

    return {
      version: 1,
      mode: 'assigned',
      recoveredLegacy: true,
      blocks: [{
        start,
        end,
        teamKeys: [],
        teamNames: [],
        recoveredLegacy: true,
      }],
    };
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
          // Older Home schedules were published before teamSchedule metadata existed.
          // Recover the session's real start/end as one visible admin time block so
          // the editor and player picker describe the same active court window.
          teamSchedule: recoveredTeamSchedule(update),
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