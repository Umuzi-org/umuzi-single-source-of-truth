import { NextResponse } from "next/server";
import { askQuestion } from "../../../lib/rag";
import { insertQuestion } from "../../../lib/repositories/questions-asked";

// Background processing function to handle the RAG pipeline and respond to Slack asynchronously.
async function processAndRespond(
  question: string,
  userId: string,
  responseUrl: string,
) {
  try {
    await insertQuestion({ user_id: userId, question_text: question });

    const { answer, sources } = await askQuestion(question);

    const sourceList = sources
      .map(
        (s) => `• _${s.title}_ (relevance ${(s.similarity * 100).toFixed(0)}%)`,
      )
      .join("\n");

    const text = sourceList ? `${answer}\n\n*Sources:*\n${sourceList}` : answer;

    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, response_type: "ephemeral" }),
    });
  } catch (error) {
    console.error("Error processing question in background:", error);
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Sorry, something went wrong while processing your question. Please try again.",
        response_type: "ephemeral",
      }),
    }).catch(() => {});
  }
}

/**
 * POST /api/ask
 *
 * Handles Slack slash-command payloads (application/x-www-form-urlencoded).
 *
 * Slack enforces a 3-second timeout on slash-command responses, but our RAG
 * pipeline takes longer. To work around this we:
 *   1. Immediately ACK with 200 + a short { text } message (within 3 s).
 *   2. Kick off the RAG pipeline in the background.
 *   3. POST the real answer back to Slack via the `response_url`.
 *
 * Also accepts JSON payloads for non-Slack callers (backwards-compatible).
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // Slack slash-command (form-encoded)
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const question = (formData.get("text") as string | null)?.trim();
      const responseUrl = formData.get("response_url") as string | null;
      const userId = (formData.get("user_id") as string | null) ?? "anonymous";

      if (!question) {
        return NextResponse.json(
          {
            text: "Please provide a question after the command, e.g. `/ask How do I book a meeting room?`",
          },
          { status: 200 },
        );
      }

      if (!responseUrl) {
        return NextResponse.json(
          { text: "Missing response_url — cannot deliver the answer." },
          { status: 200 },
        );
      }

      // Fire-and-forget: process in the background
      processAndRespond(question, userId, responseUrl);

      // Immediately ACK to Slack (< 3 s)
      return NextResponse.json({
        text: `🔍 Looking up: _"${question}"_ — hang tight…`,
        response_type: "ephemeral",
      });
    }

    // ── JSON callers (non-Slack) ────────────────────────────────────
    const body = await req.json();
    const { question, userId, topN } = body as {
      question?: string;
      userId?: string;
      topN?: number;
    };

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return NextResponse.json(
        { text: "A non-empty 'question' field is required." },
        { status: 400 },
      );
    }

    const trimmedQuestion = question.trim();

    await insertQuestion({
      user_id: userId ?? "anonymous",
      question_text: trimmedQuestion,
    });

    const { answer, sources } = await askQuestion(trimmedQuestion, topN);

    return NextResponse.json({
      text: answer,
      sources: sources.map((s) => ({
        title: s.title,
        chunk_text: s.chunk_text,
        similarity: s.similarity,
        slab_url: s.slab_url,
      })),
    });
  } catch (error) {
    console.error("Error in /api/ask:", error);
    return NextResponse.json(
      { text: "Internal server error while processing your question." },
      { status: 500 },
    );
  }
}
