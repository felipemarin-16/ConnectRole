import { FILLER_WORDS, HEDGING_PHRASES } from "@/lib/constants";
import type {
  AnswerFeedback,
  AnswerScores,
  FinalReport,
  InterviewQuestion,
  InterviewTurn,
  JobData,
  ResumeData,
} from "@/lib/types";
import { average, clamp, keywordOverlapScore, splitSentences, unique } from "@/lib/utils";
import { buildCoverLetter } from "@/lib/cover-letter";

type ScoreInput = {
  answer: string;
  question: InterviewQuestion;
  job: JobData;
};

function countMatches(text: string, phrases: string[]) {
  const lower = text.toLowerCase();
  return phrases.reduce((count, phrase) => count + (lower.match(new RegExp(`\\b${phrase}\\b`, "g"))?.length ?? 0), 0);
}

function hasMetrics(text: string) {
  return /\b\d+[%x]?\b/.test(text) || /\b(increased|reduced|grew|improved|saved|shipped|launched)\b/i.test(text);
}

function hasOwnershipLanguage(text: string) {
  return /\b(i led|i built|i designed|i owned|i delivered|i created|i drove|i managed|i launched)\b/i.test(text);
}

function significantQuestionTerms(question: string) {
  return question
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 4)
    .filter((word) => !["about", "which", "would", "could", "their", "there", "where", "while"].includes(word));
}

function buildCoachNextTimeSuggestion(question: InterviewQuestion) {
  const prompt = question.prompt.toLowerCase();

  if (/\btell me about yourself\b|\bbackground\b/.test(prompt)) {
    return "briefly introduce your background, name one or two relevant experiences, and explain clearly how they connect to the direction you are pursuing";
  }

  if (/\bwhy\b.*\b(role|company|opportunity)\b|\binterested in this role\b|\bmotivat/.test(prompt)) {
    return "give one genuine reason, support it with a specific example from your experience, and end with why it matters to you now";
  }

  if (/\bproject\b|\bresume\b|\bwalk me through\b|\bi was looking at\b/.test(prompt)) {
    return "walk through the problem, your ownership, the key decisions or tools, and the outcome in that order";
  }

  if (/\bchallenge\b|\bdifficult\b|\bobstacle\b|\brisk\b/.test(prompt)) {
    return "name the challenge directly, explain what you did to handle it, and finish with what changed because of your action";
  }

  if (/\btradeoff\b|\bdecision\b|\bchose\b/.test(prompt)) {
    return "explain the options you considered, why you made your choice, and what tradeoff came with that decision";
  }

  if (/\btime when\b|\bbehavioral\b|\bexample\b/.test(prompt)) {
    return "use a short STAR structure so the listener can follow the situation, your action, and the result";
  }

  return "answer in a simple structure with context, your action, and a clear takeaway";
}

function hasUnrealisticClaims(answer: string) {
  const lower = answer.toLowerCase();
  return (
    /\b\d{3,}\b/.test(lower) ||
    /\b(all|every|everything|entire|always)\b/.test(lower) ||
    /\b(machine learning stack|full stack|whole stack)\b/.test(lower)
  );
}

function motivationCenteredOnPersonalNeed(answer: string) {
  return /\bneed a job|need work|need money|right now\b/i.test(answer);
}

