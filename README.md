# Skybound Flight Chess Interface Prototype（天際飛行棋介面原型）

## Overview
Skybound Flight Chess 是針對傳統飛行棋玩法打造的瀏覽器 MVP 介面原型。專案提供完整的大廳設定、棋盤顯示與回合導引，採用深色主題並內建無障礙語意結構，方便進一步擴充遊戲邏輯或整合框架。

## Getting Started
1. 直接以現代瀏覽器開啟 [`skybound_flight_chess_interface.html`](skybound_flight_chess_interface.html) 以預覽互動原型。
2. 若需本地伺服器，可於專案根目錄執行 `npx serve .` 或任何靜態伺服器後造訪 `http://localhost:<port>/skybound_flight_chess_interface.html`。
3. 後續若要加入模組化 JavaScript，可將目前的 `<script>` 拆分成獨立檔案並透過 bundler 或框架導入。

## Project Layout
| Path | 說明 |
| --- | --- |
| `skybound_flight_chess_interface.html` | 含結構、樣式與遊戲邏輯的單檔原型。 |
| `README.md` | 操作與架構說明（本文件）。 |

## Key Features
- **大廳／開局設定**：支援 2–4 位玩家、人機混合、顏色選擇與預設規則（經典、速戰、自訂）。
- **自訂規則引擎**：提供細緻參數調校，包括起飛條件、連擲與懲罰、吃子／堵路、捷徑、特殊格、終點、動畫速度與回合計時。
- **棋盤顯示**：以語意化 SVG 呈現標準路徑、捷徑、飛線、基地與家路，並對應特殊格圖示。
- **極光環棋盤**：全新波浪狀外圈、彩色傳送門與重新分佈的安全格／增益格，搭配極光光暈背景凸顯航道節奏。
- **操作列與狀態提示**：整合返回、設定、說明、擲骰、可行動棋子、戰報記錄、提示橫幅、提示卡片與 toast。
- **主題切換與上一步回放**：支援深色／淺色／高對比主題即時切換，並在側邊欄顯示最近一步行動摘要與「重播上一步」路徑高亮。
- **回合控制**：內建 Undo、重開局、暫停回合（亂流）、倒數計時與 AI 自動出手。
- **無障礙考量**：語意化結構、ARIA 標籤與鍵盤操作提示，確保主要互動皆可使用鍵盤完成。

## Aurora Map Redesign
- **波浪外圈**：取代舊有競速場造型，使用四瓣波浪極光軌道，維持 52 格節奏但提供更流線的轉折視覺。
- **重新配置的安全格**：安全格索引更新為 `4, 8, 17, 21, 30, 34, 43, 47`，與新的視覺節點同步。
- **雙類型增益格**：索引 `6` 與 `32` 保留追加擲骰，`19` 與 `45` 提供「前進 2 格」推進效果。
- **彩色傳送門**：新增四組只允許對應顏色進入的傳送門，並調整公共傳送門位置以強化跨象限路線。
- **飛線與陷阱調整**：虛線飛行與亂流陷阱重新分佈，提升每個象限的戰術差異。

## 特殊格行為：亂流陷阱（Trap Tile）
在預設棋盤上，索引為 11、24、37、50 的格子標記為陷阱（圖示 `⚠`）。當棋子停在這些格子上時會觸發以下流程：

1. **特殊格解析順序**：`GameRules.resolveSpecialsAfterLanding` 依序處理自色跳格、飛線、傳送門、增益，最後才處理陷阱，確保棋子完成所有強制位移後才檢查陷阱效果。
2. **事件記錄**：若落點為陷阱，該函式會在移動事件清單中加入 `{ type: 'trap', effect: 'skip-turn' }`，並將這個效果回傳給介面控制器。
3. **UI 提示**：`App.applySpecialEffects` 讀取事件後，會在戰報與 toast 顯示「遭遇亂流，下一回合將停飛」等提示資訊。
4. **回合懲罰**：同一函式會把陷阱效果累加到 `state.skipTurns`。當 `App.advanceTurn` 換手時，若當前玩家仍有未清零的 `skipTurns`，系統會自動跳過該玩家回合並同步提示。

綜合以上流程，棋子停在陷阱格後會失去下一回合的操作權，而介面會提供即時且可追溯的視覺提示以協助玩家理解觸發原因。

