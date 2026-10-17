# Aura v2 接手指南 — Rudy

更新：2026-10-09（Asia/Taipei）｜分支：`ellie/aura-v2`

## 先看這裡

Aura v2 前端已整合，接下來需要接上真實 Agent 回覆、五主題／多因素理解、Day 10 review，以及驗證已安裝 iOS PoC 的 HealthKit 傳輸。**目前不代表完整 AI 功能已上線**。

Ellie／Codex 的範圍是前端 UI、動態回覆呈現、資料記錄、隔離及串接入口。Rudy 負責 Agent prompts、context-building、reasoning、response generation 和 safety。現有 Gemini／Agent 核心沿用；新增傳輸與資料驗證必須一起 review。

目前尚未 commit、push 或建立 Draft PR。工作樹含原有未提交變更和這次修改，請先檢查 diff，不要整批覆蓋或直接合併 main。Ellie 明確批准後才進行 GitHub 提交流程。

## 交付內容與缺口

| 功能 | 已實作的前端／傳輸 | Rudy 接手項目 |
|---|---|---|
| Onboarding | v2 分組多選卡片、主題選擇、時間、限制、同意與摘要 | 驗證主題與使用者 context 如何供 Agent 使用 |
| Today／Explore | 記錄、玻璃刻度、資料圖表、洋流與光暈；移除重複 Week by week | 保持不同量尺分開，不將前端比較當作 AI 因果推論 |
| Aura conversation | 全螢幕、中央光球→左側縮小轉場、輸入／選項／照片／歷史、loading、retry、玻璃新增選單 | 真實 Gemini 回覆；結構化 clarification、confirmation、suggestions、insights |
| 五主題 | 明確主題記錄、時間、unknown／skip／text-only | 主題辨識、最多澄清次數、多因素回應及安全策略按規格實作 |
| Day 10 review | feedback 保存、loading／error／結果呈現、方案確認及歷史版本保護 | `reviewPlan()` 仍為 stub；生成、驗證並保存真實 review |
| Personal／Demo | 訪客及模式隔離，demo AI 同意 gate | 所有新增 context／endpoint 延續隔離與來源標記 |
| Apple Health | v2 連結前／完成 UI、真實匯入數量、資料偏好與 QR／XML 入口 | 已安裝 PoC 的 deep link、origin、授權、HRV payload 真機驗證 |
| HRV | 原始 SDNN、事件／區間呈現；demo 例示相對指數 | 真實 relative index 尚有產品決策，不可套用 demo 設定 |

初始建議句是使用者輸入捷徑，不是 Agent 回答。AI 未接通時保留明確的 unavailable/error，不能用 ZIP 預設對話冒充真實回覆。Mock 僅可用於隔離 UI 測試。

## 技術入口

所有路徑相對於 repository root。

| 位置 | 用途 |
|---|---|
| `web/src/ui/aura.tsx` | 動態訊息、選項、insights、輸入與光球轉場 |
| `web/src/ui/actions.ts` | `sendToAura`、photo／health、review 請求及使用者確認動作 |
| `web/src/ui/onboarding.tsx` | Onboarding、Apple Health 連結／完成頁 |
| `web/src/ui/sheets.tsx` | 記錄、健康偏好、feedback、review／調整呈現 |
| `web/src/domain/topics.ts` | 五主題定義與記錄量尺 |
| `web/src/domain/conversation.ts` | `ReplySchema`、`InteractionSchema`、`ReviewSchema`，以實際 schema 為準 |
| `web/src/domain/state.ts` | Message／AIReview／plan／feedback／health 資料結構 |
| `web/src/server/agent.ts`, `gemini.ts` | 現有 Agent 與 Gemini 整合 |
| `web/src/server/review.ts` | `assertSnapshot` 與待串接 `reviewPlan` |
| `web/src/server/statePolicy.ts`, `repo.ts` | 訪客／模式、revision、驗證與 persistence |
| `web/src/app/api/command/route.ts` | feedback／accept／decide；不要繞過 server 確認 |
| `web/src/app/api/health/`、`web/src/server/healthLink.ts` | 真實健康資料連結、匯入與同步 |
| `HealthConnectorPoC/HealthConnectorPoC/AuraLink.swift` | iOS deep link／server origin 相容性 |

完整逐項 Agent 互動稽核和 JSON 範例見 [Agent Integration Handoff](agent-integration-handoff.md)。PR 文案見 [PR summary](aura-v2-pr-summary.md)。

## API 串接重點

### Chat 與照片

- `POST /api/aura?mode=personal|demo`，沿用 anonymous httpOnly session cookie。
- 前端會送 `text`, `today`, `inputRevision`，以及互動時的 `selectedTopic`／`choice:{messageIndex,optionId,topicId?}`。
- **目前 chat request validator 僅消費 `text`／`today`。** 其餘欄位需要 Rudy 加入驗證、snapshot 與 choice resolution，不能以為已被 Agent 使用。
- 回覆維持 `{reply:{text,via,action,draft,logOffer,...}}`；可加 `interaction` 和 `insights`，由 runtime schema 驗證。
- `interaction.kind` 支援 `clarification|confirmation|suggestions`；每個 option 有穩定 `id`、`label`、`text`，可附 `topicId`。
- `insights` 包含 `id/title/text/limitations/evidenceIds`。證據與限制由後端產生，前端只呈現。
- Retry 不應重複新增使用者訊息；若需要 conversation ID／idempotency，請明確定義 additive contract。
- `POST /api/photo` 保留既有 Gemini vision 入口與人工確認，尚未用真實 credentials 驗證。

