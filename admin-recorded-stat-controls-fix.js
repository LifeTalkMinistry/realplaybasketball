(() => {
  if (window.__realPlayRecordedStatControlsFixInstalled) return;
  window.__realPlayRecordedStatControlsFixInstalled = true;

  // Retired compatibility shim.
  //
  // Recorded score-sheet buttons are now owned entirely by
  // admin-recorded-scoring-draft.js. The previous compatibility layer
  // intercepted AST/REB/TO/STL/BLK/FOUL clicks before the draft scorer,
  // rewrote localStorage, dispatched synthetic storage/admin-render events,
  // and caused the scoring workspace to repaint around a normal click.
  // Keeping this file as an inert shim is safer for older cached app shells
  // that still request it, while removing the competing event path.
})();
