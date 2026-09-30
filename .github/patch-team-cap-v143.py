from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


def replace_block(text, pattern, replacement, label):
    next_text, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 block, found {count}')
    return next_text


# Admin editor: capacity is a number of 4v4 teams, not individual players.
path = Path('home-open-rank-admin-edit.js')
text = path.read_text()
text = replace_once(
    text,
    "return /^\\s*ENDS\\s+.+?\\s*·\\s*\\d{1,3}\\s+PLAYER\\s+CAP\\s*$/i.test(String(update.body || ''));",
    "return /^\\s*ENDS\\s+.+?\\s*·\\s*\\d{1,3}\\s+(?:TEAM|PLAYER)\\s+CAP\\s*$/i.test(String(update.body || ''));",
    'editor override matcher',
)
text = replace_block(
    text,
    r"  function parseCapacity\(update\) \{.*?\n  \}\n\n  function parseEndLabel",
    """  function parseCapacity(update) {
    const body = String(update?.body || '');
    const teamCap = Number(body.match(/\\b(\\d{1,2})\\s+TEAM\\s+CAP\\b/i)?.[1]);
    if (Number.isFinite(teamCap) && teamCap > 0) return Math.min(4, Math.round(teamCap));

    // Legacy Home schedules stored individual player capacity. For current 4v4,
    // translate 16 PLAYER CAP into 4 TEAM CAP.
    const playerCap = Number(body.match(/\\b(\\d{1,3})\\s+PLAYER\\s+CAP\\b/i)?.[1]);
    if (Number.isFinite(playerCap) && playerCap > 0) return Math.min(4, Math.ceil(playerCap / 4));

    const metadata = update?.metadata || {};
    const direct = Number(metadata.capacity ?? update?.capacity);
    if (Number.isFinite(direct) && direct > 0) return Math.min(4, Math.round(direct));
    return 4;
  }

  function parseEndLabel""",
    'editor parseCapacity',
)
text = replace_once(
    text,
    '<label>Player cap<input name="capacity" type="number" min="1" max="500" inputmode="numeric" required></label>',
    '<label>Team cap<input name="capacity" type="number" min="1" max="4" inputmode="numeric" required></label>',
    'Team cap label',
)
text = replace_once(
    text,
    "if (!Number.isFinite(capacity) || capacity < 1 || capacity > 500) return editorStatus('Player cap must be between 1 and 500.', true);",
    "if (!Number.isFinite(capacity) || capacity < 1 || capacity > 4) return editorStatus('Team cap must be between 1 and 4.', true);",
    'Team cap validation',
)
text = replace_once(
    text,
    'body: `ENDS ${formatEndTimeFrom24(endsAt)} · ${Math.round(capacity)} PLAYER CAP`,',
    'body: `ENDS ${formatEndTimeFrom24(endsAt)} · ${Math.round(capacity)} TEAM CAP`,',
    'Team cap saved body',
)
path.write_text(text)


# Home authority: show team slots and count only fully secured 4/4 teams.
path = Path('simple-navigation-state-authority.js')
text = path.read_text()
text = replace_once(
    text,
    "  const CURRENT_RANKING_ACCESS_URL = `${API_BASE_URL}/api/real-play/career/access`;\n  const PUBLIC_RANKING_ACCESS_URL = `${API_BASE_URL}/api/real-play/public/career/access`;",
    "  const PUBLIC_4V4_AVAILABILITY_URL = `${API_BASE_URL}/api/real-play/4v4/public`;",
    '4v4 public availability constant',
)
if text.count('configuredHomeCapacity = 16') != 2:
    raise SystemExit(f'configured capacity: expected 2 legacy values, found {text.count("configuredHomeCapacity = 16")}')
