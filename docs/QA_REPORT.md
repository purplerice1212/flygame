# Skybound 0.2 verification record

## Verified candidate

GitHub Actions run: https://github.com/purplerice1212/flygame/actions/runs/40133340709

The hash-guarded source migration and verification ran against staged commit `7a65c77c6264de7888355dbad8f2497971d077b8`. Only after every check passed did the workflow commit the generated source as `49987fc672d6ba570def30436183d388738369e9`. Generated HTML, app, rules and CSS were also compared byte-for-byte with the locally tested implementation.

Environment: GitHub-hosted Ubuntu, Node 22, Python 3.12, Playwright 1.57.0 and Chromium 143.0.7499.4. Browser tests navigated to an actual loopback HTTP server. They used real browser localStorage and native file downloads, not a mocked storage implementation.

| Check | Recorded result |
| --- | --- |
| Syntax, local assets, unique HTML IDs, board metadata | Pass |
| Node unit/source tests | 37 passed, 0 failed, 0 skipped |
| Chromium regression methods | 15 passed, 0 failed, 0 skipped |
| Seeded complete games | 20 finished, 4,641 actions total |
| Static distribution build | Pass |

## Browser scenarios

Mouse and keyboard roll/move/Undo; restarting during animation; cancelling stale no-move timers; capture and return-to-base; trap penalties with immediate bonus rolls; winner dialog and restart; duplicate-colour rejection; native AI turns at easy/normal/hard; dialog keyboard isolation and timer pause; centred plane sprites and unrotated tile faces; dark/light/high-contrast and debug overlay; layouts at 320/390/768/1440 pixels; real save/reload; invalid save handling; JSON download/import.

The twenty seeded games call the real controller, rule engine and AI move selector through complete finish orders. They cover 2–4 players, three AI difficulty selections and four presets. They are automated AI-selected simulations, not twenty manually played or statistically representative balance studies.

## Evidence

Run artifact `flight-chess-verified-candidate`, artifact ID `12575154646`, includes generated source, `dist/`, tests, screenshots, exported save and `complete-games.json`. Its downloaded ZIP SHA-256 was `4573c1ca4e96ee4c600c9676c61b8213b74baeb0fb924c7c70bf2b747fe7ee42`.

Permanent `Validate Flight Chess` runs retain `flight-chess-test-evidence` and `flight-chess-playable` artifacts. Inspect the latest head's checks before merging; this historical success does not prove future edits correct.

The board/desktop/mobile PNGs in the evidence are actual browser captures. The earlier glossy image generated in chat was a concept illustration and is not proof of implemented appearance.

## Boundaries

No guarantee of zero bugs. Tests do not establish physical-device compatibility on iOS/Android, a full accessibility audit, AI competitive strength, every possible custom-rule combination, or live Pages availability. The application has no server authentication, cloud save or online multiplayer. Publishing requires repository Pages activation; the prepared workflow and static build are not a verified live deployment.
