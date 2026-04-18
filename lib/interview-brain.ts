import { getLlmProvider } from "@/lib/llm/provider";
import type { InterviewModelEvaluation } from "@/lib/types";

const BEHAVIORAL_SKILL_HINTS = new Set([
  "communication",
  "leadership",
  "prioritization",
  "collaboration",
  "ownership",
  "stakeholder management",
  "project management",
  "agile",
  "problem solving",
  "decision-making",
  "adaptability",
]);

export type InterviewBrainState = {
  candidateName: string;
  role: string;
  companyName?: string;
  seniority: string;
  interviewType: string;
  resumeProjectSummary: string;
  resumeHighlights?: string[];
  resumeSkills?: string[];
  jobSummary?: string;
  companySummary?: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  keywords: string[];
  previousQuestions: string[];
  previousAnswers: string[];
  coveredSkills: string[];
  latestQuestion?: string;
  latestAnswer?: string;
};

type InterviewStage =
  | "motivation"
  | "experience-overview"
  | "project-deep-dive"
  | "project-follow-up"
  | "tradeoffs"
  | "role-behavioral"
  | "closing";

function inferStage(previousQuestionsCount: number): InterviewStage {
  if (previousQuestionsCount === 0) return "motivation";
  if (previousQuestionsCount === 1) return "experience-overview";
  if (previousQuestionsCount === 2) return "project-deep-dive";
  if (previousQuestionsCount === 3) return "project-follow-up";
  if (previousQuestionsCount === 4) return "tradeoffs";
  if (previousQuestionsCount === 5) return "role-behavioral";
  return "closing";
}

// Returns the first required skill not yet mentioned in coveredSkills.
function uncoveredSkill(state: InterviewBrainState): string {
  const covered = new Set(state.coveredSkills.map((s) => s.toLowerCase()));
  const next = state.requiredSkills.find((s) => !covered.has(s.toLowerCase()));
  return next || state.requiredSkills[0] || state.keywords[0] || "role-fit";
}

function pickRelevantResumeHighlight(state: InterviewBrainState): string {
  return state.resumeHighlights?.find(Boolean)?.trim() || "the most relevant project or experience from your background";
}

function normalizedCompanyReference(companyName?: string) {
  const company = companyName?.trim();
  if (!company || company.toLowerCase() === "the company" || company.toLowerCase() === "the team") {
    return "";
  }
  return company;
}

function normalizeSkillLabel(skill: string) {
  return skill.replace(/\bnodejs\b/i, "Node.js").replace(/\bgit\b/i, "Git").trim();
}

function isBehavioralSkill(skill: string) {
  const lower = skill.toLowerCase().trim();
  return BEHAVIORAL_SKILL_HINTS.has(lower);
}

function buildRoleBehavioralQuestion(state: InterviewBrainState) {
  const skill = normalizeSkillLabel(uncoveredSkill(state));
  const role = state.role || "this role";
  const responsibilities = state.responsibilities || [];
  const responsibility = responsibilities[0]?.replace(/\s+/g, " ").trim() || "";
  const compactResponsibility =
    responsibility.length > 110 ? `${responsibility.slice(0, 107).trim()}...` : responsibility;

  if (isBehavioralSkill(skill)) {
    return `Tell me about a time when you had to demonstrate ${skill} in a high-stakes or fast-moving situation. What happened, and what did you do?`;
  }

  if (compactResponsibility) {
    return `One part of this ${role} role is ${compactResponsibility.charAt(0).toLowerCase()}${compactResponsibility.slice(1)}. Tell me about a project where you used ${skill} in a meaningful way and what decisions or tradeoffs you had to make.`;
  }

  return `Tell me about a project where you had to use ${skill} in a meaningful way. What was the situation, what decisions did you make, and what outcome did you drive?`;
}

