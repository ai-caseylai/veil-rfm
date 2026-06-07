# PPT 概念 → Veil TypeScript 系統實作對照

> 原始 PPT：`PPT-PolyU 190211 (RFM) BL (2).pptx`（VEII, 2019，47 頁）
> 對應系統：Veil RFM Analytics（TypeScript, Cloudflare, Qwen LLM）
> 線上：https://veil.techforliving.net

---

## 一、RFM 客戶分群（PPT Slide 4-11）

### PPT 概念：用 R/F/M 三個指標劃分客戶群組

**PPT 說**：「RFM Metrics: a customer segmentation technique that uses past purchase behavior to divide customers into groups.」

### 系統實作

**核心程式碼**：`packages/core/src/rfm.ts`

```
PPT 概念                  程式碼函數                  說明
──────────────────────────────────────────────────────────────
原始交易資料            →  getRFMData()              聚合為每位客戶的 R/F/M 統計
百分位數評分 (1-5)      →  rfmCompute()              與所有客戶比較的相對分數
11 群分類               →  rfmSegmentation()         規則引擎分類
合併結果                →  getRFMResults()            RFM 資料 + 分數 + 分群
```

**API 端點**：`POST /api/rfm`
```bash
curl -X POST https://veil-rfm-api.ai-caseylai.workers.dev/api/rfm \
  -H "Content-Type: application/json" \
  -d '{"transactions": [...]}'
```

**前端頁面**：
- **Overview**（`/rfm-overview`）：圓餅圖 + 分群分佈表（對應 PPT Slide 7「Customer segments composition」）
- **Characteristics**（`/rfm-characteristics`）：R/F/M 平均長條圖（對應 PPT Slide 8「Behavior of each customer segment」）

### PPT Slide 9-11：行銷策略

**PPT 說**：
> Best Customers – Make them feel valued and appreciated.
> Churned Best Customers – Send personalized emails to reconnect.

**系統實作**：Chatbot 的 `explainSegment` 函數
- 問「Best Customers 適合什麼策略？」→ Qwen LLM 返回具體行動建議
- 每個分群都有內建的行銷策略描述（`chat.ts` 中的 `execExplainSegment`）

---

## 二、馬可夫鏈轉移矩陣（PPT Slide 12-18）

### PPT 概念：預測客戶分群的未來變化

**PPT 說**：
> 「Predicted transition matrix of customer segments」
> 「Over 96% of Lost Cheap Customers will not change」
> 「The predicted number of customers in the Lost Cheap Customers segment rise very quickly within the first year」

### 系統實作

**核心程式碼**：`packages/core/src/markov.ts`

```
PPT 概念                    程式碼函數                      說明
──────────────────────────────────────────────────────────────────
滑動時間窗口                txn2rfmSegmentList()           每個月重算一次 RFM
狀態序列                    rfmSegment2mcSeq()             客戶在各時間點的狀態
轉移計數                    mcSeq2Counts()                 統計狀態間轉移次數
轉移機率矩陣                mcCounts2Prob()                歸一化為機率（11×11）
預測未來分佈                predictSegmentMovement()       矩陣乘法預測 n 期後
```

**API 端點**：`POST /api/rfm/transition`
```bash
curl -X POST .../api/rfm/transition \
  -d '{"transactions":[...], "rfmPeriod":[1,"year"], "transitionPeriod":[1,"month"]}'
```

回傳：`{ mcSeq, mcCounts, transProb, predicted }`

**前端頁面**：**Segment Transition**（`/rfm-transition`）
- vis-network 互動圖：11 個節點 + 轉移箭頭（對應 PPT Slide 13）
- 預測折線圖：顯示各分群未來 6 期客戶數（對應 PPT Slide 17-18）
- 圖例：綠色=升級、紅色=降級、藍色=自環

### 對照 PPT Slide 14 的具體結論

| PPT 結論 | 系統如何驗證 |
|----------|-------------|
| 「大部分客戶會留在原分群」 | 轉移矩陣對角線值最高（自環機率大） |
| 「Lost Cheap 96% 不會變」 | 查看 `transProb[10][10]`（自環機率） |
| 「客戶更容易降級」 | 下三角（降級）機率總和 > 上三角（升級） |

---

## 三、客戶終身價值 CLV（PPT Slide 20-35）

### PPT 概念：預測客戶未來的交易次數與金額

**PPT 說**：「Customer Lifetime Value is the predicted sum of all future revenues」

### 系統實作

原始 R 程式碼使用了 BTYD（Buy 'Til You Die）模型（Pareto/NBD、BG/NBD），需要 MCMC 抽樣。TypeScript 版本採用**簡化 CLV 估算**：

