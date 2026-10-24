# Skybound Flight Chess · 天際飛行棋

A local, single-browser Flight Chess game for 2–4 human/AI players. Version **0.2.0** replaces the oval layout with a canonical cross board while retaining the original dark visual language, colour palette, aircraft, special tiles, flight connections and controls.

## Play

Download the repository or the `flight-chess-playable` artifact from a successful **Validate Flight Chess** Actions run. Extract the entire folder and open `index.html` or `skybound_flight_chess_interface.html` in a modern browser. Keep `board-geometry.js`, `src/` and `styles/` alongside the HTML. The game has no remote font, API, login or runtime package dependency.

For reliable browser storage and local development, serve the project with Python:

```sh
python -m http.server 8080
```

Then open `http://localhost:8080/`. Browser storage is scoped to the origin; changing ports, browsers or profiles does not transfer a save. Export JSON before moving a game to another device or browser.

**操作：** 選擇 2–4 位玩家、顏色及規則，再按「開始遊戲」。先擲骰，再點飛機或右邊的移動按鈕。`Space` 擲骰、`1–4` 選棋、`U` 撤銷。設定內可切換主題、顯示棋格編號，以及匯出／匯入 JSON 存檔。

## Board and presets

The coordinate model has 52 unique clockwise track cells, four six-cell home lanes and four four-plane bases. The red, blue, yellow and green bases occupy the top-left, top-right, bottom-right and bottom-left quadrants respectively. Every sprite and movement path uses the same coordinate data.

| Preset | Behaviour |
| --- | --- |
| 經典 / Classic-style | Six to take off, no initial advance, third-six penalty; portals, traps and power tiles disabled. Colour jumps and flights retained. |
| 速戰 / Fast | Five or six to take off, faster animations and overshoot bounce-back. |
| 親子 / Family | Even-number takeoff, no captures/jumps/flights/special tiles and overshoot bounce-back. |
| 自訂 / Custom | The original configurable Skybound variant. |

This is a documented **Skybound variant**, not a claim to reproduce every printed Flight Chess edition. Special resolution order and conflicting options are explained in [RULE_CONFLICT_MATRIX.md](RULE_CONFLICT_MATRIX.md).

## What was repaired

- Correct cross-grid geometry, centred aircraft, aligned tile faces and smaller arrows that do not cover special icons.
- Correct home-entry pip counting and blockade legality, including games with captures disabled.
- Trap penalties consume the next scheduled turn, not an immediately earned extra roll. There is no additional even-dice recovery penalty.
- Fixed the AI exposure-helper initialisation crash, colour-specific threat calculations and duplicate/stale AI callbacks.
- Restart, Undo, restore and return-to-lobby invalidate delayed actions so an old animation cannot change a new game.
- Settings dialogs isolate keyboard input and pause the turn timer. Theme changes repaint the SVG board.
- Versioned save validation, safe legacy import, JSON export/import and a warning when browser storage is unavailable.

Easy, normal and hard remain locally evaluated heuristic opponents. Tests establish legal actions and completed games; they do not establish a measured competitive-strength ranking.

## Architecture

| File | Responsibility |
| --- | --- |
| `board-geometry.js` | Canonical coordinate generation and geometry validation. |
| `src/rules.js` | Pure board rules, move generation and special resolution; also importable by Node tests. |
| `src/app.js` | UI, input, SVG renderer, timers, AI, animation and game lifecycle. |
| `src/save-store.js` | Bounded, whitelisted JSON save validation and legacy normalisation. |
| `styles/game.css` | Original visual language plus targeted responsive/accessibility repairs. |
| `skybound_flight_chess_interface.html` | Game markup and local script imports. |
| `scripts/` | Dependency-free static validation and distribution build. |
| `tests/` | Node unit tests and real Chromium regression suite. |

The original single-file architecture notes are preserved in [docs/ARCHITECTURE_LEGACY.md](docs/ARCHITECTURE_LEGACY.md) for historical reference only. Some function listings and roadmap items there predate this release.

## Run the checks

Node 22 or later and Python 3.12 are the CI reference environment. No `npm install` is needed for the game or unit tests.

```sh
npm run check
npm test
npm run build
python -m pip install -r tests/requirements.txt
python -m playwright install --with-deps chromium
python tests/browser_regression.py
```

The build outputs a self-contained `dist/` folder. The browser suite starts its own loopback HTTP server and uses actual Chromium localStorage and native downloads. It tests 320, 390, 768 and 1440-pixel layouts, keyboard/mouse actions, AI, restart/Undo, captures, trap priority, victory and JSON export/import. It also runs twenty seeded AI-selected games to completion. Screenshots and results are written to `test-results/`.

`FLYCHESS_INLINE=1` is a restricted-environment fallback for visual/interaction checks. It explicitly skips the two hosted-storage/download tests. Normal CI does **not** use that mode.

See [docs/QA_REPORT.md](docs/QA_REPORT.md) for the verified candidate results and exact limitations. Every push/PR runs the permanent validation workflow; inspect the latest commit's result before merging.

## Persistence and privacy

Save key: `ac_save_v1`. Envelope and board version: `skybound-variant-v2`. Current envelopes and compatible bare legacy snapshots are validated before loading. Invalid saves are not silently deleted. Import rejects oversized input, unsafe prototype fields, invalid players, illegal positions and unsupported rule values.

Data stays in the browser unless the player exports a file. It is ordinary JSON, not encryption or anti-cheat protection. There are no accounts, credentials, authentication tokens, server rankings or online multiplayer.

## Publishing

A manual **Publish Flight Chess to Pages** workflow is included. Repository hosting must first be enabled in **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then run that workflow on `main`; it reruns the checks before deploying `dist/`.

Adding this workflow does not itself enable Pages or prove a live URL exists. Use the deployment URL shown by the successful workflow. The tested downloadable build works independently of hosting.

## Known limits

Chromium automation and responsive viewport checks are complete for the recorded release candidate. Physical-device testing on iOS/Safari and Android, screen-reader usability testing, and live Pages deployment verification are not claimed. Very small board cells can be selected via the larger move buttons beside/below the board. The package remains a local game, not an authenticated network service.

## License

MIT. See [LICENSE](LICENSE) and [CHANGELOG.md](CHANGELOG.md).
