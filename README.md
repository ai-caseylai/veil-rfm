# Veil RFM Analytics

Retail customer analytics platform — RFM segmentation, Markov Chain transition modeling, and AI-powered chatbot. 100% TypeScript, runs on Cloudflare Workers + Pages + Qwen LLM.

Forked and modernized from the original [veil-dotnet](https://github.com/ai-caseylai/veil-dotnet) R/Python project.

## Architecture

```
veil-rfm/
├── packages/
│   ├── core/          # Pure TS: RFM engine + Markov Chain + What-If logic
│   ├── worker/        # Cloudflare Worker (REST API + Qwen chatbot proxy)
│   └── frontend/      # Cloudflare Pages (React dashboard)
├── scripts/           # Test scripts (250 Q&A validation)
├── logs/              # Chatbot Q&A test logs
└── sample-data/       # Sample CSV for testing
```

### Package: `core`
Pure business logic, zero I/O, fully unit-tested (vitest).

| Module | Source | Purpose |
|---|---|---|
| `rfm.ts` | `findRFM.R` port | RFM scoring (1-5) + 11-segment classification |
| `markov.ts` | `rfmMC.R` port | Markov Chain transition matrix + prediction |
| `clumpiness.ts` | `clumpiness.R` port | Inter-event time clumpiness metric |
| `whatif.ts` | New | What-If simulation engine |

### Package: `worker`
Cloudflare Worker with 5 REST endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/api/rfm` | POST | Compute RFM scores and segments |
| `/api/rfm/transition` | POST | Markov Chain transition probability matrix |
| `/api/rfm/predict` | POST | Predict future segment distribution |
| `/api/rfm/whatif` | POST | Simulate behavioral changes |
| `/api/chat` | POST | Qwen-powered chatbot with 14 function calls |
| `/api/health` | GET | Health check |

**14 Chatbot Function Calls:**
`getCustomerInfo`, `listAllCustomers`, `runWhatIf`, `explainSegment`, `getSegmentDistribution`, `suggestTargetSegment`, `getSegmentStats`, `getAtRiskCustomers`, `compareCustomers`, `getCustomersByFilter`, `getRevenueBySegment`, `getNewVsReturning`, `getSummaryStats`, `getSegmentMigration`

### Package: `frontend`
React 18 + TypeScript dashboard with 3-language i18n (EN / 繁體中文 / 简体中文).

**Tab structure (mirrors original R Shiny layout):**
- Overview — Pie chart + segment distribution table
- Characteristics — R/F/M bar charts per segment, frequency histogram
- Segment Transition — Interactive vis-network graph + prediction line chart
- Customer Summary — Filterable data table with CSV export
- What-If Analysis — Slider-based simulation with target segment suggestions
- LTV Overview — Average lifetime value per segment bar chart

**Right panel:** Resizable Qwen-powered chatbot with multi-turn conversation.

## Quick Start

### Prerequisites
- Node.js 20+
- Cloudflare account (for deployment)
- Qwen API key from [DashScope](https://dashscope.aliyuncs.com) (for chatbot)

### Local Development

```bash
# Install dependencies
cd veil-rfm
npm install

# Run core unit tests (13 tests)
npm test

# Start Worker API (localhost:8787)
npm run dev:worker

# Start frontend (localhost:3000)
npm run dev:frontend
```

### Deploy to Cloudflare

```bash
# Set Qwen API key (for chatbot)
npx -w packages/worker wrangler secret put QWEN_API_KEY

# Deploy Worker API
npm run deploy:worker

# Build and deploy frontend
VITE_API_URL=https://your-worker.workers.dev npm run build -w packages/frontend
npx -w packages/frontend wrangler pages deploy dist --project-name veil-rfm
```

### Custom Domain

```bash
# Add custom domain to Pages project
npx wrangler pages domain add veil-rfm your-domain.com
```

Add a CNAME DNS record pointing to `veil-rfm.pages.dev` (proxied).

## Usage Guide

### Uploading Data

1. Open the dashboard
2. Navigate to **Import** in the sidebar
3. Drag-and-drop a CSV file with these columns:
   ```
   MemberID, OrderID, Timestamp, NetPrice, Quantity, ProductID, ProductName, Category
   ```
4. Or click **Load Sample Data** for a demo with 8 customers

### Understanding RFM Segments

| # | Segment | RFM Pattern | Business Action |
|---|---|---|---|
| 1 | Best Customers | 555 | VIP retention, exclusive previews |
| 2 | Loyal Customers | ≥444 | Loyalty rewards, cross-sell |
| 3 | Potential Loyalist | ≥333 | Nurture campaigns, milestone rewards |
| 4 | Low-spending Active Loyal | R≥4,F≥4,M≤2 | Bundle deals, upsell |
| 5 | High-spending New Customers | R≥4,M≥4,F≤2 | Follow-up sequence, 2nd purchase discount |
| 6 | Almost Lost Customers | R=2-3,F≥4,M≥4 | Win-back campaign NOW |
| 7 | Churned Best Customers | R=1,F≥4,M≥4 | Aggressive win-back, survey |
| 8 | Customers Needing Attention | Mixed | Investigate by category/channel |
| 9 | About to Sleep Customers | ≤333 | Re-engagement campaign |
| 10 | Hibernating Customers | ≤222 | Low-cost reactivation test |
| 11 | Lost Cheap Customers | 111 | Minimal marketing spend |

### Using the Chatbot

The right-side chatbot is powered by Qwen LLM with 14 function calls. Example questions:

- "Who are the top 5 customers by spending?"
- "Which customers are at risk of churning?"
- "What if C003 made 5 more purchases?"
- "Compare C001 and C004"
- "How much revenue does each segment generate?"
- "What changes would move C008 to Potential Loyalist?"
- 解釋 Best Customers 是什麼？
- 顯示所有客戶

### Running Q&A Validation

```bash
bash scripts/test-chatbot.sh
```

Tests 250 questions across 14 categories. Results saved to `logs/`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, vis-network |
| API | Cloudflare Workers, TypeScript |
| AI Chatbot | Qwen-plus via DashScope (OpenAI-compatible) |
| Testing | Vitest |
| Deployment | Wrangler (Workers + Pages) |
| i18n | Custom React context (en / zh-TW / zh-CN) |

## Project Structure

```
packages/core/src/
├── index.ts           # Barrel export
├── types.ts           # TypeScript interfaces + 11 segment constants
├── rfm.ts             # RFM scoring engine
├── markov.ts          # Markov Chain transition engine
├── clumpiness.ts      # Clumpiness metric
└── whatif.ts          # What-If simulation engine

packages/worker/src/
├── index.ts           # Worker entry + REST endpoints
└── chat.ts            # Qwen chatbot proxy + 14 function implementations

packages/frontend/src/
├── main.tsx           # Entry point + i18n provider
├── App.tsx            # Shell: header, sidebar, KPI bar, routes
├── index.css          # Enterprise design system
├── lib/
│   ├── api.ts         # API client
│   ├── i18n.ts        # 3-language translations
│   ├── parse.ts       # CSV parser (Papa Parse)
│   └── sampleData.ts  # Embedded demo transactions
├── components/
│   ├── ChatBot.tsx    # Qwen chatbot panel (resizable)
│   ├── FileUpload.tsx # CSV drag-and-drop
│   └── DashboardSections.tsx
└── pages/
    ├── RFMOverview.tsx
    ├── RFMCharacteristics.tsx
    ├── RFMTransition.tsx
    ├── RFMCustomerSummary.tsx
    ├── LTVOverview.tsx
    └── WhatIf.tsx
```

## Verified Q&A Coverage

250 questions tested across 14 categories with 100% pass rate (see `logs/`):

| Category | Questions | Status |
|---|---|---|
| Customer Lookup | 20 | 100% |
| Segment Explanation | 15 | 100% |
| Segment Distribution | 10 | 100% |
| Rankings | 20 | 100% |
| What-If Simulation | 25 | 100% |
| Churn & Risk | 20 | 100% |
| Revenue Analysis | 20 | 100% |
| Customer Comparison | 15 | 100% |
| Filtering & Search | 20 | 100% |
| New vs Returning | 10 | 100% |
| Summary & KPIs | 15 | 100% |
| Migration & Transition | 15 | 100% |
| Business Actions | 25 | 100% |
| Edge Cases | 20 | 100% |
| **Total** | **250** | **100%** |
