(() => {
  if (window.__realPlayReplayAdminEditInstalled) return;
  window.__realPlayReplayAdminEditInstalled = true;

  const API_BASE_URL = 'https://api.clarapmc.com';
  const TOKEN_KEY = 'real_play_access_token';
  const STATS = [
    { key: 'ast', label: 'AST', aliases: ['ast', 'assist', 'assists'] },
    { key: 'reb', label: 'REB', aliases: ['reb', 'rebound', 'rebounds'] },
    { key: 'to', label: 'TO', aliases: ['to', 'tov', 'turnover', 'turnovers'] },
    { key: 'stl', label: 'STL', aliases: ['stl', 'steal', 'steals'] },
    { key: 'blk', label: 'BLK', aliases: ['blk', 'block', 'blocks'] },
    { key: 'foul', label: 'FOUL', aliases: ['foul', 'fouls'] },
  ];

  let currentSessionId = 0;
  let correctionActive = false;
  let reviewMode = false;
  let context = null;
  let draftEvents = [];
  let selectedPlayerId = null;
  let busy = false;
  let playheadMs = 0;
  let streamUrl = '';
  let youtubeId = '';
  let youtubePlayer = null;
  let mediaDurationMs = 0;
  let clockTimer = null;
  let notice = '';
  let noticeError = false;
  let lastAuditScoreTapId = '';
  let lastAuditScoreTapAt = 0;
  let activeAuditScoreCorrectionId = '';
  const AUDIT_SCORE_DOUBLE_TAP_MS = 430;

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const adminVerified = () => window.__realPlayAdminVerified === true;
  const viewer = () => document.querySelector('[data-rp-career-replay].open');
  const adminRoot = () => document.querySelector('.rp-admin-control');
  const adminBody = () => adminRoot()?.querySelector('[data-admin-body]') || null;

  function correctionAuditState() {
    if (!correctionActive || !context?.session?.id) return null;
    return {
      active: true,
      sessionId: Number(context.session.id),
      recording: context.recording ? { ...context.recording, du...[truncated]