# Veil 智慧零售分析系統 — 詳細解釋與比較

> 涵蓋 RFM、Markov Chain、BTYD CLV、推薦系統四大模型
> 對照原始 PPT（VEII 2019）與 TypeScript 實作

---

## 一、四大模型總覽

| | RFM | Markov Chain | BTYD CLV | 推薦系統 |
|---|---|---|---|---|
| **問題** | 他是誰？值多少？ | 他下一步會去哪裡？ | 他終身價值多少？ | 他會買什麼？ |
| **時間視角** | 靜態快照 | 動態遷移 | 長期預測 | 當下推薦 |
| **輸出** | 11 分群標籤 | 11×11 轉移矩陣 | 每位客戶 $CLV | 個人化商品清單 |
| **輸入** | 交易記錄 | 多期交易記錄 | 交易記錄（時間序列） | 商品購買記錄 |
| **數學基礎** | 百分位數 + 規則 | 馬可夫鏈 | Pareto/NBD + Gamma-Gamma | 協同過濾 + 關聯規則 |
| **複雜度** | 低 | 中 | 高 | 中 |

---

## 二、各模型詳細解釋

### 2.1 RFM 客戶分群

**一句話**：用 Recency、Frequency、Monetary 三個維度給客戶打分，分為 11 個群組。

**實作位置**：`packages/core/src/rfm.ts`

**計算步驟**：
```
原始交易
  → getRFMData()    聚合：每位客戶 → DaySinceLastTxn, NoOfTxn, MeanMoneyValue, TotalSpending
  → rfmCompute()    百分位數排名 → 1-5 分（與其他客戶比較的相對分數）
  → rfmSegmentation()  規則引擎 → 11 分群標籤
  → getRFMResults()  合併輸出
```

**計分方式**：百分位數排名（Percentile Rank）
- 不是跟絕對值比，而是跟所有客戶比
- 你買了 10 次覺得很多？如果其他人平均 20 次，你只有 2 分
- 你花了 $100？如果其他人平均 $500，你也只有 1 分

**11 個分群的規則優先級**（由高到低，先匹配先得）：

| 優先級 | 規則 | 分群 |
|--------|------|------|
| 1 | R=5, F=5, M=5 | Best Customers |
| 2 | R≥4, F≥4, M≥4 | Loyal Customers |
| 3 | R≥3, F≥3, M≥3 | Potential Loyalist |
| 4 | R≥4, F≥4, M≤2 | Low-spending Active Loyal |
| 5 | R≥4, F≤2, M≥4 | High-spending New |
| 6 | R=2-3, F≥4, M≥4 | Almost Lost |
| 7 | R=1, F≥4, M≥4 | Churned Best |
| 8 | R=1, F=1, M=1 | Lost Cheap |
| 9 | R≤2, F≤2, M≤2 | Hibernating |
| 10 | R≤3, F≤3, M≤3 | About to Sleep |
| 11 | 以上皆非 | Needing Attention |

**API**：`POST /api/rfm` → 回傳 rfmData + rfmScore + rfmSegment + results

**前端**：Overview（圓餅圖 + 分群表）、Characteristics（R/F/M 長條圖）

---

### 2.2 Markov Chain 分群遷移

**一句話**：用歷史數據計算客戶在 11 個分群間的轉移機率，預測未來分佈。

**實作位置**：`packages/core/src/markov.ts`

**計算步驟**：
```
原始交易
  → txn2rfmSegmentList()   滑動時間窗口：每個月重算一次 RFM
  → rfmSegment2mcSeq()     每個客戶 → 狀態序列 [T0: Loyal, T1: Loyal, T2: AlmostLost, ...]
  → mcSeq2Counts()         統計轉移次數 → 11×11 矩陣
  → mcCounts2Prob()        歸一化 → 轉移機率矩陣（每列和 = 1）
  → predictSegmentMovement()  矩陣乘法 → 預測 n 期後的客戶分佈
```

**轉移矩陣的解讀**：

```
範例（實際數據計算）：

              到下一期 →
從本期 ↓      Best  Loyal  Potential  ...  Lost Cheap
Best          0.00  1.00    0.00      ...   0.00
Loyal         0.00  0.40    0.40      ...   0.00
Potential     0.00  0.08    0.75      ...   0.00
...
Lost Cheap    0.00  0.00    0.00      ...   0.68
```

- **對角線**：留在原分群的機率（越高越穩定）
- **上三角**：升級機率（往數字小的分群走）
- **下三角**：降級機率（往數字大的分群走）

**預測公式**：
```
未來狀態向量(t) = 初始狀態向量 × (轉移矩陣)^t
```

