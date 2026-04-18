import { parseJobPosting } from "@/lib/job-parser";
import { getLlmProvider } from "@/lib/llm/provider";
import { parseResumeText } from "@/lib/resume-parser";
import type { JobData, ResumeData } from "@/lib/types";

type SetupExtractionResult = {
  resume: ResumeData;
  job: JobData;
};

type ResumeExtraction = {
  name?: string;
  education?: string[];
  projects?: string[];
  skills?: string[];
  experience?: string[];
  highlights?: string[];
};

type JobExtraction = {
  roleTitle?: string;
  companyName?: string;
  jobType?: string;
  workMode?: string;
  location?: string;
  salaryRange?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  keywords?: string[];
  summary?: string;
};

function stripTrailingDateSuffix(text: string) {
  return text
    .replace(/\s*\d{4}\s*\(\s*present\s*\)\s*$/i, "")
    .replace(/\s*[\(\[]?\d{4}\s*[-–]?\s*(present|\d{4})[\)\]]?\s*$/i, "")
    .replace(/\s*[\(\[]\d{4}[\)\]]\s*$/i, "")
    .trim();
}

function cleanList(input: unknown, limit: number) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => stripTrailingDateSuffix(String(item ?? "").replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanText(input: unknown, fallback = "") {
  const text = String(input ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function mergeResume(base: ResumeData, extracted?: ResumeExtraction): ResumeData {
  if (!extracted) {
    return base;
  }

  const experience = cleanList(extracted.experience, 8);
  const projects = cleanList(extracted.projects, 6);
  const education = cleanList(extracted.education, 5);
  const skills = cleanList(extracted.skills, 24);
  const highlights = cleanList(extracted.highlights, 6);

  return {
    ...base,
    name: cleanText(extracted.name, base.name),
    education: education.length ? education : base.education,
    projects: projects.length ? projects : base.projects,
    skills: skills.length ? skills : base.skills,
    experience: experience.length ? experience : base.experience,
    highlights: highlights.length ? highlights : base.highlights,
  };
}

function mergeJob(base: JobData, extracted?: JobExtraction): JobData {
  if (!extracted) {
    return base;
  }

  const requiredSkills = cleanList(extracted.requiredSkills, 18);
  const preferredSkills = cleanList(extracted.preferredSkills, 12);
  const responsibilities = cleanList(extracted.responsibilities, 8);
  const keywords = cleanList(extracted.keywords, 14);

  return {
    ...base,
    roleTitle: cleanText(extracted.roleTitle, base.roleTitle),
    companyName: cleanText(extracted.companyName, base.companyName),
    jobType: cleanText(extracted.jobType, base.jobType),
    workMode: cleanText(extracted.workMode, base.workMode || ""),
    location: cleanText(extracted.location, base.location || ""),
    salaryRange: cleanText(extracted.salaryRange, base.salaryRange || ""),
    requiredSkills: requiredSkills.length ? requiredSkills : base.requiredSkills,
    preferredSkills: preferredSkills.length ? preferredSkills : base.preferredSkills,
    responsibilities: responsibilities.length ? responsibilities : base.responsibilities,
    keywords: keywords.length ? keywords : base.keywords,
    summary: cleanText(extracted.summary, base.summary || ""),
  };
}

export async function parseSetupInputs(rawResumeText: string, rawJobText: string): Promise<SetupExtractionResult> {
  const baseResume = parseResumeText(rawResumeText);
  const baseJob = parseJobPosting(rawJobText);

  const provider = getLlmProvider();
  const systemPrompt =
    'You extract structured recruiting data. Return ONLY strict JSON with shape ' +
    '{"resume":{"name":string,"education":[string],"projects":[string],"skills":[string],"experience":[string],"highlights":[string]},' +
    '"job":{"roleTitle":string,"companyName":string,"jobType":string,"workMode":string,"location":string,"salaryRange":string,' +
    '"requiredSkills":[string],"preferredSkills":[string],"responsibilities":[string],"keywords":[string],"summary":string}}. ' +
    "Use concise normalized values. Never guess a company from tools or technologies. " +
    "Use resume headers/sections to distinguish projects from jobs. " +
    "Student resumes may have strong projects but little or no formal work experience; do not invent job experience. " +
    "Strip trailing date suffixes from project names and highlight labels. " +
    "If a field is unclear, return an empty string or empty array.";

  const userPrompt = JSON.stringify({
    task: "extract_resume_and_job",
    resume_text: rawResumeText.slice(0, 12000),
    job_posting_text: rawJobText.slice(0, 12000),
    heuristic_resume: {
      name: baseResume.name,
      education: baseResume.education.slice(0, 4),
      projects: baseResume.projects.slice(0, 4),
      skills: baseResume.skills.slice(0, 16),
      experience: baseResume.experience.slice(0, 6),
      highlights: baseResume.highlights.slice(0, 5),
    },
    heuristic_job: {
      roleTitle: baseJob.roleTitle,
      companyName: baseJob.companyName,
      jobType: baseJob.jobType,
      workMode: baseJob.workMode || "",
      location: baseJob.location || "",
      salaryRange: baseJob.salaryRange || "",
      requiredSkills: baseJob.requiredSkills.slice(0, 16),
      preferredSkills: baseJob.preferredSkills.slice(0, 10),
      responsibilities: baseJob.responsibilities.slice(0, 6),
      keywords: baseJob.keywords.slice(0, 12),
      summary: baseJob.summary || "",
    },
  });

  try {
    const extraction = await provider.generateJson<{
      resume?: ResumeExtraction;
      job?: JobExtraction;
    }>({
      systemPrompt,
      userPrompt,
    });

    return {
      resume: mergeResume(baseResume, extraction.resume),
      job: mergeJob(baseJob, extraction.job),
    };
  } catch {
    return {
      resume: baseResume,
      job: baseJob,
    };
  }
}