text = text.replace('configuredHomeCapacity = 16', 'configuredHomeCapacity = 4')
text = replace_block(
    text,
    r"  function isHomeScheduleOverride\(update\) \{.*?\n  \}\n\n  function homeRoot",
    """  function isHomeScheduleOverride(update) {
    if (!update || update.category !== 'schedule') return false;
    if (update.source_key || update.sourceKey) return false;
    return /^\\s*ENDS\\s+.+?\\s*·\\s*\\d{1,3}\\s+(?:TEAM|PLAYER)\\s+CAP\\s*$/i.test(String(update.body || ''));
  }

  function homeRoot""",
    'Home schedule override classifier',
)
text = replace_once(
    text,
    '<span class="rp-home-spots-left" data-rp-home-open-rank-capacity>16 PLAYER CAP</span>',
    '<span class="rp-home-spots-left" data-rp-home-open-rank-capacity>4 TEAM CAP</span>',
    'default team-cap badge',
)
text = replace_block(
    text,
    r"  function parseOpenRankCapacity\(update\) \{.*?\n  \}\n\n  function renderConfiguredOpenRankCapacity",
    """  function parseOpenRankCapacity(update) {
    const body = String(update?.body || '');
    const teamCap = Number(body.match(/\\b(\\d{1,2})\\s+TEAM\\s+CAP\\b/i)?.[1]);
    if (Number.isFinite(teamCap) && teamCap > 0) return Math.min(4, Math.round(teamCap));

    const legacyPlayerCap = Number(body.match(/\\b(\\d{1,3})\\s+PLAYER\\s+CAP\\b/i)?.[1]);
    if (Number.isFinite(legacyPlayerCap) && legacyPlayerCap > 0) return Math.min(4, Math.ceil(legacyPlayerCap / 4));

    const metadata = update?.metadata || {};
    const directCap = Number(metadata.capacity ?? update?.capacity);
    if (Number.isFinite(directCap) && directCap > 0) return Math.min(4, Math.round(directCap));
    return 4;
  }

  function renderConfiguredOpenRankCapacity""",
    'Home team-cap parser',
)
text = replace_once(
    text,
    'const nextText = `${configuredHomeCapacity} PLAYER CAP`;',
    'const nextText = `${configuredHomeCapacity} TEAM CAP`;',
    'configured team-cap badge',
)
text = replace_block(
    text,
    r"  function renderOpenRankAvailability\(state\) \{.*?\n  async function refreshOpenRankAvailability\(\) \{.*?\n  \}\n\n  function renderOpenRank\(update\) \{",
    """  function renderOpenRankAvailability(state) {
    const node = homeRoot()?.querySelector('[data-rp-home-open-rank-capacity]');
    if (!node || !state || typeof state !== 'object') return false;

    const teamStates = Array.isArray(state.teamStates) ? state.teamStates : [];
    if (!teamStates.length) return false;

    const teamCap = Math.max(1, Math.min(4, Math.trunc(Number(configuredHomeCapacity) || 4)));
    const occupiedTeams = Math.min(
      teamCap,
      teamStates.filter((team) => String(team?.status || '').toLowerCase() === 'secured').length,
    );
    const teamsLeft = Math.max(0, teamCap - occupiedTeams);
    const nextText = teamsLeft === 0
      ? 'FULL'
      : `${teamsLeft} ${teamsLeft === 1 ? 'TEAM' : 'TEAMS'} LEFT`;

    hasOpenRankAvailability = true;
    if (node.textContent !== nextText) node.textContent = nextText;
    return true;
  }

  async function refreshOpenRankAvailability() {
    const requestId = ++availabilityRequestId;
    const node = homeRoot()?.querySelector('[data-rp-home-open-rank-capacity]');
    if (!node) return;

    try {
      const response = await fetch(PUBLIC_4V4_AVAILABILITY_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (requestId !== availabilityRequestId) return;
      if (!response.ok) throw new Error(`Could not load current 4v4 team availability (${response.status}).`);

      const data = await response.json().catch(() => ({}));
      if (requestId !== availabilityRequestId) return;
      if (!renderOpenRankAvailability(data)) {
        hasOpenRankAvailability = false;
        renderConfiguredOpenRankCapacity({ force: true });
      }
    } catch (_error) {
      if (requestId === availabilityRequestId && !hasOpenRankAvailability) {
        renderConfiguredOpenRankCapacity({ force: true });
      }
    }
  }

  function renderOpenRank(update) {""",
    'Home team availability renderer',
)
path.write_text(text)


# Boot readiness must watch the same request Home now makes.
path = Path('public-first-entry.js')
text = path.read_text()
text = replace_once(
    text,
    "const HOME_RANKING_ACCESS_PATH = '/api/real-play/career/access';",
    "const HOME_RANKING_ACCESS_PATH = '/api/real-play/4v4/public';",
    'Home readiness availability path',
)
text = replace_once(
    text,
    'home-open-rank-admin-edit.js?v=20260930-home-card-editable-title-v142',
    'home-open-rank-admin-edit.js?v=20260930-team-cap-home-availability-v143',
    'Home editor cache version',
)
path.write_text(text)

path = Path('index.html')
text = path.read_text()
text = replace_once(
    text,
    'data-rp-deploy="20260930-home-card-editable-title-v142"',
    'data-rp-deploy="20260930-team-cap-home-availability-v143"',
    'deploy id',
)
path.write_text(text)