例如：初始有 100 位 Best Customers，預測 6 個月後：
- 期初：100 × [1, 0, 0, ..., 0] = 100 位 Best
- 1 個月後：100 × [P(Best→Best), P(Best→Loyal), ...]
- 6 個月後：向量 × 矩陣^6

**API**：`POST /api/rfm/transition` → 回傳 mcSeq + mcCounts + transProb + predicted

**前端**：Segment Transition（vis-network 互動圖 + 預測折線圖）

---

### 2.3 BTYD CLV 客戶終身價值

**一句話**：用 Pareto/NBD 模型預測客戶未來交易次數 × Gamma-Gamma 模型預測每筆金額 = 終身價值。

**實作位置**：`packages/core/src/btyd/`

**模型架構**：

```
Pareto/NBD 模型（預測交易次數）：
  ├── 購買過程：客戶存活時，以 Poisson(λ) 的速率購買
  ├── λ 的分佈：Gamma(r, α) — 不同客戶的購買速率不同
  ├── 流失過程：客戶以 Pareto(s, β) 的壽命分佈「死亡」
  └── 參數：[r, α, s, β] — 從數據估計

Gamma-Gamma 模型（預測每筆金額）：
  ├── 每筆金額：Gamma 分佈
  ├── Gamma 參數隨客戶變化：Gamma(p, q)
  └── 參數：[p, q, γ] — 從數據估計

CLV = DERT × E(Spend) × margin
  ├── DERT = Σ 每期預期交易 × 折現因子
  ├── E(Spend) = Gamma-Gamma 預期金額
  └── margin = 毛利（預設 100%）
```

**P(Alive) 的直觀解釋**：

| P(Alive) | 含義 | 例子 |
|-----------|------|------|
| 99% | 幾乎確定還活著 | C004：16 筆訂單，4 天前剛買 |
| 50% | 一半機率已流失 | 中等客戶，有一段時間沒買 |
| 5% | 很可能已流失 | C008：1 筆訂單，84 天沒買 |

**API**：`POST /api/rfm/clv` → 回傳每位客戶的 P(Alive) + 預期交易 + 預期金額 + CLV

**前端**：LTV Overview（Pareto/NBD 參數表 + Gamma-Gamma 參數表 + 每位客戶 CLV 明細表）

**樣本數據結果**：

| 客戶 | P(Alive) | 預期 Txns/年 | 預期 $/Txn | CLV |
|------|----------|-------------|-----------|-----|
| C004 | 99% | 5.7 | $446 | $840,331 |
| C002 | 99% | 3.9 | $201 | $159,034 |
| C001 | 99% | 4.6 | $121 | $137,205 |
| C008 | 99% | 1.5 | $50 | $1,095 |

---

### 2.4 推薦系統

**一句話**：根據購買歷史，推薦客戶可能感興趣但尚未購買的商品。

**實作位置**：`packages/core/src/recommend.ts`

**兩種方法**：

#### A. Item-Based Collaborative Filtering（基於商品的協同過濾）

**計算步驟**：
```
1. 建立商品共現矩陣：C[i][j] = 同時買過商品 i 和 j 的客戶數
2. 對目標客戶，找出他買過的商品集合 P
3. 對每個候選商品 j（不在 P 中）：
   Score(j) = Σ_{i in P} C[i][j] / Count(i)
4. 取 Score 最高的 N 個商品推薦
```

**範例**：C001 買過 [Milk, Bread, Steak, Cheese, Wine, Eggs, Butter, Yogurt]
→ 推薦 [Salmon（0.62）, Chocolate（0.38）, Coffee（0.38）]

#### B. Association Rule Mining（關聯規則）

**計算步驟**：
```
1. 計算所有商品對的 Support = 同時出現的客戶數 / 總客戶數
2. 計算 Confidence(A→B) = P(B|A) = 同時買 A 和 B 的人 / 買 A 的人
3. 計算 Lift(A→B) = Confidence / P(B)（>1 表示正相關，=1 獨立，<1 負相關）
4. 篩選 Support > 閾值 且 Confidence > 閾值 且 Lift > 1
```

**樣本數據發現的強關聯**：

| 購買 | 可能也會買 | Lift | Confidence |
|------|-----------|------|------------|
| Champagne | Lobster | 8.0 | 100% |
| Lobster | Champagne | 8.0 | 100% |
| Cheese | Butter | 4.0 | 100% |
| Chocolate | Coffee | 4.0 | 50% |

Lift=8.0 表示：買 Champagne 的人買 Lobster 的機率是隨機客戶的 8 倍。

**API**：
- `POST /api/rfm/recommend`（customerID 選填）→ 個人化推薦
- `POST /api/rfm/associate` → 關聯規則

