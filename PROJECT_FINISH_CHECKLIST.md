# Project Finish Checklist

Use this checklist to drive the MVP to a release-ready version.

## 1) Architecture
- [ ] Split `GameRules` and `App` into separate source modules.
- [ ] Introduce a lightweight build step (Vite/Parcel or equivalent).
- [ ] Keep UI rendering utilities isolated from rule logic.

## 2) Quality
- [ ] Add unit tests for rule resolution order and move legality.
- [ ] Add regression tests for trap tile skip-turn behavior.
- [ ] Add smoke test for start game -> move -> save -> load.

## 3) Gameplay Completion
- [ ] Finalize winner flow (result summary + replay options).
- [ ] Validate rule conflict priorities and document final behavior.
- [ ] Add at least 3 polished presets for casual players.

## 4) UX / Accessibility
- [ ] Verify keyboard-only gameplay loop.
- [ ] Improve mobile layout for the move list and logs.
- [ ] Add first-time tutorial/onboarding hints.

## 5) Release Operations
- [x] Add `LICENSE`.
- [x] Add `CHANGELOG.md`.
- [ ] Configure CI checks (lint + tests + basic static checks).
- [ ] Publish a playable deployment target (GitHub Pages / Netlify).

## Exit Criteria
- [ ] Core tests pass in CI.
- [ ] Manual QA pass on desktop + mobile.
- [ ] Known limitations documented in README.
