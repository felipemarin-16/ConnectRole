"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LiveAudioWaveform } from "@/components/live-audio-waveform";
import { SiteHeader } from "@/components/site-header";
import { Shell } from "@/components/shell";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { buildAnswerFeedback, buildQuestionTip, compileFinalReport, scoreAnswer } from "@/lib/interview-engine";
import { getInterviewSession, getSetupSession, saveFinalReport, saveInterviewSession } from "@/lib/session";
import type { InterviewModelEvaluation, InterviewSession, InterviewTurn, SetupSession } from "@/lib/types";
import { cn } from "@/lib/utils";

function getFirstName(fullName: string) {
  const cleaned = fullName.replace(/[^a-zA-Z\s'-]/g, " ").trim();
  const first = cleaned.split(/\s+/).find(Boolean);
  return first ? `${first.charAt(0).toUpperCase()}${first.slice(1).toLowerCase()}` : "there";
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function getQuestionTextSize(prompt: string) {
  const length = prompt.trim().length;

  if (length > 260) {
    return "text-base sm:text-lg";
  }

  if (length > 180) {
    return "text-lg sm:text-xl";
  }

  if (length > 110) {
    return "text-xl sm:text-2xl";
  }

  return "text-2xl sm:text-[2rem]";
}

function estimateSpeechMs(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Increase timing to guarantee it doesn't interrupt slower TTS
  return Math.max(3000, words * 600);
}

type IntroStage = "idle" | "playing" | "pause" | "done";

export function InterviewScreen() {
  const INTRO_PAUSE_MS = 3000;
  const router = useRouter();
  const [setup, setSetup] = useState<SetupSession | null>(null);
  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [draftAnswer, setDraftAnswer] = useState("");
  const draftAnswerRef = useRef("");
  const [status, setStatus] = useState("Loading interview...");
  const [error, setError] = useState("");
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [spokenQuestionId, setSpokenQuestionId] = useState("");
  const [openingDelivered, setOpeningDelivered] = useState(false);
  const [introStage, setIntroStage] = useState<IntroStage>("idle");
  const [outroStage, setOutroStage] = useState<"idle" | "playing" | "done">("idle");
  const [visibleIntroLines, setVisibleIntroLines] = useState(0);
  const [activeIntroLine, setActiveIntroLine] = useState(-1);
  const [visibleOutroLines, setVisibleOutroLines] = useState(0);
  const [activeOutroLine, setActiveOutroLine] = useState(-1);
  const [userMicStream, setUserMicStream] = useState<MediaStream | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const introTimersRef = useRef<number[]>([]);
  const introSequenceQuestionRef = useRef<string | null>(null);
  const introSpeechSequenceRef = useRef(0);
  const outroTimersRef = useRef<number[]>([]);
  const outroSpeechSequenceRef = useRef(0);
  const speakRef = useRef<
    (
      text: string,
      options?: {
        allowBrowserFallback?: boolean;
        onStart?: () => void;
        onComplete?: () => void;
        onError?: () => void;
      },
    ) => void
  >(() => { });
  const stopSpeakingRef = useRef<() => void>(() => { });

  useEffect(() => {
    const sessionSetup = getSetupSession();
    const sessionInterview = getInterviewSession();

    if (!sessionSetup || !sessionInterview) {
      setStatus("Missing interview setup.");
      return;
    }

    setSetup(sessionSetup);
    setInterview(sessionInterview);
    setStatus("Ready");
  }, []);

  const currentQuestion = interview?.currentQuestion ?? null;
  const currentQuestionId = currentQuestion?.id ?? "";
  const currentQuestionPrompt = currentQuestion?.prompt ?? "";
  const progressLabel = interview
    ? `Question ${Math.min(interview.currentQuestionIndex + 1, interview.targetQuestionCount)} of ${interview.targetQuestionCount}`
    : "Interview";
  const interviewContext = setup?.context ?? {
    candidateName: setup?.resume.name || "there",
    role: setup?.job.roleTitle || "Target Role",
    companyName: setup?.job.companyName || "the company",
    jobType: setup?.job.jobType || "Full-time",
    seniority: "mid-level",
    interviewType: "mixed behavioral and role-fit",
    resumeProjectSummary: setup?.resume.rawText.slice(0, 600) || "",
    resumeHighlights: setup?.resume.highlights.slice(0, 5) || [],
    resumeSkills: setup?.resume.skills.slice(0, 12) || [],
    resumeEducation: setup?.resume.education.slice(0, 5) || [],
    resumeExperience: setup?.resume.experience.slice(0, 5) || [],
    resumeProjects: setup?.resume.projects.slice(0, 5) || [],
    jobSummary: setup?.job.summary || "",
  };
  const candidateFirstName = getFirstName(setup?.context.candidateName ?? setup?.resume.name ?? "");
  const interviewRole = setup?.context.role || setup?.job.roleTitle || "this role";
  const interviewCompany = setup?.context.companyName || setup?.job.companyName || "";
  const coachName = setup?.coachVoice === "male" ? "Mark" : "Rachel";
  const introLines = useMemo(
    () => [
      `Hi ${candidateFirstName}, it's nice to meet you.`,
      interviewCompany && interviewCompany !== "the company"
        ? `I'm ${coachName}, and I'll be interviewing you today for the ${interviewRole} position at ${interviewCompany}.`
        : `I'm ${coachName}, and I'll be interviewing you today for the ${interviewRole} position.`,
      "Take a breath, settle in, and answer as clearly as you can.",
    ],
    [candidateFirstName, interviewCompany, interviewRole, coachName],
  );
  const outroLines = useMemo(
    () => [
      "That's all the questions I have.",
      `I appreciate your time, ${candidateFirstName}.`,
      "Nice work today — your feedback and results will be ready shortly.",
    ],
    [candidateFirstName],
  );
  const isFirstQuestion = Boolean(
    currentQuestion &&
    interview &&
    interview.currentQuestionIndex === 0 &&
    interview.turns.length === 0,
  );
  const introActive = isFirstQuestion && !openingDelivered;
  const questionVisible = !introActive || introStage === "done";
  const ttsMode = (process.env.NEXT_PUBLIC_TTS_MODE as "auto" | "browser" | "cloud") || "cloud";
  const {
    supported: ttsSupported,
    ready: ttsReady,
    activeAudioElement,
    browserSpeechLevel,
    lastError: voiceError,
    speak,
    stop: stopSpeaking,
    speaking,
  } = useSpeechSynthesis(setup?.coachVoice ?? "female", {
    mode: ttsMode,
  });
  const {
    supported: sttSupported,
    listening,
    error: recognitionError,
    start,
    stop,
    reset,
  } = useSpeechRecognition((text) => {
    setDraftAnswer((current) => {
      const next = `${current} ${text}`.trim();
      draftAnswerRef.current = next;
      return next;
    });
  });
  const introManualActionEnabled = introActive;
  const actionButtonLabel = introActive
    ? voiceError
      ? "Play intro"
      : introStage === "pause"
        ? "Continue"
        : "Skip intro"
    : outroStage === "playing"
      ? "Finishing"
      : evaluating
        ? "Analyzing"
        : listening
          ? "Stop"
          : pendingAdvance
            ? interview && interview.turns.length >= interview.targetQuestionCount
              ? "Finish"
              : "Next"
            : "Speak";
  const statusText = introActive && introStage !== "done"
    ? voiceError
      ? "Browser blocked coach audio. Tap Play intro or Continue."
      : introStage === "pause"
        ? "Beginning the first question shortly..."
        : "Coach introduction playing..."
    : outroStage === "playing"
      ? "Wrapping up the interview..."
      : evaluating
        ? "Analyzing your answer..."
        : speaking
          ? "Coach is speaking..."
          : listening
            ? "Recording your answer..."
            : pendingAdvance
              ? "Ready for the next question."
              : questionVisible
                ? "Tap Speak when you're ready."
                : "Preparing your first question...";
  const mainButtonDisabled = introActive
    ? evaluating || !introManualActionEnabled
    : evaluating || outroStage === "playing" || (!pendingAdvance && (!sttSupported || speaking));
  const shouldShowQuestionPanel = !introActive && outroStage === "idle" && Boolean(currentQuestion?.prompt?.trim());

  useEffect(() => {
    speakRef.current = speak;
    stopSpeakingRef.current = stopSpeaking;
  }, [speak, stopSpeaking]);

  useEffect(() => {
    if (!currentQuestion || !interview || openingDelivered || !isFirstQuestion) {
      if (openingDelivered) {
        setIntroStage("done");
      }
      if (!isFirstQuestion) {
        introSequenceQuestionRef.current = null;
      }
      return;
    }

    if (introSequenceQuestionRef.current === currentQuestionId) {
      return;
    }

    if (ttsSupported && !ttsReady) {
      return;
    }

    introTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    introTimersRef.current = [];

    introSequenceQuestionRef.current = currentQuestionId;
    setIntroStage("playing");
    setVisibleIntroLines(0);
    setActiveIntroLine(-1);
    introSpeechSequenceRef.current += 1;
    const sequenceId = introSpeechSequenceRef.current;

    const playIntroLine = (index: number) => {
      if (introSpeechSequenceRef.current !== sequenceId) {
        return;
      }

      if (index >= introLines.length) {
        setActiveIntroLine(-1);
        setIntroStage("pause");
        const pauseTimer = window.setTimeout(() => {
          if (introSpeechSequenceRef.current !== sequenceId) {
            return;
          }
          setOpeningDelivered(true);
          setIntroStage("done");
        }, INTRO_PAUSE_MS);
        introTimersRef.current.push(pauseTimer);
        return;
      }

      const line = introLines[index];
      let settled = false;
      setVisibleIntroLines(index + 1);
      setActiveIntroLine(index);

      const fallbackTimer = window.setTimeout(() => {
        if (settled || introSpeechSequenceRef.current !== sequenceId) {
          return;
        }
        settled = true;
        playIntroLine(index + 1);
      }, estimateSpeechMs(line));
      introTimersRef.current.push(fallbackTimer);

      speakRef.current(line, {
        onStart: () => {
          if (introSpeechSequenceRef.current !== sequenceId) {
            return;
          }
          setActiveIntroLine(index);
        },
        onComplete: () => {
          if (settled || introSpeechSequenceRef.current !== sequenceId) {
            return;
          }
          settled = true;
          window.setTimeout(() => {
            playIntroLine(index + 1);
          }, 180);
        },
        onError: () => {
          if (settled || introSpeechSequenceRef.current !== sequenceId) {
            return;
          }
          settled = true;
          setActiveIntroLine(index);
        },
      });
    };

    playIntroLine(0);

    return () => {
      introSpeechSequenceRef.current += 1;
      introTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      introTimersRef.current = [];
    };
  }, [currentQuestion, currentQuestionId, interview, INTRO_PAUSE_MS, introLines, isFirstQuestion, openingDelivered, ttsReady, ttsSupported]);

  useEffect(() => {
    if (outroStage !== "playing") {
      return;
    }

    outroTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    outroTimersRef.current = [];

    setVisibleOutroLines(0);
    setActiveOutroLine(-1);
    outroSpeechSequenceRef.current += 1;
    const sequenceId = outroSpeechSequenceRef.current;

    const playOutroLine = (index: number) => {
      if (outroSpeechSequenceRef.current !== sequenceId) {
        return;
      }

      if (index >= outroLines.length) {
        setActiveOutroLine(-1);
        const finishTimer = window.setTimeout(() => {
          if (outroSpeechSequenceRef.current !== sequenceId) return;
          setOutroStage("done");
          if (interview && setup) {
            const report = compileFinalReport(interview.turns, setup.resume, setup.job, setup.companySummary);
            saveFinalReport(report);
            startTransition(() => {
              router.push("/results");
            });
          }
        }, 1500);
        outroTimersRef.current.push(finishTimer);
        return;
      }

      const line = outroLines[index];
      let settled = false;
      setVisibleOutroLines(index + 1);
      setActiveOutroLine(index);

      const fallbackTimer = window.setTimeout(() => {
        if (settled || outroSpeechSequenceRef.current !== sequenceId) return;
        settled = true;
        playOutroLine(index + 1);
      }, estimateSpeechMs(line));
      outroTimersRef.current.push(fallbackTimer);

      speakRef.current(line, {
        onStart: () => {
          if (outroSpeechSequenceRef.current !== sequenceId) return;
          setActiveOutroLine(index);
        },
        onComplete: () => {
          if (settled || outroSpeechSequenceRef.current !== sequenceId) return;
          settled = true;
          window.setTimeout(() => playOutroLine(index + 1), 180);
        },
        onError: () => {
          if (settled || outroSpeechSequenceRef.current !== sequenceId) return;
          settled = true;
          setActiveOutroLine(index);
        },
      });
    };

    playOutroLine(0);

    return () => {
      outroSpeechSequenceRef.current += 1;
      outroTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      outroTimersRef.current = [];
    };
  }, [outroStage, outroLines, interview, setup, router]);

  useEffect(() => {
    if (voiceError) {
      setError(voiceError);
    }
  }, [voiceError]);

  useEffect(() => {
    if (!currentQuestionId || !currentQuestionPrompt || pendingAdvance || !questionVisible) {
      return;
    }

    if (spokenQuestionId === currentQuestionId) {
      return;
    }

    if (ttsSupported && !ttsReady) {
      return;
    }

    setSpokenQuestionId(currentQuestionId);
    speakRef.current(currentQuestionPrompt);
  }, [currentQuestionId, currentQuestionPrompt, pendingAdvance, questionVisible, spokenQuestionId, ttsReady, ttsSupported]);

  useEffect(() => {
    if (recognitionError) {
      setError(recognitionError);
    }
  }, [recognitionError]);

  useEffect(() => {
    return () => {
      introTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      userMicStream?.getTracks().forEach((track) => track.stop());
    };
  }, [userMicStream]);

  function updateInterview(nextInterview: InterviewSession) {
    setInterview(nextInterview);
    saveInterviewSession(nextInterview);
  }

  async function handleStartRecording() {
    if (!sttSupported) {
      setError("Speech recognition is unavailable in this browser. This prototype currently requires microphone input.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is unavailable in this browser.");
      return;
    }

    setError("");
    stopSpeaking();

    try {
      const hasLiveTrack = userMicStream?.getTracks().some((track) => track.readyState === "live");
      if (!hasLiveTrack) {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        setUserMicStream(nextStream);
      }

      start();
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : "Microphone permission is required to record an answer.");
    }
  }

  function handleStopRecording() {
    stop();
  }

  function handleReplayQuestion() {
    if (!currentQuestion) {
      return;
    }

    if (ttsSupported && !ttsReady) {
      setError("Coach voice is still loading. Give it a second and try replay again.");
      return;
    }

    setError("");
    speak(currentQuestion.prompt);
  }

  function handleReplayIntro() {
    introTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    introTimersRef.current = [];
    introSpeechSequenceRef.current += 1;
    setError("");
    setIntroStage("playing");
    setOpeningDelivered(false);
    setVisibleIntroLines(0);
    setActiveIntroLine(-1);
    introSequenceQuestionRef.current = null;
  }

  function handleIntroContinue() {
    if (!currentQuestion) {
      return;
    }

    introTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    introTimersRef.current = [];
    setError("");
    setVisibleIntroLines(introLines.length);
    setActiveIntroLine(-1);
    setIntroStage("done");
    setOpeningDelivered(true);
    setSpokenQuestionId(currentQuestion.id);
  }

  function handleContinue() {
    if (!setup || !interview) {
      return;
    }

    const nextIndex = interview.currentQuestionIndex + 1;

    if (nextIndex >= interview.targetQuestionCount) {
      setOutroStage("playing");
      setPendingAdvance(false);
      return;
    }

    const nextQuestionPrompt = interview.pendingNextQuestion?.trim();
    if (!nextQuestionPrompt) {
      setError("No follow-up question is ready yet. Submit another answer to continue.");
      setPendingAdvance(false);
      return;
    }

    const nextSkill = interview.pendingNextSkill?.trim();
    const nextQuestion = {
      id: `q${nextIndex + 1}`,
      category: "adaptive" as const,
      prompt: nextQuestionPrompt,
      focus: interview.pendingNextTip?.trim() || "",
      targetSkills: nextSkill ? [nextSkill] : [],
    };

    updateInterview({
      ...interview,
      currentQuestionIndex: nextIndex,
      currentQuestion: {
        ...nextQuestion,
        focus: nextQuestion.focus || buildQuestionTip(nextQuestion),
      },
      pendingNextQuestion: undefined,
      pendingNextTip: undefined,
      pendingNextSkill: undefined,
      pendingFollowUpReason: undefined,
    });
    setDraftAnswer("");
    draftAnswerRef.current = "";
    setPendingAdvance(false);
    reset();
    setVisibleIntroLines(0);
    introSequenceQuestionRef.current = null;
  }

  function storeTurn(turn: InterviewTurn, modelResponse: InterviewModelEvaluation) {
    if (!setup || !interview) {
      return;
    }

    const nextTurns = [...interview.turns, turn];
    const completed = nextTurns.length >= interview.targetQuestionCount;
    const nextSkill = modelResponse.next_skill_to_probe?.trim();
    const nextCoveredSkills = uniqueItems([
      ...interview.coveredSkills,
      ...(nextSkill ? [nextSkill] : []),
    ]);

    const nextInterview = {
      ...interview,
      turns: nextTurns,
      coveredSkills: nextCoveredSkills,
      pendingNextQuestion: modelResponse.follow_up_question,
      pendingNextTip: modelResponse.coach_tip,
      pendingNextSkill: modelResponse.next_skill_to_probe,
      pendingFollowUpReason: modelResponse.why_this_follow_up,
      completedAt: completed ? new Date().toISOString() : interview.completedAt,
    };

    updateInterview(nextInterview);
    setPendingAdvance(true);
    stop();
    reset();
  }

  async function handleSpeakToggle() {
    if (listening) {
      stop();
      // Wait briefly for any final speech recognition results to flush into the ref
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      void handleSubmitAnswer();
    } else {
      void handleStartRecording();
    }
  }

  async function handleSubmitAnswer() {
    if (!setup || !interview || !currentQuestion) {
      return;
    }

    const answer = draftAnswerRef.current.trim() || draftAnswer.trim();
    if (!answer) {
      setError("No answer was recorded. Tap Speak and say your answer.");
      return;
    }

    setError("");
    setEvaluating(true);

    try {
      const modelResponse = await fetch("/api/interview/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: {
            candidateName: setup.context?.candidateName || setup.resume.name || "",
            companyName: setup.job.companyName || "",
            role: interviewContext.role,
            seniority: interviewContext.seniority,
            interviewType: interviewContext.interviewType,
            resumeProjectSummary: interviewContext.resumeProjectSummary,
            resumeHighlights: interviewContext.resumeHighlights,
            resumeSkills: interviewContext.resumeSkills,
            resumeEducation: interviewContext.resumeEducation,
            resumeExperience: interviewContext.resumeExperience,
            resumeProjects: interviewContext.resumeProjects,
            jobSummary: interviewContext.jobSummary,
            companySummary: setup.companySummary,
            requiredSkills: setup.job.requiredSkills,
            preferredSkills: setup.job.preferredSkills,
            responsibilities: setup.job.responsibilities,
            keywords: setup.job.keywords,
            previousQuestions: interview.turns.map((turn) => turn.question),
            previousAnswers: interview.turns.map((turn) => turn.answer),
            coveredSkills: interview.coveredSkills,
            latestQuestion: currentQuestion.prompt,
            latestAnswer: answer,
          },
        }),
      });

      if (!modelResponse.ok) {
        const details = await modelResponse.text();
        throw new Error(details || "Local interview model request failed.");
      }

      const evaluation = (await modelResponse.json()) as InterviewModelEvaluation;
      const heuristicFeedback = buildAnswerFeedback(answer, currentQuestion, setup.job);
      const normalizedCoachSummary = evaluation.evaluation.trim() || heuristicFeedback.coachSummary;

      storeTurn(
        {
          questionId: currentQuestion.id,
          category: currentQuestion.category,
          question: currentQuestion.prompt,
          answer,
          followUp: evaluation.follow_up_question,
          evaluation: normalizedCoachSummary,
          whyThisFollowUp: evaluation.why_this_follow_up,
          nextSkillToProbe: evaluation.next_skill_to_probe,
          scores: scoreAnswer({
            answer,
            question: currentQuestion,
            job: setup.job,
          }),
          feedback: {
            ...heuristicFeedback,
            strengths: evaluation.strengths.length ? evaluation.strengths : heuristicFeedback.strengths,
            issues: evaluation.gaps.length ? evaluation.gaps : heuristicFeedback.issues,
            coachSummary: normalizedCoachSummary,
          },
        },
        evaluation,
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not evaluate this answer with the local model.",
      );
    } finally {
      setEvaluating(false);
    }
  }

  function handleSkipQuestion() {
    if (!currentQuestion) {
      return;
    }

    const skipEvaluation: InterviewModelEvaluation = {
      evaluation: "No answer was provided, so there is no response quality to evaluate for this question.",
      strengths: ["The flow stayed moving."],
      gaps: ["There was no recorded answer to review."],
      follow_up_question: "Let’s shift to another area. Can you share one strong example that best represents your impact?",
      why_this_follow_up: "This keeps momentum while recovering evidence for role fit.",
      next_skill_to_probe: interview?.coveredSkills[0] || setup?.job.requiredSkills[0] || "role-fit execution",
    };

    storeTurn(
      {
        questionId: currentQuestion.id,
        category: currentQuestion.category,
        question: currentQuestion.prompt,
        answer: "Skipped by user.",
        followUp: skipEvaluation.follow_up_question,
        evaluation:
          "There was no answer to review here, so the interviewer could not evaluate clarity, specificity, or structure. Next time, give even a short response with one clear point and a brief close.",
        whyThisFollowUp: skipEvaluation.why_this_follow_up,
        nextSkillToProbe: skipEvaluation.next_skill_to_probe,
        scores: {
          relevance: 20,
          specificity: 10,
          confidence: 35,
          alignment: 20,
          overall: 21,
        },
        feedback: {
          strengths: ["The interview moved forward without stalling."],
          issues: ["There was no answer to evaluate for clarity, structure, or specificity."],
          improvedAnswer:
            "Use a short, structured answer even if you are unsure: context, action, result, and why it matters here.",
          coachSummary:
            "There was no answer to review here, so the interviewer could not evaluate clarity, specificity, or structure. Next time, give even a short response with one clear point and a brief close.",
        },
      },
      skipEvaluation,
    );
  }

  if (!setup || !interview || !currentQuestion) {
    return (
      <Shell
        badge="RoleReady"
        title="Interview session not found."
        subtitle="Set up a session first so the app can tailor the questions and report."
        current="interview"
      >
        <div className="panel p-6">
          <p className="text-sm text-slate">{status}</p>
          <button type="button" className="button-primary mt-4" onClick={() => router.push("/")}>
            Return to setup
          </button>
        </div>
      </Shell>
    );
  }

  const introView = (
    <section className="mt-6">
      <div className="mx-auto flex min-h-[430px] max-w-4xl flex-col items-center justify-center px-4 text-center">
        <LiveAudioWaveform
          tone="coach"
          active={speaking}
          mediaElement={activeAudioElement}
          activityLevel={browserSpeechLevel}
          className="mb-8 w-40 sm:w-48"
        />
        <div className="w-full max-w-4xl space-y-4">
          {introLines.map((line, index) => (
            <p
              key={line}
              className={cn(
                "text-xl leading-9 text-ink/82 transition-all duration-500 sm:text-[1.7rem] sm:leading-[1.9]",
                visibleIntroLines > index
                  ? activeIntroLine === index
                    ? "translate-y-0 opacity-100"
                    : "translate-y-0 opacity-74"
                  : "translate-y-3 opacity-0",
              )}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );

  const interviewView = (
    <section className="animate-entrance relative mx-auto mt-6 max-w-5xl overflow-hidden rounded-[45px] border border-white bg-white/40 px-6 py-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:px-10 sm:py-7 lg:px-12">
      <div className="relative flex min-h-[320px] flex-col sm:min-h-[340px]">
        <div className="flex h-10 items-center justify-center">
          <p className="text-[16px] font-semibold uppercase tracking-[0.2em] text-ink/60">
            {progressLabel}
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <LiveAudioWaveform
            tone="coach"
            active={speaking}
            mediaElement={activeAudioElement}
            activityLevel={browserSpeechLevel}
            className="mb-4 w-20 sm:w-24"
          />
          <div className="mx-auto w-full max-w-5xl text-center">
            <h2
              key={`q-${currentQuestion.id}`}
              className={cn(
                "animate-entrance font-semibold leading-[1.3] text-ink transition-all duration-300",
                getQuestionTextSize(currentQuestion.prompt),
              )}
            >
              {currentQuestion.prompt}
            </h2>
          </div>
        </div>

        <div key={`tip-${currentQuestion.id}`} className="animate-entrance flex min-h-[80px] items-end pt-2 [animation-delay:150ms]">
          <div className="w-full rounded-[26px] border border-white/60 bg-white/18 px-5 py-4 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/68">
              Coach tip
            </p>
            <p className="mt-2 min-h-[48px] text-sm leading-6 text-ink/72 sm:text-base">
              {currentQuestion.focus}
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  const outroView = (
    <section className="animate-entrance mt-6">
      <div className="mx-auto flex min-h-[430px] max-w-4xl flex-col items-center justify-center px-4 text-center">
        <LiveAudioWaveform
          tone="coach"
          active={speaking}
          mediaElement={activeAudioElement}
          activityLevel={browserSpeechLevel}
          className="mb-8 w-20 sm:w-24"
        />
        <div className="w-full max-w-4xl space-y-4">
          {outroLines.map((line, index) => (
            <p
              key={line}
              className={cn(
                "text-xl leading-9 text-ink/82 transition-all duration-500 sm:text-[1.7rem] sm:leading-[1.9]",
                visibleOutroLines > index
                  ? activeOutroLine === index
                    ? "translate-y-0 opacity-100"
                    : "translate-y-0 opacity-74"
                  : "translate-y-3 opacity-0",
              )}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-[82rem] flex-col bg-transparent">
      <div className="absolute left-6 right-6 top-10 z-50 sm:left-10 lg:left-14 lg:right-14 xl:left-16 xl:right-16">
        <SiteHeader current="interview" />
      </div>
      <div className="mx-auto w-full max-w-[82rem] px-6 pb-6 pt-36 sm:px-10 lg:px-14 xl:px-16">
        {introActive ? introView : outroStage !== "idle" ? outroView : shouldShowQuestionPanel ? interviewView : null}

        <section className={cn("mt-4 transition-opacity duration-300", introActive || outroStage !== "idle" ? "pointer-events-none opacity-0" : "opacity-100")}>
          <div className="mx-auto grid min-h-[208px] max-w-xl grid-rows-[48px_72px_32px_28px] items-center justify-items-center">
            <div className="flex h-[56px] w-full items-center justify-center">
              <LiveAudioWaveform
                tone="candidate"
                active={listening}
                mediaStream={userMicStream}
                className="w-20 sm:w-24"
              />
            </div>

            <div className="flex h-[72px] w-full items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  if (introActive) {
                    if (voiceError) {
                      handleReplayIntro();
                    } else if (introManualActionEnabled) {
                      handleIntroContinue();
                    }
                  } else if (pendingAdvance) {
                    handleContinue();
                  } else {
                    void handleSpeakToggle();
                  }
                }}
                disabled={mainButtonDisabled}
                className={cn(
                  "flex h-14 w-[220px] items-center justify-center rounded-full text-sm font-semibold text-white transition-all duration-200",
                  evaluating
                    ? "bg-ink/70"
                    : listening
                      ? "animate-recording-pulse bg-red-500"
                      : "bg-ink hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45",
                )}
              >
                {evaluating ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {actionButtonLabel}
                  </span>
                ) : (
                  actionButtonLabel
                )}
              </button>
            </div>

            <div className="flex h-[32px] items-center justify-center">
              <p className="text-sm text-slate">{statusText}</p>
            </div>

            <div className="flex h-[28px] items-center justify-center">
              {error ? (
                <p className="text-center text-sm text-red-600">{error}</p>
              ) : (
                <span className="text-sm text-transparent">status</span>
              )}
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}