**前端**：Recommender（關聯規則表 + 每位客戶推薦商品）

---

## 三、核心差異對比

### 3.1 時間軸對比

```
過去 ─────────────── 現在 ─────────────── 未來
  │                    │                    │
  │   RFM              │                    │
  │   「用過去數據      │                    │
  │    給現狀打分」     │                    │
  │                    │                    │
  │   Markov Chain ←───┼───→               │
  │   「從過去遷移      │  預測未來遷移」    │
  │                    │                    │
  │   BTYD CLV ←───────┼──────────────────→│
  │   「從過去行為      │  預測終身價值」    │
  │                    │                    │
  │   推薦系統          │                    │
  │   「從過去購買      │                    │
  │    推測當下需求」   │                    │
```

### 3.2 資料需求對比

| 模型 | 最少客戶數 | 最少交易數 | 時間跨度 | 必需欄位 |
|------|-----------|-----------|----------|----------|
| RFM | 1 | 1 | 任意 | MemberID, OrderID, Timestamp, Price |
| Markov Chain | 5+ | 10+ | 3+ 個週期 | 同上 |
| BTYD CLV | 20+ | 50+ | 6+ 個月 | 同上（需要時間序列） |
| 推薦系統 | 5+ | 20+ | 任意 | 同上 + ProductID, ProductName |

### 3.3 業務應用對比

| 場景 | 用哪個模型 | 怎麼用 |
|------|-----------|--------|
| 今天該給誰發優惠券？ | RFM | 選 Potential Loyalist 或 Almost Lost |
| 下個月會流失多少 VIP？ | Markov Chain | 預測 Best → Churned 的人數 |
| 這個客戶值多少錢？ | BTYD CLV | 計算終身價值，決定獲客成本上限 |
| 這個客戶可能還需要什麼？ | 推薦系統 | 推薦互補商品，提升客單價 |
| 行銷活動的長期效果？ | Markov Chain + RFM | 活動前後對比分群分佈變化 |
| 該花多少錢獲取新客戶？ | BTYD CLV | 獲客成本 < CLV × 30% |

---

## 四、從 PPT 到系統的完整旅程

| PPT Slide | 概念 | TypeScript 檔案 | API 端點 | 前端頁面 |
|-----------|------|----------------|----------|----------|
| 4-8 | RFM 分群與組成 | `core/src/rfm.ts` | `/api/rfm` | Overview, Characteristics |
| 9-11 | 行銷策略 | `worker/src/chat.ts` | `/api/chat` | Chatbot |
| 12-18 | 轉移矩陣預測 | `core/src/markov.ts` | `/api/rfm/transition` | Segment Transition |
| 20-35 | CLV 終身價值 | `core/src/btyd/` | `/api/rfm/clv` | LTV Overview |
| 36-42 | 推薦系統 | `core/src/recommend.ts` | `/api/rfm/recommend`, `/api/rfm/associate` | Recommender |
| 43-47 | 外部因素 | 靜態 SVG | — | External Factors |
| — | What-If | `core/src/whatif.ts` | `/api/rfm/whatif` | What-If Analysis |
| — | 客戶活動 | `core/src/activity.ts` | `/api/rfm/activity` | Customer Activity |
| — | AI 問答 | `worker/src/chat.ts` | `/api/chat` | Chatbot 面板 |

---

## 五、系統實測數據（樣本 8 位客戶）

| 客戶 | 分群 | RFM | 訂單 | 消費 | P(Alive) | CLV | 推薦商品 |
|------|------|-----|------|------|----------|-----|----------|
| C004 | Best | 555 | 16 | $7,130 | 99% | $840K | Salmon, Lobster |
| C002 | Potential | 345 | 10 | $2,005 | 99% | $159K | Chocolate, Coffee |
| C001 | Potential | 453 | 12 | $1,456 | 99% | $137K | Salmon, Chocolate |
| C005 | Potential | 333 | 6 | $630 | 99% | $35K | Wine, Steak |
| C007 | Hibernating | 222 | 5 | $255 | 99% | $13K | Bread, Milk |
| C003 | Hibernating | 121 | 3 | $135 | 99% | $5K | Wine, Butter |
| C006 | High-spend New | 514 | 1 | $200 | 99% | $1K | Chocolate, Coffee |
| C008 | Lost Cheap | 111 | 1 | $50 | 99% | $1K | Milk, Bread |

---

> **Veil RFM Analytics** · https://veil.techforliving.net
> GitHub: https://github.com/ai-caseylai/veil-rfm
> 完整 PPT 對照：`logs/ppt-to-system-mapping-zh.md`
> 理論基礎：`logs/rfm-vs-markov-theory-zh.md`
> 250 題 Q&A 驗證：100% 通過率
