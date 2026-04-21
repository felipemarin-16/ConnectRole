"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { Shell } from "@/components/shell";
import { compileFinalReport } from "@/lib/interview-engine";
import { clearRoleReadySession, getFinalReport, getInterviewSession, getSetupSession, saveFinalReport } from "@/lib/session";
import type { FinalReport, InterviewSession, InterviewTurn, SetupSession } from "@/lib/types";

type ResultsPhase = "walkthrough" | "summary";

function parseFeedbackSections(feedback: string) {
  const normalized = feedback.replace(/\r/g, "").trim();
  const strengthMatch = normalized.match(/Strength:\s*([\s\S]*?)(?=\nImprovement:|Improvement:|$)/i);
  const improvementMatch = normalized.match(/Improvement:\s*([\s\S]*?)$/i);

  return {
    strength: strengthMatch?.[1]?.replace(/\s+/g, " ").trim() || "",
    improvement: improvementMatch?.[1]?.replace(/\s+/g, " ").trim() || "",
    fallback: normalized,
  };
}

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
  const strengthVisible = revealStep === undefined || revealStep >= 3;
  const improveVisible = revealStep === undefined || revealStep >= 4;
  const feedbackSections = parseFeedbackSections(turn.feedback.coachSummary);

  return (
    <section className="px-1 text-left grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:items-start">
      <div className="flex flex-col">
        <div
          className={`transition-all duration-1000 ease-out ${questionVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">
            Question {index + 1} of {total}
          </p>
          <h2 className="mt-3 max-w-[60ch] font-display text-[2rem] leading-[1.08] text-ink sm:text-[1.7rem]">
            {turn.question}
          </h2>
        </div>

        <div
          className={`mt-10 transition-all duration-1000 ease-out ${answerVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate/70">Your answer</p>
          <blockquote className="mt-4 max-w-4xl border-l-[3px] border-ink/10 pl-5 text-lg leading-8 text-ink/80 italic">
            "{turn.answer}"
          </blockquote>
        </div>
      </div>

      <div
        className={`transition-all duration-1000 ease-out ${strengthVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
      >
        {feedbackSections.strength || feedbackSections.improvement ? (
          <div className="space-y-8 pt-5">
            {feedbackSections.strength ? (
              <div
                className={`grid gap-3 sm:grid-cols-[100px_1fr] sm:gap-5 transition-all duration-1000 delay-300 ease-out ${strengthVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
              >
                <div>
                  <span className="inline-flex items-center rounded-full bg-[#EEF7F5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2F8F62]">
                    Strength
                  </span>
                </div>
                <p className="text-[1.05rem] leading-[1.8] text-ink/90">{feedbackSections.strength}</p>
              </div>
            ) : null}

            {feedbackSections.improvement ? (
              <div
                className={`grid gap-3 sm:grid-cols-[100px_1fr] sm:gap-5 transition-all duration-1000 ease-out ${improveVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
              >
                <div>
                  <span className="inline-flex items-center rounded-full bg-[#FBF7F1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C27A22]">
                    Improve
                  </span>
                </div>
                <p className="text-[1.05rem] leading-[1.8] text-ink/90">{feedbackSections.improvement}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`transition-all duration-1000 ease-out ${strengthVisible ? "opacity-100" : "opacity-0"}`}>
            <p className="text-[15px] leading-relaxed text-ink">{feedbackSections.fallback}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryTurnCard({ turn, index }: { turn: InterviewTurn; index: number }) {
  const feedbackSections = parseFeedbackSections(turn.feedback.coachSummary);

  return (
    <div className="rounded-[24px] border border-ink/5 bg-[#f8f9fc]/50 p-5 transition hover:bg-[#f8f9fc] sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate/70">
        Question {index + 1}
      </p>
      <h3 className="mt-2 text-[17px] font-medium leading-relaxed text-ink">
        {turn.question}
      </h3>
      
      <blockquote className="mt-4 border-l-2 border-ink/10 pl-4 text-[15px] leading-relaxed italic text-ink/75">
        "{turn.answer}"
      </blockquote>
      
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {feedbackSections.strength ? (
          <div className="rounded-2xl bg-[#EEF7F5]/60 p-4">
            <span className="inline-flex items-center rounded-full bg-[#EEF7F5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#2F8F62] shadow-sm ring-1 ring-[#2F8F62]/10">
              Strength
            </span>
            <p className="mt-2 text-sm leading-relaxed text-ink/90">{feedbackSections.strength}</p>
          </div>
        ) : null}

        {feedbackSections.improvement ? (
          <div className="rounded-2xl bg-[#FBF7F1]/60 p-4">
            <span className="inline-flex items-center rounded-full bg-[#FBF7F1] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#C27A22] shadow-sm ring-1 ring-[#C27A22]/10">
              Improve
            </span>
            <p className="mt-2 text-sm leading-relaxed text-ink/90">{feedbackSections.improvement}</p>
          </div>
        ) : null}
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
  const [revealStep, setRevealStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

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
      window.setTimeout(() => setRevealStep(1), 300),
      window.setTimeout(() => setRevealStep(2), 1600),
      window.setTimeout(() => setRevealStep(3), 3200),
      window.setTimeout(() => setRevealStep(4), 4800),
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
      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-2 px-4 py-8 sm:px-6 lg:px-10">
        <SiteHeader current="results" />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-start gap-8 pt-2">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Post-interview review</p>
            <h1 className="mt-3 font-display text-[2rem] leading-none text-ink sm:text-[2.35rem]">
              Coach feedback
            </h1>
          </div>


          <div
            key={`${activeTurn.questionId}-${activeTurnIndex}`}
            className={`mt-10 transition-all duration-[600ms] ${
              isExiting ? "-translate-x-[60vw] opacity-0 ease-in" :
              revealStep >= 1 ? "translate-x-0 translate-y-0 opacity-100 ease-out" : "translate-x-0 translate-y-4 opacity-0 ease-out"
            }`}
          >
            <TurnFeedbackCard
              turn={activeTurn}
              index={activeTurnIndex}
              total={interview.turns.length}
              revealStep={revealStep}
            />
          </div>

          <div
            className={`flex justify-end transition-all duration-[600ms] ${
              isExiting ? "-translate-x-[60vw] opacity-0 ease-in" :
              revealStep >= 4 ? "translate-x-0 translate-y-0 opacity-100 ease-out" : "translate-x-0 translate-y-3 opacity-0 ease-out"
            }`}
          >
            <button
              type="button"
              className="button-primary min-w-[168px]"
              disabled={isExiting}
              onClick={() => {
                setIsExiting(true);
                
                setTimeout(() => {
                  if (isLastTurn) {
                    setPhase("summary");
                  } else {
                    setActiveTurnIndex((current) => Math.min(interview.turns.length - 1, current + 1));
                  }
                  setIsExiting(false);
                }, 600); // Wait for the 600ms exit animation to finish
              }}
            >
              Continue
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
      subtitle="Now you can review everything together, with answer feedback at the top and resume guidance below."
      current="results"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="panel animate-entrance p-6 sm:p-8" style={{ animationDelay: "100ms" }}>
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
                  <span key={`${item}-${index}`} className="rounded-full bg-[#EEF7F5]/80 border border-[#2F8F62]/10 px-3 py-2 text-[13px] font-medium text-[#2F8F62]">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:min-w-[240px]">
              <button
                type="button"
                className="button-primary w-full"
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

        <section className="panel animate-entrance p-6 sm:p-8" style={{ animationDelay: "250ms" }}>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[24px] border border-ink/5 bg-[#f8f9fc]/50 px-5 py-4 text-left transition hover:border-ink/20 hover:bg-[#f8f9fc]"
            onClick={() => setShowReviewAnswers((current) => !current)}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Answer feedback</p>
              <p className="mt-1 text-lg font-semibold text-ink">Review {interview.turns.length} answers</p>
            </div>
            <span className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-slate shadow-sm">{showReviewAnswers ? "Hide" : "View"}</span>
          </button>

          {showReviewAnswers ? (
            <div className="animate-fade-in mt-6 space-y-4">
              {interview.turns.map((turn, index) => (
                <SummaryTurnCard
                  key={`${turn.questionId}-summary-${index}`}
                  turn={turn}
                  index={index}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div 
            className="panel animate-entrance p-6 sm:p-8" 
            style={{ animationDelay: "400ms", borderColor: 'rgba(194, 122, 34, 0.15)', background: '#FDFBF7' }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C27A22]/10 text-[#C27A22]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 15A7 7 0 108 1a7 7 0 000 14zm0-9.5v3.5m0 2h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C27A22]">Resume gaps</p>
            </div>
            <h2 className="mt-4 text-[22px] font-semibold text-ink leading-snug">What the job asks for that your resume misses.</h2>
            <ul className="mt-6 space-y-3 text-[14px] leading-relaxed text-ink/80">
              {report.resumeGaps.map((gap, index) => (
                <li
                  key={`${gap}-${index}`}
                  className="rounded-[20px] bg-white px-5 py-4 shadow-sm border border-black/[0.03]"
                >
                  {gap}
                </li>
              ))}
            </ul>
          </div>

          <div 
            className="panel animate-entrance p-6 sm:p-8" 
            style={{ animationDelay: "550ms", borderColor: 'rgba(47, 143, 98, 0.15)', background: '#F8FCFA' }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2F8F62]/10 text-[#2F8F62]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 4.5l-7.5 7L2 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2F8F62]">Recommendations</p>
            </div>
            <h2 className="mt-4 text-[22px] font-semibold text-ink leading-snug">What to emphasize before applying next.</h2>
            <ul className="mt-6 space-y-3 text-[14px] leading-relaxed text-ink/80">
              {report.recommendations.map((item, index) => (
                <li 
                  key={`${item}-${index}`} 
                  className="rounded-[20px] bg-white px-5 py-4 shadow-sm border border-black/[0.03]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </Shell>
  );
}
