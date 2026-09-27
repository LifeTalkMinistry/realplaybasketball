'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const controllerPath = path.join(__dirname, '..', 'real-play-inactive-player-state.js');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');

function createHarness(players) {
  let payload = { ok: true, players };

  const document = {
    hidden: false,
    documentElement: {},
    head: { appendChild() {} },
    createElement() {
      return { dataset: {}, textContent: '' };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };

  const window = {
    addEventListener() {},
    clearInterval() {},
    setInterval() { return 1; },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
  };

  const context = {
    window,
    document,
    localStorage: { getItem() { return ''; } },
    MutationObserver: class MutationObserver {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    }),
    console,
    setTimeout,
    clearTimeout,
  };

  const instrumented = controllerSource.replace(
    /\n\}\)\(\);\s*$/,
    `\n  window.__inactiveIdentityTest = { refreshAuthority, playerForRow, rankingStatus };\n})();\n`
  );
  assert.notEqual(instrumented, controllerSource, 'test hook injection should match the controller IIFE');

  vm.runInNewContext(instrumented, context, { filename: controllerPath });

  return {
    hooks: window.__inactiveIdentityTest,
    setPlayers(nextPlayers) {
      payload = { ok: true, players: nextPlayers };
    },
  };
}

function row(playerId) {
  return { dataset: { worldPlayerId: String(playerId) } };
}

test('claimed inactive player resolves by canonical player ID and retains OVR', async () => {
  const claimed = {
    playerId: 12,
    userId: 12,
    accountUserId: 58,
    playerName: 'CLAIMED INACTIVE',
    ovr: 78,
    rank: null,
    rankingStatus: 'inactive',
    competitiveStatus: 'inactive',
    inactive: true,
  };
  const { hooks } = createHarness([claimed]);
  await hooks.refreshAuthority(true);

  const resolved = hooks.playerForRow(row(12));
  assert.equal(resolved?.playerId, 12);
  assert.equal(resolved?.ovr, 78);
  assert.equal(hooks.rankingStatus(resolved), 'inactive');
});

test('unclaimed/manual inactive player resolves by canonical manual player ID', async () => {
  const manual = {
    playerId: 99,
    userId: 99,
    accountUserId: null,
    playerName: 'MANUAL INACTIVE',
    unclaimed: true,
    ovr: 71,
    rank: null,
    rankingStatus: 'inactive',
    inactive: true,
  };
  const { hooks } = createHarness([manual]);
  await hooks.refreshAuthority(true);

  const resolved = hooks.playerForRow(row(99));
  assert.equal(resolved?.playerId, 99);
  assert.equal(resolved?.unclaimed, true);
  assert.equal(resolved?.ovr, 71);
  assert.equal(hooks.rankingStatus(resolved), 'inactive');
});

test('cross-domain numeric collision cannot overwrite canonical row identity', async () => {
  const playerA = {
    playerId: 12,
    userId: 12,
    accountUserId: 58,
    playerName: 'PLAYER A',
    ovr: 78,
    rank: null,
    rankingStatus: 'inactive',
    inactive: true,
  };
  const playerB = {
    playerId: 58,
    userId: 58,
    accountUserId: 81,
    playerName: 'PLAYER B',
    ovr: 84,
    rank: 1,
    rankingStatus: 'ranked',
    inactive: false,
  };
  const { hooks } = createHarness([playerA, playerB]);
  await hooks.refreshAuthority(true);

  const row12 = hooks.playerForRow(row(12));
  const row58 = hooks.playerForRow(row(58));

  assert.equal(row12?.playerId, 12);
  assert.equal(hooks.rankingStatus(row12), 'inactive');
  assert.equal(row58?.playerId, 58, 'canonical playerId=58 must win over another player accountUserId=58');
  assert.equal(row58?.playerName, 'PLAYER B');
  assert.equal(hooks.rankingStatus(row58), 'ranked');
});
