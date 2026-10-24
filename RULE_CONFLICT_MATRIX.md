# Rule Conflict Matrix

Actual priority in `src/rules.js` and `src/app.js` for Skybound 0.2.

## Resolution order

1. Movement legality: enemy blockades, exact-entry restrictions and exact-finish constraints can invalidate a move.
2. Landing specials: own-colour jump → flight → portal → power-up → trap.
3. Final capture: check destination blockade, then safe-tile immunity and capture settings.
4. Apply post-move effects: bonus roll/move and pending trap skip counters.
5. Turn transition: an earned extra roll keeps the current player; otherwise rotate, excluding finished players and consuming scheduled skip counters.

## Conflicts and boundary cases

| Case | Result |
| --- | --- |
| Trap plus an extra roll | Take the earned roll immediately. Consume the trap penalty on that player's next scheduled turn in the rotation. |
| Trap recovery | No additional even-dice recovery penalty is applied. |
| Flight/portal versus trap | Check the final landing after special relocation, not the original intermediate square. |
| Capture on a safe tile | No capture on any enabled start-safe tile or configured safe-list square. |
| Enemy destination blockade | Illegal when blockade pass-through is disabled, even when normal or flight captures are disabled. The explicit portal bypass option is an exception. |
| Portal cycling | Portal limit bounds hops; paired portals cannot create an infinite resolution loop. |
| Own-colour jump | Resolve once within the ordered specials pass, not recursively around the whole board. |
| Reaching home-entry track square | Costs one pip and does not enter the home lane for free. Moving from entry into home cell 0 costs the next pip. |
| Exact-home-entry option | Entry is permitted only when one pip remains. |
| Exact finish | Overshoots are invalid unless bounce-back is enabled. |
| Six with no legal move | Earn another roll when enabled, unless the third-consecutive-six penalty already ended the turn. |
| Finished players with pending trap counters | Finished players are excluded from active turn targeting. Their old counters have no effect. |
| Restart/Undo/load/lobby during delayed work | Invalidate the old game epoch and cancel pending timers. Stale callbacks cannot update the new state. |
| Settings dialog | Blocks game keyboard/pointer actions and pauses the turn countdown until closed. |

## Presets

Classic-style disables portal/power/trap specials but retains colour jumps and flights. Fast and custom can use specials. Family disables capture, jumps, flights and specials. These are Skybound presets, not a universal physical-board rules claim.

## Test coverage

`tests/rules.test.cjs` covers move/special legality and counting. `tests/browser_regression.py` covers applied effects, trap/extra-roll rotation, capture, restart/Undo, dialogs and completed games. See `docs/QA_REPORT.md` for the executed environment and results.
