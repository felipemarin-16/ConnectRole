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
  resumeEducation?: string[];
  resumeExperience?: string[];
  resumeProjects?: string[];
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
  | "background"
  | "resume-dive"
  | "jd-skill"
  | "company-fit";

type AnswerReviewPayload = Pick<InterviewModelEvaluation, "evaluation" | "strengths" | "gaps">;
type NextQuestionPayload = Pick<
  InterviewModelEvaluation,
  "follow_up_question" | "coach_tip" | "why_this_follow_up" | "next_skill_to_probe"
>;

function inferStage(previousQuestionsCount: number): InterviewStage {
  if (previousQuestionsCount <= 1) return "resume-dive";
  if (previousQuestionsCount === 2) return "jd-skill";
  return "company-fit";
}

// Returns the first required skill not yet mentioned in coveredSkills.
function uncoveredSkill(state: InterviewBrainState): string {
  const covered = new Set(state.coveredSkills.map((s) => s.toLowerCase()));
  const next = state.requiredSkills.find((s) => !covered.has(s.toLowerCase()));
  return next || state.requiredSkills[0] || state.keywords[0] || "role-fit";
}

function pickRelevantResumeHighlight(state: InterviewBrainState): string {
  // Only pick from projects or experience — never education
  const projects = state.resumeProjects || [];
  const experience = state.resumeExperience || [];
  const candidate = projects.find(Boolean)?.trim() || experience.find(Boolean)?.trim();
  return candidate || "the most relevant project or experience from your background";
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
  const responsibilities = state.responsibilities || [];
  const responsibility = responsibilities[0]?.replace(/\s+/g, " ").trim() || "";
  const compactResponsibility =
    responsibility.length > 110 ? `${responsibility.slice(0, 107).trim()}...` : responsibility;

  if (isBehavioralSkill(skill)) {
    return `Tell me about a time when you had to show ${skill}. What happened?`;
  }

  if (compactResponsibility) {
    return `Tell me about a project where you used ${skill}. What were you trying to accomplish?`;
  }

  return `Tell me about a project where you used ${skill}. What did you work on?`;
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
  const company =
    state.companyName?.trim() ||
    state.companySummary?.split(".")[0]?.trim() ||
    "this company";
  const companyReference = normalizedCompanyReference(company);
  const highlight = pickRelevantResumeHighlight(state).replace(/\s+/g, " ").trim();

  switch (stage) {
    case "background":
      return "Tell me about yourself and what brings you to this role.";
    case "resume-dive": {
      // Only use projects or experience, never education
      const projects = state.resumeProjects || [];
      const experience = state.resumeExperience || [];
      const previousQuestionsString = state.previousQuestions.join(" ").toLowerCase();
      
      const unusedProjects = projects.filter((p) => p && !previousQuestionsString.includes(p.toLowerCase().trim()));
      const unusedExperience = experience.filter((e) => e && !previousQuestionsString.includes(e.toLowerCase().trim()));

      const projectItem = unusedProjects[0]?.trim();
      const experienceItem = unusedExperience[0]?.trim();
      
      if (projectItem) {
        return `I saw ${projectItem} on your resume. Walk me through that project — what were you trying to build and what was your role?`;
      }
      if (experienceItem) {
        return `I noticed ${experienceItem} on your resume. Tell me about your biggest accomplishment there.`;
      }
      return "Tell me about a project or experience you're most proud of.";
    }
    case "jd-skill": {
      const skill = normalizeSkillLabel(uncoveredSkill(state));
      const responsibilities = state.responsibilities || [];
      const responsibility = responsibilities[0]?.replace(/\s+/g, " ").trim() || "";
      if (responsibility && skill) {
        return `This role involves ${responsibility.toLowerCase().slice(0, 80)}. Walk me through a time you used ${skill} in that kind of work.`;
      }
      if (skill && skill !== "role-fit") {
        return `The job description highlights ${skill} as a key requirement. Walk me through a time you applied that skill.`;
      }
      return "What technical skill or experience from your background do you think is most relevant to this role?";
    }
    case "company-fit":
      return companyReference
        ? `Why are you interested in working at ${companyReference} specifically, and what makes you a strong fit for this role?`
        : "Why are you interested in this role, and what makes you a strong fit?";
  }
}