**前端頁面**：**LTV Overview**（`/ltv-overview`）
- 基於歷史總消費的簡易 CLV 估算：`平均消費金額 × 預期活躍週期`
- 各分群平均 CLV 長條圖（對應 PPT Slide 31「Predicted average CLV in each customer segment」）

**Chatbot 查詢**：問「哪個客戶的終身價值最高？」
→ Qwen 調用 `getCustomerInfo` + `getSegmentStats` 綜合分析

### 差距分析

| PPT 功能 | 原始 R 實作 | TypeScript 狀態 |
|----------|-----------|----------------|
| Pareto/NBD 參數估計 | `BTYDmodels.R::fit.pnbd()` | ❌ 未移植（需 MLE 優化） |
| 未來交易次數預測 | `futureTxnLevel()` | ❌ 未移植 |
| 未來交易金額預測 | `MonetaryValue.R` | ❌ 未移植 |
| 折現現金流 DERT | `findLTV.R::computeDERT()` | ❌ 未移植 |
| 簡易 CLV 估算 | — | ✅ 已實作 |

---

## 四、推薦系統（PPT Slide 36-42）

### PPT 概念：協同過濾 + 關聯規則

**PPT 說**：
> 「Item-based collaborative filtering」
> 「Association rule mining」
> 「Naïve Bayesian classifiers」

### 系統實作狀態：❌ 未移植

原始 R 程式碼中有 MBA（Market Basket Analysis）相關邏輯（`map_reduce-driver.py` 中的 `agg_type == 'mba'`），但完整的推薦系統未移植到 TypeScript。

**若需實作**，可新增：
- `core/src/recommender.ts`：Item-based CF + Association Rules
- `POST /api/recommend`：輸入客戶 ID，回傳推薦商品
- 前端「Customer Profile」頁面：顯示個人化推薦（對應 PPT Slide 42 效能評估）

---

## 五、外部因素分析（PPT Slide 43-47）

### PPT 概念：人口統計資料與銷售的關聯

**PPT 說**：
> 「Total sale amount and proportion population aged 45-64 are positively correlated」
> 「Total sale amount and male labour force participation rate are positive correlated」

### 系統實作

原始 R Shiny 的 External Factors 頁面使用靜態 SVG 圖片。TypeScript 版本同樣以靜態圖片展示（`Shiny/www/*.svg`）。

**當前狀態**：未整合即時人口統計 API。這些是外部資料集的分析結果，需離線產生。

---

## 六、完整功能對照總表

| PPT Slide | 功能 | TypeScript 實作 | API | 前端 |
|-----------|------|----------------|-----|------|
| 4-8 | RFM 分群 | `core/src/rfm.ts` | `POST /api/rfm` | Overview / Characteristics |
| 9-11 | 行銷策略 | `chat.ts::explainSegment` | `POST /api/chat` | Chatbot |
| 12-18 | 轉移矩陣 | `core/src/markov.ts` | `POST /api/rfm/transition` | Segment Transition |
| 20-35 | CLV | 簡化估算 | — | LTV Overview |
| 36-42 | 推薦系統 | ❌ 未移植 | — | — |
| 43-47 | 外部因素 | 靜態 SVG | — | External Factors |
| — | What-If | `core/src/whatif.ts` | `POST /api/rfm/whatif` | What-If Analysis |
| — | AI 問答 | `chat.ts`（14 個 functions） | `POST /api/chat` | Chatbot 面板 |
| — | 客戶活動 | `core/src/activity.ts` | `POST /api/rfm/activity` | Customer Activity |

---

## 七、實際操作示範

### 場景 1：想知道本月各分群客戶數（PPT Slide 7）

1. 開啟 https://veil.techforliving.net
2. 點側邊欄「總覽」→ 看到圓餅圖 + 分群表
3. 或用 chatbot 問：「各分群有多少客戶？」

### 場景 2：想知道下個月客戶流向（PPT Slide 13）

1. 點側邊欄「分群遷移」
2. 看到互動式轉移圖：節點=分群，邊=機率
3. 下方預測圖顯示各分群未來 6 個月客戶數
4. 或用 chatbot 問：「Best Customers 下個月會去哪裡？」

### 場景 3：想知道某客戶的 CLV（PPT Slide 31）

1. 點側邊欄「價值總覽」→ 看到各分群平均 CLV
2. 或用 chatbot 問：「C001 的終身價值是多少？」

### 場景 4：想知道改變策略後的影響（PPT 未覆蓋，系統新增）

1. 點側邊欄「情境模擬」
2. 選客戶、拉滑桿調整 R/F/M
3. 即時看到分群變化 + 到達目標分群的建議
4. 或用 chatbot 問：「如果 C003 多買 5 次會怎樣？」

---

> **Veil RFM Analytics** · https://veil.techforliving.net
> GitHub: https://github.com/ai-caseylai/veil-rfm
> 250 題 Q&A 驗證 · 100% 通過率