// Simple word-overlap similarity check. Returns true if newQ shares > 50% of
// significant words with any question already asked — meaning it is a near-duplicate.
function isTooSimilar(newQuestion: string, previousQuestions: string[]): boolean {
  const sig = (s: string) =>
    s
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4);

  const newWords = new Set(sig(newQuestion));
  if (newWords.size === 0) return false;

  for (const prev of previousQuestions) {
    const prevWords = sig(prev);
    const overlap = prevWords.filter((w) => newWords.has(w)).length;
    if (overlap / Math.max(newWords.size, prevWords.length, 1) > 0.5) {
      return true;
    }
  }
  return false;
}

function questionFocus(question: string) {
  const lower = question.toLowerCase();

  if (/\b(tradeoff|trade-off|decision|collaboration|stakeholder|speed|quality|complexity)\b/.test(lower)) {
    return "tradeoff";
  }

  if (/\b(challenge|difficult|hardest|obstacle|problem)\b/.test(lower)) {
    return "challenge";
  }

  if (/\bwhy\b.*\b(role|company|opportunity|next step)\b|\bright next step\b/.test(lower)) {
    return "motivation";
  }

  if (/\bresume\b|\bproject\b|\bwalk me through\b|\btell me about yourself\b/.test(lower)) {
    return "experience";
  }

  if (/\btell me about a time when\b|\bhigh-stakes\b|\bfast-moving\b/.test(lower)) {
    return "behavioral";
  }

  if (/\bwrap up\b|\bremember\b|\bbefore we wrap up\b/.test(lower)) {
    return "closing";
  }

  return "general";
}

function conflictsWithRecentAngle(newQuestion: string, previousQuestions: string[]) {
  const lastQuestion = previousQuestions.at(-1);
  if (!lastQuestion) {
    return false;
  }

  const nextFocus = questionFocus(newQuestion);
  const lastFocus = questionFocus(lastQuestion);

  return nextFocus !== "general" && nextFocus === lastFocus;
}

// Stage-aware fallback question used when the model fails or generates a near-duplicate.
function stageFallbackQuestion(stage: InterviewStage, state: InterviewBrainState): string {
  const role = state.role || "this role";
  const skill = uncoveredSkill(state);
  const company =
    state.companyName?.trim() ||
    state.companySummary?.split(".")[0]?.trim() ||
    "this company";

  switch (stage) {
    case "motivation":
      return `What about the ${role} role at ${company} genuinely stands out to you, and why does it feel like the right next step right now?`;
    case "experience-overview":
      return `Looking across your background, which experiences or projects feel most relevant to the ${role} role, and why?`;
    case "project-deep-dive":
      return `I was looking at ${pickRelevantResumeHighlight(state)} on your resume, and I'd love to hear more about it. What problem were you solving, what did you own directly, and what outcome came from the work?`;
    case "project-follow-up":
      return `Staying with that project for a moment, what was the most technically difficult part, and how did you work through it?`;
    case "tradeoffs":
      return `On that same project, what tradeoff or decision did you have to make around speed, quality, complexity, or collaboration, and how did you think it through?`;
    case "role-behavioral":
      return buildRoleBehavioralQuestion(state);
    case "closing":
      return `Before we wrap up, what is the one thing about your background you most want me to remember for this role?`;
  }
}

