# Rule Conflict Matrix

Actual priority in `src/rules.js` and `src/app.js` for Skybound 0.2.1.

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
| Portal cycling | Portal limit bounds hops. A paired portal does not immediately reverse a hop already taken, including imported two-hop settings. |
| Takeoff and blockades | Two or more aircraft of one enemy colour form a blockade. Different enemy colours sharing a safe start do not combine. The whole configured takeoff advance must be legal; a blocked path is not shortened. |
| Takeoff with stacking disabled | Allied aircraft may be passed at an intermediate launch square. An occupied allied final destination is still illegal. |
| Own-colour jump | Resolve once within the ordered specials pass, not recursively around the whole board. |
| Reaching home-entry track square | Costs one pip and does not enter the home lane for free. Moving from entry into home cell 0 costs the next pip. |
| Exact-home-entry option | Entry is permitted only when one pip remains. |
| Exact finish | Overshoots are invalid unless bounce-back is enabled. |
| Six with no legal move | Earn another roll when enabled, unless the third-consecutive-six penalty already ended the turn. |
| Six streaks and saves | With the optional penalty disabled, legal longer streaks are preserved in saves and exports. Enabling the penalty retains its existing bound and turn-ending behavior. |
| Finished players with pending trap counters | Finished players are excluded from active turn targeting. Their old counters have no effect. |
| Restart/Undo/load/lobby during delayed work | Invalidate the old game epoch and cancel pending timers. Stale callbacks cannot update the new state. |
| Settings dialog | Blocks game keyboard/pointer actions and pauses the turn countdown until closed. |
| Movement animation and countdown | Once a move is chosen, animation does not consume choice time or trigger a turn change. A later bonus choice receives its own countdown. |
| Expired bonus choice | End the departing turn and clear its bonus state before the next player can roll. |
| Large accumulated trap penalties | Consume complete skipped rotations in bounded work, then resume the usual player order. |

## Presets

Classic-style disables portal/power/trap specials but retains colour jumps and flights. Fast and custom can use specials. Family disables capture, jumps, flights and specials. These are Skybound presets, not a universal physical-board rules claim.

## Test coverage

`tests/rules.test.cjs` covers move/special legality and counting. `tests/browser_regression.py` covers applied effects, trap/extra-roll rotation, capture, restart/Undo, dialogs and completed games. See `docs/QA_REPORT.md` for the executed environment and results.
