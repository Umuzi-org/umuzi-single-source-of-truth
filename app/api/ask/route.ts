import { NextResponse } from "next/server";
import { askQuestion } from "../../../lib/rag";
import { insertQuestion } from "../../../lib/repositories/questions-asked";

/**
 * POST /api/ask
 *
 * Receives a user question, runs it through the RAG pipeline, and returns
 * the generated answer together with source references.
 *
 * Request body:
 *   { "question": string, "userId"?: string, "topN"?: number }
 *
 * Response:
 *   { "answer": string, "sources": [{ title, chunk_text, similarity, slab_url }] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, userId, topN } = body as {
      question?: string;
      userId?: string;
      topN?: number;
    };

    // Validate input
    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "A non-empty 'question' field is required." },
        { status: 400 },
      );
    }

    const trimmedQuestion = question.trim();

    // Log the question
    await insertQuestion({
      user_id: userId ?? "anonymous",
      question_text: trimmedQuestion,
    });

    // Run the RAG pipeline
    const { answer, sources } = await askQuestion(trimmedQuestion, topN);

    // Return the result
    return NextResponse.json({
      answer,
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
      { error: "Internal server error while processing your question." },
      { status: 500 },
    );
  }
}
