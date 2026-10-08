const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../career-game-replay-stats.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../career-game-replay-stats.css'), 'utf8');

function section(start, end) {
  const first = script.indexOf(start);
  const last = script.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing code section: ${start}`);
  return script.slice(first, last);
}

const ui = vm.runInNewContext(
  [
    section('function isDnp(', 'function formatTime('),
    section('function playerKey(', 'function shotSummary('),
    section('function statIdentityHtml(', 'function statHeaderRow('),
    section('function teamBlock(', 'function setActiveTeam('),
    '({ isDnp, statIdentityHtml, statRow, teamBlock })',
  ].join('\n'),
  {
    esc: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    recognitionBadgesHtml: () => '',
    playerLabel: (player) => player.playerName,
    normalizeName: (value) => String(value || '').trim().toLowerCase().replace(/\\s+/g, ' '),
    num: (value) => Number(value || 0),
    statHeaderRow: () => '<div class="test-heading"></div>',
  }
);

test('WEST and EAST list played players before explicitly marked DNP', () => {
  const players = [
    { team: 'west', playerName: 'West DNP', didNotPlay: true },
    { team: 'west', playerName: 'West Zero', pts: 0, ast: 0, reb: 0 },
    { team: 'east', playerName: 'East DNP', didNotPlay: true },
    { team: 'east', playerName: 'East Zero', pts: 0, ast: 0, reb: 0 },
  ];
  for (const [team, playedIndex, dnpIndex] of [['west', 1, 0], ['east', 3, 2]]) {
    const markup = ui.teamBlock(team, players);
    assert.ok(markup.indexOf(`data-rp-career-stat-player="${playedIndex}"`) <
      markup.indexOf(`data-rp-career-stat-player="${dnpIndex}"`));
    assert.match(markup, /rp-career-replay-stat-dnp-start/);
  }
});

test('zero stats remain numeric for active players and become dashes only for DNP', () => {
  const active = ui.statRow({ playerName: 'Played', pts: 0, ast: 0, reb: 0 }, 1);
  const dnp = ui.statRow({ playerName: 'Out', didNotPlay: true, pts: 0, ast: 0, reb: 0 }, 0, true);
  assert.equal((active.match(/<b>0<\/b>/g) || []).length, 7);
  assert.equal((dnp.match(/<b>—<\/b>/g) || []).length, 7);
  assert.match(dnp, /rp-career-replay-stat-dnp-badge/);
  assert.doesNotMatch(active, /rp-career-replay-stat-dnp-badge/);
  assert.match(css, /\.rp-career-replay-stat-dnp-start::before/);
});

test('DNP detection uses explicit participation, never zero stats', () => {
  assert.equal(ui.isDnp({ pts: 0, ast: 0, reb: 0 }), false);
  assert.equal(ui.isDnp({ didNotPlay: true }), true);
  assert.equal(ui.isDnp({ didNotPlay: false, pts: 0 }), false);
  assert.equal(ui.isDnp({ participationStatus: 'DNP' }), true);
  assert.match(script, /!isDnp\(player\) && \['west', 'east'\]/);
  assert.match(script, /if \(isDnp\(player\)\) \{/);
});

const resultsSource = fs.readFileSync(path.join(__dirname, '../world-results.js'), 'utf8');
const recapSource = fs.readFileSync(path.join(__dirname, '../admin-game-recap-recognitions.js'), 'utf8');

function extractFrom(file, start, end) {
  const first = file.indexOf(start);
  const last = file.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing source section: ${start}`);
  return file.slice(first, last);
}

const worldMvp = vm.runInNewContext(
  extractFrom(resultsSource, 'function normalizeReplayMvp(', 'async function loadReplayTeamMvps(')
    + '\n({ deriveReplayTeamMvps, replayMvpImpact })'
);

test('Game Results fallback never recognizes DNP, even above a low-impact active player', () => {
  const mvps = worldMvp.deriveReplayTeamMvps([
    { playerId: 31, playerName: 'DNP Player', team: 'west', didNotPlay: true, points: 9 },
    { playerId: 32, playerName: 'Played Player', team: 'west', missedShots: 8, turnovers: 3 },
    { playerId: 33, playerName: 'DNP Alias', team: 'east', participationStatus: 'DNP', points: 5 },
  ]);
  assert.equal(mvps.west.playerName, 'Played Player');
  assert.equal(mvps.east, null);
});

test('Game Results fallback resolves identical-name exact ties independent of row order', () => {
  const alpha = { playerId: 18, playerName: 'SAME NAME', team: 'west', points: 2 };
  const beta = { playerId: 37, playerName: 'SAME NAME', team: 'west', points: 2 };
  const first = worldMvp.deriveReplayTeamMvps([alpha, beta]).west;
  const second = worldMvp.deriveReplayTeamMvps([beta, alpha]).west;
  assert.equal(first.identityKey, second.identityKey);
  assert.equal(first.identityKey, 'user:18');
});

test('MVP bug fixes preserve the existing Jack and Jaff Impact totals', () => {
  const jack = worldMvp.replayMvpImpact({ points: 3, rebounds: 6, missedShots: 6 });
  const jaff = worldMvp.replayMvpImpact({
    points: 6, rebounds: 4, steals: 2, turnovers: 2, missedShots: 11,
  });
  assert.equal(Math.round(jack * 10) / 10, 7.2);
  assert.equal(Math.round(jaff * 10) / 10, 6.3);
});

test('Admin awards exclude explicit DNP and official replay owns the MVP crown', () => {
  assert.match(recapSource, /eligible = players\.filter\(\(player\) => !player\.didNotPlay\)/);
  assert.match(recapSource, /rp-recap-dnp-player/);
  assert.match(script, /overall && !window\.__realPlayReplayOfficialMvpInstalled/);
});

test('Official replay MVP badge resolves duplicate teammates using identity before name', () => {
  const src = fs.readFileSync(path.join(__dirname, '../career-game-replay-official-mvp.js'), 'utf8');
  const source = extractFrom(src, 'function canonicalPlayerKey(', 'async function loadOfficialGameMvp(')
    + '\n' + extractFrom(src, 'function findOfficialMvpRow(', 'function renderOfficialBadge(')
    + '\n({ findOfficialMvpRow })';
  const { findOfficialMvpRow } = vm.runInNewContext(source, {
    normalizeName: (v) => String(v || '').trim().toLowerCase(),
  });
  const row = (key) => ({
    dataset: { rpCareerStatIdentity: key },
    querySelector: () => ({ textContent: 'Same Name' }),
    closest: () => ({ dataset: { rpCareerStatPanel: 'west' } }),
  });
  const wrong = row('id:10');
  const right = row('id:20');
  const root = { querySelectorAll: () => [wrong, right] };
  assert.equal(findOfficialMvpRow(root, { identityKey: 'user:20', playerName: 'Same Name', team: 'west' }), right);
  assert.equal(findOfficialMvpRow(root, { playerName: 'Same Name', team: 'west' }), null);
  assert.match(script, /data-rp-career-stat-identity/);
});
