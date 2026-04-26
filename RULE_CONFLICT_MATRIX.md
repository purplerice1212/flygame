# Rule Conflict Matrix

This document records the **actual** conflict priority implemented in
`skybound_flight_chess_interface.html` as of branch `work`.

## 1) Conflict priorities (high → low)

1. **Hard illegality while moving**
   - Enemy blockade on path (`blocked-by-enemy-stack`) stops the move simulation.
   - Exact-finish / home-lane constraints can also invalidate a move.
2. **Landing special resolution order**
   - `own-color-jump` → `flight` → `portal` → `power-up` → `trap`.
3. **Capture resolution**
   - Capture is checked after landing/special movement finalizes.
   - Enemy blockade on destination blocks capture/move.
   - Safe tile immunity then prevents capture if tile is safe.
4. **Post-move effect application**
   - `power-up` effects (extra roll / bonus move) and `trap` skip-turn are applied.
5. **Turn transition**
   - Extra turn from dice=6 or power-up keeps the current player.
   - Otherwise `advanceTurn()` rotates and consumes pending skip-turn counters.

---

## 2) Specific conflict outcomes

### A. Trap vs extra turn

- A player can earn an extra turn (rolling 6 or power-up `extra-roll`) and still gain
  a `trap` skip-turn counter from the same move.
- The extra turn is taken immediately.
- The trap penalty is consumed on that player's **next scheduled turn in rotation**
  (not during the immediate extra turn).

### B. Flight / portal relocation vs trap check

- Trap is evaluated at the end of special resolution, so flight/portal relocation can
  change whether trap triggers.
- The final track tile after jump/flight/portal/power-up is the tile used for trap check.

### C. Capture vs safe tile

- Even if capture conditions are otherwise met, no enemy pieces are captured on safe tiles
  (`start` safe tiles and configured `safeTiles.list`).

### D. Capture vs enemy blockade on destination

- If destination has an enemy stack (`>=2`) and `blockadePassThrough` is disabled,
  move/capture is blocked before normal capture outcome.

### E. Trap skip-turn vs finished players

- Finished players are excluded from active turn targeting.
- Skip counters can still exist in state for completed players, but they are irrelevant
  once the player is in `finishOrder` / `disabledColors`.

---

## 3) Code references used for this matrix

- `SPECIAL_RESOLUTION_ORDER` and special resolver loop.
- Move simulation legality checks and capture resolver.
- `applySpecialEffects()` skip-turn and power-up effects.
- `applyMove()` extra-turn decision path.
- `advanceTurn()` skip-turn consumption and finished-player filtering.
