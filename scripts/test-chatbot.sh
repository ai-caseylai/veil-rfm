#!/bin/bash
# Test 250 Q&A scenarios against the RFM chatbot
API="https://veil-rfm-api.ai-caseylai.workers.dev/api/chat"
LOG="chatbot-qa-log-$(date +%Y%m%d_%H%M%S).md"
TXN=$(cat /tmp/rfm_payload.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['transactions']))")

# ── 250 questions across 14 categories ──
QUESTIONS=(
  # === Category 1: Customer Lookup (20 Q) ===
  "Tell me about customer C001"
  "What is C004's segment?"
  "Show me C007's RFM score"
  "How much has C002 spent in total?"
  "How many orders does C003 have?"
  "When did C005 last purchase?"
  "What is the average spending of C001 per order?"
  "Is C006 a new customer?"
  "What segment does C008 belong to?"
  "Tell me everything about C004"
  "What is C001's recency score?"
  "How does C002 rank in terms of spending?"
  "Describe C003's purchase behavior"
  "Is C005 a loyal customer?"
  "What is C007's frequency score?"
  "How long has C008 been inactive?"
  "Is C004 a Best Customer?"
  "What is the monetary score for C002?"
  "How many transactions does C001 have?"
  "Show me C006's complete profile"

  # === Category 2: Segment Explanation (15 Q) ===
  "What does Best Customers mean?"
  "Explain Loyal Customers"
  "What is a Potential Loyalist?"
  "Describe High-spending New Customers"
  "What are Almost Lost Customers?"
  "Explain Churned Best Customers"
  "What does Hibernating Customers mean?"
  "Explain Lost Cheap Customers"
  "What is Customers Needing Attention?"
  "Describe About to Sleep Customers"
  "What is Low-spending Active Loyal Customers?"
  "Which segment is the most valuable?"
  "Which segment is the worst?"
  "How do you identify a Best Customer?"
  "What is the difference between Hibernating and Lost Cheap?"

  # === Category 3: Segment Distribution (10 Q) ===
  "How many customers are in each segment?"
  "What is the segment distribution?"
  "Which segment has the most customers?"
  "Which segment has the fewest customers?"
  "How many segments are active?"
  "What percentage of customers are Best Customers?"
  "How many customers are in the Loyal segment?"
  "Show me the segment breakdown"
  "Are there any empty segments?"
  "What proportion of customers are at risk?"

  # === Category 4: Rankings (20 Q) ===
  "Who are the top 5 customers by spending?"
  "List all customers sorted by orders"
  "Who has the most transactions?"
  "Who spent the least?"
  "Rank customers by recency"
  "Who are the top 3 customers?"
  "Which customer has the highest order count?"
  "Show me the bottom 3 customers by spending"
  "Who is the most recent buyer?"
  "Who is the least recent buyer?"
  "List customers in Hibernating segment"
  "Show me customers with more than 5 orders"
  "Who are the customers in Potential Loyalist?"
  "List all customers in Best Customers segment"
  "Who has spent more than $1000?"
  "Show me the highest value customers"
  "Which customers buy most frequently?"
  "Who are the churned best customers?"
  "List customers who haven't purchased in 30+ days"
  "Show me all customers sorted by total spending"

  # === Category 5: What-If Simulation (25 Q) ===
  "What if C003 made 10 purchases?"
  "If C008 bought something today, would their segment change?"
  "What if C005 increased their spending to $500 per order?"
  "Simulate C002 making 5 more orders"
  "What happens to C001 if they don't buy for 90 days?"
  "If C003 spent $300 per order, what segment would they be?"
  "What if C007 ordered 15 times?"
  "Simulate C008 becoming a daily shopper"
  "What changes would move C006 to Loyal Customers?"
  "How can C003 become a Potential Loyalist?"
  "What if C005 had recency of 0 days?"
  "Simulate doubling C002's order count"
  "What if C004 reduced their spending by half?"
  "If C001 doubled their frequency, what changes?"
  "What would it take for C008 to reach Best Customers?"
  "Simulate C007 with 12 orders and $200 avg spend"
  "What if C006's recency was 1 day?"
  "How to move C003 to Loyal Customers?"
  "What changes would upgrade C005's segment?"
  "If C002 came back today, what segment?"
  "Simulate C008 with recency=0, frequency=5, monetary=150"
  "What if all customers bought one more time?"
  "Can C007 reach Best Customers?"
  "What minimal changes upgrade C003?"
  "How to turn C008 into a valuable customer?"

  # === Category 6: Churn & Risk (20 Q) ===
  "Which customers are at risk of churning?"
  "Show me the churn risk analysis"
  "Who is most likely to churn?"
  "Which high-value customers are slipping away?"
  "Are there any critical churn risks?"
  "Which Almost Lost customers need attention?"
  "Who are the churned best customers?"
  "How many customers are in the danger zone?"
  "Which loyal customers have stopped buying?"
  "What is the churn rate?"
  "Identify customers who were best but are now lost"
  "Who needs win-back campaigns?"
  "Which customers have high spending but low recency?"
  "Who is about to sleep?"
  "Show customers with RFM score below 333"
  "Which customers have the highest churn probability?"
  "Are Best Customers at risk?"
  "How urgent is the churn situation?"
  "Which customers should we contact today?"
  "What percentage of revenue is at risk?"

  # === Category 7: Revenue Analysis (20 Q) ===
  "What is the total revenue?"
  "How is revenue distributed across segments?"
  "Which segment generates the most revenue?"
  "What percentage of revenue comes from Best Customers?"
  "Show revenue by segment"
  "What is the average revenue per customer?"
  "Which segment has the highest average spending?"
  "How much revenue do Loyal Customers generate?"
  "What is the revenue contribution of each segment?"
  "Which segment is the most profitable?"
  "How much did C004 contribute to total revenue?"
  "What is the average order value across all customers?"
  "Show revenue breakdown by segment"
  "Which low-value segments drag down revenue?"
  "What percentage of revenue is from new customers?"
  "How concentrated is revenue in top segments?"
  "What is the revenue per segment per customer?"
  "Which segment has the highest total spending?"
  "Compare revenue between Loyal and Hibernating"
  "What drives the majority of our revenue?"

  # === Category 8: Customer Comparison (15 Q) ===
  "Compare C001 and C004"
  "How does C002 compare to C003?"
  "Who is better: C004 or C002?"
  "Compare the top two spenders"
  "Side by side: C001 vs C008"
  "Compare C005 with C007"
  "What is the difference between C004 and C001?"
  "Compare best and worst customer"
  "How does C003 stack up against C002?"
  "Compare C006 to the average customer"
  "Which of C001 and C002 is more loyal?"
  "Compare all customers in Potential Loyalist"
  "C004 vs C005: who spends more per order?"
  "Compare recency between C001 and C008"
  "Who has better metrics: C002 or C005?"

  # === Category 9: Filtering & Search (20 Q) ===
  "Show customers with more than 10 orders"
  "Find customers who spent over $2000"
  "Who purchased in the last 7 days?"
  "List customers with recency under 30 days"
  "Show customers with fewer than 3 orders"
  "Find customers in Loyal segment with low spending"
  "Who has 5-10 orders?"
  "Show customers spending $500-$1000"
  "Find Best Customers who haven't purchased in 14 days"
  "List customers with RFM starting with 5"
  "Who has exactly 1 order?"
  "Find customers with monetary score of 5"
  "Show new customers with high spending"
  "Find customers at the intersection of high orders and high recency"
  "Who purchased in the last 24 hours?"
  "Show customers with frequency score 1"
  "List customers who are either Best or Loyal"
  "Find customers over $5000 total"
  "Who has more than 10 orders but low spending?"
  "Show customers with perfect recency but low frequency"

  # === Category 10: New vs Returning (10 Q) ===
  "How many new customers do we have?"
  "What is the ratio of new to returning customers?"
  "How much do new customers spend vs returning?"
  "Show me the new customer breakdown"
  "Are new customers more valuable than returning?"
  "What percentage of customers are first-time buyers?"
  "How many repeat customers are there?"
  "Compare new customer spending to average"
  "What is the retention rate?"
  "How many single-purchase customers are there?"

  # === Category 11: Summary & KPIs (15 Q) ===
  "Give me a business summary"
  "What are the key metrics?"
  "Show me the dashboard overview"
  "What is the health of our customer base?"
  "Summarize the customer analytics"
  "What is the average recency?"
  "How many total orders were placed?"
  "What is the average order value?"
  "Give me the executive summary"
  "What are the top 3 insights from the data?"
  "How is customer engagement?"
  "What is the overall customer value?"
  "Summarize revenue, customers, and segments"
  "What should I focus on to grow revenue?"
  "What is the biggest opportunity in this data?"

  # === Category 12: Migration & Transition (15 Q) ===
  "How do customers move between segments?"
  "What is the transition probability from Best Customers?"
  "Where do Hibernating customers typically go?"
  "Show migration for Loyal Customers"
  "How likely is a Potential Loyalist to become Loyal?"
  "What percentage of Best Customers stay Best?"
  "Where do customers go after being Almost Lost?"
  "Segment migration for Churned Best Customers"
  "How do new customers transition?"
  "What is the retention rate for each segment?"
  "Show transition probabilities for Hibernating"
  "Where do Lost Cheap Customers come from?"
  "How stable is the Best Customers segment?"
  "What segment has the worst retention?"
  "Analyze the customer lifecycle through segments"

  # === Category 13: Business Actions (25 Q) ===
  "How can I increase customer loyalty?"
  "What should I do about churning customers?"
  "Give me a win-back strategy"
  "How to convert Potential Loyalists to Loyal?"
  "What campaign should I run for Hibernating customers?"
  "How to increase average order value?"
  "What is the best strategy for Best Customers?"
  "How to re-engage Almost Lost customers?"
  "What offers work for Low-spending Active Loyal?"
  "How to prevent Best Customers from churning?"
  "What is the ROI of targeting Churned Best?"
  "Should we focus on acquisition or retention?"
  "What segments should we prioritize?"
  "How to reduce the number of Hibernating customers?"
  "What loyalty program would work best?"
  "How to increase purchase frequency?"
  "What pricing strategy for different segments?"
  "How to move customers up the value chain?"
  "Which customers should get VIP treatment?"
  "What is the most cost-effective growth lever?"
  "How to design a re-engagement campaign?"
  "What email frequency for each segment?"
  "How to reduce customer acquisition cost?"
  "What cross-sell opportunities exist?"
  "Give me a 90-day customer growth plan"

  # === Category 14: Mixed / Edge Cases (20 Q) ===
  "What is RFM analysis?"
  "How do you calculate RFM scores?"
  "Why are there 11 segments?"
  "What is a good RFM score?"
  "How often should I refresh RFM analysis?"
  "Can RFM predict customer lifetime value?"
  "What data do I need for RFM?"
  "How accurate is the Markov Chain prediction?"
  "What is the difference between RFM and CLV?"
  "Can I export this analysis?"
  "How to interpret the transition graph?"
  "What does recency really measure?"
  "Why is frequency important?"
  "How does monetary value affect segmentation?"
  "Can I combine segments for campaigns?"
  "What is the minimum data for meaningful RFM?"
  "How do seasonal patterns affect RFM?"
  "Can I customize the segment definitions?"
  "What other metrics complement RFM?"
  "How to track segment changes over time?"
)

