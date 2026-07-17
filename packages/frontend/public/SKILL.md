---
name: veii-rfm
description: "VEII RFM 零售客戶分析平台 — RFM 分群、Markov Chain 遷移、CLV 終身價值、推薦系統、What-If 模擬。透過 REST API 或 AI 聊天機器人查詢客戶數據。觸發時機：用戶提到 RFM、客戶分析、客戶分群、veii-rfm、零售分析、客戶終身價值、CLV、BTYD、Markov Chain、關聯規則、推薦系統、What-If、RFM 儀表板、segment migration、同期群、cohort、客戶活動分析等關鍵詞。"
---
# VEII RFM Analytics Skill

## 概述

VEII RFM 是一個零售客戶分析平台，提供 RFM 分群、Markov Chain 客戶遷移預測、CLV 終身價值估算、產品推薦系統、What-If 行為模擬等功能。平台透過 Cloudflare Worker API + D1 資料庫（5,000 客戶 / 97K+ 交易）運行，前端為 React 儀表板。

本 skill 讓 AI agent 可以透過 REST API 或 chatbot function call 完整操控所有分析功能。

## 專案資源

| 資源 | 位置 |
|------|------|
| API Base URL | `https://veil-rfm-api.ai-caseylai.workers.dev` |
| 前端儀表板 | `https://veil.techforliving.net` |
| 本地源碼 | `/Users/perry/Documents/VEII RFM Final` |
| LLM 模型 | Qwen-plus（DashScope International） |
| D1 資料庫 | `veil-rfm-db`（50bfc84c）— customers 5,000 筆 + transactions 97,282 筆 |

## 架構

```
前端 React (veil.techforliving.net)
       ↓
Worker API (15 個端點 — 6 GET + 9 POST)
       ↓
  core/ (純 TS 商業邏輯)
       ↓
  D1 資料庫 (customers + transactions)

AI Agent → /api/chat (POST) → Qwen LLM + 26 個 function calls → 雙鏡分析 (RFM+CLV)
```

## ⚡ D1 Auto-Load 機制

**所有 POST 端點支援空 transactions 自動載入**：傳 `"transactions": []` 時，Worker 自動從 D1 載入 97K 筆真實交易資料進行計算，無需手動傳入數據。

```json
{ "transactions": [] }
// Worker 自動執行：SELECT * FROM transactions → 97,282 rows → 計算
```

## 兩種調用方式

### 方式 A：直接調用 REST API

適用於需要精確控制參數、批次處理的場景。所有端點接受 JSON，返回 JSON。

### 方式 B：透過 /api/chat 自然語言查詢

傳送對話訊息給 Qwen LLM，LLM **自動結合 RFM + CLV 雙鏡分析**，選擇合適的 function call 獲取數據並回答。支援多輪對話。

---

## REST API 端點（15 個）

### GET 端點（5 個）

| 端點 | 說明 |
|---|---|
| `GET /api/health` | 健康檢查 |
| `GET /api/generate/rfm?n=5000&seed=20260603&startDate=&endDate=&offset=&limit=` | 從 D1 獲取 RFM + Transition 預計算結果（前端主數據源）。無 date filter 時直接查 D1 customers 表 |
| `GET /api/customers?search=&segment=&limit=50` | 搜尋客戶（支援 ID 模糊搜尋 + segment contains 匹配） |
| `GET /api/customers/:id/transactions` | 獲取特定客戶完整交易記錄（最多 200 筆） |
| `GET /api/generate?n=5000&seed=20260603&format=csv` | 生成合成測試數據（CSV 或 JSON 導出） |

### POST 端點（10 個）— 全部支援 D1 Auto-Load

