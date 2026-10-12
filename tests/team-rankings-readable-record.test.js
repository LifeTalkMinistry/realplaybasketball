'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../competition-team-rankings.js'), 'utf8');

function setupRows() {
  const start = source.indexOf('  function makeRow(team) {');
  const end = source.indexOf('  async function load(state) {', start);
  assert.ok(start >= 0 && end > start, 'Team card renderer is present');
  let changes = 0;
  const fakeDocument = {
    createElement() {
      const nodes = new Map();
      const row = {
        dataset: {},
        attributes: {},
        setAttribute(key, value) { this.attributes[key] = value; },
        markup: '',
        nodes,
        set innerHTML(value) {
          this.markup = value;
          for (const key of ['[data-wins]', '[data-losses]']) {
            let text = '';
            nodes.set(key, {
              get textContent() { return text; },
              set textContent(next) { text = next; changes++; },
            });
          }
        },
        get innerHTML() { return this.markup; },
        querySelector(selector) { return nodes.get(selector) || null; },
        replaceWith(next) {
          const pos = list.children.indexOf(this);
          if (pos >= 0) list.children.splice(pos, 1, next);
          changes++;
        },
        remove() {
          const pos = list.children.indexOf(this);
          if (pos >= 0) list.children.splice(pos, 1);
          changes++;
        },
      };
      return row;
    },
  };
  const list = {
    children: [],
    classList: { add() {}, remove() {} },
    get textContent() { return this._text || ''; },
    set textContent(next) { this._text = next; this.children = []; changes++; },
    querySelector(selector) {
      return selector === '[data-team-id]' ? this.children[0] || null : null;
    },
    querySelectorAll(selector) {
      return selector === '[data-team-id]' ? [...this.children] : [];
    },
    insertBefore(row, before) {
      const old = this.children.indexOf(row);
      if (old >= 0) this.children.splice(old, 1);
      const at = before ? this.children.indexOf(before) : -1;
      if (at >= 0) this.children.splice(at, 0, row);
      else this.children.push(row);
      changes++;
    },
  };
  const host = {
    querySelector: selector => selector === '[data-rp-team-list]' ? list : null,
    querySelectorAll: () => [],
  };
  const functions = vm.runInNewContext(source.slice(start, end) +
    '\n({ makeRow, render })', {
    document: fakeDocument,
    esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    logoFor: () => 'assets/3v3/clubs/valiant-logo.png',
    number: value => Number(value || 0),
    sortedRows: (rows, key) => key === 'TEAM NAME'
      ? [...rows].sort((a, b) => a.name.localeCompare(b.name)) : [...rows],
  });
  return { ...functions, list, host, writes: () => changes };
}

test('record shows only separate Wins and Losses without Win Rate', () => {
  const { makeRow } = setupRows();
  const row = makeRow({ teamId: 'valiant', clubId: 'valiant', rank: 1, name: 'VALIANT' });
  assert.match(row.innerHTML, /data-result="wins".*<small>WINS<\/small>/s);
  assert.match(row.innerHTML, /data-result="losses".*<small>LOSSES<\/small>/s);
  assert.doesNotMatch(row.innerHTML, /WIN RATE|data-win-rate/);
  assert.doesNotMatch(row.innerHTML, /\d+W[–-]\d+L|% WR/);
  assert.match(source, /\.rp-team-standings-record-grid\{[^}]*gap:8px/);
  assert.match(source, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source, /@media\(max-width:340px\)/);
});

test('verified wins and losses render separately and unchanged refreshes preserve logo DOM', () => {
  const view = setupRows();
  const team = {
    teamId: 'valiant', clubId: 'valiant', name: 'VALIANT',
    wins: 3, losses: 1, rank: 1, winRate: 75,
  };
  const state = {
    host: view.host, mode: 'teams', loaded: true, error: '', filter: 'WINS', rows: [team],
  };
  view.render(state);
  assert.equal(view.list.children.length, 1);
  const original = view.list.children[0];
  assert.equal(original.querySelector('[data-wins]').textContent, '3');
  assert.equal(original.querySelector('[data-losses]').textContent, '1');
  assert.equal(original.querySelector('[data-win-rate]'), null, 'Win Rate is not rendered');
  const writes = view.writes();
  view.render(state);
  assert.strictEqual(view.list.children[0], original);
  assert.equal(view.writes(), writes, 'unchanged refresh must not mutate team record or logo');

  state.rows = [{ ...team, wins: 4, losses: 2, winRate: 66.7 }];
  view.render(state);
  assert.strictEqual(view.list.children[0], original, 'updated scores do not replace logo nodes');
  assert.equal(original.querySelector('[data-wins]').textContent, '4');
  assert.equal(original.querySelector('[data-losses]').textContent, '2');
  assert.equal(original.querySelector('[data-win-rate]'), null, 'Win Rate stays hidden after score correction');
});