// Stage-aware system prompt for the next interview question.
function buildStageSystemPrompt(stage: InterviewStage): string {
  const jsonShape =
    'Return ONLY strict JSON: {"follow_up_question": string, "coach_tip": string, "why_this_follow_up": string, "next_skill_to_probe": string}.';
  const interviewerRule =
    "Speak like a real interviewer talking to a candidate in a live interview. " +
    "Ask one concise, natural, conversational interview question. " +
    "Do NOT ask analytical or meta questions like 'what do you understand' or 'what are the most relevant aspects'. " +
    "Do NOT use placeholders. " +
    "CRITICAL: Do NOT ask any question that is semantically similar to the questions in the 'already_asked' list.";
  const coachTipRule =
    "coach_tip must be 1-2 short sentences (max 30 words) helping the candidate answer THIS question. Be specific, not generic.";

  switch (stage) {
    case "background":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${interviewerRule} ` +
        `${coachTipRule} ` +
        "follow_up_question must be a generic INTRODUCTION question. " +
        "Ask about the candidate's background and what brings them to this role. " +
        "Do NOT reference specific resume items. Keep it open-ended. " +
        "One concise, direct sentence."
      );

    case "resume-dive":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${interviewerRule} ` +
        `${coachTipRule} ` +
        "follow_up_question must choose ONE specific project or work experience from the candidate's resume and ask for a deep walkthrough. " +
        "IMPORTANT: Only reference items from 'resume_projects' or 'resume_experience'. " +
        "NEVER reference items from 'resume_education' — those are degrees/schools, NOT projects. " +
        "CRITICAL: Do NOT ask about any project or experience that is already mentioned in the 'already_asked' list. Pick a NEW one. " +
        "Mention the project or experience BY NAME in the question. " +
        "Ask what they built, their role, or their biggest accomplishment. " +
        "One natural, conversational question."
      );

    case "jd-skill":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${interviewerRule} ` +
        `${coachTipRule} ` +
        "follow_up_question must ask about a SPECIFIC SKILL or responsibility from the job description. " +
        "Pick one skill from 'required_skills' or one item from 'responsibilities' and ask how the candidate has applied it. " +
        "Connect it to something from their resume if possible. " +
        "CRITICAL: Do NOT reference any project or experience that was already mentioned in the 'already_asked' questions. " +
        "Ask for a concrete example or walkthrough. " +
        "One natural, conversational question."
      );

    case "company-fit":
      return (
        `You are a professional interviewer. ${jsonShape} ` +
        `${interviewerRule} ` +
        `${coachTipRule} ` +
        "follow_up_question must ask about COMPANY FIT and MOTIVATION. " +
        "Ask why the candidate is interested in this specific company and/or role, and what makes them a strong fit. " +
        "Use the company name from context — do NOT use placeholders. " +
        "One concise, direct sentence."
      );
  }
}

async function generateCoachTip(
  provider: ReturnType<typeof getLlmProvider>,
  question: string,
  stage: InterviewStage,
  state: InterviewBrainState,
) {
  try {
    const output = await provider.generateJson<{ coach_tip?: string }>({
      systemPrompt:
        'Return ONLY strict JSON: {"coach_tip": string}. ' +
        "You are a supportive interview coach. " +
        "Write a very brief tip (1-2 SHORT sentences, max 30 words) to help the candidate answer the interview question below. " +
        "Be specific to this question. Do NOT give generic advice.",
      userPrompt: JSON.stringify({
        the_interview_question: question,
        stage,
        role: state.role,
        company: normalizedCompanyReference(state.companyName) || "",
        resume_projects: (state.resumeProjects || []).slice(0, 3),
        resume_experience: (state.resumeExperience || []).slice(0, 3),
        required_skills: state.requiredSkills.slice(0, 5),
      }),
    });

    return sanitizeText(output.coach_tip, "");
  } catch {
    return "";
  }
}

function buildAnswerReviewSystemPrompt() {
  return (
    'Return ONLY strict JSON: {"evaluation": string, "strengths": string[], "gaps": string[]}. ' +
    "You are a supportive interview coach reviewing ONE candidate answer to a specific interview question. " +
    "You MUST provide PERSONALIZED feedback based on the EXACT content of the candidate's answer. " +
    "Reference specific things the candidate said or failed to say. " +
    "NEVER give generic feedback like 'You gave a direct answer'. " +

    "Format the 'evaluation' field exactly like this: " +
    'Strength: [one specific thing the candidate did well in THIS answer, referencing what they said]\n' +
    'Improvement: [one specific suggestion for how to improve THIS answer, with a concrete example]. ' +

    "Also extract 1-2 very short bullet points for 'strengths' and 1-2 for 'gaps' based on the answer. " +
    "These must also be specific to THIS answer, not generic advice. " +

    "RULES: " +
    "- The feedback MUST reference the actual content of the answer. If they mentioned a project, name it. If they gave a metric, reference it. " +
    "- Keep the Improvement section brief (1-2 sentences) and encouraging. " +
    "- Be forgiving. If they convey the general idea or mention relevant experience, praise them. " +
    "- Focus on answer quality: clarity, specificity, structure, and relevance to the question. " +
    "- Do NOT give the same feedback for different answers. Each answer deserves unique feedback. " +
    "- Do NOT use placeholder phrases like 'your answer' or 'the candidate'. Be specific."
  );
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

function questionLooksAwkward(question: string, state?: InterviewBrainState) {
  const lower = question.toLowerCase();

  // Catch raw label leaks (LLM parroting section headers)
  if (/\b(education|education:|work experience:|projects:|skills:)\b.*\bwalk me through\b/i.test(question)) {
    return true;
  }

  // Catch education items being treated as projects
  const educationEntries = state?.resumeEducation || [];
  for (const edu of educationEntries) {
    const eduLower = edu.toLowerCase().trim();
    if (eduLower && lower.includes(eduLower) && /\b(project|walk me through|tell me about)\b/i.test(lower)) {
      return true;
    }
  }

  // Catch university/degree names being called "project"
  if (/\b(university|college|b\.?[as]\.?|m\.?[as]\.?|ph\.?d|bachelor|master|degree)\b/i.test(lower) &&
      /\b(project|walk me through that project)\b/i.test(lower)) {
    return true;
  }

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

  if (questionLooksAwkward(normalized, state)) {
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
        "Rewrite the question so it sounds like a real interviewer speaking to a candidate. " +
        "Keep it concise, conversational, grammatically correct, and easy to answer. Preserve the core intent. " +
        "Do not introduce placeholders, analysis language, resume noise, or awkward wording. " +
        "Do not paste long job-description text into the question.",
      userPrompt: JSON.stringify({
        stage,
        role: state.role,
        company: normalizedCompanyReference(state.companyName) || "",
        original_question: question,
      }),
    });

    return ensureQuestionQuality(String(polished.question ?? ""), stage, state);
  } catch {
    return ensureQuestionQuality(question, stage, state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Opening question — Q1: Background/Introduction (generic, not resume-specific)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateOpeningQuestion(state: InterviewBrainState) {
  const provider = getLlmProvider();
  const baseQuestion = "Tell me about yourself and what brings you to this role.";
  const question = await polishQuestion(provider, baseQuestion, "background", state);
  const coachTip = await generateCoachTip(provider, question, "background", state);

  return {
    question,
    coach_tip: coachTip,
    whyThisQuestion:
      "Opens with a natural introduction so the candidate can frame their background and motivation.",
    nextSkillToProbe:
      state.requiredSkills[0] || state.keywords[0] || "role-fit",
  };
}

function normalizeFeedbackBlock(text: string, fallback: string) {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/\r/g, "")
    .replace(/"strengths"\s*:\s*\[[\s\S]*$/i, "")
    .replace(/"gaps"\s*:\s*\[[\s\S]*$/i, "")
    .trim();

  const strengthMatch = cleaned.match(/Strength:\s*([\s\S]*?)(?=\s*Improvement:|$)/i);
  const improvementMatch = cleaned.match(/Improvement:\s*([\s\S]*?)$/i);

  const toSentence = (value: string) => {
    const trimmed = value.replace(/\s+/g, " ").trim().replace(/[.]+$/g, "");
    if (!trimmed) return "";
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  };

  if (strengthMatch || improvementMatch) {
    const strength = strengthMatch?.[1]?.replace(/\s+/g, " ").trim() || "None.";
    const improvement = improvementMatch?.[1]?.replace(/\s+/g, " ").trim();

    if (improvement) {
      return `Strength: ${toSentence(strength)}\nImprovement: ${toSentence(improvement)}`;
    }
  }

  const plainParagraph = cleaned.replace(/\s+/g, " ").trim();
  if (!plainParagraph) {
    return fallback;
  }

  const sentences = plainParagraph.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
  if (!sentences.length) {
    return fallback;
  }

  const clipped = sentences.slice(0, 4).map(toSentence);
  if (clipped.length === 1) {
    return `Strength: None.\nImprovement: ${clipped[0]}`;
  }

  return `Strength: ${clipped[0]}\nImprovement: ${clipped.slice(1).join(" ")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Turn evaluation — stage-aware, anti-repetition, with quality fallbacks.
// ─────────────────────────────────────────────────────────────────────────────
export async function evaluateInterviewTurn(
  state: InterviewBrainState,
): Promise<InterviewModelEvaluation> {
  const provider = getLlmProvider();
  const allAskedQuestions = [
    ...state.previousQuestions,
    state.latestQuestion || "",
  ].filter(Boolean);

  const stage = inferStage(allAskedQuestions.length);
  const questionSystemPrompt = buildStageSystemPrompt(stage);
  const answerReviewSystemPrompt = buildAnswerReviewSystemPrompt();
  const skill = uncoveredSkill(state);

  const userPrompt = JSON.stringify({
    candidate_name: state.candidateName,
    role: state.role,
    company: state.companyName?.trim() || "the company",
    seniority: state.seniority,
    resume_summary: state.resumeProjectSummary.slice(0, 500),
    resume_education: (state.resumeEducation || []).slice(0, 4),
    resume_experience: (state.resumeExperience || []).slice(0, 4),
    resume_projects: (state.resumeProjects || []).slice(0, 4),
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

  const defaultAnswerReview: AnswerReviewPayload = {
    evaluation:
      "Strength: You gave a direct answer, which helps the interviewer understand your main point quickly.\nImprovement: The response would be stronger with one concrete example that shows what you did and what came out of it. For example, briefly name a project, explain your role, and end with the result.",
    strengths: ["Answered directly."],
    gaps: [
      "Stayed too general to be memorable.",
      "Needed a more concrete example.",
    ],
  };

  const defaultQuestionPlan: NextQuestionPayload = {
    follow_up_question: stageFallbackQuestion(stage, state),
    coach_tip: "",
    why_this_follow_up: `Moves the interview into the ${stage} stage.`,
    next_skill_to_probe: skill,
  };

  let answerReviewOutput: Partial<AnswerReviewPayload> = {};
  try {
    const answerReviewUserPrompt = JSON.stringify({
      interview_question: state.latestQuestion || "",
      candidate_answer: (state.latestAnswer || "").slice(0, 800),
      role: state.role,
      company: state.companyName?.trim() || "",
    });
    console.log("[answer-review] Sending prompt to LLM...");
    answerReviewOutput = await provider.generateJson<AnswerReviewPayload>({
      systemPrompt: answerReviewSystemPrompt,
      userPrompt: answerReviewUserPrompt,
    });
    console.log("[answer-review] LLM response:", JSON.stringify(answerReviewOutput).slice(0, 300));
  } catch (error) {
    console.error("[answer-review] Failed to generate answer review:", error);
  }

  let questionOutput: Partial<NextQuestionPayload> = {};
  try {
    console.log("[next-question] Sending prompt to LLM...");
    questionOutput = await provider.generateJson<NextQuestionPayload>({
      systemPrompt: questionSystemPrompt,
      userPrompt,
    });
    console.log("[next-question] LLM response:", JSON.stringify(questionOutput).slice(0, 300));
  } catch (error) {
    console.error("[next-question] Failed to generate next question:", error);
  }

  const rawFollowUp = sanitizeText(questionOutput.follow_up_question, "");

  // Anti-repetition: if the model generated something too close to a prior question,
  // fall back to the stage-appropriate question instead.
  const candidateQuestion =
    rawFollowUp &&
      !isTooSimilar(rawFollowUp, allAskedQuestions) &&
      !conflictsWithRecentAngle(rawFollowUp, allAskedQuestions)
      ? ensureQuestionQuality(rawFollowUp, stage, state)
      : stageFallbackQuestion(stage, state);

  const followUpQuestion = await polishQuestion(provider, candidateQuestion, stage, state);
  const coachTip = sanitizeText(
    questionOutput.coach_tip,
    await generateCoachTip(provider, followUpQuestion, stage, state),
  );

  const strengths = sanitizeList(answerReviewOutput.strengths);
  const gaps = sanitizeList(answerReviewOutput.gaps);
  const evaluation = normalizeFeedbackBlock(
    sanitizeText(answerReviewOutput.evaluation, defaultAnswerReview.evaluation),
    defaultAnswerReview.evaluation,
  );

  return {
    evaluation,
    strengths: strengths.length ? strengths : defaultAnswerReview.strengths,
    gaps: gaps.length ? gaps : defaultAnswerReview.gaps,
    follow_up_question: followUpQuestion,
    coach_tip: coachTip,
    why_this_follow_up: sanitizeText(
      questionOutput.why_this_follow_up,
      defaultQuestionPlan.why_this_follow_up,
    ),
    next_skill_to_probe: sanitizeText(questionOutput.next_skill_to_probe, skill),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Final interview summary generation.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateInterviewSummary(state: InterviewBrainState): Promise<string> {
  const provider = getLlmProvider();
  
  const systemPrompt = 
    'Return ONLY strict JSON: {"summary": string}. ' +
    'You are a supportive interview coach giving a final post-interview summary. ' +
    'Write a single 2-3 sentence paragraph summarizing how the candidate performed overall based on their answers, strengths, and areas for improvement. ' +
    'Keep the tone encouraging, objective, and professional. ' +
    'Do NOT give a score, just the paragraph summary.';

  const userPrompt = JSON.stringify({
    role: state.role,
    questions: state.previousQuestions,
    answers: state.previousAnswers,
  });

  try {
    const output = await provider.generateJson<{ summary?: string }>({
      systemPrompt,
      userPrompt,
    });
    return String(output.summary || "").trim() || "The interview showed a solid foundation, though there's room to add more concrete examples to your answers.";
  } catch {
    return "The interview showed a solid foundation, though there's room to add more concrete examples to your answers.";
  }
}