function buildCoachSummary(
  answer: string,
  question: InterviewQuestion,
  strengths: string[],
  issues: string[],
  signals: {
    broad: boolean;
    short: boolean;
    lowRelevance: boolean;
    lowConfidence: boolean;
  },
) {
  const prompt = question.prompt.toLowerCase();
  const suggestion = buildCoachNextTimeSuggestion(question);
  let praise = "You gave a direct answer, which helps the interviewer understand your main point quickly.";
  let tip = `The next step is to ${suggestion}, so the interviewer can clearly see your example, ownership, and result.`;

  if (/\bprivacy|secure|security|reliable|reliability\b/i.test(answer) && /(\bwhy\b|\binterested\b|\bwant to work\b)/.test(prompt)) {
    praise = "You connected your answer to secure and reliable systems, which gives your motivation a clear theme.";
  } else if (/\bproject|assistant|macos|model|on-device|device\b/i.test(answer) && /(\bproject\b|\bwalk me through\b|\bexperience\b)/.test(prompt)) {
    praise = "You anchored the answer in a real project, which makes your experience feel more tangible.";
  } else if (strengths.find((item) => item.includes("concrete detail"))) {
    praise = "You included a concrete detail, which makes the answer easier to follow and more believable.";
  } else if (strengths.find((item) => item.includes("stayed on the question"))) {
    praise = "You stayed on the question, which keeps the response focused and easier to follow.";
  } else if (strengths.find((item) => item.includes("structure"))) {
    praise = "You gave the answer enough structure for the interviewer to follow your main point.";
  }

  if (hasUnrealisticClaims(answer)) {
    tip = "The biggest improvement is to use one believable example with realistic scope. For example, pick one project, explain what part you owned, and describe one concrete result instead of stacking several large claims together.";
  } else if (motivationCenteredOnPersonalNeed(answer) && /(\bwhy\b|\binterested\b|\bwant to work\b)/.test(prompt)) {
    tip = "The answer would land better if it centered more on the work itself. For example, mention one part of the role or mission that genuinely interests you and connect it to something you have enjoyed building before.";
  } else if (signals.lowRelevance) {
    tip = `The main improvement is to answer the exact question earlier. For example, start with your direct reason or example first, then ${suggestion}.`;
  } else if (signals.broad && /(\bproject\b|\bwalk me through\b|\bexperience\b)/.test(prompt)) {
    tip = "The answer needs a clearer shape so the project is easier to follow. For example, walk through it in this order: the problem, what you owned, the main decision or tool, and what came out of it.";
  } else if (signals.short) {
    tip = `The answer would be stronger if you stayed with the example a little longer. For example, add one sentence on what you did and one sentence on what changed because of your work.`;
  } else if (signals.lowConfidence) {
    tip = "The answer would feel stronger with more direct wording and a firmer finish. For example, end on one clear takeaway about what you contributed instead of tapering off.";
  } else if (issues.some((item) => item.includes("result"))) {
    tip = "What is missing most is the outcome. For example, finish with one sentence on what improved, shipped, or changed because of your work so the answer feels complete.";
  } else if (issues.some((item) => item.includes("role"))) {
    tip = "Your own contribution should come through more clearly. For example, say 'I owned...' or 'I handled...' early in the answer so the interviewer knows what was actually yours.";
  } else if (issues.length && !strengths.length) {
    praise = "You gave the interviewer a starting point, which is better than leaving the answer unfocused.";
  }

  return `Strength: ${praise}\nImprovement: ${tip}`.replace(/\s+/g, " ").trim();
}

function formatSkillLabel(skill: string) {
  return skill.replace(/[-_/]+/g, " ").trim();
}

export function buildQuestionTip(question: InterviewQuestion) {
  const prompt = question.prompt.toLowerCase();
  const primarySkill = formatSkillLabel(question.targetSkills[0] || "");

  if (/\btell me about yourself\b|\bwalk me through your background\b/.test(prompt)) {
    return "Keep it concise: present, past, and why this role is the natural next step.";
  }

  if (/\bwhy\b.*\b(role|company|team)\b|\binterested in this role\b|\bmotivat/.test(prompt)) {
    return "Tie your interest to one real reason from the role and one detail from your background.";
  }

  if (/\bproject\b|\bresume\b|\bwalk me through\b|\bi was looking at\b/.test(prompt)) {
    return "Frame it as problem, what you owned, the stack you used, and the result.";
  }

  if (/\btradeoff\b|\bdecision\b|\bchose\b/.test(prompt)) {
    return "Explain the options you considered, why you chose one path, and what tradeoff you accepted.";
  }

  if (/\bchallenge\b|\bdifficult\b|\bobstacle\b|\brisk\b/.test(prompt)) {
    return "Name the challenge clearly, then focus on the action you took and what changed after it.";
  }

  if (/\btime when\b|\bexample\b|\bbehavioral\b/.test(prompt)) {
    return "Use a STAR structure and make your own contribution explicit.";
  }

  if (primarySkill) {
    return `Use one concrete example that shows how you applied ${primarySkill} and what outcome it led to.`;
  }

  return "Answer with clear ownership, decisions, and a concrete outcome.";
}

export function generateFollowUp(answer: string, question: InterviewQuestion) {
  const trimmed = answer.trim();
  if (!trimmed) {
    return "Could you give me one concise example so I can understand your approach?";
  }

  if (/\b\d+\s+years?\b/i.test(trimmed) && !hasMetrics(trimmed)) {
    return "Across those years, what was your strongest measurable outcome?";
  }

  if (/\b(left|transitioned|moved on|switched)\b/i.test(trimmed)) {
    return "What drove that transition, and how did it shape your next impact?";
  }

  if (trimmed.split(/\s+/).length < 35) {
    return "Can you add one concrete example and the result it created?";
  }

  if (!hasMetrics(trimmed)) {
    return "What metric, business result, or visible outcome best proves that work mattered?";
  }

  if (question.category === "role-specific" && !/\b(using|with)\b/i.test(trimmed)) {
    return "Which tools or methods did you personally use, and why did you choose them?";
  }

  if (!hasOwnershipLanguage(trimmed)) {
    return "Which parts did you own directly versus what the team handled?";
  }

  if (!/\b(challenge|problem|risk|obstacle)\b/i.test(trimmed) && question.category === "behavioral") {
    return "What was the hardest part of that situation, and how did you adapt in the moment?";
  }

  return "If you had ten more seconds, what final result would you emphasize for this role?";
}

