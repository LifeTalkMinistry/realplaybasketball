'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function file(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing source section ${start}`);
  return source.slice(a, b);
}

const inactiveSource = file('real-play-inactive-player-state.js');
const filterSource = file('real-play-world-player-filters.js');
const competitionSource = file('competition-hub.js');
const inactiveFunctions = section(inactiveSource, '  function setRowVisible(', '  function profilePlayer(');

function fixture(count, scoped = true) {
  const rows = Array.from({ length: count }, (_, index) => {
    const inactive = index % 3 !== 0; // 12 globally inactive, 6 active
    const styles = new Map(inactive ? [['display', 'none']] : []);
    return {
      dataset: { worldPlayerId: String(index + 1), rankingStatus: inactive ? 'inactive' : 'unranked' },
      hidden: inactive,
      attrs: {},
      style: {
        setProperty: (key, val) => styles.set(key, val),
        removeProperty: (key) => styles.delete(key),
        getPropertyValue: (key) => styles.get(key) || '',
      },
      removeAttribute(key) {
        if (key === 'data-ranking-status') delete this.dataset.rankingStatus;
        if (key === 'data-inactive-rank') delete this.dataset.inactiveRank;
      },
      setAttribute(key, val) {
        if (key === 'aria-hidden') this.attrs.ariaHidden = val;
      },
      querySelector() { return null; },
    };
  });
  const countNode = { textContent: '' };
  const list = {
    querySelectorAll: () => rows,
  };
  const classSet = new Set(['rp-world-inactive-mode']);
  const panel = {
    dataset: { rpCompetitionPresentation: scoped ? 'scoped' : '' },
    classList: {
      remove: (item) => classSet.delete(item),
      toggle: (item, state) => state ? classSet.add(item) : classSet.delete(item),
    },
    querySelector(selector) {
      if (selector === '[data-world-player-list]') return list;
      if (selector === '[data-world-player-count]') return countNode;
      return null;
    },
  };
  return { rows, panel, classSet, countNode };
}

function makeInactiveEngine(f) {
  return vm.runInNewContext(
    'let inactiveMode = true;\n' + inactiveFunctions
    + '\n({ applyRows, mode: () => inactiveMode })',
    {
      worldPanel: () => f.panel,
      playerForRow: (row) => row.dataset.rankingStatus
        ? ({ rankingStatus: row.dataset.rankingStatus }) : null,
      rankingStatus: (player) => player.rankingStatus,
      inactiveRank: () => null,
      ensureInactiveRankBadge: () => {},
      clearCurrentRecognitions: () => {},
      ovr: () => 60,
    }
  );
}

test('18 verified Tune-Up entrants stay visible even if 12 are inactive overall', () => {
  const f = fixture(18, true);
  const engine = makeInactiveEngine(f);
  engine.applyRows();
  assert.equal(f.rows.filter((row) => row.hidden).length, 0);
  assert.equal(f.rows.filter((row) => 'rankingStatus' in row.dataset).length, 0);
  assert.equal(f.classSet.has('rp-world-inactive-mode'), false);
  assert.equal(engine.mode(), false);
});

test('the overall World ranking still filters globally inactive players', () => {
  const f = fixture(3, false);
  const engine = makeInactiveEngine(f);
  engine.applyRows();
  assert.equal(f.rows.filter((row) => row.hidden).length, 2);
  assert.equal(f.classSet.has('rp-world-inactive-mode'), true);
});

test('competition rank filter initializes at #1; win rate does not depend on global authority', () => {
  const code = [
    section(filterSource, '  function matchesFilter(', '  function visibleRows('),
    section(filterSource, '  function selectControl(', '  function ensureOvrInfoButton('),
    '({ selectControl, matchesFilter, direction: () => directions.rank, currentFilter: () => filterMode })',
  ].join('\n');
  const panel = { dataset: { rpCompetitionPresentation: 'scoped' } };
  const control = vm.runInNewContext(
    'let filterMode = "ranked"; let sortKey = "ovr";\n'
    + 'const directions = {rank:"desc",ovr:"desc",winrate:"desc"};\n'
    + code,
    {
      panel,
      FILTERS: [['ranked', 'RANK OVR'], ['unranked', 'UNRANK OVR'], ['winrate', 'WIN RATE']],
      rankAuthorityReady: false,
      refreshRankAuthority: async () => {},
      scheduleSort: () => {},
      renderControls: () => {},
      GAME_STAT_KEYS: new Set(['games']),
    }
  );
  control.selectControl('ranked', { initialize: true });
  assert.equal(control.direction(), 'asc');
  assert.equal(control.matchesFilter({ ranked: true, games: 1 }), true);
  control.selectControl('ranked');
  assert.equal(control.direction(), 'desc');
  control.selectControl('winrate');
  assert.equal(control.currentFilter(), 'all');
  assert.equal(control.matchesFilter({ ranked: true, games: 1 }), true);
  panel.dataset.rpCompetitionPresentation = '';
  assert.equal(control.matchesFilter({ ranked: true, games: 1 }), false);
});

test('competition participation requires verified played games and creates contiguous ranks', () => {
  const normalize = vm.runInNewContext(
    section(competitionSource, '  function normalizeAutomaticCompetitionRanks(', '  function scopedPlayerRow(')
      + '\nnormalizeAutomaticCompetitionRanks'
  );
  const players = Array.from({ length: 18 }, (_, index) => ({
    playerName: `PLAYER ${index + 1}`,
    identityKey: `manual:${index + 1}`,
    ranked: false,
    record: { games: 1 },
    ovr: index % 2 ? null : 60 + index,
    provisionalOvr: index % 2 ? 50 + index : null,
  }));
  const list = normalize([...players, { playerName: 'DNP ONLY', record: { games: 0 } }]);
  assert.equal(list.length, 18);
  assert.ok(list.every((player) => player.ranked));
  assert.deepEqual(Array.from(list, (player) => player.rank), Array.from({length:18}, (_, i) => i + 1));
  assert.equal(list.some((player) => player.playerName === 'DNP ONLY'), false);
});
