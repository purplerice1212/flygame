# Changelog

## [0.2.1] - 2026-10-26

### Fixed
- Legal streaks of four or more sixes no longer break autosave or JSON export when the three-six penalty is disabled. Accumulated trap penalties also round-trip without an arbitrary cap.
- Editing the next game's setup cannot overwrite a paused game's save or exported rules.
- Imported games refresh their controls after the settings dialog closes, so restored moves remain clickable.
- Turn countdowns stop during flight/capture animation. Expired bonus choices clear their state so the next player can roll. Very large skip counters no longer cause recursive turn processing.
- Paired portals no longer immediately reverse with a two-hop limit. Takeoff uses same-colour blockades, requires the full configured advance and allows transit past allied aircraft when stacking is disabled.
- Storage failures remain visible; duplicate-colour and invalid-import feedback appears in the active view/dialog. Shared-mode hints now describe touch, mouse and keyboard correctly.

### Improved verification and usability
- Compact move/hint panels and collapsible board reference preserve the original visual style while reducing scrolling.
- Geometry regressions cover four-way rotation and 1,248 movement/coordinate cases. New lifecycle and save tests cover the repaired edge cases.
- Browser regressions now run against the actual `dist/` package, including its entry page, real touch events, six-streak save/reload/export/import, animation deadlines, quota failures and paused-game isolation.

## [0.2.0] - 2026-10-24

### Fixed
- Canonical cross-board geometry while retaining the original visual style; centred planes, aligned cell faces and unobscured special markers.
- AI exposure-helper initialisation, colour-specific threat snapshots and duplicate/stale callbacks.
- Home-entry pip counting, documented trap bonus-turn priority and blockade checks when captures are disabled.
- Animation-safe restart/Undo/load, dialog keyboard/timer isolation and theme-driven SVG repainting.

### Added
- Separate rules/controller/save validator/CSS, a dependency-free static build and entry page.
- Family preset, distinct fast/classic-style presets, quick-start guide and geometry debug overlay.
- Validated versioned saves, compatible legacy import, JSON export/import and storage-failure feedback.
- 37 unit tests, 15 real Chromium regressions including hosted persistence, twenty seeded complete-game simulations and actual screenshot artifacts.
- Permanent validation workflow and a manual Pages publishing workflow; hosting activation is separate.

## [0.1.0] - 2026-04-13

### Added
- Project-wide MIT LICENSE file.
- Changelog and release checklist updates for completed license/changelog tasks.
