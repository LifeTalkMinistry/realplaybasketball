'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../competition-hub.js'), 'utf8');

function sourceSection(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Could not find season selector: ' + start);
  return source.slice(first, last);
}

function fixture(seasons, opts = {}) {
  const requests = [];
  const chosen = [];
  const list = { innerHTML: '' };
  const panel = {
    dataset: { rpCompetitionCurrentView: 'hub' },
    querySelector: selector => selector === '[data-rp-tune-up-season-list]' ? list : null,
  };
  const code = sourceSection('  function seasonChoicesMarkup(', '  function openLeague() {');
  const api = vm.runInNewContext(`
    let tuneUpSeasons = null;
    let tuneUpSeasonsRequestId = 0;
    ${code}
    ({ openTuneUp, selectTuneUpSeason, seasonChoicesMarkup, getSeasons: () => tuneUpSeasons })
  `, {
    panel,
    API_BASE_URL: 'https://api.clarapmc.com',
    esc: value => String(value ?? '').replaceAll('<', '&lt;'),
    scopedToken: () => opts.token === false ? '' : 'test-token',
    showPanelView: name => { panel.dataset.rpCompetitionCurrentView = name; },
    openScopedRanking: config => { chosen.push(config); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: opts.responseOk !== false,
        json: async () => ({ ok: opts.responseOk !== false, seasons }),
      };
    },
  });
  return { api, requests, chosen, list, panel };
}

test('Tune Up opens a season picker first and reads configured seasons instead of latest stats', async () => {
  const view = fixture([
    { id: 88, seasonNumber: 2, competitionContext: 'open_ranking' },
    { id: 5, seasonNumber: 1, competitionContext: 'open_ranking' },
    { id: 12, seasonNumber: 1, competitionContext: 'league' },
  ]);
  await view.api.openTuneUp();
  assert.equal(view.panel.dataset.rpCompetitionCurrentView, 'tune-up-seasons');
  assert.equal(view.chosen.length, 0, 'entering Tune-Up must not open a leaderboard');
  assert.equal(view.requests.length, 1);
  assert.match(view.requests[0].url, /\/competition\/seasons\?context=open_ranking$/);
  assert.match(view.list.innerHTML, /data-rp-tune-up-season-id="88"/);
  assert.match(view.list.innerHTML, /data-rp-tune-up-season-id="5"/);
  assert.doesNotMatch(view.list.innerHTML, /data-rp-tune-up-season-id="12"/);
  assert.ok(view.list.innerHTML.indexOf('id="88"') < view.list.innerHTML.indexOf('id="5"'));
  view.api.selectTuneUpSeason({ id: 88, seasonNumber: 2 });
  assert.equal(view.chosen[0].competitionSeasonId, 88);
  assert.equal(view.chosen[0].seasonNumber, 2);
  assert.equal(view.chosen[0].competitionContext, 'open_ranking');
  assert.equal(view.chosen[0].parent, 'tune-up-seasons');
  assert.equal(view.chosen[0].id, 'tune-up');
});

test('missing season data stays empty, with no invented Season 1', async () => {
  const view = fixture([]);
  await view.api.openTuneUp();
  assert.match(view.list.innerHTML, /NO TUNE-UP SEASONS HAVE BEEN CONFIGURED/);
  assert.doesNotMatch(view.list.innerHTML, /data-rp-tune-up-season-id/);
});

test('picker fails closed for unauthenticated visitors', async () => {
  const view = fixture([], { token: false });
  await view.api.openTuneUp();
  assert.equal(view.requests.length, 0);
  assert.match(view.list.innerHTML, /Log in to choose a Tune-Up season/);
  assert.equal(view.chosen.length, 0);
});

test('Tune-Up title is an accessible season button, with season number replacing player count', () => {
  assert.match(source, /data-rp-competition-scope-season-trigger/);
  assert.match(source, /aria-label="Choose Tune-Up season"/);
  assert.match(source, /data-rp-competition-scope-season-label/);
  assert.match(source, /SEASON ' \+ config\.seasonNumber/);
  assert.match(source, /if \(scopedRanking\?\.id !== 'tune-up'\) return/);
  assert.match(source, /openTuneUp\(\)/);
  assert.doesNotMatch(source, /data-rp-competition-scope-player-count/);
  assert.doesNotMatch(source, /\+ ' PLAYER' \+/);
  assert.match(source, /scopedRanking\?\.parent === 'tune-up-seasons'/);
});

test('the existing PLAYERS / TEAMS leaderboard and score authority remain separate', () => {
  assert.match(source, /RealPlayTeamRankings\?\.attach/);
  assert.match(source, /renderScopedCompetitionRows\(list, config\)/);
  assert.match(source, /fetchScopedCompetitionStats\(config\)/);
  assert.match(source, /params\.set\('season_id', String\(config\.competitionSeasonId\)\)/);
});
