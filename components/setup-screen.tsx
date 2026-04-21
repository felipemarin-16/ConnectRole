"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { buildInterviewContext } from "@/lib/interview-context";
import { parseJobPosting } from "@/lib/job-parser";
import { extractTextFromPdf } from "@/lib/pdf";
import { saveInterviewSession, saveSetupSession } from "@/lib/session";
import type { JobData, ResumeData } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_START_NAME = "Felipe";
const QUICK_START_RESUME_TEXT = `
Felipe Marin

Education
University of Utah - B.S. in Computer Science, expected December 2026

Projects
FNDR - Privacy-First Local AI Assistant for macOS (2026-Present)
Built a local-first AI assistant that helps users retrieve past context from screenshots and notes.
Designed retrieval flows for memory search and fast follow-up prompts.

RoleReady - Mock Interview Coach (2026)
Built a Next.js + TypeScript prototype for voice-based mock interviews with transcript scoring.

Skills
TypeScript, JavaScript, React, Next.js, Node.js, Python, SQL, FastAPI, Git

Experience
Built and shipped multiple full-stack side projects focused on AI-assisted user workflows.
`;

const QUICK_START_JOB_POSTING = `
Leidos
Jr. Software Engineer Intern
Tucson, AZ
Internship
Onsite

Responsibilities
Support full stack development across user interfaces, REST services, APIs, and AWS cloud infrastructure.
Work with senior engineers on agile planning and software engineering standards.

Required
Working toward a Bachelors in Computer Science or similar discipline.
Experience with software design patterns and web application development.
Exposure to JavaScript, TypeScript, Python, Java, C++, and SQL.
Familiarity with React, Django, Flask, FastAPI, SpringBoot, or NodeJS.
Familiarity with Git standards.
`;

function primeBrowserVoicePlayback() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(".");
    utterance.volume = 0;
    utterance.rate = 1;
    utterance.pitch = 1;
    // Do not call cancel() synchronously before speak() if idle,
    // as it can lock Chrome in a stuck "speaking=true" state.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      window.setTimeout(() => window.speechSynthesis.speak(utterance), 80);
    } else {
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    // Best-effort only; the interview page still has its own recovery path.
  }
}

type SetupStepStatus = "pending" | "current" | "done";
type PreparationStepId = "resume" | "job" | "context" | "questions" | "ready";
type ExplanationVisualKind = "practice" | "feedback" | "repeat";

const SETUP_STEPS = [
  { label: "Name", short: "1" },
  { label: "Resume", short: "2" },
  { label: "Job post", short: "3" },
  { label: "Confirm", short: "4" },
] as const;

const PREPARATION_STEP_COPY: Array<{ id: PreparationStepId; label: string; detail: string }> = [
  { id: "resume", label: "Reading resume", detail: "Extracting text and checking your background." },
  { id: "job", label: "Analyzing job post", detail: "Pulling out the role, company, and core requirements." },
  { id: "context", label: "Extracting context", detail: "Connecting your resume to the role and likely themes." },
  { id: "questions", label: "Preparing questions", detail: "Generating the opening prompt and first coaching tip." },
  { id: "ready", label: "Interview ready", detail: "Everything is lined up and about to begin." },
];

const EXPLANATION_SECTIONS: Array<{
  kind: ExplanationVisualKind;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    kind: "practice",
    eyebrow: "Start privately",
    title: "Practice on your own first to get comfortable before speaking with a real interviewer.",
    description:
      "Use your resume and the role you care about to rehearse out loud in a lower-pressure setting before the real conversation starts.",
  },
  {
    kind: "feedback",
    eyebrow: "See what landed",
    title: "AI will analyze your answers and give you clear feedback.",
    description:
      "Each answer is reviewed for clarity, specificity, structure, and completeness so you know what to tighten for the next round.",
  },
  {
    kind: "repeat",
    eyebrow: "Repeat with intention",
    title: "Then refine your responses and try again until you feel confident.",
    description:
      "Use the feedback to sharpen your examples, improve your pacing, and build stronger answers before the real interview.",
  },
];

