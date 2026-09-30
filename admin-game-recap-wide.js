(() => {
  if (window.__realPlayAdminGameRecapWideInstalled) return;
  window.__realPlayAdminGameRecapWideInstalled = true;

  const STYLE_ATTR = 'data-rp-game-recap-wide-styles';
  if (document.querySelector(`[${STYLE_ATTR}]`)) return;

  const style = document.createElement('style');
  style.setAttribute(STYLE_ATTR, '1');
  style.textContent = `
    /* Desktop recap is intentionally presentation-only. It widens the existing
       review canvas and reflows already-rendered data without touching scoring,
       submission, finalization, Rank, OVR, MVP, or backend state. */
    @media (min-width:1100px) {
      .rp-admin-control.rp-admin-review-focus .rp-admin-shell {
        width: auto !important;
        max-width: 1480px !important;
        padding-left: 18px !important;
        padding-right: 18px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-admin-body,
      .rp-admin-control.rp-admin-review-focus .rp-video-sheet-review {
        width: 100% !important;
        max-width: none !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-admin-review-focus-back,
      .rp-admin-control.rp-admin-review-focus .rp-admin-review-focus-return {
        margin-left: 0 !important;
      }

      /* PRE-FINAL REVIEW: score / leaders / comparison share the first row.
         Career standing uses the full second row in a compact 4-column matrix. */
      .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment {
        display: grid !important;
        grid-template-columns: minmax(235px,.78fr) minmax(430px,1.42fr) minmax(300px,1fr) !important;
        gap: 10px !important;
        align-items: start !important;
        margin: 4px 0 10px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-summary {
        grid-column: 1 !important;
        grid-row: 1 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-panel:has(.rp-recap-leaders) {
        grid-column: 2 !important;
        grid-row: 1 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-panel:has(.rp-recap-comparison) {
        grid-column: 3 !important;
        grid-row: 1 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-panel:has(.rp-recap-career-list) {
        grid-column: 1 / -1 !important;
        grid-row: 2 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-review-enrichment > .rp-recap-original-label {
        grid-column: 1 / -1 !important;
      }

      /* Compress cards so more categories remain visible in one desktop frame. */
      .rp-admin-control.rp-admin-review-focus .rp-recap-summary,
      .rp-admin-control.rp-admin-review-focus .rp-recap-panel,
      .rp-admin-control.rp-admin-review-focus .rp-recap-mvp {
        border-radius: 15px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-summary {
        padding: 12px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-panel {
        padding: 11px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-panel-head {
        margin-bottom: 7px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-score {
        margin-top: 9px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-score strong {
        font-size: 2.05rem !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-result {
        margin-top: 7px !important;
        font-size: 1.02rem !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-leaders {
        gap: 6px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-leaders article {
        min-height: 70px !important;
        padding: 8px 7px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-leaders strong {
        white-space: normal !important;
        line-height: 1.15 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-comparison > div {
        min-height: 28px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-career-list {
        display: grid !important;
        grid-template-columns: repeat(4,minmax(0,1fr)) !important;
        gap: 6px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-career-player {
        grid-template-columns: minmax(0,1fr) !important;
        align-items: start !important;
        gap: 5px !important;
        min-height: 66px !important;
        padding: 8px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-career-status {
        justify-items: start !important;
        text-align: left !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-career-name > strong {
        white-space: normal !important;
        line-height: 1.15 !important;
      }

      /* Raw evidence remains intact, but West and East now use the available
         width side-by-side instead of creating another long vertical stack. */
      .rp-admin-control.rp-admin-review-focus .rp-video-sheet-review > .rp-video-sheet-teams {
        display: grid !important;
        grid-template-columns: repeat(2,minmax(0,1fr)) !important;
        gap: 10px !important;
        align-items: start !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-video-sheet-team > header {
        padding: 9px 11px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-video-sheet-player {
        gap: 6px !important;
        padding: 9px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-video-sheet-line > span {
        padding: 5px 2px !important;
      }

      /* OFFICIAL FINAL: summary, MVP, and team comparison share the first row;
         leaders and career context then span the full dashboard width. */
      .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen {
        display: grid !important;
        grid-template-columns: repeat(3,minmax(0,1fr)) !important;
        gap: 10px !important;
        align-items: start !important;
        margin-top: 4px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-summary {
        grid-column: 1 !important;
        grid-row: 1 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-mvp {
        grid-column: 2 !important;
        grid-row: 1 !important;
        min-height: 100% !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-panel:has(.rp-recap-comparison) {
        grid-column: 3 !important;
        grid-row: 1 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-panel:has(.rp-recap-leaders) {
        grid-column: 1 / -1 !important;
        grid-row: 2 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-recap-panel:has(.rp-recap-career-list) {
        grid-column: 1 / -1 !important;
        grid-row: 3 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-official-screen > .rp-video-sheet-teams {
        grid-column: 1 / -1 !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-mvp {
        padding: 14px 12px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-mvp-crown {
        margin-top: 3px !important;
        font-size: 1.3rem !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-mvp h2 {
        font-size: 1.08rem !important;
      }
    }

    /* Medium desktop/tablet still benefits from wider evidence without forcing
       the dense 3-column dashboard. */
    @media (min-width:760px) and (max-width:1099px) {
      .rp-admin-control.rp-admin-review-focus .rp-admin-shell {
        width: auto !important;
        max-width: 1040px !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-recap-career-list {
        grid-template-columns: repeat(2,minmax(0,1fr)) !important;
      }

      .rp-admin-control.rp-admin-review-focus .rp-video-sheet-review > .rp-video-sheet-teams {
        grid-template-columns: repeat(2,minmax(0,1fr)) !important;
      }
    }
  `;

  document.head.appendChild(style);
})();