mkdir -p /Users/perry/veil-rfm/logs
LOG="/Users/perry/veil-rfm/logs/chatbot-qa-$(date +%Y%m%d_%H%M%S).md"

echo "# RFM Chatbot Q&A Test — $(date)" > "$LOG"
echo "" >> "$LOG"
echo "**Model**: Qwen-plus via DashScope Intl" >> "$LOG"
echo "**Functions**: 14 (getCustomerInfo, listAllCustomers, runWhatIf, explainSegment, getSegmentDistribution, suggestTargetSegment, getSegmentStats, getAtRiskCustomers, compareCustomers, getCustomersByFilter, getRevenueBySegment, getNewVsReturning, getSummaryStats, getSegmentMigration)" >> "$LOG"
echo "**Sample Data**: 8 customers, 54 transactions" >> "$LOG"
echo "" >> "$LOG"
echo "| # | Question | Answer (truncated) | Status |" >> "$LOG"
echo "|---|----------|-------------------|--------|" >> "$LOG"

PASS=0
FAIL=0

for i in "${!QUESTIONS[@]}"; do
  Q="${QUESTIONS[$i]}"
  NUM=$((i + 1))

  # Escape for JSON
  Q_ESC=$(echo "$Q" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")

  RESP=$(curl -s -X POST "$API" \
    -H "Content-Type: application/json" \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":$Q_ESC}],\"transactions\":$TXN}" 2>/dev/null)

  REPLY=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('reply','ERROR: '+d.get('error','unknown'))[:200])" 2>/dev/null)
  HAS_ERROR=$(echo "$RESP" | python3 -c "import sys,json; print('error' in json.load(sys.stdin))" 2>/dev/null)

  if [ "$HAS_ERROR" = "True" ]; then
    FAIL=$((FAIL + 1))
    STATUS="❌ FAIL"
  else
    PASS=$((PASS + 1))
    STATUS="✅ PASS"
  fi

  # Clean for markdown table
  REPLY_CLEAN=$(echo "$REPLY" | tr '\n' ' ' | tr '|' '/' | head -c 200)
  Q_CLEAN=$(echo "$Q" | tr '|' '/')

  echo "| $NUM | $Q_CLEAN | $REPLY_CLEAN | $STATUS |" >> "$LOG"
  echo "  [$NUM/$((i+1))] $STATUS: $Q"

  # Small delay to avoid rate limits
  sleep 0.3
done

echo "" >> "$LOG"
echo "---" >> "$LOG"
echo "" >> "$LOG"
echo "## Summary" >> "$LOG"
echo "- **Passed**: $PASS / $((PASS + FAIL))" >> "$LOG"
echo "- **Failed**: $FAIL / $((PASS + FAIL))" >> "$LOG"
echo "- **Success Rate**: $(python3 -c "print(f'{($PASS/($PASS+$FAIL)*100):.1f}%')") " >> "$LOG"
echo "" >> "$LOG"

echo ""
echo "============================================"
echo "Results: $PASS passed, $FAIL failed"
echo "Success rate: $(python3 -c "print(f'{($PASS/($PASS+$FAIL)*100):.1f}%')")"
echo "Log saved: $LOG"
