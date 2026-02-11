import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Hello! This is Zazu's Cousin. The app is running successfully.",
  });
}