function ExplanationVisual({ kind }: { kind: ExplanationVisualKind }) {
  if (kind === "practice") {
    return (
      <div className="relative mx-auto w-full max-w-[470px]">
        <div className="absolute inset-x-10 top-6 h-28 rounded-full bg-[radial-gradient(circle,_rgba(158,208,255,0.28),_rgba(158,208,255,0))] blur-3xl" />
        <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(240,246,255,0.62))] p-5 shadow-[0_28px_80px_rgba(17,24,39,0.10)] backdrop-blur-xl">
          <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[22px] border border-ink/8 bg-white/82 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate/70">Resume context</p>
              <div className="mt-4 space-y-2.5">
                <div className="h-2.5 w-24 rounded-full bg-ink/80" />
                <div className="h-2 rounded-full bg-ink/15" />
                <div className="h-2 rounded-full bg-ink/12" />
                <div className="h-2 w-[82%] rounded-full bg-ink/12" />
              </div>
              <div className="mt-5 rounded-2xl bg-[linear-gradient(135deg,rgba(226,247,235,0.75),rgba(241,247,255,0.92))] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Relevant project</p>
                <p className="mt-1 text-sm text-ink">Privacy-first local AI assistant</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-ink/8 bg-[linear-gradient(180deg,rgba(232,244,255,0.92),rgba(255,255,255,0.88))] p-4 shadow-[0_20px_42px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate/70">Warm-up interview</p>
                <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-700">
                  Live
                </span>
              </div>
              <div className="mt-5 flex h-24 items-center justify-center rounded-[22px] border border-white/70 bg-white/80">
                <div className="flex items-end gap-1.5 text-accent">
                  {[18, 26, 38, 22, 34, 46, 29, 18, 31, 42, 26].map((value, index) => (
                    <span
                      key={`practice-bar-${index}`}
                      className="w-2 rounded-full bg-[linear-gradient(180deg,#79C8FF,#3E6EFF)]"
                      style={{ height: `${value}px` }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-ink/8 bg-white/85 px-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2.5A2.75 2.75 0 0 1 10.75 5.25V8A2.75 2.75 0 1 1 5.25 8V5.25A2.75 2.75 0 0 1 8 2.5Z" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M3.75 7.75A4.25 4.25 0 0 0 8 12a4.25 4.25 0 0 0 4.25-4.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">Talk it through out loud</p>
                  <p className="text-xs text-slate">Build comfort before the real interview starts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "feedback") {
    return (
      <div className="relative mx-auto w-full max-w-[470px]">
        <div className="absolute inset-x-12 top-10 h-24 rounded-full bg-[radial-gradient(circle,_rgba(186,224,204,0.28),_rgba(186,224,204,0))] blur-3xl" />
        <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(241,247,244,0.64))] p-5 shadow-[0_28px_80px_rgba(17,24,39,0.10)] backdrop-blur-xl">
          <div className="rounded-[24px] border border-ink/8 bg-white/84 px-4 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate/70">Answer review</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((item) => (
                  <span key={`feedback-dot-${item}`} className="h-2 w-2 rounded-full bg-ink/10" />
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">What landed</p>
                <p className="mt-1.5 text-sm leading-6 text-ink/88">
                  You connected the answer back to the role and gave the interviewer a useful starting point.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">How to sharpen it</p>
                <p className="mt-1.5 text-sm leading-6 text-ink/80">
                  Add one concrete example so your impact is easier to picture and remember.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 px-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="h-2 w-24 rounded-full bg-ink/10" />
            <span className="h-2 w-16 rounded-full bg-ink/7" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[470px]">
      <div className="absolute inset-x-10 top-10 h-24 rounded-full bg-[radial-gradient(circle,_rgba(222,204,255,0.24),_rgba(222,204,255,0))] blur-3xl" />
      <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(246,242,255,0.64))] p-5 shadow-[0_28px_80px_rgba(17,24,39,0.10)] backdrop-blur-xl">
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-[22px] border border-ink/8 bg-white/82 px-4 py-3 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate/70">Round one</p>
              <p className="mt-1 text-sm text-ink">Good foundation, but needs a sharper example.</p>
            </div>
            <span className="rounded-full bg-amber-500/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700">
              Refine
            </span>
          </div>
          <div className="flex items-center justify-between rounded-[22px] border border-ink/8 bg-white/88 px-4 py-3 shadow-[0_20px_46px_rgba(15,23,42,0.08)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate/70">Round two</p>
              <p className="mt-1 text-sm text-ink">Stronger structure, clearer ownership, better finish.</p>
            </div>
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-700">
              Ready
            </span>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-[0_16px_36px_rgba(15,23,42,0.14)]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M4 9.5L7.2 12.5L14 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,#B5E7C7,#8CC6FF,#748BFF)]" />
              <p className="mt-2 text-sm text-slate">Practice, tighten, repeat until the answer feels natural.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SetupScreen() {
  const router = useRouter();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [jobPosting, setJobPosting] = useState("");
  const [confirmedCompany, setConfirmedCompany] = useState("");
  const [confirmedPosition, setConfirmedPosition] = useState("");
  const [confirmedJobType, setConfirmedJobType] = useState("Full-time");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [prepStatuses, setPrepStatuses] = useState<Record<PreparationStepId, SetupStepStatus>>({
    resume: "pending",
    job: "pending",
    context: "pending",
    questions: "pending",
    ready: "pending",
  });
  const targetQuestionCount = Number.parseInt(process.env.NEXT_PUBLIC_INTERVIEW_TARGET_COUNT || "3", 10);
  const canContinueFromStepOne = candidateName.trim().length > 0;
  const canContinueFromStepTwo = Boolean(resumeFile);
  const canContinueFromStepThree = jobPosting.trim().length > 0;
  const canStart = canContinueFromStepOne && canContinueFromStepTwo && canContinueFromStepThree && confirmedCompany.trim().length > 0 && confirmedPosition.trim().length > 0;
  const setupStepStatuses = useMemo(
    () =>
      SETUP_STEPS.map((item, index) => ({
        ...item,
        status:
          index < step
            ? ("done" as SetupStepStatus)
            : index === step
              ? ("current" as SetupStepStatus)
              : ("pending" as SetupStepStatus),
      })),
    [step],
  );

  function resetPreparationStatuses(startAt: PreparationStepId = "resume") {
    const startIndex = PREPARATION_STEP_COPY.findIndex((item) => item.id === startAt);
    const nextState = PREPARATION_STEP_COPY.reduce<Record<PreparationStepId, SetupStepStatus>>((acc, item, index) => {
      if (index < startIndex) {
        acc[item.id] = "done";
      } else if (index === startIndex) {
        acc[item.id] = "current";
      } else {
        acc[item.id] = "pending";
      }
      return acc;
    }, {} as Record<PreparationStepId, SetupStepStatus>);
    setPrepStatuses(nextState);
  }

  function markPreparationStep(stepId: PreparationStepId) {
    setPrepStatuses((current) => {
      const next = { ...current };
      let reached = false;

      PREPARATION_STEP_COPY.forEach((item) => {
        if (item.id === stepId) {
          reached = true;
          next[item.id] = "current";
          return;
        }

        if (!reached) {
          next[item.id] = "done";
        } else if (current[item.id] !== "done") {
          next[item.id] = "pending";
        }
      });

      return next;
    });
  }

  function completePreparationStep(stepId: PreparationStepId) {
    setPrepStatuses((current) => ({
      ...current,
      [stepId]: "done",
    }));
  }

  function goToNextStep() {
    if (step === 0 && !canContinueFromStepOne) {
      setError("Add the name you want the interviewer to use.");
      return;
    }

    if (step === 1 && !canContinueFromStepTwo) {
      setError("Upload a PDF resume to continue.");
      return;
    }

    if (step === 2) {
      if (!canContinueFromStepThree) {
        setError("Paste a job posting to continue.");
        return;
      }
      // Pre-populate confirmation from parsed job
      const parsed = parseJobPosting(jobPosting);
      setConfirmedCompany(parsed.companyName !== "the company" ? parsed.companyName : "");
      setConfirmedPosition(parsed.roleTitle !== "Target Role" ? parsed.roleTitle : "");
      setConfirmedJobType(parsed.jobType || "Full-time");
    }

    if (step === 3) {
      if (!confirmedCompany.trim()) {
        setError("Enter the company name to continue.");
        return;
      }
      if (!confirmedPosition.trim()) {
        setError("Enter the position title to continue.");
        return;
      }
    }

    if (step < 3) {
      setError("");
      setStep((current) => current + 1);
    }
  }

  function goToPreviousStep() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
  }

  async function prepareAndLaunchInterview(input: {
    rawResumeText: string;
    resumeFileName: string;
    jobPostingText: string;
    candidateNameInput: string;
    companyOverride?: string;
    roleOverride?: string;
    jobTypeOverride?: string;
    onPhaseChange?: (phase: PreparationStepId) => void;
  }) {
    input.onPhaseChange?.("job");
    await new Promise((r) => setTimeout(r, 600));

    const parseResponse = await fetch("/api/setup/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rawResumeText: input.rawResumeText,
        jobPostingText: input.jobPostingText,
      }),
    });

    if (!parseResponse.ok) {
      const details = await parseResponse.text();
      throw new Error(details || "Could not analyze the resume and job posting.");
    }

    const { resume, job: parsedJob } = (await parseResponse.json()) as {
      resume: ResumeData;
      job: JobData;
    };

    input.onPhaseChange?.("context");
    await new Promise((r) => setTimeout(r, 600));

    const job = {
      ...parsedJob,
      companyName: input.companyOverride?.trim() || parsedJob.companyName,
      roleTitle: input.roleOverride?.trim() || parsedJob.roleTitle,
      jobType: input.jobTypeOverride || parsedJob.jobType,
    };
    const context = buildInterviewContext(resume, job, input.candidateNameInput);

    input.onPhaseChange?.("questions");
    await new Promise((r) => setTimeout(r, 600));

    const openingResponse = await fetch("/api/interview/opening", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: {
          candidateName: context.candidateName,
          role: context.role,
          companyName: context.companyName,
          seniority: context.seniority,
          interviewType: context.interviewType,
          resumeProjectSummary: context.resumeProjectSummary,
          resumeHighlights: context.resumeHighlights,
          resumeSkills: context.resumeSkills,
          jobSummary: context.jobSummary,
          companySummary: "",
          requiredSkills: job.requiredSkills,
          preferredSkills: job.preferredSkills,
          responsibilities: job.responsibilities,
          keywords: job.keywords,
          previousQuestions: [],
          previousAnswers: [],
          coveredSkills: [],
        },
      }),
    });

    if (!openingResponse.ok) {
      const details = await openingResponse.text();
      throw new Error(details || "Could not prepare the first interview question.");
    }

    const openingPayload = (await openingResponse.json()) as {
      question: string;
      coach_tip?: string;
      whyThisQuestion?: string;
      nextSkillToProbe?: string;
    };
    const openingSkill =
      openingPayload.nextSkillToProbe?.trim() || job.requiredSkills[0] || job.keywords[0] || "role-fit";
    const openingQuestion =
      openingPayload.question?.trim() ||
      `To start, walk me through the experience, project, or technical work in your background that best matches the ${job.roleTitle || "role"} role.`;
    const openingFocus =
      openingPayload.coach_tip?.trim() ||
      "Open with the background most relevant to this role, then connect it to why you are here.";

    input.onPhaseChange?.("ready");
    await new Promise((r) => setTimeout(r, 300));

    console.groupCollapsed("RoleReady setup debug");
    console.info("Parsed resume", resume);
    console.info("Parsed job", job);
    console.info("Interview context", context);
    console.groupEnd();

    saveSetupSession({
      createdAt: new Date().toISOString(),
      coachVoice: "female",
      companySummary: "",
      resumeFileName: input.resumeFileName,
      resume,
      job,
      context,
    });

    saveInterviewSession({
      startedAt: new Date().toISOString(),
      currentQuestionIndex: 0,
      targetQuestionCount: Number.isFinite(targetQuestionCount) && targetQuestionCount > 0 ? targetQuestionCount : 3,
      currentQuestion: {
        id: "q1",
        category: "adaptive",
        prompt: openingQuestion,
        focus: openingFocus,
        targetSkills: [openingSkill].filter(Boolean),
      },
      coveredSkills: openingSkill ? [openingSkill] : [],
      turns: [],
    });
  }

  async function handleStartInterview() {
    if (!resumeFile) {
      setError("Upload a PDF resume to begin the interview.");
      return;
    }

    if (!jobPosting.trim()) {
      setError("Paste a job posting so RoleReady can tailor the questions.");
      return;
    }

    setError("");
    primeBrowserVoicePlayback();
    setLoading(true);
    setShowOverlay(true);
    resetPreparationStatuses("resume");

    const minWait = new Promise<void>((resolve) => setTimeout(resolve, 3000));

    try {
      const rawResumeText = await extractTextFromPdf(resumeFile);
      markPreparationStep("job");
      await prepareAndLaunchInterview({
        rawResumeText,
        resumeFileName: resumeFile.name,
        jobPostingText: jobPosting,
        candidateNameInput: candidateName,
        companyOverride: confirmedCompany,
        roleOverride: confirmedPosition,
        jobTypeOverride: confirmedJobType,
        onPhaseChange: markPreparationStep,
      });
      completePreparationStep("ready");

      await minWait;

      startTransition(() => {
        router.push("/interview");
      });
    } catch (setupError) {
      setShowOverlay(false);
      setError(
        setupError instanceof Error
          ? setupError.message
          : "We ran into an issue while parsing the resume. Please try another PDF.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickStart() {
    setError("");
    primeBrowserVoicePlayback();
    setLoading(true);
    setShowOverlay(true);
    resetPreparationStatuses("resume");

    const minWait = new Promise<void>((resolve) => setTimeout(resolve, 1400));

    try {
      completePreparationStep("resume");
      markPreparationStep("job");
      await prepareAndLaunchInterview({
        rawResumeText: QUICK_START_RESUME_TEXT,
        resumeFileName: "quick-start-resume.txt",
        jobPostingText: QUICK_START_JOB_POSTING,
        candidateNameInput: QUICK_START_NAME,
        onPhaseChange: markPreparationStep,
      });
      completePreparationStep("ready");

      await minWait;
      startTransition(() => {
        router.push("/interview");
      });
    } catch (setupError) {
      setShowOverlay(false);
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Quick start failed. Try regular setup.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showOverlay ? (
        <div className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(248,249,252,0.92)] px-6 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/70 bg-white/76 px-7 py-8 shadow-[0_25px_80px_rgba(19,28,46,0.12)] backdrop-blur-xl sm:px-9">
            <p className="font-display text-3xl text-ink">Preparing your interview</p>
            <p className="mt-3 text-sm leading-7 text-slate">We’re building the interview context now so the first question feels tailored and ready.</p>

            <div className="mt-8 grid gap-1">
              {PREPARATION_STEP_COPY.map((item) => {
                const status = prepStatuses[item.id];
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-2.5 transition-all duration-500",
                      status === "done" ? "bg-emerald-50/40" : status === "current" ? "bg-ink/[0.02]" : "bg-transparent"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-500",
                        status === "done"
                          ? "bg-emerald-500 text-white"
                          : status === "current"
                            ? "bg-ink text-white animate-pulse"
                            : "border border-ink/15 text-transparent"
                      )}
                    >
                      {status === "done" ? "✓" : status === "current" ? "…" : ""}
                    </div>
                    <div className="flex-1">
                      <p className={cn(
                        "text-[15px] font-medium transition-colors duration-500",
                        status === "pending" ? "text-slate/60" : status === "current" ? "text-ink" : "text-emerald-700"
                      )}>
                        {item.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col">
        <div className="absolute left-4 right-4 top-8 z-50 sm:left-6 lg:left-10 lg:right-10">
          <SiteHeader current="home" />
        </div>

        <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-28 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[56rem] text-center">
            <p className="animate-entrance text-[11px] font-semibold uppercase tracking-[0.24em] text-slate/80">
              Mock Interview Coach
            </p>
            <h1 className="animate-entrance mx-auto mt-4 max-w-[54rem] font-display text-4xl leading-[1.02] text-ink sm:text-5xl lg:text-[4rem]">
              Practice interviews that feel real.
            </h1>
            <p className="animate-entrance mx-auto mt-5 max-w-3xl text-base leading-8 text-slate/80 sm:text-lg">
              Rehearse with your resume and a real job posting, get clear feedback on each answer, and keep refining until you sound ready.
            </p>
          </div>

          <div className="mt-16 grid gap-14">
            {EXPLANATION_SECTIONS.map((section, index) => {
              const reverseOnDesktop = index % 2 === 1;

              return (
                <div key={section.title} className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
                  <div className={cn("max-w-xl", reverseOnDesktop && "lg:order-2 lg:justify-self-end")}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate/75">
                      {section.eyebrow}
                    </p>
                    <h2 className="mt-4 font-display text-3xl leading-tight text-ink sm:text-[2.3rem]">
                      {section.title}
                    </h2>
                    <p className="mt-5 text-base leading-8 text-slate/80 sm:text-[1.05rem]">
                      {section.description}
                    </p>
                  </div>

                  <div className={cn(reverseOnDesktop ? "lg:order-1" : "lg:order-2")}>
                    <ExplanationVisual kind={section.kind} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 flex justify-center">
            <button
              type="button"
              className="rounded-full border border-ink/15 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink transition hover:border-ink/35 hover:bg-white/80"
              onClick={() => void handleQuickStart()}
              disabled={loading}
            >
              {loading ? "Preparing..." : "Try a Demo Interview"}
            </button>
          </div>
        </section>

        {/* Setup Flow Target */}
        <div id="setup-wizard" className="mx-auto mt-12 w-full max-w-4xl flex-1 scroll-mt-24 px-4 pb-24 sm:px-6"> 
            <div className="relative mx-auto w-full max-w-[280px]">
              {/* Background line */}
              <div className="absolute left-[15%] right-[15%] top-[13px] h-[2px] -translate-y-1/2 bg-ink/10" />
              {/* Active progress line */}
              <div
                className="absolute left-[15%] top-[13px] h-[2px] -translate-y-1/2 bg-emerald-500 transition-all duration-500"
                style={{ width: `${(Math.min(step, SETUP_STEPS.length - 1) / (SETUP_STEPS.length - 1)) * 70}%` }}
              />

              <div className="relative flex justify-between">
                {setupStepStatuses.map((item) => (
                  <div key={item.label} className="flex w-14 flex-col items-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-300",
                        item.status === "done"
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : item.status === "current"
                            ? "border-ink bg-ink text-white shadow-[0_6px_12px_rgba(14,23,38,0.18)]"
                            : "border-ink/12 bg-white/70 text-slate",
                      )}
                    >
                      {item.status === "done" ? "✓" : item.short}
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-center text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em]",
                        item.status === "current" ? "text-ink" : item.status === "done" ? "text-emerald-700" : "text-slate/60",
                      )}
                    >
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step heading */}
            <div className="mt-8 text-center">
              <h2 className="mx-auto max-w-3xl font-display text-2xl text-ink sm:text-3xl">
                {step === 0
                  ? "What’s your name?"
                  : step === 1
                    ? "Upload your resume"
                    : step === 2
                      ? "Paste the job posting"
                      : "Confirm job details"}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate sm:text-base">
                {step === 0
                  ? "This is how the interviewer will address you."
                  : step === 1
                    ? "A PDF resume lets RoleReady tailor the questions to your experience."
                    : step === 2
                      ? "The job description shapes every question in the interview."
                      : "We’ll use these details to make the interview sound grounded and role-aware."}
              </p>
            </div>

            {/* Step input */}
            <div key={step} className="animate-step-in mx-auto mt-6 max-w-sm">
              {step === 0 ? (
                <input
                  id="candidate-name"
                  type="text"
                  className="field text-center text-lg"
                  placeholder="e.g. Felipe"
                  value={candidateName}
                  autoFocus
                  onChange={(event) => setCandidateName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") goToNextStep();
                  }}
                />
              ) : null}

              {step === 1 ? (
                <label
                  htmlFor="resume"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-ink/20 px-6 py-10 text-center transition hover:border-ink/35 hover:bg-ink/[0.02]"
                >
                  {resumeFile ? (
                    <>
                      <span className="text-base font-semibold text-ink">{resumeFile.name}</span>
                      <span className="mt-1 text-sm text-slate">Click to replace</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base font-semibold text-ink">Click to upload PDF</span>
                      <span className="mt-1 text-sm text-slate">or drag and drop</span>
                    </>
                  )}
                  <input
                    id="resume"
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setResumeFile(file);
                    }}
                  />
                </label>
              ) : null}

              {step === 2 ? (
                <textarea
                  id="job-posting"
                  rows={10}
                  className="field resize-none text-base"
                  placeholder="Paste the job posting here."
                  value={jobPosting}
                  autoFocus
                  onChange={(event) => setJobPosting(event.target.value)}
                />
              ) : null}

              {step === 3 ? (
                <div className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="confirmed-company" className="mb-1.5 block text-sm font-medium text-ink">
                      Company
                    </label>
                    <input
                      id="confirmed-company"
                      type="text"
                      className="field"
                      placeholder="e.g. Acme Corp"
                      value={confirmedCompany}
                      autoFocus
                      onChange={(event) => setConfirmedCompany(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmed-position" className="mb-1.5 block text-sm font-medium text-ink">
                      Position
                    </label>
                    <input
                      id="confirmed-position"
                      type="text"
                      className="field"
                      placeholder="e.g. Software Engineer"
                      value={confirmedPosition}
                      onChange={(event) => setConfirmedPosition(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">Job type</label>
                    <div className="flex flex-wrap gap-2">
                      {["Full-time", "Part-time", "Contract", "Internship", "Freelance"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setConfirmedJobType(type)}
                          className={cn(
                            "rounded-full border px-4 py-1.5 text-sm transition",
                            confirmedJobType === type
                              ? "border-ink bg-ink text-white"
                              : "border-ink/18 text-ink hover:border-ink/35",
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Navigation */}
            <div className="mx-auto mt-6 flex max-w-sm items-center justify-between">
              <button
                type="button"
                aria-label="Previous step"
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition",
                  step === 0 || loading
                    ? "cursor-not-allowed border-ink/8 text-ink/18"
                    : "border-ink/18 text-ink hover:border-ink/35",
                )}
                onClick={goToPreviousStep}
                disabled={step === 0 || loading}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  aria-label="Next step"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/18 text-ink transition hover:border-ink/35"
                  onClick={goToNextStep}
                  disabled={loading}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleStartInterview}
                  disabled={loading || !canStart}
                >
                  {loading ? "Preparing..." : "Start interview"}
                </button>
              )}
            </div>

            {error ? (
              <p className="mt-5 text-center text-sm text-red-600">{error}</p>
            ) : null}
        </div>
      </main>
    </>
  );
}
