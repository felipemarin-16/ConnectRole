import type { JobData, ResumeData } from "@/lib/types";

function inferSeniority(roleTitle: string, rawJobText: string) {
  const corpus = `${roleTitle} ${rawJobText}`.toLowerCase();

  if (/\b(staff|principal|director|head|vp|vice president)\b/.test(corpus)) {
    return "staff-plus";
  }

  if (/\b(senior|sr\.?)\b/.test(corpus)) {
    return "senior";
  }

  if (/\b(junior|jr\.?|entry|associate|intern)\b/.test(corpus)) {
    return "junior";
  }

  return "mid-level";
}

function cleanProjectEntry(entry: string) {
  // Strip trailing date patterns: "2026(Present)", "(2024-Present)", "2024 - Present", "(2023)"
  return entry
    .replace(/\s*\d{4}\s*\(Present\)\s*$/i, "")
    .replace(/\s*\d{4}\s*\(\s*present\s*\)\s*$/i, "")
    .replace(/\s*[\(\[]?\d{4}\s*[-–]?\s*(present|\d{4})[\)\]]?\s*$/i, "")
    .replace(/\s*[\(\[]\d{4}\s*[-–]\s*(Present|\d{4})[\)\]]\s*$/i, "")
    .replace(/\s*\d{4}\s*[-–]\s*(Present|\d{4})\s*$/i, "")
    .replace(/\s*[\(\[]\d{4}[\)\]]\s*$/i, "")
    .trim();
}

function buildResumeProjectSummary(resume: ResumeData) {
  const education = resume.education.slice(0, 3).map(cleanProjectEntry);
  const experience = resume.experience.slice(0, 3).map(cleanProjectEntry);
  const projects = resume.projects.slice(0, 3).map(cleanProjectEntry);
  const skills = resume.skills.slice(0, 8);

  return [
    `Candidate: ${resume.name}.`,
    education.length ? `Education (degrees, NOT projects): ${education.join(" | ")}.` : "",
    experience.length ? `Work experience: ${experience.join(" | ")}.` : "",
    projects.length ? `Projects (can be asked about as projects): ${projects.join(" | ")}.` : "",
    skills.length ? `Top skills: ${skills.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInterviewContext(resume: ResumeData, job: JobData, candidateName: string) {
  const jobSummary = [
    job.summary,
    job.location ? `Location: ${job.location}.` : "",
    job.workMode ? `Work mode: ${job.workMode}.` : "",
    job.requiredSkills.length ? `Key skills: ${job.requiredSkills.slice(0, 8).join(", ")}.` : "",
    job.responsibilities.length ? `Key responsibilities: ${job.responsibilities.slice(0, 3).join(" | ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Only actual projects go into resumeHighlights now — never education
  const projectHighlights = resume.projects.map(cleanProjectEntry).slice(0, 5);
  const experienceHighlights = resume.experience.map(cleanProjectEntry).slice(0, 5);
  const highlights = [...projectHighlights, ...experienceHighlights].slice(0, 5);

  return {
    candidateName: candidateName.trim() || resume.name,
    role: job.roleTitle || "Target Role",
    companyName: job.companyName || "the company",
    jobType: job.jobType || "Full-time",
    seniority: inferSeniority(job.roleTitle, job.rawText),
    interviewType: "mixed behavioral and role-fit",
    resumeProjectSummary: buildResumeProjectSummary(resume),
    resumeHighlights: highlights,
    resumeSkills: resume.skills.slice(0, 12),
    resumeEducation: resume.education.map(cleanProjectEntry).slice(0, 5),
    resumeExperience: experienceHighlights,
    resumeProjects: projectHighlights,
    jobSummary,
  };
}
