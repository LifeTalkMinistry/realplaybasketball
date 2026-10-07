const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('profile hero stability authority is loaded before premium profile art', () => {
  const authority = app.indexOf("'real-play-profile-recognition-authority.js'");
  const premiumArt = app.indexOf("'real-play-profile-intro.js'");
  assert.notEqual(authority, -1);
  assert.notEqual(premiumArt, -1);
  assert.ok(authority < premiumArt, 'recognition authority must install before premium profile art');
});

test('profile structural styles are boot-gated before the shell is revealed', () => {
  const start = app.indexOf('const criticalStylesheetHrefs = new Set([');
  const end = app.indexOf(']);', start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  for (const href of [
    'real-play-profile.css',
    'profile-identity-cleanup.css',
    'real-play-profile-intro.css',
    'profile-metrics-stability.css',
    'real-play-profile-metrics.css',
  ]) assert.ok(block.includes(`'${href}'`), `${href} must be critical`);
});

test('ME profile scripts are part of initial interaction readiness', () => {
  const start = app.indexOf('const initialInteractionScripts = new Set([');
  const end = app.indexOf(']);', start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  for (const href of [
    'profile-load-guard.js',
    'real-play-profile.js',
    'real-play-profile-recognition-authority.js',
    'profile-art-owner-access.js',
    'real-play-profile-intro.js',
    'profile-metrics-stability.js',
    'real-play-profile-metrics.js',
  ]) assert.ok(block.includes(`'${href}'`), `${href} must be initial-interaction ready`);
});
