'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const simulator = fs.readFileSync(path.join(__dirname, '..', 'ovr-simulator.html'), 'utf8');

test('OVR simulator shows 100% individual event performance and no team-win bonus', () => {
  assert.match(simulator, /V7 · INDIVIDUAL IMPACT/);
  assert.match(simulator, /statistical:\s*\['Scoring-First Individual Impact', '100%'/);
  assert.doesNotMatch(simulator, /competitive:\s*\[/);
  assert.doesNotMatch(simulator, /75% team scoring contribution \+ 25% shooting efficiency/);
  assert.match(simulator, /id="gameImpact"/);
  assert.match(simulator, /TEAM RESULT DOES NOT AFFECT OVR/);
  assert.doesNotMatch(simulator, /name="teamOvr"/);
  assert.doesNotMatch(simulator, /name="opponentOvr"/);
});

test('OVR simulator includes foul penalties and team fouls', () => {
  assert.match(simulator, /name="fouls"/);
  assert.match(simulator, /name="teamFouls"/);
  assert.match(simulator, /fouls: num\('fouls'\)/);
  assert.match(simulator, /fouls: num\('teamFouls'\)/);
  assert.match(simulator, /setText\('gameImpact', Number\(data\.gameImpact \?\? 0\)\.toFixed\(2\)\)/);
});
