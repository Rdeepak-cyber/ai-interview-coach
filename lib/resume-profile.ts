export type WorkHistoryItem = {
  company: string;
  title: string;
  duration: string;
  highlights: string[];
};

export type ProjectItem = {
  name: string;
  description: string;
  technologies: string[];
};

export type ResumeProfile = {
  skills: string[];
  workHistory: WorkHistoryItem[];
  projects: ProjectItem[];
  yearsExperience: number;
  notableGaps: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringList = (value: unknown, maxItems: number) =>
  Array.isArray(value) && value.length <= maxItems && value.every((item) => typeof item === "string" && item.trim().length > 0);

export function isResumeProfile(value: unknown): value is ResumeProfile {
  if (!isRecord(value)) return false;
  const { skills, workHistory, projects, yearsExperience, notableGaps } = value;

  return (
    isStringList(skills, 40) &&
    Array.isArray(workHistory) &&
    workHistory.length <= 20 &&
    workHistory.every(
      (item) =>
        isRecord(item) &&
        typeof item.company === "string" &&
        typeof item.title === "string" &&
        typeof item.duration === "string" &&
        isStringList(item.highlights, 8)
    ) &&
    Array.isArray(projects) &&
    projects.length <= 20 &&
    projects.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        isStringList(item.technologies, 20)
    ) &&
    typeof yearsExperience === "number" &&
    Number.isFinite(yearsExperience) &&
    yearsExperience >= 0 &&
    yearsExperience <= 80 &&
    isStringList(notableGaps, 10)
  );
}

export const resumeProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["skills", "workHistory", "projects", "yearsExperience", "notableGaps"],
  properties: {
    skills: { type: "array", items: { type: "string" }, maxItems: 40 },
    workHistory: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company", "title", "duration", "highlights"],
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          duration: { type: "string" },
          highlights: { type: "array", items: { type: "string" }, maxItems: 8 }
        }
      }
    },
    projects: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "technologies"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: { type: "array", items: { type: "string" }, maxItems: 20 }
        }
      }
    },
    yearsExperience: { type: "number", minimum: 0, maximum: 80 },
    notableGaps: { type: "array", items: { type: "string" }, maxItems: 10 }
  }
} as const;
