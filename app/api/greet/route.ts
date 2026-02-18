import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    text: "Hello! This is Zazu's Cousin. The app is running successfully.",
  });
}

/**
 * POST /api/greet
 *
 * Slack slash-commands always POST. We handle the same greeting here so
 * that a `/greet` slash command works out-of-the-box.
 */
export async function POST() {
  return NextResponse.json({
    text: "Hello! This is Zazu's Cousin. The app is running successfully.",
    response_type: "in_channel",
  });
}