| 端點 | 說明 | Request Body |
|---|---|---|
| `POST /api/rfm` | RFM 分群計算 | `{ "transactions": [] }` |
| `POST /api/rfm/transition` | Markov Chain 轉移矩陣 + 預測 | `{ "transactions": [] }`（D1→500 顧客合成樣本） |
| `POST /api/rfm/predict` | 依給定轉移矩陣預測 | `{ "initProp": [...], "transProb": [[...]], "nCustomer": 5000 }` |
| `POST /api/rfm/whatif` | What-If 模擬 + 目標分群路徑 | `{ "transactions": [...], "customerID": "S001", "scenario": {...}, "targetSegment": "..." }` |
| `POST /api/rfm/clv` | BTYD 終身價值（Pareto/NBD + Gamma-Gamma） | `{ "transactions": [] }` |
| `POST /api/rfm/activity` | 客戶活動分析（日/週/月） | `{ "transactions": [] }` |
| `POST /api/rfm/cohort` | 同期群留存分析（O(n) 優化） | `{ "transactions": [] }`（D1→5,000 顧客合成樣本） |
| `POST /api/rfm/categories` | 各分群產品類別消費偏好 | `{ "transactions": [] }` |
| `POST /api/rfm/recommend` | 產品推薦（協同過濾） | `{ "transactions": [], "customerID": "S001", "topN": 5 }` |
| `POST /api/rfm/associate` | 購物籃關聯規則 | `{ "transactions": [], "minSupport": 0.01, "minConfidence": 0.05 }` |
| `POST /api/chat` | AI 聊天機器人 | `{ "messages": [...], "transactions": [] }` |

> **注意**：`/api/rfm/transition` 和 `/api/rfm/cohort` 使用合成樣本（500/5,000 顧客）以避免 97K 筆交易造成 stack overflow 或 O(n²) 超時。

---

## Chatbot Function Calls（26 個）

LLM 透過 `/api/chat` 自動調用。**MANDATORY：所有查詢自動結合 RFM + CLV 雙鏡分析。**

### RFM 分析類

| Function Call | 參數 | 說明 |
|---|---|---|
| `getCustomerInfo` | `customerID` | 特定客戶 RFM 詳情 |
| `listAllCustomers` | `sortBy`, `limit`, `segment` | 列出客戶（segment 用 contains 匹配） |
| `getSegmentDistribution` | 無 | 各分群客戶數與百分比 |
| `getSegmentStats` | `segment?` | 各分群 R/F/M 平均值 + 總營收（segment 用 contains 匹配） |
| `getSummaryStats` | 無 | 總覽摘要 |
| `getRevenueBySegment` | 無 | 各分群營收佔比 |
| `getNewVsReturning` | 無 | 新客 vs 回頭客 |
| `getAtRiskCustomers` | `limit` | 流失風險客戶 |
| `getCustomersByFilter` | `minOrders`, `maxOrders`, `minSpending`, `maxSpending`, `maxRecencyDays`, `segment`, `limit` | 多條件篩選（segment 用 contains 匹配） |
| `compareCustomers` | `customer1`, `customer2` | 兩位客戶並排比較 |

### Markov Chain 遷移類

| Function Call | 參數 | 說明 |
|---|---|---|
| `getTransitionMatrix` | 無 | 11×11 轉移機率矩陣 |
| `predictCustomerSegment` | `customerID`, `periods?` | 預測未來分群 |
| `getSegmentMigration` | `segment` | 特定分群流入/流出分析（segment 用 contains 匹配） |

### CLV 終身價值類

| Function Call | 參數 | 說明 |
|---|---|---|
| `getCustomerCLV` | `customerID` | 特定客戶 CLV（Pareto/NBD + Gamma-Gamma） |
| `getCLVReport` | 無 | 完整 CLV 報告 + 模型參數 |
| `getTopCLVCustomers` | `limit` | CLV 排名 Top N |

### 推薦系統類

| Function Call | 參數 | 說明 |
|---|---|---|
| `recommendProducts` | `customerID`, `topN?` | 個人化推薦。若客戶已買全部產品，回傳提示訊息 |
| `getAssociationRules` | `minLift?`, `limit?` | 關聯規則（minSupport=0.01, minConfidence=0.05, 無 lift 過濾） |
| `getCrossSellOpportunities` | 無 | 交叉銷售機會（按 confidence 排序，無 lift 過濾） |

### What-If 模擬類

| Function Call | 參數 | 說明 |
|---|---|---|
| `runWhatIf` | `customerID`, `recency?`, `frequency?`, `monetary?` | 模擬行為改變 |
| `suggestTargetSegment` | `customerID`, `targetSegment` | 遷移到目標分群所需條件 |
| `explainSegment` | `segmentName` | 分群含義 + 商業建議（contains 匹配） |

