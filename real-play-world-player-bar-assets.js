(function exposeRealPlayWorldPlayerBarAssets(global) {
  "use strict";

  if (global.__realPlayWorldPlayerBarAssetsInstalled) return;
  global.__realPlayWorldPlayerBarAssetsInstalled = true;

  const ROOT = "assets/world/player-bars";
  const BADGE_DOMINANT = `${ROOT}/badge-dominant`;
  const FILTER_ATTRIBUTE = "data-rp-player-bar-filter";

  const DEFAULT_DIRECTIONS = Object.freeze({
    ranked: 'asc',
    unranked: 'desc',
    winrate: 'desc',
    overallmvp: 'desc',
    teammvp: 'desc',
    shooting: 'desc',
    rebounding: 'desc',
    scoring: 'desc',
    assists: 'desc',
    steals: 'desc',
    blocks: 'desc',
    games: 'desc',
    name: 'asc',
    jersey: 'asc',
  });

  const paths = {
    root: ROOT,
    default: `${ROOT}/default`,
    ranking: `${ROOT}/ranking`,
    badgeDominant: BADGE_DOMINANT,

    badgeDominantAsset(slug) {
      const safeSlug = String(slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      return safeSlug ? `${BADGE_DOMINANT}/${safeSlug}.png` : "";
    },
  };

  global.RealPlayWorldPlayerBarAssets = Object.freeze(paths);

  function activeFilterKey() {
    const active = document.querySelector('.rp-world-player-sort [data-player-sort].active');
    return String(active?.dataset?.playerSort || 'ranked').trim().toLowerCase();
  }

  function installStyles() {
    if (document.querySelector('[data-rp-world-player-bar-variant-styles]')) return;
    const style = document.createElement('style');
    style.dataset.rpWorldPlayerBarVariantStyles = '1';
    style.textContent = `
      /*
       * Captain Eligible no longer owns any Players-directory bar artwork.
       * Captain opportunity belongs to the League/team-formation flow. The
       * global Players list only themes actual earned stat/MVP recognitions.
       */

      /*
       * Every Players filter uses the same fixed left number lane. RANK OVR
       * displays the canonical official Rank there. Every other filter displays
       * the player's canonical position for that leaderboard, so reversing the
       * visual sort never reassigns #1, #2, #3 to different players.
       */
      .rp-world-player-row .rp-world-player-rank-badge{
        box-sizing:border-box!important;
        flex:0 0 38px!important;
        width:38px!important;
        min-width:38px!important;
        margin-right:2px!important;
      }
      .rp-world-player-row .rp-world-player-rank-badge.is-visible{display:inline-block!important}

      /*
       * The artwork itself scales with the row width, so the badge must use the
       * same coordinate system. Fixed pixel offsets drift across devices.
       * Keep X/Y and size as row-relative variables so every viewport preserves
       * the same visual socket alignment.
       */
      .rp-world-player-row.rp-recognition-themed{
        --rp-featured-badge-x:75%;
        --rp-featured-badge-y:42%;
        --rp-featured-badge-width:23.5%;
      }
      .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge{
        left:var(--rp-featured-badge-x)!important;
        right:auto!important;
        top:var(--rp-featured-badge-y)!important;
        width:var(--rp-featured-badge-width)!important;
        height:auto!important;
        aspect-ratio:9 / 4;
        transform:translate(-50%,-50%)!important;
        transform-origin:center center!important;
      }
      .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge:hover{
        transform:translate(-50%,-50%) scale(1.055)!important;
      }
      .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge:active{
        transform:translate(-50%,-50%) scale(.97)!important;
      }

      /* Sit the recognition count on the badge's upper edge, not beside the OVR. */
      .rp-world-player-row.rp-recognition-themed .rp-player-featured-count{
        right:4px!important;
        top:-8px!important;
        bottom:auto!important;
      }
      @media(max-width:420px){
        .rp-world-player-row .rp-world-player-rank-badge{
          flex-basis:34px!important;
          width:34px!important;
          min-width:34px!important;
        }
        .rp-world-player-row.rp-recognition-themed .rp-player-featured-count{
          right:3px!important;
          top:-7px!important;
          bottom:auto!important;
        }
      }
      @media(max-width:360px){
        .rp-world-player-row .rp-world-player-rank-badge{
          flex-basis:31px!important;
          width:31px!important;
          min-width:31px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePositionBadge(row) {
    const nameNode = row?.querySelector?.('.rp-world-player-name');
    if (!nameNode) return null;
    let badge = nameNode.querySelector('.rp-world-player-rank-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'rp-world-player-rank-badge';
      badge.setAttribute('aria-hidden', 'true');
      nameNode.prepend(badge);
    }
    return badge;
  }

  function isVisibleLeaderboardRow(row) {
    if (!(row instanceof HTMLElement)) return false;
    if (row.hidden || row.getAttribute('aria-hidden') === 'true') return false;
    return row.style.getPropertyValue('display') !== 'none';
  }

  function rowName(row) {
    return String(row?.querySelector?.('.rp-world-player-name strong')?.textContent || '').trim();
  }

  function compareNames(a, b) {
    return rowName(a).localeCompare(rowName(b), undefined, { sensitivity: 'base', numeric: true });
  }

  function numberFromText(value) {
    const raw = String(value || '').trim();
    if (!raw || /^—/.test(raw) || /UNRANKED/i.test(raw)) return null;
    const parsed = Number.parseFloat(raw.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function rowFilterNumber(row, filterKey) {
    if (filterKey === 'unranked') {
      return numberFromText(row?.querySelector?.('.rp-world-player-ovr')?.textContent);
    }
    if (filterKey === 'winrate') {
      return numberFromText(row?.querySelector?.('.rp-world-player-winrate')?.textContent);
    }
    if (filterKey === 'jersey') {
      return numberFromText(row?.querySelector?.('.rp-world-player-name b')?.textContent);
    }
    if (['overallmvp', 'teammvp', 'shooting', 'rebounding', 'scoring', 'assists', 'steals', 'blocks', 'games'].includes(filterKey)) {
      return numberFromText(row?.querySelector?.('.rp-world-player-filter-stat strong')?.textContent);
    }
    return null;
  }

  function compareCanonicalRows(a, b, filterKey) {
    const direction = DEFAULT_DIRECTIONS[filterKey] || 'desc';

    if (filterKey === 'name') {
      const result = compareNames(a, b);
      return direction === 'asc' ? result : -result;
    }

    const av = rowFilterNumber(a, filterKey);
    const bv = rowFilterNumber(b, filterKey);
    const aMissing = av === null || av === undefined || Number.isNaN(av);
    const bMissing = bv === null || bv === undefined || Number.isNaN(bv);

    // Match the Players filter authority: missing values stay at the bottom in
    // either direction, while exact numeric ties keep the same name tie-break.
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (aMissing && bMissing) return compareNames(a, b);
    if (av === bv) return compareNames(a, b);
    return direction === 'asc' ? av - bv : bv - av;
  }

  function canonicalPositions(filterKey, visibleRows) {
    const ordered = [...visibleRows].sort((a, b) => compareCanonicalRows(a, b, filterKey));
    const positions = new Map();
    ordered.forEach((row, index) => positions.set(row, index + 1));
    return positions;
  }

  function syncLeaderboardPositions(filterKey = activeFilterKey()) {
    const list = document.querySelector('[data-world-player-list]');
    if (!list) return;

    const rows = [...list.querySelectorAll('.rp-world-player-row')];
    const visibleRows = rows.filter(isVisibleLeaderboardRow);
    const visibleSet = new Set(visibleRows);
    const stablePositions = filterKey === 'ranked'
      ? null
      : canonicalPositions(filterKey, visibleRows);

    rows.forEach((row) => {
      if (visibleSet.has(row)) return;
      const badge = row.querySelector('.rp-world-player-rank-badge');
      badge?.classList.remove('is-visible');
      row.removeAttribute('data-rp-leaderboard-position');
      row.removeAttribute('data-rp-visual-position');
    });

    visibleRows.forEach((row, index) => {
      const badge = ensurePositionBadge(row);
      if (!badge) return;

      const visualPosition = index + 1;
      const officialRank = Number(row.dataset.officialRank);
      const hasOfficialRank = Number.isSafeInteger(officialRank) && officialRank > 0;
      const leaderboardPosition = filterKey === 'ranked'
        ? (hasOfficialRank ? officialRank : null)
        : (stablePositions?.get(row) ?? visualPosition);
      const displayText = filterKey === 'ranked'
        ? (hasOfficialRank ? `#${officialRank}` : '—')
        : `#${leaderboardPosition}`;

      if (badge.textContent !== displayText) badge.textContent = displayText;
      badge.classList.add('is-visible');
      badge.dataset.rpLeaderboardPosition = leaderboardPosition === null ? '' : String(leaderboardPosition);
      row.dataset.rpLeaderboardPosition = leaderboardPosition === null ? '' : String(leaderboardPosition);
      row.dataset.rpVisualPosition = String(visualPosition);
    });
  }

  function syncFilterVariant() {
    const next = activeFilterKey() || 'ranked';
    if (document.documentElement.getAttribute(FILTER_ATTRIBUTE) !== next) {
      document.documentElement.setAttribute(FILTER_ATTRIBUTE, next);
    }
    syncLeaderboardPositions(next);
  }

  let scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncFilterVariant();
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-player-sort]')) scheduleSync();
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => {
      if (mutation.type === 'childList') return true;
      if (mutation.type !== 'attributes') return false;
      if (mutation.attributeName === 'class') {
        return mutation.target instanceof HTMLElement && mutation.target.matches('[data-player-sort]');
      }
      if (mutation.attributeName === 'hidden') {
        return mutation.target instanceof HTMLElement && mutation.target.matches('.rp-world-player-row');
      }
      if (mutation.attributeName === 'data-official-rank') {
        return mutation.target instanceof HTMLElement && mutation.target.matches('.rp-world-player-row');
      }
      return false;
    })) scheduleSync();
  });

  installStyles();
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'data-official-rank'],
  });
  syncFilterVariant();
})(window);
