# Skybound Flight Chess AI Difficulty Guide
# 天际航线飞行棋 AI 难度指南

This guide explains how the Skybound Flight Chess prototype evaluates moves and differentiates behaviour across the Easy, Normal, and Hard AI levels. Use it as a reference when tuning heuristics or extending the AI pipeline.
本指南说明了天际航线飞行棋原型如何评估走法，并在简单、普通和困难 AI 等级之间区分行为，可作为调试启发式或扩展 AI 流程的参考。

## Overview of the Decision Loop
## 决策循环概览

1. **Legal move generation** – The interface gathers all valid actions for the current player turn before any AI-specific logic runs.
   **合法走法生成**——在任何 AI 逻辑运行之前，界面会为当前轮到的玩家收集所有可行操作。
2. **Phase-aware weighting** – For each difficulty level the AI chooses a weight profile (opening, midgame, or endgame) based on how many planes are out, the distances remaining, and progress toward finishing.【F:skybound_flight_chess_interface.html†L3902-L4004】
   **阶段权重**——AI 会根据出动飞机数量、剩余距离和完成进度，为每个难度选择对应的权重配置（开局、中局或终局）。【F:skybound_flight_chess_interface.html†L3902-L4004】
3. **Heuristic scoring** – Every candidate move receives a base heuristic score derived from progress, captures, safety, tempo, clustering, and finishing pressure. Event triggers (jumps, flights, portals, traps, etc.) add bonuses or penalties on top of the base score.【F:skybound_flight_chess_interface.html†L4014-L4186】
   **启发式评分**——每个候选走法都会根据推进、吃子、安全性、节奏、聚集度和冲线压力获得基础分，事件触发（跳跃、飞行、传送、陷阱等）会进一步加成或扣分。【F:skybound_flight_chess_interface.html†L4014-L4186】
4. **Difficulty adjustments** – After the base score is computed, the AI applies extra adjustments tailored to the chosen difficulty, such as prioritising safety for Easy, comeback potential for Normal, or exposure control and blockades for Hard.【F:skybound_flight_chess_interface.html†L4187-L4267】
   **难度修正**——在得到基础分后，AI 会根据所选难度进行额外修正，例如简单模式优先安全、普通模式增强追赶能力、困难模式注重控制暴露与封锁。【F:skybound_flight_chess_interface.html†L4187-L4267】
5. **Move selection** – The scored moves are sorted and the AI picks from the top candidates, inserting difficulty-specific randomness so Easy feels relaxed, Normal occasionally explores alternatives, and Hard stays laser-focused unless two moves are indistinguishably close.【F:skybound_flight_chess_interface.html†L4268-L4316】
   **走法选择**——对评分后的走法排序，AI 从分数最高的候选中选择，同时注入不同程度的随机性：简单模式更随意、普通模式偶尔探索其他选项、困难模式除非分差极小才会放松。【F:skybound_flight_chess_interface.html†L4268-L4316】
6. **Automation timing** – Once a move is chosen, the AI drives the same UI hooks as a player: it rolls when needed and applies the move after short delays so animations stay in sync with human turns.【F:skybound_flight_chess_interface.html†L4319-L4340】
   **自动执行时序**——选定走法后，AI 与玩家一样调用界面钩子：在需要时掷骰，并在短暂延迟后执行操作，保持动画与真人回合同步。【F:skybound_flight_chess_interface.html†L4319-L4340】

## Heuristic Components
## 启发式组成

The base heuristic blends multiple signals before difficulty modifiers are applied:
在进入难度修正之前，基础启发式会融合多种信号：

- **Progress toward finishing** – `distToFinish` estimates steps remaining for each plane and rewards shrinking that distance; getting a plane from base to track also scores progress.【F:skybound_flight_chess_interface.html†L3911-L3979】【F:skybound_flight_chess_interface.html†L4057-L4078】
  **冲线进度**——`distToFinish` 估算每架飞机剩余步数，减少距离即可得分；把飞机从基地带到航线同样计入推进。【F:skybound_flight_chess_interface.html†L3911-L3979】【F:skybound_flight_chess_interface.html†L4057-L4078】
- **Safety & risk** – `isSafeTile`, threat projections, and exposure tracking penalise reckless moves and reward staying on shelters or reducing danger, with heavier weighting at higher difficulties.【F:skybound_flight_chess_interface.html†L3929-L3947】【F:skybound_flight_chess_interface.html†L4039-L4098】
  **安全与风险**——`isSafeTile`、威胁预测与暴露追踪会惩罚冒进行为、奖励停留在庇护格或降低危险，高难度下权重更大。【F:skybound_flight_chess_interface.html†L3929-L3947】【F:skybound_flight_chess_interface.html†L4039-L4098】
- **Capture pressure** – Capturing opponents boosts tempo and pressure, especially in Hard mode where follow-up blockades gain extra credit.【F:skybound_flight_chess_interface.html†L4046-L4105】【F:skybound_flight_chess_interface.html†L4219-L4246】
  **吃子压力**——吃掉对手可提升节奏和压迫力，特别是在困难模式中，后续封锁还能获得额外加分。【F:skybound_flight_chess_interface.html†L4046-L4105】【F:skybound_flight_chess_interface.html†L4219-L4246】
- **Tempo incentives** – Extra turns from sixes, power-ups, or jumps receive tempo bonuses so the AI values chain plays that keep momentum.【F:skybound_flight_chess_interface.html†L4106-L4136】
  **节奏奖励**——掷出六点、强化道具或跳跃带来的额外回合会获得节奏加分，让 AI 重视保持势头的连击操作。【F:skybound_flight_chess_interface.html†L4106-L4136】
