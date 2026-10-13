'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const simulator = fs.readFileSync(path.join(__dirname, '..', 'ovr-simulator.html'), 'utf8');

test('OVR simulator uses universal scoring-first, personal opportunities V8', () => {
  assert.match(simulator, /V8 · OWN OPPORTUNITIES/);
  assert.match(simulator, /statistical:\s*\['Scoring-First Personal Impact', '100%'/);
  assert.doesNotMatch(simulator, /competitive:\s*\[/);
  assert.doesNotMatch(simulator, /normalized by teammate opportunities/);
  assert.match(simulator, /id="gameImpact"/);
  assert.match(simulator, /id="referenceImpact"/);
  assert.match(simulator, /id="shotAccuracy"/);
  assert.match(simulator, /id="shotAttempts"/);
  assert.match(simulator, /TEAM RESULT DOES NOT AFFECT OVR/);
});

test('OVR simulator records all personal events but requires no teammate totals', () => {
  assert.match(simulator, /name="points"/);
  assert.match(simulator, /name="madeShots"/);
  assert.match(simulator, /name="missedShots"/);
  assert.match(simulator, /name="fouls"/);
  assert.match(simulator, /fouls: num\('fouls'\)/);
  assert.doesNotMatch(simulator, /name="teamAssists"/);
  assert.doesNotMatch(simulator, /name="teamFouls"/);
  assert.doesNotMatch(simulator, /teamTotals: \{/);
  assert.match(simulator, /data\.shootingPct/);
  assert.match(simulator, /data\.referenceImpact/);
});
