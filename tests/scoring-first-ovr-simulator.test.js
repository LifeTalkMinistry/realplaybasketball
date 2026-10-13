'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const simulator = fs.readFileSync(path.join(__dirname, '..', 'ovr-simulator.html'), 'utf8');

test('OVR simulator presents statistical impact as the 85% anchor', () => {
  assert.match(simulator, /V6 · SCORING FIRST/);
  assert.match(simulator, /statistical:\s*\['Scoring-First Statistical Impact', '85%'/);
  assert.match(simulator, /competitive:\s*\['Competitive Result Context', '15%'/);
  assert.doesNotMatch(simulator, /75% team scoring contribution \+ 25% shooting efficiency/);
  assert.match(simulator, /id="gameImpact"/);
});

test('OVR simulator includes foul penalties and team fouls', () => {
  assert.match(simulator, /name="fouls"/);
  assert.match(simulator, /name="teamFouls"/);
  assert.match(simulator, /fouls: num\('fouls'\)/);
  assert.match(simulator, /fouls: num\('teamFouls'\)/);
  assert.match(simulator, /setText\('gameImpact', Number\(data\.gameImpact \?\? 0\)\.toFixed\(2\)\)/);
});
