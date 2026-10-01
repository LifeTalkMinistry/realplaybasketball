# Team Schedule Rotation – diagnosis and safety fixes

This branch replaces the first rotation attempt that caused the site to stall.

## Root causes addressed

1. The player-facing rotation script used a whole-document MutationObserver whose callback rewrote the CTA text on every mutation. Rewriting the text created another mutation and could lock the browser in a self-triggering loop.
2. The admin scheduler rendered `data-rp-home-team-schedule-open-note` but queried `data-rp-team-schedule-open-note`, which could throw when switching/applying modes.
3. Both new layers selected the newest published schedule too broadly, which could load a different week's team assignments.
4. The first player handoff repeatedly clicked the 4v4 trigger while polling for the team view.

## Current fixes

- Observer writes are idempotent and scheduled through one animation-frame queue.
- The schedule-note selector and rendered attribute are identical.
- The player view uses current/future session selection with the existing 12-hour grace behavior.
- The admin editor matches the exact session minute first, then the same Manila calendar day and title; it does not fall through to a different dated session when the form has a concrete date.
- The 4v4 team view trigger is clicked once, then the code only polls for the view.
- Saturday and Sunday are fixed to 8:00 PM–10:00 PM.
- Legacy two-block team assignments migrate to Saturday/Sunday while preserving team groups.
- Old superseded rotation scripts are not loaded.

The live `main` branch remains on the pre-rotation safe commit until this branch passes review/checks.
