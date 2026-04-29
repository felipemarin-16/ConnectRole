import { NextResponse } from "next/server";

import { generateInterviewSummary } from "@/lib/interview-brain";

export const runtime = "nodejs";

type SummaryRequest = {
  state?: {
    role?: string;
    previousQuestions?: string[];
    previousAnswers?: string[];
  };
};

export async function POST(request: Request) {
  let body: SummaryRequest;

  try {
    body = (await request.json()) as SummaryRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const state = body.state;

  if (!state?.role || !state.previousQuestions || !state.previousAnswers) {
    return NextResponse.json(
      { error: "Missing required interview state (role/previousQuestions/previousAnswers)." },
      { status: 400 },
    );
  }

  const summary = await generateInterviewSummary({
    candidateName: "",
    role: state.role,
    companyName: "",
    seniority: "mid-level",
    interviewType: "mixed behavioral and role-fit",
    resumeProjectSummary: "",
    resumeHighlights: [],
    resumeSkills: [],
    jobSummary: "",
    companySummary: "",
    requiredSkills: [],
    preferredSkills: [],
    responsibilities: [],
    keywords: [],
    previousQuestions: state.previousQuestions,
    previousAnswers: state.previousAnswers,
    coveredSkills: [],
    latestQuestion: "",
    latestAnswer: "",
  });

  return NextResponse.json({ summary }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
