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
    section('function statIdentityHtml(', 'function statHeaderRow('),
    section('function teamBlock(', 'function setActiveTeam('),
    '({ isDnp, statIdentityHtml, statRow, teamBlock })',
  ].join('\n'),
  {
    esc: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    recognitionBadgesHtml: () => '',
    playerLabel: (player) => player.playerName,
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
