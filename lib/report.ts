import { query } from "./db";
import { generateText } from "./gemini";
import type { QuestionAsked } from "./db-types";
import type { MonthlyReport } from "./report-types";

// Fetch every question asked in the past month from the database
async function getMonthlyQuestions(): Promise<QuestionAsked[]> {
  const result = await query<QuestionAsked>(
    `SELECT * FROM questions_asked
     WHERE timestamp >= NOW() - INTERVAL '30 days'
     ORDER BY timestamp DESC`,
  );
  return result.rows;
}

/**
 * Send all monthly questions to Gemini in one shot and ask it to
 * categorise them, find the most-asked question, and produce
 * observations + improvement suggestions.
 */
async function analyzeQuestions(
  questions: QuestionAsked[],
): Promise<MonthlyReport> {
  const questionTexts = questions.map((q) => q.question_text);

  const prompt = `You are an analytics assistant. Analyze the following ${questions.length} questions that were asked to an internal company AI bot over the past month and return a JSON report.

Questions:
${questionTexts.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "categories": [
    {"name": "Category Name", "count": 10, "percentage": 25}
  ],
  "mostAsked": {
    "question": "The most frequently asked question (paraphrased if needed)",
    "count": 5
  },
  "observations": [
    "Observation 1",
    "Observation 2"
  ],
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ]
}

Rules:
- Group questions into 3-7 meaningful categories.
- Category counts must add up to ${questions.length}.
- Percentages must sum to 100 (round as needed).
- Identify the single most frequently asked question (group near-duplicates together).
- Provide 2-3 observations about usage patterns.
- Provide 2-3 actionable improvement suggestions.
- Return ONLY the JSON object, nothing else.`;

  const responseText = await generateText(prompt);

  // Strip any accidental markdown code fences Gemini might add
  const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
  const analysis = JSON.parse(cleaned);

  return {
    totalQuestions: questions.length,
    categories: analysis.categories,
    mostAsked: analysis.mostAsked,
    observations: analysis.observations,
    suggestions: analysis.suggestions,
  };
}

// ── Formatting ─────────────────────────────────────────────────────────────

// Format the report into a nice string for posting to Slack
function formatReport(report: MonthlyReport): string {
  const categoryLines = report.categories
    .sort((a, b) => b.percentage - a.percentage)
    .map((c, i) => `${i + 1}. ${c.name} (${c.percentage}%)`)
    .join("\n");

  const observationLines = report.observations.map((o) => `- ${o}`).join("\n");

  const suggestionLines = report.suggestions.map((s) => `- ${s}`).join("\n");

  return [
    "📊 Monthly AI Bot Usage Report",
    "",
    `Total Questions: ${report.totalQuestions}`,
    "",
    "Top Categories:",
    categoryLines,
    "",
    "🔥 Most Asked Question:",
    `"${report.mostAsked.question}" (${report.mostAsked.count} times)`,
    "",
    "📌 Observations:",
    observationLines,
    "",
    "💡 Suggested Improvements:",
    suggestionLines,
  ].join("\n");
}

// Reporting function to post the report to Slack
export async function generateMonthlyReport(): Promise<string> {
  const questions = await getMonthlyQuestions();

  if (questions.length === 0) {
    return "📊 Monthly AI Bot Usage Report\n\nNo questions were asked in the past 30 days.";
  }

  const report = await analyzeQuestions(questions);
  return formatReport(report);
}
