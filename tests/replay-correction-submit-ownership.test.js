const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('first-pass draft click controller yields the entire Second-Pass correction root', () => {
  const source = read('admin-recorded-scoring-draft.js');
  const listener = source.indexOf("document.addEventListener('click'");
  const yieldGuard = source.indexOf("if (event.target.closest('[data-rp-replay-correction-mode]')) return;", listener);
  const back = source.indexOf("if (event.target.closest('[data-rp-draft-back]'))", listener);
  const submit = source.indexOf("if (event.target.closest('[data-rp-draft-submit]'))", listener);

  assert.ok(listener >= 0, 'draft click listener must exist');
  assert.ok(yieldGuard > listener, 'correction ownership guard must exist in the listener');
  assert.ok(yieldGuard < back, 'correction mode must yield before first-pass Back consumes the click');
  assert.ok(yieldGuard < submit, 'correction mode must yield before first-pass Submit consumes the click');
});

test('Second-Pass editor remains the owner of correction Back and Submit', () => {
  const source = read('career-game-replay-admin-edit.js');

  assert.match(source, /const back = target\.closest\('\[data-rp-draft-back\]'\)/);
  assert.match(source, /const submit = target\.closest\('\[data-rp-draft-submit\]'\)/);
  assert.match(source, /if \(back\) \{[\s\S]*?renderScoring\(\)/);
  assert.match(source, /if \(submit\) \{[\s\S]*?saveCorrection\(\)/);
});

test('re-audit submit ownership repair is cache-busted', () => {
  assert.match(read('admin-access-bootstrap.js'), /20261006-replay-submit-owner-v65/);
  assert.match(read('index.html'), /20261006-replay-submit-owner-v216/);
});