export function scoreAnswer({ answer, question, job }: ScoreInput): AnswerScores {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const fillerCount = countMatches(answer, FILLER_WORDS);
  const hedgingCount = countMatches(answer, HEDGING_PHRASES);
  const relevanceBase = keywordOverlapScore(answer, [question.focus, ...question.targetSkills, ...job.keywords.slice(0, 6)]);
  const alignmentBase = keywordOverlapScore(answer, job.requiredSkills.length ? job.requiredSkills : job.keywords.slice(0, 8));

  const specificity =
    clamp(
      (wordCount >= 90 ? 40 : wordCount >= 45 ? 28 : wordCount >= 20 ? 18 : 8) +
        (hasMetrics(answer) ? 28 : 0) +
        (/\b(because|when|after|before|result|impact)\b/i.test(answer) ? 16 : 0) +
        (hasOwnershipLanguage(answer) ? 16 : 0),
    );

  const confidence = clamp(
    78 -
      fillerCount * 7 -
      hedgingCount * 10 -
      (wordCount < 20 ? 20 : 0) +
      (hasOwnershipLanguage(answer) ? 14 : 0) +
      (splitSentences(answer).length >= 3 ? 8 : 0),
  );

  const relevance = clamp(relevanceBase * 0.7 + (wordCount >= 25 ? 24 : 12));
  const alignment = clamp(alignmentBase * 0.8 + (hasMetrics(answer) ? 10 : 0) + (hasOwnershipLanguage(answer) ? 10 : 0));
  const overall = Math.round(average([relevance, specificity, confidence, alignment]));

  return {
    relevance: Math.round(relevance),
    specificity: Math.round(specificity),
    confidence: Math.round(confidence),
    alignment: Math.round(alignment),
    overall,
  };
}

export function buildImprovedAnswer(answer: string, question: InterviewQuestion, job: JobData) {
  const trimmed = answer.trim();
  const roleSignal = job.roleTitle || "the role";
  const skillSignal = question.targetSkills[0] || job.requiredSkills[0] || "the core skill";

  if (!trimmed) {
    return `I would frame this around a specific example that shows why my background matches ${roleSignal}. I would describe the situation, the action I owned directly, the tools or decisions I used, and a measurable result that connects back to ${skillSignal}.`;
  }

  return `A stronger version would open with the context in one sentence, explain the challenge, spell out what I owned directly, and end with a measurable outcome. I would make the link to ${roleSignal} explicit by naming how the example demonstrates ${skillSignal} and what I learned that I would bring into this role.`;
}

export function buildAnswerFeedback(answer: string, question: InterviewQuestion, job: JobData): AnswerFeedback {
  const strengths: string[] = [];
  const issues: string[] = [];
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const fillerCount = countMatches(answer, FILLER_WORDS);
  const hedgingCount = countMatches(answer, HEDGING_PHRASES);
  const sentenceCount = splitSentences(answer).length;
  const questionOverlap = keywordOverlapScore(answer, significantQuestionTerms(question.prompt));
  const broad = !hasMetrics(answer) && !/\b(for example|for instance|specifically|because|when|after|before|using|built|created|designed|led|implemented|worked on|responsible for)\b/i.test(answer);
  const short = wordCount < 18;
  const lowRelevance = questionOverlap < 12;
  const lowConfidence = fillerCount >= 2 || hedgingCount >= 1;

  if (!short && !lowRelevance) {
    strengths.push("the response stayed on the question");
  }

  if (sentenceCount >= 2) {
    strengths.push("the answer had enough structure to follow");
  } else {
    issues.push("the answer moved too quickly and needed clearer structure");
  }

  if (!broad) {
    strengths.push("you included at least one concrete detail");
  } else {
    issues.push("it stayed too general and needed a more specific example or detail");
  }

  if (hasOwnershipLanguage(answer) || /\b(i|my)\b/i.test(answer)) {
    strengths.push("your role in the answer was reasonably clear");
  } else {
    issues.push("your personal role or contribution was hard to identify");
  }

  if (wordCount >= 30) {
    strengths.push("you gave enough context to begin understanding your point");
  } else {
    issues.push("the answer was short and needed a little more development");
  }

  if (lowRelevance) {
    issues.push("the answer did not fully address the exact question that was asked");
  }

  if (lowConfidence) {
    issues.push("the delivery felt tentative and would be stronger with more direct language");
  }

  if (!hasMetrics(answer) && /\b(project|challenge|result|impact|outcome|built|launched|improved)\b/i.test(question.prompt)) {
    issues.push("the answer stopped before showing what result came from the example");
  }

  const normalizedStrengths = unique(strengths).slice(0, 3);
  const normalizedIssues = unique(issues).slice(0, 3);

  return {
    strengths: normalizedStrengths.length ? normalizedStrengths : ["the response answered the question directly"],
    issues: normalizedIssues.length ? normalizedIssues : ["it could still be sharper with a clearer takeaway"],
    improvedAnswer: buildImprovedAnswer(answer, question, job),
    coachSummary: buildCoachSummary(
      answer,
      question,
      normalizedStrengths,
      normalizedIssues,
      {
        broad,
        short,
        lowRelevance,
        lowConfidence,
      },
    ),
  };
}