- **Event awareness** – Trap tiles, portals, flights, and finishing lines directly nudge the score through `eventScore`, allowing designer-defined events to influence move desirability without rewriting heuristics.【F:skybound_flight_chess_interface.html†L4014-L4045】
  **事件感知**——陷阱格、传送门、飞行路线和终点线等通过 `eventScore` 直接调整分值，让设计者定义的事件无需重写启发式即可影响走法偏好。【F:skybound_flight_chess_interface.html†L4014-L4045】

## Difficulty Personalities
## 难度特性

Each difficulty modifies the shared heuristic differently:
不同难度会以各自方式调整共享启发式：

- **Easy**
  - Upscales safety and take-off rewards while downplaying risky exits, then injects wider randomness to keep gameplay casual.【F:skybound_flight_chess_interface.html†L4187-L4200】【F:skybound_flight_chess_interface.html†L4281-L4295】
    **简单**——强调安全与起飞奖励，降低冒险离场的重要性，并加入更大的随机性，让玩法更轻松。【F:skybound_flight_chess_interface.html†L4187-L4200】【F:skybound_flight_chess_interface.html†L4281-L4295】
  - Prefers captures only when obvious and otherwise biases toward safe tiles or minimal-progress moves.【F:skybound_flight_chess_interface.html†L4281-L4295】
    只有在机会明显时才倾向吃子，其余更偏向安全格或小幅推进。【F:skybound_flight_chess_interface.html†L4281-L4295】
- **Normal**
  - Adds comeback boosts when trailing, rewards breaking out planes, and still allows moderate randomness for variety.【F:skybound_flight_chess_interface.html†L4201-L4231】【F:skybound_flight_chess_interface.html†L4296-L4303】
    **普通**——在落后时增加追赶加成，奖励更多飞机起飞，并保留适度随机性以丰富体验。【F:skybound_flight_chess_interface.html†L4201-L4231】【F:skybound_flight_chess_interface.html†L4296-L4303】
  - Penalises lingering under threat by subtracting expected losses from dangerous positions.【F:skybound_flight_chess_interface.html†L4251-L4256】
    对停留在危险位置的行为施加惩罚，通过扣除预期损失来避免冒险。【F:skybound_flight_chess_interface.html†L4251-L4256】
- **Hard**
  - Prioritises captures, exposure reduction, finishing tempo, and establishing blockades while trimming randomness to near-zero.【F:skybound_flight_chess_interface.html†L4232-L4267】【F:skybound_flight_chess_interface.html†L4304-L4315】
    **困难**——优先考虑吃子、降低暴露、加快冲线和建立封锁，并将随机性降至接近零。【F:skybound_flight_chess_interface.html†L4232-L4267】【F:skybound_flight_chess_interface.html†L4304-L4315】
  - Applies extra penalties for leaving pieces exposed and tracks threat intensity to avoid walks into danger.【F:skybound_flight_chess_interface.html†L4257-L4267】
    对让棋子暴露的情况施加额外惩罚，并跟踪威胁强度以避免主动踏入危险。【F:skybound_flight_chess_interface.html†L4257-L4267】

## Standing Awareness
## 局势感知

Before tuning by difficulty, the AI compares each player's status to the leader. This snapshot powers comeback logic (e.g., `distGapToLeader`, `finishedGap`) and exposure checks (`exposureGap`). Designers can extend these metrics to feed additional strategic layers such as cooperative modes or scenario-specific scoring.【F:skybound_flight_chess_interface.html†L3972-L4038】【F:skybound_flight_chess_interface.html†L4187-L4246】
在按难度调整之前，AI 会将每位玩家的状态与领先者进行比较。这些数据支持追赶逻辑（例如 `distGapToLeader`、`finishedGap`）和暴露检查（`exposureGap`）。设计者可以扩展这些指标，为合作模式或场景评分等高级策略提供信息。【F:skybound_flight_chess_interface.html†L3972-L4038】【F:skybound_flight_chess_interface.html†L4187-L4246】

## Extending the AI
## 扩展 AI

- **Adjust weight tables** – Tweak `weightsProfile` to emphasise new behaviours, or add additional game phases if you introduce mechanics that significantly alter pacing.【F:skybound_flight_chess_interface.html†L3938-L3953】
  **调整权重表**——根据新行为调整 `weightsProfile`，若新增的机制显著改变节奏，也可添加额外的对局阶段。【F:skybound_flight_chess_interface.html†L3938-L3953】
- **Hook into `eventScore`** – Register new event types in the rule engine and give them bespoke bonuses or penalties here so the AI recognises their strategic value.【F:skybound_flight_chess_interface.html†L4014-L4045】
  **接入 `eventScore`**——在规则引擎中注册新的事件类型，并在此赋予专属加减分，使 AI 了解其战略价值。【F:skybound_flight_chess_interface.html†L4014-L4045】
- **Add situational adjustments** – The difficulty tuning block is the best place to react to novel rules or buffs (e.g., defensive formations, cooperative allies).【F:skybound_flight_chess_interface.html†L4187-L4267】
  **添加情境修正**——难度调节区块是响应新规则或增益（如防御阵型、合作盟友）的最佳位置。【F:skybound_flight_chess_interface.html†L4187-L4267】
- **Modify randomness envelopes** – Change the jitter logic in the selection stage if you want AI personalities that feel more human-like or more robotic.【F:skybound_flight_chess_interface.html†L4268-L4316】
  **调整随机幅度**——如果想让 AI 更像真人或更机械，可以在选择阶段修改抖动逻辑。【F:skybound_flight_chess_interface.html†L4268-L4316】

By following this guide, you can confidently iterate on AI behaviours across different skill levels while keeping the decision pipeline understandable and maintainable.
遵循本指南，您可以在保持决策流程可理解、可维护的同时，自信地迭代不同水平的 AI 行为。
