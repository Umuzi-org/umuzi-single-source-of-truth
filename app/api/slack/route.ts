import { NextRequest, NextResponse } from "next/server";
import { askQuestion } from "../../../lib/rag";
import { insertQuestion } from "../../../lib/repositories/questions-asked";

/** Strip the `<@BOTID>` mention prefix so we get a clean question. */
function stripMention(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/g, "").trim();
}

// Post a Slack message via chat.postMessage. Replies in a thread when thread_ts is provided.
async function postSlackMessage(
  channel: string,
  text: string,
  threadTs?: string,
) {
  const payload: Record<string, string> = { channel, text };
  if (threadTs) {
    payload.thread_ts = threadTs;
  }

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("chat.postMessage HTTP error:", res.status, await res.text());
  }
}

// Background processor (fire-and-forget)

/**
 * Runs the full RAG pipeline and posts the answer back into the
 * Slack channel / DM where the question originated.
 */
async function processAndReply(
  question: string,
  userId: string,
  channel: string,
  threadTs?: string,
) {
  try {
    // 1. Log the question
    await insertQuestion({ user_id: userId, question_text: question });

    // 2. Run RAG
    const { answer, sources } = await askQuestion(question);

    // 3. Format response with sources
    const sourceList = sources
      .map(
        (s) => `• _${s.title}_ (relevance ${(s.similarity * 100).toFixed(0)}%)`,
      )
      .join("\n");

    const text = sourceList ? `${answer}\n\n*Sources:*\n${sourceList}` : answer;

    // 4. Send to Slack (threaded when threadTs is available)
    await postSlackMessage(channel, text, threadTs);
  } catch (error) {
    console.error("Error processing Slack event:", error);
    await postSlackMessage(
      channel,
      "Sorry, something went wrong while processing your question. Please try again.",
      threadTs,
    );
  }
}

// Route handler

/**
 * POST /api/slack
 *
 * Receives Slack Events API payloads:
 *   • url_verification  — one-time challenge handshake
 *   • event_callback     — real-time events
 *       ◦ app_mention   — someone @-mentioned the bot in a channel
 *       ◦ message (DM)  — someone sent a direct message to the bot
 *
 * We ACK immediately (200) and process in the background so Slack
 * doesn't retry due to a 3-second timeout.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1. URL verification (Slack setup handshake)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 2. Event callbacks
  if (body.type === "event_callback") {
    const event = body.event;
    if (!event) {
      return NextResponse.json({ ok: true });
    }

    // Ignore messages from bots (avoid infinite loops)
    if (event.bot_id || event.subtype === "bot_message") {
      return NextResponse.json({ ok: true });
    }

    const userId: string = event.user ?? "anonymous";
    const channel: string = event.channel;

    // 2a. @mention in a channel — reply in a thread under the original message
    if (event.type === "app_mention") {
      const question = stripMention(event.text ?? "");
      const threadTs: string = event.thread_ts ?? event.ts;

      if (!question) {
        await postSlackMessage(
          channel,
          "👋 Hey! Ask me a question after the mention, e.g. `@Zazu How do I apply for leave?`",
          threadTs,
        );
        return NextResponse.json({ ok: true });
      }

      // ACK immediately, process in background
      processAndReply(question, userId, channel, threadTs);
      return NextResponse.json({ ok: true });
    }

    // 2b. Direct message to the bot
    if (event.type === "message" && event.channel_type === "im") {
      const question = (event.text ?? "").trim();

      if (!question) {
        await postSlackMessage(
          channel,
          "👋 Hi there! Go ahead and ask me anything.",
        );
        return NextResponse.json({ ok: true });
      }

      // ACK immediately, process in background
      processAndReply(question, userId, channel);
      return NextResponse.json({ ok: true });
    }
  }

  // Fallback
  return NextResponse.json({ ok: true });
}