## Additional Resources
- **設計稿／靜態資產**：若有 UI 設計稿，可放置於 `docs/` 或 `design/` 目錄，並於專案層級 `index.html` 連結對應資源。
- **問題回報**：使用 GitHub Issues 或其他追蹤工具蒐集錯誤與功能需求，並以標籤區分「UI」「規則引擎」「AI」「可及性」。
- **開發規範**：建議遵循 [Conventional Commits](https://www.conventionalcommits.org/) 為提交訊息命名，以利後續自動化釋出流程。

## Version & Persistence
- 棋盤規格版本：`skybound-aurora-v1`（`GameRules.BOARD.boardSpecVersion`）。
- 儲存格式版本：`skybound-aurora-v1`（常數 `SAVE_VERSION`）。
- 本地存檔索引鍵：`ac_save_v1`（常數 `SAVE_KEY`）。

## JavaScript Architecture
整個互動邏輯位於 HTML 檔案尾端的兩個立即執行模組：`GameRules`（規則引擎）與 `App`（介面控制器）。

### GameRules 模組
`GameRules` 暴露以下屬性與工具，用於計算合法移動與棋盤互動：

- `BOARD`：定義棋盤規格、起點、家路、捷徑、傳送門、增益與陷阱。
- `DEFAULT_RULES`：建議的初始規則組合，供 `App` 載入或覆寫。
- `SPECIAL_RESOLUTION_ORDER`：特殊格結算順序常數（自色跳格 → 飛行 → 傳送門 → 增益 → 陷阱）。
- `buildOccupancy(state)`：統計目前各格子上不同顏色棋子的占據情況。
- `canTakeoffWith(dice, rules)`：判斷擲出的骰值是否符合起飛條件。
- `isOwnJumpTile(color, idx)` / `flightTo(color, idx)` / `isStartTile(color, idx)` / `isAnyStartTile(idx)` / `isSafeTrackTile(color, idx, rules)`：棋盤輔助判斷函式。
- `generateLegalMoves(state, rules, dice)`：計算目前回合所有可行動作與特殊事件。
- `simulateMove(player, fromPos, dice, rules, occ)`：模擬單一棋子的移動結果、特殊格、吃子與結束情況。
- `resolveSpecialsAfterLanding(player, pos, rules, occ, events)`：依結算順序處理捷徑、飛線、傳送門、增益與陷阱。
- `resolveCaptureOnTrack(player, pos, rules, occ, context)`：處理落點吃子、堵路與安全格。
- `Pos.base(slot)` / `Pos.track(idx)` / `Pos.home(idx)` / `Pos.finished()` / `Pos.isEqual(a, b)`：位置表示與比較工具。

### App 介面控制器
`App` 以 `state` 物件維護檢視狀態、玩家資料、規則、棋子位置、回合資訊、歷史紀錄與控制鎖定，並透過下列方法驅動整體介面：

#### Bootstrapping & 事件綁定
- `init()`：初始化應用，快取元素、綁定事件並建立預設棋盤。
- `cache()`：快取常用 DOM 節點以便後續操作。
- `hasSavedGame()`：檢查本地儲存是否存在存檔。
- `bind()`：綁定大廳、按鈕、鍵盤等使用者互動事件。

#### 檢視與提示管理
- `updateViewVisibility()`：切換大廳與對局檢視的可見狀態。
- `updateBoardOverlay()`：根據檢視與設定狀態顯示棋盤覆蓋提示。
- `syncPlayerCardColor(card)` / `refreshPlayerCardColors()`：同步玩家卡片的顏色標籤。
- `updateSpecialsLegend()`：更新特殊格圖例的啟用狀態呈現。
- `onResize()`：節流處理視窗尺寸變更後的棋盤重繪。
- `lockInput(ms)` / `isInputLocked()`：鎖定或檢查輸入，避免提示期間誤觸。
- `showToast(message, duration)`：顯示暫時性的提示訊息。
- `updateControlAssignments()`：根據設定與玩家偏好分配鍵盤／滑鼠控制權。
- `currentPlayer()` / `currentControlModeForTurn()`：查詢目前回合玩家與控制方式。
- `isInteractionPermitted(source)` / `handleBlockedInteraction(source)`：判斷輸入來源是否允許並在被阻擋時提示。
- `renderHints()`：於提示卡片呈現當前玩家的操作建議。
- `buildTurnPrompt()` / `showTurnPrompt(message, options)` / `updateTurnPrompt(force)`：生成並顯示回合橫幅訊息。
- `log(message)`：寫入戰報記錄面板。
- `getAnimDuration(base)`：依動畫速度設定調整動畫時間。
- `clearTurnTimer()` / `beginTurnTimer()` / `handleTurnTimerExpired()`：管理回合倒數計時與逾時處理。

#### 遊戲流程與規則
- `refreshLegalMoves()`：運用 `GameRules` 重新計算可行動作並處理增益限制。
- `handleNoMoves(player)`：處理無棋可走時的提示與自動換手。
- `updateTurnUI()`：更新回合指示、按鈕狀態、倒數計時與提示。
- `cloneDefaultRules(extra)`：複製預設規則並合併覆寫選項。
- `renderLobbyPlayers(n)`：依人數生成玩家設定卡片。
- `applyPreset(name)`：套用預設規則組合（經典／速戰／自訂）。
- `applyBoardDefaultsToRules()`：將棋盤定義中的安全格與特殊格預設合併進規則。
- `readRulesFromForm()`：自大廳表單讀取自訂規則值。
- `normalizePieces()`：確保每名玩家的棋子資料含有基礎欄位。
- `normalizePlayerControls()`：整理玩家控制設定為有效值。
- `startGame()`：收集玩家與規則設定、初始化棋子與狀態並進入對局。
- `toGame()` / `toLobby()`：在對局與大廳檢視之間切換。
- `restartGame()`：在保留玩家設定的情況下重置對局。
- `rollDice(source)`：處理擲骰流程、亂流跳過與互動鎖定判斷。
- `bootstrapBoard()`：依棋盤規格重建 SVG 結構與幾何資訊。
- `highlightMovables()`：標示可移動棋子並更新右側選項。
- `describeMove(move)`：生成移動摘要文字（含事件與增益）。
- `posToXY(pos)`：將棋子位置映射為棋盤上的座標。
- `redrawPieces()`：根據狀態重新繪製棋子圖層。
- `applyMove(move, source)`：套用單一步驟的移動、處理吃子與動畫。
- `applySpecialEffects({ player, move, leadIndex })`：解析並執行增益或陷阱效果。
- `advanceTurn()`：依規則前進至下一位玩家、處理連擲與跳過。
- `onKey(event)`：監聽鍵盤快捷鍵（擲骰、選棋、Undo 等）。

#### 存檔、歷史與 Undo
- `snapshot()`：擷取當前狀態（玩家、棋子、規則與增益）。
- `saveGame()`：將狀態寫入本地儲存並更新「繼續上局」按鈕。
- `loadGame()`：由本地儲存讀取並解析存檔資料。
- `clearSave()`：刪除現有存檔。
- `continueFromSave(data)`：載入存檔並恢復棋局與介面。
- `pushHistory()`：記錄可 Undo 的狀態快照（最多 20 筆）。
- `undo()`：回復上一個歷史狀態並重繪棋盤。

#### AI 與自動化
- `isAI(player)`：判斷玩家是否為 AI。
- `chooseAIMove()`：評分目前可行動作並挑選 AI 最佳移動。
- `maybeAutoPlayIfAI()`：於適當時機觸發 AI 自動擲骰與移動。

#### 動畫與威脅提示
- `animatePiece(player, from, to, duration)`：以動畫呈現棋子的移動軌跡。
- `pulseAt(x, y, color)`：於特定座標顯示脈衝效果。
- `computeThreatFaces(targetIdx)`：計算敵方可能襲擊指定格子的骰面值。
- `showThreatBadge(x, y, faces)`：顯示對應威脅骰值的提醒徽章。

## Development Tips
- 若需擴充邏輯，可將 `GameRules` 與 `App` 拆分為模組並補齊型別註記或測試。
- 規則引擎使用 `structuredClone`（或 JSON 備援）複製狀態，可視瀏覽器支援情況調整。
- 建議在新增特殊格或規則時，同步更新 `BOARD` 定義與相關 UI（例如特殊格圖例與提示文案）。

## License
目前尚未定義授權條款，可依需求新增 `LICENSE` 檔案。
