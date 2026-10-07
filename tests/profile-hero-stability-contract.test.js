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

test('ME base route is ready before the global app loader releases', () => {
  const start = app.indexOf('const initialInteractionScripts = new Set([');
  const end = app.indexOf(']);', start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);

  for (const href of [
    'profile-load-guard.js',
    'real-play-profile.js',
  ]) assert.ok(block.includes(`'${href}'`), `${href} must be initial-interaction ready`);

  for (const href of [
    'real-play-profile-recognition-authority.js',
    'profile-art-owner-access.js',
    'real-play-profile-intro.js',
    'profile-metrics-stability.js',
    'real-play-profile-metrics.js',
  ]) assert.ok(!block.includes(`'${href}'`), `${href} must stay progressive and must not hold the global loader`);
});


test('profile badge content cannot own a hero layout row', () => {
  const css = fs.readFileSync(path.join(root, 'real-play-profile-intro.css'), 'utf8');
  assert.ok(css.includes('PROFILE HERO GEOMETRY LOCK v223'));
  assert.ok(css.includes('grid-template-rows:auto auto auto!important'));
  assert.ok(css.includes('position:absolute!important'));
  assert.ok(css.includes('--rp-profile-hero-band:0px!important'));
});

test('recognition authority cannot expand the player row', () => {
  const authority = fs.readFileSync(path.join(root, 'real-play-profile-recognition-authority.js'), 'utf8');
  assert.ok(authority.includes('Hero geometry is owned by CSS only'));
  assert.ok(!authority.includes('margin-top:24px!important'));
});


test('own ME profile warms in the background without becoming a global boot dependency', () => {
  const profile = fs.readFileSync(path.join(root, 'real-play-profile.js'), 'utf8');
  assert.ok(profile.includes('function warmProfile()'));
  assert.ok(profile.includes('refresh({ background: true })'));
  assert.ok(profile.includes('function renderPendingProfile()'));
});

test('profile artwork and metrics use warm progressive readiness', () => {
  const art = fs.readFileSync(path.join(root, 'real-play-profile-intro.js'), 'utf8');
  const metrics = fs.readFileSync(path.join(root, 'real-play-profile-metrics.js'), 'utf8');
  assert.ok(art.includes('refreshRelevantProfiles'));
  assert.ok(art.includes("typeof image.decode === 'function'"));
  assert.ok(metrics.includes('OWN_CACHE_TTL_MS = 30_000'));
  assert.ok(metrics.includes("window.addEventListener('realplay:profile-loaded'"));
});


test('ME geometry lock is scoped away from public profiles', () => {
  const css = fs.readFileSync(path.join(root, 'real-play-profile-intro.css'), 'utf8');
  const lockStart = css.indexOf('PROFILE HERO GEOMETRY LOCK v223');
  assert.ok(lockStart >= 0);
  const lock = css.slice(lockStart);
  assert.ok(lock.includes('.rp-profile[data-rp-profile] .rp-profile-hero'));
  assert.ok(!lock.includes('\n.rp-profile .rp-profile-hero{'));
  assert.ok(lock.includes('.rp-profile[data-rp-profile] .rp-profile-hero > .rp-profile-badges'));
});
