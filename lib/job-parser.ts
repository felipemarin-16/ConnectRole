import { COMMON_SKILLS } from "@/lib/constants";
import type { JobData } from "@/lib/types";
import { extractBulletLikeLines, normalizeWhitespace, toTitleCase, unique } from "@/lib/utils";

const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "your",
  "that",
  "will",
  "have",
  "for",
  "our",
  "you",
  "are",
  "this",
  "from",
  "into",
  "their",
  "they",
  "about",
  "role",
  "team",
  "work",
  "using",
  "across",
  "years",
  "experience",
]);

const META_LINE_PATTERN =
  /^(position|time|remote|seniority|money|note|required|preferred|onsite|hybrid|internship|full-time|part-time)$/i;
const COMPANY_BANNED_TERMS = new Set(
  [
    "git",
    "github",
    "react",
    "typescript",
    "javascript",
    "python",
    "java",
    "sql",
    "svelte",
    "vue",
    "django",
    "flask",
    "fastapi",
    "nodejs",
    "springboot",
    "standards",
  ],
);

function isLikelyCompanyLine(line: string) {
  const compact = line.trim();
  if (!compact || compact.length > 50 || META_LINE_PATTERN.test(compact)) {
    return false;
  }

  const lowerTokens = compact.toLowerCase().split(/[^a-z0-9&.+-]+/).filter(Boolean);
  if (!lowerTokens.length || lowerTokens.some((token) => COMPANY_BANNED_TERMS.has(token))) {
    return false;
  }

  return /^[A-Z][A-Za-z0-9&.\- ]+$/.test(compact);
}

function findRoleTitle(lines: string[]) {
  const explicit = lines.find((line) => /^(role|title|position)\s*:/i.test(line));
  if (explicit) {
    return explicit.split(":").slice(1).join(":").trim();
  }

  const earlyRole = lines.slice(0, 6).find(
    (line) =>
      line.length < 90 &&
      /intern|engineer|designer|analyst|specialist|lead|director|coordinator|developer|consultant/i.test(line),
  );
  if (earlyRole) {
    return earlyRole;
  }

  const candidate = lines.find(
    (line) =>
      line.length < 80 &&
      /manager|engineer|designer|analyst|specialist|lead|director|coordinator|developer|consultant/i.test(line),
  );

  return candidate ?? "Target Role";
}

function findCompanyName(lines: string[], text: string) {
  const topLineCandidate = lines.slice(0, 5).find(isLikelyCompanyLine);
  if (topLineCandidate) {
    return topLineCandidate.trim();
  }

  const explicit = text.match(/company\s*:\s*([A-Z][A-Za-z0-9&.\- ]{1,40})/i);
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  const joined = text.match(/join\s+([A-Z][A-Za-z0-9&.\- ]{1,40})/);
  if (joined?.[1]) {
    return joined[1].trim();
  }

  const atCompany = text.match(/(?:at|with)\s+([A-Z][A-Za-z0-9&.\- ]{1,40})/);
  const matchedCompany = atCompany?.[1]?.trim();
  if (matchedCompany && isLikelyCompanyLine(matchedCompany)) {
    return matchedCompany;
  }

  return "the company";
}

function findJobType(text: string) {
  if (/\bintern(ship)?\b/i.test(text)) return "Internship";
  if (/\bpart[\s-]?time\b/i.test(text)) return "Part-time";
  if (/\bcontract(or)?\b/i.test(text)) return "Contract";
  if (/\bfreelance\b/i.test(text)) return "Freelance";
  return "Full-time";
}

function findWorkMode(text: string) {
  if (/\bhybrid\b/i.test(text)) return "Hybrid";
  if (/\bremote\b/i.test(text)) return "Remote";
  if (/\bonsite\b/i.test(text)) return "Onsite";
  return "";
}

function findLocation(lines: string[]) {
  const locationLine = lines.find((line) => /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\b/.test(line));
  return locationLine?.trim() ?? "";
}

function findSalaryRange(text: string) {
  const salary = text.match(/\$\d[\d,]*K?\/?(?:yr|year|hr|hour)?\s*[-–]\s*\$\d[\d,]*K?\/?(?:yr|year|hr|hour)?/i);
  return salary?.[0]?.trim() ?? "";
}

function findSkills(text: string) {
  const lower = text.toLowerCase();
  return COMMON_SKILLS.filter((skill) => lower.includes(skill.toLowerCase()));
}

function getSectionMatches(text: string, pattern: RegExp) {
  const lines = text.split("\n");
  const matches: string[] = [];
  let collecting = false;

  for (const line of lines) {
    if (pattern.test(line)) {
      collecting = true;
      continue;
    }

    if (collecting && /^[A-Z][A-Za-z ]{2,30}:?$/.test(line)) {
      break;
    }

    if (collecting && line.trim()) {
      matches.push(line.trim().replace(/^[•*-]\s*/, ""));
    }
  }

  return matches;
}

function extractKeywords(text: string, detectedSkills: string[]) {
  const tokens = text
    .toLowerCase()
    .match(/[a-z][a-z.+-]{2,}/g);

  if (!tokens) {
    return detectedSkills;
  }

  const counts = new Map<string, number>();

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const frequent = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([keyword]) => keyword);

  return unique([...detectedSkills, ...frequent]);
}

export function parseJobPosting(rawText: string): JobData {
  const normalized = normalizeWhitespace(rawText);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const skills = findSkills(normalized);
  const responsibilities = getSectionMatches(normalized, /^(responsibilities|what you'll do|what you will do|what you’ll do)$/i);
  const requiredSection = getSectionMatches(
    normalized,
    /^(requirements|required qualifications|qualification|qualifications|must have|minimum qualifications|required)$/i,
  );
  const preferredSection = getSectionMatches(
    normalized,
    /^(preferred qualifications|nice to have|bonus points|preferred)$/i,
  );

  const requiredSkills = unique([...skills, ...findSkills(requiredSection.join("\n"))]);
  const preferredSkills = unique(findSkills(preferredSection.join("\n")));
  const fallbackResponsibilities = extractBulletLikeLines(normalized).slice(0, 6);

  return {
    rawText: normalized,
    roleTitle: toTitleCase(findRoleTitle(lines)),
    companyName: findCompanyName(lines, normalized),
    jobType: findJobType(normalized),
    workMode: findWorkMode(normalized),
    location: findLocation(lines),
    salaryRange: findSalaryRange(normalized),
    requiredSkills,
    preferredSkills,
    responsibilities: responsibilities.length ? responsibilities : fallbackResponsibilities,
    keywords: extractKeywords(normalized, requiredSkills),
    summary: (responsibilities.length ? responsibilities : fallbackResponsibilities).slice(0, 3).join(" "),
  };
}