### Review 與方案調整

- `POST /api/review?mode=…`：`{planId,planVersion,inputRevision,requestId,today}`。
- 現在 `reviewPlan()` 直接回 `not-integrated`；UI 保存 feedback，但沒有 AI review／adjustment 生成。
- 後端從該 visitor／mode 的已保存資料建構 context，呼叫 Gemini，驗證 `ReviewSchema`，再 transaction 保存到 `aiReviews`。生成前後都檢查 snapshot。
- 成功格式 `{status:'ok',result:AIReview}`；未串接／失敗要保持明確 status 和 error。
- `AIReview.contract='aura.review.v1'`；包含 snapshot identity、feedback IDs、summary、recommendation、1–4 reasons、proposal、safety、via、at。`adjust` 必須有 proposal。
- 接受調整走 `/api/command` 的 `accept`；keep／observe／stop 走 `decide`。需匹配保存的 server review、revision、request ID，保留 lineage 和舊版本。
- 非 catalog 的 Gemini proposal 尚須決定授權合約；不能拿無關 catalog step 替代。

### Health／HRV

- 前端勾選是「Aura 使用資料的偏好」，**不是 iOS HealthKit 授權**。真正系統授權由已安裝 PoC 顯示。
- Web-selected types 尚未透過 token／origin deep link 傳给 PoC；需 Rudy 定義驗證後的合約。
- HRV payload：`hrvSamples[day]:[{t,ms,timestamp?}]`；`workouts/mindful[day]:[{start,end,startAt?,endAt?}]`，保留完整時間邊界。
- 本機 QR 不能使用 iPhone 的 `localhost`。LAN URL 雖可到 Mac，但已安裝 PoC 的 associated domain／HTTP origin allowlist 未確認支援數字 LAN IP。
- 不可把本機 session token 改送 Cloud Run：token／資料屬於建立它的 server 和 session。
- 完成頁只按真正匯入內容計數，不固定填 30 天，也不以 Allow 建立假資料。

## 待確認產品決策

1. 新 topic 的 approved factors／trend thresholds／action catalog；不要沿用舊 first-topic fallback 當作新規格。
2. 自由生成 adjustment 的允許範圍、授權方式與 safety 限制。
3. 真實 HRV baseline 最少天數、每日聚合、bin／timezone 和排除規則；目前不宣稱真實相對指數完成。
4. 已安裝 PoC 版本、支援的 server origin、HRV／workout／mindful 能力。

行為 source of truth：Aura Topic Behavior Definitions、Gemini Implementation Prompt、Aura Multifactor Response Policy（2026-10-07），以及 Daily HRV & Relative Index Tracking PDF。UI 以 v2 ZIP 和 Ellie 後續確認修改為準。這些外部附件未假定已隨 repository 提交；交接时請一併提供原檔。

## 建議串接順序

1. 配置 Google Cloud credentials，驗證現有 chat／photo 真實 Gemini 呼叫。
2. 加入 choice／selectedTopic validation，回傳動態 interaction 與 insights。
3. 依三份文件落實五主題、澄清、多因素與 safety；確認所有來源、權限及 coverage。
4. 接 Day 10 generation／保存／stale rejection／confirmed adjustment。
5. 用 Rudy 已安裝 PoC 真機驗證 QR、HealthKit、HRV，完成 HRV 未決產品規則。
6. 跑規格 M01–M14、回歸測試與手機驗收，再交 Ellie 確認 Draft PR。

## 本機啟動與驗收

Node.js ≥22，先看 [web README](../README.md) 的環境變數與 Google Cloud 設定。

```bash
cd web
npm ci
STORAGE=file GEMINI_DISABLED=1 npm run dev -- --hostname 0.0.0.0
```

瀏覽器開 `http://localhost:3000`。這條命令用來看 UI，AI 明確停用。真實 AI 測試需依 README 配置 credentials／project，移除 `GEMINI_DISABLED=1` 後重啟；有 project 名称不代表已取得 credentials。

```bash
npm run typecheck
npm test
npm run build
```

Production build 請在停止 dev 後跑，避免共用 `.next`。不要將 `.data`、credentials 或個人健康資料提交到 PR。

最新結果：TypeScript 通過，**7 個測試檔／83 項通過**。隔離 browser 已驗證 onboarding 分組多選、Health intro／偏好、error 時輸入框可見、光球縮小移左、onboarding→Today 洋流、玻璃刻度及新增選單。真實 Gemini、真機 HealthKit 和最新 production build **仍需驗證**；先前 build 通過是在較早 UI 修改前。

人工驗收至少涵蓋：個人與 demo 切換無混資料；五主題記錄與 reload；選項／retry 無重複訊息；缺資料不產生偽 insight；review 後改 feedback 導致 stale；確認前不改 plan；接受後舊 history 保留；QR 成功／過期／失敗；iPhone 動畫、鍵盤和輸入框可見；reduced-motion 可操作。


## Publishing checkpoint — 2026-10-09

Ellie explicitly approved commit, push and Draft PR creation. Latest TypeScript, 83 tests and production build pass. Real Gemini and physical HealthKit remain unverified. Original package-lock and local agent configuration changes are preserved outside this feature commit.
