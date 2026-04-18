import { NextResponse } from "next/server";

import { parseSetupInputs } from "@/lib/setup-intelligence";

export const runtime = "nodejs";

type ParseRequest = {
  rawResumeText?: string;
  jobPostingText?: string;
};

export async function POST(request: Request) {
  let body: ParseRequest;

  try {
    body = (await request.json()) as ParseRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.rawResumeText?.trim() || !body.jobPostingText?.trim()) {
    return NextResponse.json(
      { error: "Missing rawResumeText or jobPostingText." },
      { status: 400 },
    );
  }

  const parsed = await parseSetupInputs(body.rawResumeText, body.jobPostingText);

  return NextResponse.json(parsed, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
