# Flight Chess 0.2.1 verification

Date: 26 October 2026. Scope: repair the unresolved persistence finding from PR #97, check geometry and playable rules, and verify the downloadable build.

## Baseline and actual defect

[PR #97](https://github.com/purplerice1212/flygame/pull/97) had already merged as `276409ac0642773153e07e5949052041f715f0ae`. Its final head was `f2dcaac66767538f1af31759e6e53b97c9327018`, superseding the earlier failed `49987fc`.

The merged baseline had [successful validation](https://github.com/purplerice1212/flygame/actions/runs/40134365641), but did not cover [the six-streak review finding](https://github.com/purplerice1212/flygame/pull/97#discussion_r4368572556). The old validator rejected a legitimate fourth consecutive six with `consecutiveSixes 超出範圍`. Both autosave and export called that validator.

## Repairs and regression evidence

| Area | Repaired behavior and evidence |
| --- | --- |
| Six streaks | Normalize the rules first. Keep the existing bound when the three-six penalty is enabled; preserve longer nonnegative safe-integer streaks when disabled. Browser test 16 rolls six sixes, verifies autosave after rolls/moves, reloads, downloads JSON, imports it and continues playing. Test 17 checks that the enabled penalty still ends the third-six turn. |
| Accumulated traps | Remove the arbitrary twenty-skip cap. A real rules-engine sequence of 263 legal six-roll moves accumulates 21 traps and round-trips successfully. Invalid/unsafe numeric values remain rejected. |
| Large skip counts | Replace recursive skipped-turn rotation with complete-round subtraction and one bounded traversal. Test maximum safe integers, relative penalties and finished players. An independent comparison of the actual old and new methods matched next player and counters across 18,048 small-state combinations. |
| Animation deadlines | Stop choice time when a move starts. Real-browser test 18 lets a slow capture animation cross the former deadline and confirms that the next player is not skipped. |
| Bonus deadlines | Clear departing bonus/extra-turn state and restart the timer for a new bonus choice. Test 19 confirms the next player can roll and move after an expired bonus. Supported legacy bonus states remain compatible. |
| Lobby isolation | Keep a deep snapshot of the paused game; setup/theme edits cannot autosave over it. Browser test 22 checks both unchanged localStorage and an exported paused game. |
| Import usability | Refresh move controls after a modal closes. Test 16 actually executes moves after importing, covering the previous stale pointer-permission state. |
| Storage failure | Keep an explicit save-status warning until a later successful save. Test 21 simulates a quota failure, downloads the current game despite it and verifies recovery. |
| Input feedback | Duplicate-colour and invalid-import messages are visible in the active lobby/dialog. Invalid import preserves the running game. Shared-mode hints describe touch, mouse and keyboard; AI turns identify automatic play. |
| Takeoff and portals | Reject blocked required takeoff advances instead of shortening them; count enemy blockades per colour; allow transit past allies while still respecting occupied destinations; prevent paired portals immediately reversing their hop. |

## Geometry and presentation

The canonical coordinate source did not require a redesign. It retains 52 unique clockwise track cells, four six-cell home lanes and four four-plane bases. The original dark palette, aircraft and special markers remain.

Tests validate all four 90-degree rotations and **1,248 ordinary movement cases**: four colours × 52 track cells × dice 1–6. Move paths agree with adjacent rendered cell centres, including home entry.

Actual desktop and mobile screenshots were captured before and after the interface changes. Empty move/hint panels were shortened, the long reference section became collapsible, and the persistent save status was added. No generated artwork was used as verification evidence.

| Flow step | Result |
| --- | --- |
| 1. Set up players and rules | Lobby/game visibility and AI controls work; duplicate colours show a visible error. |
| 2. Roll and select a plane | Mouse, keyboard and emulated mobile touch work; current-turn instructions match the enabled controls. |
| 3. Play, capture and finish | Legal AI choices, trap priority, animation, Undo/restart, winner dialog and full-game completion pass. |
| 4. Save, reload and transfer | Actual HTTP-origin storage, native JSON download/import, long six streaks, invalid data and quota recovery pass. |

## Executed local verification

The final browser suite served the actual `dist/` folder, not the source tree. No runtime network, account or package dependency is needed by the game.

| Check | Result |
| --- | --- |
| Syntax, asset references, duplicate IDs and board specification | Passed |
| Node unit/source/lifecycle suite | **58 passed**, zero failed/skipped |
| Hosted browser gameplay/persistence suite | **23 passed**, zero failed/skipped |
| Additional visibility suite | **2 passed**, zero failed/skipped |
| Seeded AI-selected games | **20 completed**, 2–4 players, all three difficulty selections and four presets, **4,641 actions** |
| Responsive layout | 320, 390, 768 and 1440-pixel widths checked |
| Static distribution build | Passed; entry page and assets exercised from `dist/` |

Local environment: Node 24.22.1, Python 3.12, Playwright 1.57.0 and Google Chrome 156.0.8078.47. The pinned Chromium CDN archive was unavailable locally, so `CHROMIUM_PATH=/usr/bin/google-chrome` selected the installed Chrome browser. GitHub Actions retains its Node 22/Python 3.12/pinned Chromium environment and reruns the suite for the repair PR before merge.

```sh
npm run check
npm test
npm run build
python -m pip install -r tests/requirements.txt
python -m playwright install --with-deps chromium
npm run test:browser
```

Local logs/screenshots are in ignored `test-results/`. GitHub Actions uploads `flight-chess-test-evidence` and the tested `flight-chess-playable` distribution. The PR's final CI result is the remote verification receipt.

## Practical boundaries

This remains a local, single-browser game for people sharing a device and/or playing AI. It does not provide online rooms, accounts or remote multiplayer. The AI is heuristic; legal play and completed games do not establish a measured strength ranking.

Touch was tested with browser emulation. Physical Android/iOS, Safari and a full screen-reader audit were not performed. The large move buttons provide an alternative to small aircraft targets on phones.

The manual GitHub Pages workflow remains available. A successful build/CI run does not prove a published website exists; use only a verified deployment URL when publishing is configured.
