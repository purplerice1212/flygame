# Release checklist: 0.2

## Implemented and tested
- [x] Separate rules, app controller, save validation and visual CSS into source files.
- [x] Canonical 15×15 cross-board geometry: 52 track cells and tested home/base alignment.
- [x] Preserve the original dark visual language; fix sprite anchors, tile rotation and arrow occlusion.
- [x] Dependency-free static build and entry page.
- [x] Geometry, move legality, capture, finish, portal, trap, save/schema and style tests.
- [x] Fix AI initialisation crash and deduplicate/cancel asynchronous AI callbacks.
- [x] Fix home-entry pip counting and documented trap/extra-turn priority.
- [x] Winner summary, restart and Undo; stale animations cannot mutate restarted games.
- [x] Three named presets plus custom rules, quick-start guide and keyboard shortcuts.
- [x] Responsive controls, light/dark/high-contrast themes and geometry debug overlay.
- [x] Validated save/load and native JSON export/import.
- [x] MIT license, changelog, known limitations and repeatable read-only CI validation.
- [x] Integrated candidate: 37 Node tests and 15 hosted Chromium tests passed with no skips.
- [x] Twenty seeded AI-selected full games completed (4,641 actions in the recorded run).
- [x] Real HTTP-origin save/reload and native export/import verified in GitHub Actions.
- [x] Static distribution build and genuine browser screenshots retained as CI artifacts.

## Publication and manual coverage
- [x] Include a manually triggered Pages publishing workflow for main.
- [ ] Enable repository Pages hosting and verify the resulting public URL.
- [ ] Physical-device QA on Safari/iOS and Android.
- [ ] Manual screen-reader usability review.

The first checked candidate run is linked in docs/QA_REPORT.md. Later commits must
pass the permanent Validate Flight Chess workflow before merging. A dist bundle
and a prepared deployment workflow are not a live deployment.