export function buildResumeGaps(resume: ResumeData, job: JobData) {
  const resumeCorpus = `${resume.skills.join(" ")} ${resume.experience.join(" ")} ${resume.projects.join(" ")}`.toLowerCase();
  const missingRequired = job.requiredSkills.filter((skill) => !resumeCorpus.includes(skill.toLowerCase()));
  const missingKeywords = job.keywords.filter((keyword) => !resumeCorpus.includes(keyword.toLowerCase()));

  if (!missingRequired.length && !missingKeywords.length) {
    return [
      "Your resume broadly aligns with the role, but you could make results, ownership, and impact keywords more explicit.",
    ];
  }

  const requiredGaps = missingRequired.slice(0, 4).map(
    (skill) => `The posting emphasizes ${skill}, but that signal is not obvious in the resume as written.`,
  );
  const keywordGaps = missingKeywords
    .filter((keyword) => !missingRequired.some((skill) => skill.toLowerCase() === keyword.toLowerCase()))
    .slice(0, 2)
    .map((keyword) => `The keyword "${keyword}" appears in the job description but not clearly in the resume.`);

  return [...requiredGaps, ...keywordGaps];
}

function buildResumeRecommendations(resume: ResumeData, job: JobData) {
  const resumeCorpus = `${resume.skills.join(" ")} ${resume.experience.join(" ")} ${resume.projects.join(" ")}`.toLowerCase();
  const missingRequired = job.requiredSkills.filter((skill) => !resumeCorpus.includes(skill.toLowerCase()));
  const missingKeywords = job.keywords.filter((keyword) => !resumeCorpus.includes(keyword.toLowerCase()));

  const targetedRecommendations = [
    ...missingRequired.slice(0, 3).map(
      (skill) => `If you have used ${skill}, add it to your resume with a project or bullet that shows how you applied it.`,
    ),
    ...missingKeywords
      .filter((keyword) => !missingRequired.some((skill) => skill.toLowerCase() === keyword.toLowerCase()))
      .slice(0, 2)
      .map(
        (keyword) => `Consider adding the keyword "${keyword}" in a natural way if your experience genuinely supports it.`,
      ),
  ];

  if (targetedRecommendations.length) {
    return targetedRecommendations;
  }

  return [
    "Add stronger outcome language so each project or experience bullet makes the impact easier to see.",
    "Surface ownership earlier in each bullet so your direct contribution is unmistakable.",
    "Mirror the job posting’s terminology where it truthfully matches your background.",
  ];
}

export function compileFinalReport(
  turns: InterviewTurn[],
  resume: ResumeData,
  job: JobData,
  companySummary?: string,
): FinalReport {
  const overallScore = Math.round(average(turns.map((turn) => turn.scores.overall)));
  const strengths = unique(
    turns.flatMap((turn) => turn.feedback.strengths).slice(0, 8),
  ).slice(0, 4);
  const weaknesses = unique(
    turns.flatMap((turn) => turn.feedback.issues).slice(0, 8),
  ).slice(0, 4);
  const recommendations = unique([
    ...buildResumeRecommendations(resume, job),
    "Use a clear structure: context, action, result, then tie it back to the role.",
    "Add at least one metric or proof point in every answer.",
    "Reduce filler language and end with a stronger close.",
    "Name your personal contribution before describing the team effort.",
  ]).slice(0, 4);

  return {
    overallScore,
    strengths,
    weaknesses,
    improvedAnswers: turns.map((turn) => ({
      questionId: turn.questionId,
      question: turn.question,
      improvedAnswer: turn.feedback.improvedAnswer,
    })),
    resumeGaps: buildResumeGaps(resume, job),
    recommendations,
    coverLetterText: buildCoverLetter({ resume, job, companySummary }),
  };
}