// Stage-aware system prompt. Short and directive so small models (0.6b) can follow it.
function buildStageSystemPrompt(stage: InterviewStage): string {
  const jsonShape =
    'Return ONLY strict JSON: {"evaluation": string, "strengths": [string, string], ' +
    '"gaps": [string, string], "follow_up_question": string, ' +
    '"why_this_follow_up": string, "next_skill_to_probe": string}.';
  const answerCoachRule =
    "evaluation, strengths, and gaps must critique ONLY the quality of the candidate's answer to the latest question. " +
    "Focus on clarity, specificity, structure, relevance to the exact question, confidence, and completeness. " +
    "Do NOT judge job fit, readiness, technical qualifications, missing skills, resume strength, or career direction.";

  switch (stage) {
    case "motivation":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${answerCoachRule} ` +
        "follow_up_question must be a MOTIVATION question. " +
        "Use the company and role fields from the context — do NOT use placeholders like [Company Name]. " +
        "Ask why the candidate wants this specific role at this company, and why now in their career. " +
        "One concise, direct sentence."
      );

    case "experience-overview":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${answerCoachRule} ` +
        "follow_up_question must ask for a general overview of the candidate's most relevant experience for the role. " +
        "Reference the role requirements explicitly. Do not jump into one narrow project yet. One concise direct sentence."
      );

    case "project-deep-dive":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${answerCoachRule} ` +
        "follow_up_question must choose ONE specific project or technical example from the resume and ask for a deep walkthrough. " +
        "Use resume_highlights and role requirements to choose the best project. Ask about ownership, problem, stack, and result. " +
        "Do NOT use generic fit wording."
      );

    case "project-follow-up":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${answerCoachRule} ` +
        "The candidate just described a project. follow_up_question must ask one focused follow-up on that same project. " +
        "Probe missing depth such as challenge, ownership boundary, decision-making, metrics, or implementation details. " +
        "Do NOT switch to a new topic."
      );

    case "tradeoffs":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${answerCoachRule} ` +
        "follow_up_question must ask about tradeoffs, technical decisions, collaboration, metrics, stakeholder communication, or outcomes. " +
        "Keep it tied to the project or experience already under discussion."
      );

    case "role-behavioral":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${answerCoachRule} ` +
        "follow_up_question must be a role-specific or behavioral question tied to the actual job. " +
        'If behavioral, it may start with "Tell me about a time when". ' +
        "Use uncovered required skills, responsibilities, or working style expectations from the posting. " +
        "Do not repeat already_asked questions."
      );

    case "closing":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${answerCoachRule} ` +
        "follow_up_question should invite the candidate to make their strongest final case or " +
        "reflect on the conversation. Keep it brief and warm."
      );
  }
}

function sanitizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function sanitizeText(input: unknown, fallback: string): string {
  const text = String(input ?? "").trim();
  return text || fallback;
}

function normalizeQuestionSpacing(question: string) {
  return question.replace(/\s+/g, " ").trim();
}

function questionLooksAwkward(question: string) {
  const lower = question.toLowerCase();

  return (
    /\bhad to (sql|react|typescript|javascript|python|java|c\+\+|git|aws|docker|kubernetes)\b/i.test(question) ||
    /\bhow does your experience fit\b/i.test(lower) ||
    /\bstrong fit for this role\b/i.test(lower) ||
    /\brole involves you'?ll\b/i.test(lower) ||
    question.length > 240
  );
}

function ensureQuestionQuality(rawQuestion: string, stage: InterviewStage, state: InterviewBrainState) {
  const normalized = normalizeQuestionSpacing(rawQuestion);

  if (!normalized) {
    return stageFallbackQuestion(stage, state);
  }

  if (questionLooksAwkward(normalized)) {
    return stageFallbackQuestion(stage, state);
  }

  return normalized;
}

async function polishQuestion(
  provider: ReturnType<typeof getLlmProvider>,
  question: string,
  stage: InterviewStage,
  state: InterviewBrainState,
) {
  try {
    const polished = await provider.generateJson<{ question?: string }>({
      systemPrompt:
        'You rewrite interview questions. Return ONLY strict JSON: {"question": string}. ' +
        "Rewrite the question so it sounds like a natural, professional interviewer. " +
        "Keep it concise, grammatically correct, and easy to answer. Preserve the core intent. " +
        "Do not introduce placeholders, resume noise, or awkward wording. " +
        "Do not paste long job-description text into the question.",
      userPrompt: JSON.stringify({
        stage,
        role: state.role,
        company: normalizedCompanyReference(state.companyName) || "",
        resume_highlight: pickRelevantResumeHighlight(state),
        original_question: question,
      }),
    });

    return ensureQuestionQuality(String(polished.question ?? ""), stage, state);
  } catch {
    return ensureQuestionQuality(question, stage, state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Opening question — always static, no LLM.
// A reliable, role-aware intro prompt that starts every interview cleanly.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateOpeningQuestion(state: InterviewBrainState) {
  const role = state.role || "this role";
  const company = normalizedCompanyReference(state.companyName);
  const roleContext = company ? `${role} role at ${company}` : `${role} role`;
  const provider = getLlmProvider();
  const baseQuestion = `To get started, tell me a bit about yourself and what led you to apply for the ${roleContext}.`;

  return {
    question: await polishQuestion(provider, baseQuestion, "motivation", state),
    whyThisQuestion:
      "Starts with a natural warm-up so the candidate can frame their story before the interview narrows into role fit and project depth.",
    nextSkillToProbe:
      state.requiredSkills[0] || state.keywords[0] || "role-fit",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Turn evaluation — stage-aware, anti-repetition, with quality fallbacks.
// ─────────────────────────────────────────────────────────────────────────────
export async function evaluateInterviewTurn(
  state: InterviewBrainState,
): Promise<InterviewModelEvaluation> {
  const provider = getLlmProvider();
  const stage = inferStage(state.previousQuestions.length);
  const systemPrompt = buildStageSystemPrompt(stage);
  const skill = uncoveredSkill(state);

  // Include the current question in the "already asked" list so the model avoids it.
  const allAskedQuestions = [
    ...state.previousQuestions,
    state.latestQuestion || "",
  ].filter(Boolean);

  const userPrompt = JSON.stringify({
    candidate_name: state.candidateName,
    role: state.role,
    company: state.companyName?.trim() || "the company",
    seniority: state.seniority,
    resume_summary: state.resumeProjectSummary.slice(0, 350),
    resume_highlights: (state.resumeHighlights || []).slice(0, 4),
    resume_skills: (state.resumeSkills || []).slice(0, 10),
    job_summary: (state.jobSummary || "").slice(0, 350),
    required_skills: state.requiredSkills.slice(0, 4),
    preferred_skills: (state.preferredSkills || []).slice(0, 4),
    responsibilities: (state.responsibilities || []).slice(0, 4),
    skill_to_probe_next: skill,
    already_asked: allAskedQuestions.slice(-4),
    latest_question: state.latestQuestion || "",
    latest_answer: (state.latestAnswer || "").slice(0, 500),
  });

  const defaultEvaluation: InterviewModelEvaluation = {
    evaluation: "The answer stayed broad, so it would be stronger with a clearer structure and one concrete detail tied directly to the question.",
    strengths: ["Stayed on the question.", "Answered directly."],
    gaps: [
      "Add one concrete example or detail so the answer is easier to picture.",
      "Use a clearer structure so the listener can follow the response.",
    ],
    follow_up_question: stageFallbackQuestion(stage, state),
    why_this_follow_up: `Moves the interview into the ${stage} stage.`,
    next_skill_to_probe: skill,
  };

  try {
    const output = await provider.generateJson<InterviewModelEvaluation>({
      systemPrompt,
      userPrompt,
    });

    const rawFollowUp = sanitizeText(output.follow_up_question, "");

    // Anti-repetition: if the model generated something too close to a prior question,
    // fall back to the stage-appropriate question instead.
    const candidateQuestion =
      rawFollowUp &&
      !isTooSimilar(rawFollowUp, allAskedQuestions) &&
      !conflictsWithRecentAngle(rawFollowUp, allAskedQuestions)
        ? ensureQuestionQuality(rawFollowUp, stage, state)
        : stageFallbackQuestion(stage, state);
    const followUpQuestion = await polishQuestion(provider, candidateQuestion, stage, state);

    const strengths = sanitizeList(output.strengths);
    const gaps = sanitizeList(output.gaps);

    return {
      evaluation: sanitizeText(
        output.evaluation,
        defaultEvaluation.evaluation,
      ),
      strengths: strengths.length ? strengths : defaultEvaluation.strengths,
      gaps: gaps.length ? gaps : defaultEvaluation.gaps,
      follow_up_question: followUpQuestion,
      why_this_follow_up: sanitizeText(
        output.why_this_follow_up,
        defaultEvaluation.why_this_follow_up,
      ),
      next_skill_to_probe: sanitizeText(output.next_skill_to_probe, skill),
    };
  } catch {
    return {
      ...defaultEvaluation,
      follow_up_question: stageFallbackQuestion(stage, state),
    };
  }
}
