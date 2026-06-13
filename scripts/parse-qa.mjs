import { readFileSync, writeFileSync } from "fs"

const src = readFileSync("logs/chatbot-qa-500.md", "utf-8")
const lines = src.split("\n")

const qa = []
let currentCategory = null
let currentId = null
let currentQuestion = null
let currentAnswer = []
let inAnswer = false

for (const line of lines) {
  // Category heading: ## RFM Analysis (100 questions)
  const catMatch = line.match(/^## (.+?) \(\d+ questions?\)/)
  if (catMatch) {
    if (currentCategory && currentId) {
      currentCategory.questions.push({
        id: currentId,
        question: currentQuestion,
        answer: currentAnswer.join("\n").trim(),
      })
      currentAnswer = []
      inAnswer = false
    }
    currentCategory = { category: catMatch[1], questions: [] }
    qa.push(currentCategory)
    continue
  }

  // Question heading: ### 1. Tell me about customer C001
  const qMatch = line.match(/^### (\d+)\. (.+)/)
  if (qMatch) {
    if (currentCategory && currentId && currentAnswer.length) {
      currentCategory.questions.push({
        id: currentId,
        question: currentQuestion,
        answer: currentAnswer.join("\n").trim(),
      })
    }
    currentId = parseInt(qMatch[1])
    currentQuestion = qMatch[2]
    currentAnswer = []
    inAnswer = true
    continue
  }

  if (inAnswer && currentCategory) {
    // Stop at the ✅ marker
    if (line.trim() === "**✅**") continue
    // Skip horizontal rules between Q&As
    if (line.trim() === "---" && currentAnswer.length > 0) continue
    currentAnswer.push(line)
  }
}

// Save last question
if (currentCategory && currentId && currentAnswer.length) {
  currentCategory.questions.push({
    id: currentId,
    question: currentQuestion,
    answer: currentAnswer.join("\n").trim(),
  })
}

writeFileSync("packages/frontend/public/data/qa-500.json", JSON.stringify(qa, null, 2))
console.log(`Written ${qa.length} categories, ${qa.reduce((s, c) => s + c.questions.length, 0)} questions`)