---

## 11 個 RFM 分群（Canonical Order）

所有圖表按此順序排列（非字母排序）：

| # | 分群 | RFM | 行動 |
|---|---|---|---|
| 1 | Best Customers | 555 | VIP 保留 |
| 2 | Loyal Customers | ≥444 | 忠誠獎勵 |
| 3 | Potential Loyalist | ≥333 | 培育升級 |
| 4 | Low-spending Active Loyal | R≥4,F≥4,M≤2 | 提高客單 |
| 5 | High-spending New | R≥4,M≥4,F≤2 | 二次購買 |
| 6 | Almost Lost | R=2-3,F≥4,M≥4 | 緊急挽回 |
| 7 | Churned Best | R=1,F≥4,M≥4 | 激進挽回 |
| 8 | Needing Attention | 混合 | A/B 測試 |
| 9 | About to Sleep | ≤333 | 重新參與 |
| 10 | Hibernating | ≤222 | 低成本激活 |
| 11 | Lost Cheap | 111 | 最低支出 |

---

## 關聯規則參數

| 參數 | API 預設 | Chatbot 預設 | 說明 |
|---|---|---|---|
| `minSupport` | 0.01 (1%) | 0.01 (1%) | 97K 筆中 ≥ 972 次 |
| `minConfidence` | 0.05 (5%) | 0.05 (5%) | |
| `minLift` | 無過濾 | 0（無過濾） | Synthetic 數據 lift 均為 ~1.0 |

---

## 使用範例

### 透過 API（D1 Auto-Load）

```bash
# RFM + Transition 預計算
curl "https://veil-rfm-api.ai-caseylai.workers.dev/api/generate/rfm?n=5000"

# 搜尋 Almost Lost 客戶
curl "https://veil-rfm-api.ai-caseylai.workers.dev/api/customers?segment=Almost%20Lost&limit=10"

# CLV 計算（空 transactions 自動從 D1 載入）
curl -X POST https://veil-rfm-api.ai-caseylai.workers.dev/api/rfm/clv \
  -H "Content-Type: application/json" -d '{"transactions":[]}'

# What-If 模擬
curl -X POST https://veil-rfm-api.ai-caseylai.workers.dev/api/rfm/whatif \
  -H "Content-Type: application/json" \
  -d '{"transactions":[],"customerID":"S001097","targetSegment":"Loyal Customers"}'
```

### 透過 Chatbot

```bash
curl -X POST https://veil-rfm-api.ai-caseylai.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Top 5 客戶的 RFM 和 CLV 雙鏡分析"}],
    "transactions": []
  }'
```

### AI Agent 典型查詢流程

1. **雙鏡概覽** → `getSegmentDistribution` + `getCLVReport`
2. **風險排查** → `getAtRiskCustomers` + `getTopCLVCustomers`
3. **深入分析** → `getCustomerInfo` + `getCustomerCLV` + `recommendProducts`
4. **升級路徑** → `suggestTargetSegment` + `runWhatIf`
5. **捆綁建議** → `getCrossSellOpportunities` + `getAssociationRules`

---

## 重要規則

1. **所有 POST 端點傳空 transactions** — D1 auto-load 會自動處理
2. **Segment 匹配用 contains** — "Almost Lost" 匹配 "Almost Lost Customers"
3. **雙鏡分析** — chatbot 自動結合 RFM + CLV，勿只回 RFM
4. **Canonical order** — 分群顯示按 #1-11 順序，非字母
5. **Synthetic 數據** — 所有產品出現率 ~84%，lift 均為 ~1.0，關聯規則按 confidence 排序
6. **推薦為空** — 若客戶已購買全部 13 種產品，回傳提示訊息而非空陣列

## 本地開發

```bash
cd "/Users/perry/Documents/VEII RFM Final"
npm install
npm run dev:worker     # Worker API (wrangler dev)
npm run dev:frontend   # React 儀表板 (vite, port 3000)
npm run build          # 構建所有套件

# 部署
cd packages/worker && npx wrangler deploy
cd packages/frontend && npm run build && npx wrangler pages deploy dist --project-name veii-rfm --branch main
```
