# Team Rotation Regression Test Plan

Before merging to `main`:

1. Load the Home page and confirm the boot screen clears normally.
2. Confirm the Home 4v4 action reads `CHECK TEAM SCHEDULE` without repeated DOM churn.
3. Open Team Schedule Rotation and confirm only the current/relevant schedule is used.
4. Select Saturday and confirm only Saturday-assigned teams appear in team selection.
5. Return to Team Schedule Rotation, select Sunday, and confirm only Sunday-assigned teams appear.
6. Open the admin schedule editor and confirm it renders without console errors.
7. Confirm admin rotation shows Saturday and Sunday, both fixed at 8:00 PM–10:00 PM.
8. Confirm existing legacy two-block assignments migrate in order: first block -> Saturday, second block -> Sunday.
9. Publish a schedule and confirm metadata contains version 2 blocks with `day`, `start`, `end`, `teamKeys`, and `teamNames`.
10. Reopen the same schedule and confirm the editor reloads that schedule rather than another week's assignments.
11. Confirm unrelated Home, Open Rank, profile, replay, and admin controls still load.
