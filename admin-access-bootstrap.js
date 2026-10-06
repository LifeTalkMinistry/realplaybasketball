(() => {
  if (window.__realPlayAdminAccessBootstrapInstalled) return;
  window.__realPlayAdminAccessBootstrapInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const HEAD_ADMIN_EMAILS = new Set([
    'jeromemirabuenos62@gmail.com',
  ]);
  const ADMIN_ASSET_VERSION = '20261006-declared-team-labels-v66';
  const REPLAY_ADMIN_ROOT_VERSION = '20261006-replay-correction-owner-v2';
  const ADMIN_CSS = [
    'admin-game-control.css',
    'admin-launcher-mobile-fix.css',
    'admin-game-control-simplify.css',
    'admin-courtside-live.css',
    'admin-shot-breakdown.css',
    'admin-game-rules.css',
    'admin-player-ownership.css',
    'admin-membership-review.css',
    'admin-recorded-scoring.css',
    'admin-audit-team-designation.css',
    'admin-recorded-scoring-draft.css',
    'admin-recorded-scoring-score-confirmation.css',
    'admin-recorded-scoring-youtube.css',
    'admin-recorded-scoring-desktop.css',
    'admin-race-target-correction.css',
    'admin-recorded-audit-clock.css',
    'real-play-admin-brand-overrides.css',
  ];
  const ADMIN_SCRIPTS = [
    'admin-recorded-input-stability.js',
    'admin-score-sync.js',
    'admin-game-control.js',
    'admin-session-start.js',
    'admin-game-control-simplify.js',
    'admin-player-search.js',
    'admin-player-ownership.js',
    'admin-membership-review.js',
    'admin-courtside-live.js',
    'admin-game-rules.js',
    'admin-recorded-start-submit-fix.js',
    'admin-recorded-scoring-draft-guard.js',
    'admin-recorded-scoring-assist-link.js',
    'admin-recorded-scoring-score-confirmation.js',
    'admin-recorded-scoring-draft.js',
    'admin-recorded-scoring-mobile-workspace.js',
    'admin-recorded-scoring-cancel.js',
    'admin-recorded-scoring.js',
    'admin-audit-team-designation.js',
    'admin-recorded-scoring-youtube.js',
    'admin-recorded-audit-clock.js',
    'admin-recorded-scoring-stamp-filter.js',
    'admin-recorded-scoring-you...[truncated]