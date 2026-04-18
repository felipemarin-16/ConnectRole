"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { Shell } from "@/components/shell";
import { compileFinalReport } from "@/lib/interview-engine";
import { downloadCoverLetterPdf } from "@/lib/pdf-export";
import { clearRoleReadySession, getFinalReport, getInterviewSession, getSetupSession, saveFinalReport } from "@/lib/session";
import type { FinalReport, InterviewSession, InterviewTurn, SetupSession } from "@/lib/types";

type ResultsPhase = "walkthrough" | "summary";

function TurnFeedbackCard({
  turn,
  index,
  total,
  revealStep,
}: {
  turn: InterviewTurn;
  index: number;
  total: number;
  revealStep?: number;
}) {
  const questionVisible = revealStep === undefined || revealStep >= 1;
  const answerVisible = revealStep === undefined || revealStep >= 2;
  const feedbackVisible = revealStep === undefined || revealStep >= 3;

  return (
    <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_50px_rgba(19,28,46,0.08)]">
      <div
        className={`transition-all duration-500 ${
          questionVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">
            Question {index + 1} of {total}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-9 text-ink">{turn.question}</h2>
        </div>
      </div>

      <div
        className={`mt-6 rounded-[24px] bg-[#FBF7F1] p-5 transition-all duration-500 ${
          answerVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Your answer</p>
        <p className="mt-3 text-base leading-8 text-ink">{turn.answer}</p>
      </div>

      <div
        className={`mt-5 rounded-[24px] border border-ink/10 bg-[#F7FAFD] p-5 transition-all duration-500 ${
          feedbackVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Feedback</p>
        <p className="mt-3 text-sm leading-7 text-ink">{turn.feedback.coachSummary}</p>
      </div>
    </div>
  );
}

export function ResultsScreen() {
  const router = useRouter();
  const [setup, setSetup] = useState<SetupSession | null>(null);
  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [phase, setPhase] = useState<ResultsPhase>("walkthrough");
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);
  const [showReviewAnswers, setShowReviewAnswers] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [revealStep, setRevealStep] = useState(0);

  useEffect(() => {
    const sessionSetup = getSetupSession();
    const sessionInterview = getInterviewSession();
    const sessionReport = getFinalReport();

    if (!sessionSetup || !sessionInterview) {
      return;
    }

    setSetup(sessionSetup);
    setInterview(sessionInterview);

    if (sessionReport) {
      setReport(sessionReport);
      return;
    }

    const nextReport = compileFinalReport(
      sessionInterview.turns,
      sessionSetup.resume,
      sessionSetup.job,
      sessionSetup.companySummary,
    );
    saveFinalReport(nextReport);
    setReport(nextReport);
  }, []);

  const activeTurn = useMemo(() => {
    if (!interview?.turns.length) {
      return null;
    }

    return interview.turns[Math.min(activeTurnIndex, interview.turns.length - 1)];
  }, [activeTurnIndex, interview?.turns]);

  useEffect(() => {
    if (phase !== "walkthrough" || !activeTurn) {
      return;
    }

    setRevealStep(0);

    const timers = [
      window.setTimeout(() => setRevealStep(1), 120),
      window.setTimeout(() => setRevealStep(2), 420),
      window.setTimeout(() => setRevealStep(3), 760),
      window.setTimeout(() => setRevealStep(4), 1080),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeTurn, activeTurnIndex, phase]);

  if (!setup || !interview || !report) {
    return (
      <Shell
        badge="Results"
        title="Your interview results will appear here."
        subtitle="Complete a session first so RoleReady can generate feedback, transcript review, and the cover letter draft."
        current="results"
      >
        <div className="panel p-6">
          <button type="button" className="button-primary" onClick={() => router.push("/")}>
            Return to setup
          </button>
        </div>
      </Shell>
    );
  }

  const roleLabel = setup.job.companyName
    ? `${setup.job.roleTitle} at ${setup.job.companyName}`
    : setup.job.roleTitle;

  if (phase === "walkthrough" && activeTurn) {
    const isLastTurn = activeTurnIndex >= interview.turns.length - 1;

    return (
      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10">
        <SiteHeader current="results" />
        <div className="mx-auto grid w-full max-w-4xl gap-6 pt-4">
          <div className="flex gap-2">
            {interview.turns.map((turn, index) => (
              <span
                key={`${turn.questionId}-progress-${index}`}
                className={`h-2.5 flex-1 rounded-full transition-all duration-300 ${
                  index === activeTurnIndex ? "bg-ink" : "bg-ink/15"
                }`}
              />
            ))}
          </div>

          <TurnFeedbackCard
            turn={activeTurn}
            index={activeTurnIndex}
            total={interview.turns.length}
            revealStep={revealStep}
          />

          <div
            className={`flex flex-col gap-3 transition-all duration-500 sm:flex-row sm:items-center sm:justify-between ${
              revealStep >= 4 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            <button
              type="button"
              className="button-secondary"
              onClick={() => setActiveTurnIndex((current) => Math.max(0, current - 1))}
              disabled={activeTurnIndex === 0}
            >
              Previous answer
            </button>

            <button
              type="button"
              className="button-primary"
              onClick={() => {
                if (isLastTurn) {
                  setPhase("summary");
                  return;
                }

                setActiveTurnIndex((current) => Math.min(interview.turns.length - 1, current + 1));
              }}
            >
              {isLastTurn ? "See full results" : "Next answer"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <Shell
      badge="Results"
      title="Your full interview summary"
      subtitle="Now you can review everything together, including resume gaps, recommendations, and the transcript."
      current="results"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="panel p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Interview snapshot</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">{roleLabel}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">
                {interview.turns.length} answers reviewed. This summary highlights what showed up well in the interview
                and what should be clearer in the next version of your resume and delivery.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {report.strengths.slice(0, 4).map((item, index) => (
                  <span key={`${item}-${index}`} className="rounded-full bg-[#EEF7F5] px-3 py-2 text-xs font-medium text-ink">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:min-w-[240px]">
              <button
                type="button"
                className="button-primary w-full"
                onClick={() => downloadCoverLetterPdf(setup.resume.name, report.coverLetterText)}
              >
                Download cover letter PDF
              </button>
              <button
                type="button"
                className="button-secondary w-full"
                onClick={() => setPhase("walkthrough")}
              >
                Revisit answer walkthrough
              </button>
              <button
                type="button"
                className="button-secondary w-full"
                onClick={() => {
                  clearRoleReadySession();
                  router.push("/");
                }}
              >
                Start over
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Resume gaps</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">What the job asks for that your resume does not show clearly yet.</h2>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-slate">
              {report.resumeGaps.map((gap, index) => (
                <li key={`${gap}-${index}`} className="rounded-[22px] bg-[#FBF7F1] px-4 py-4">
                  {gap}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Resume recommendations</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">What to add or emphasize before applying again.</h2>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-slate">
              {report.recommendations.map((item, index) => (
                <li key={`${item}-${index}`} className="rounded-[22px] bg-white px-4 py-4 shadow-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel p-6 sm:p-8">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[24px] border border-ink/10 bg-white px-5 py-4 text-left transition hover:border-ink/20"
            onClick={() => setShowReviewAnswers((current) => !current)}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Answer feedback</p>
              <p className="mt-1 text-lg font-semibold text-ink">Review answers</p>
            </div>
            <span className="text-sm font-medium text-slate">{showReviewAnswers ? "Hide" : "View"}</span>
          </button>

          {showReviewAnswers ? (
            <div className="mt-6 space-y-4">
              {interview.turns.map((turn, index) => (
                <TurnFeedbackCard
                  key={`${turn.questionId}-summary-${index}`}
                  turn={turn}
                  index={index}
                  total={interview.turns.length}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel p-6 sm:p-8">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[24px] border border-ink/10 bg-white px-5 py-4 text-left transition hover:border-ink/20"
            onClick={() => setShowTranscript((current) => !current)}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Transcript</p>
              <p className="mt-1 text-lg font-semibold text-ink">View transcript</p>
            </div>
            <span className="text-sm font-medium text-slate">{showTranscript ? "Hide" : "View"}</span>
          </button>

          {showTranscript ? (
            <div className="mt-6 space-y-4">
              {interview.turns.map((turn, index) => (
                <article key={`${turn.questionId}-transcript-${index}`} className="rounded-[24px] border border-ink/10 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">Question {index + 1}</p>
                  <p className="mt-2 text-sm leading-7 text-ink">{turn.question}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate">Answer</p>
                  <p className="mt-2 text-sm leading-7 text-ink">{turn.answer}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}
