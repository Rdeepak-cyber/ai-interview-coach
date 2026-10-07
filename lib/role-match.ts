export type RoleMatch = {
  matchPercent: number;
  reason: string;
  missingSkills: string[];
};

export const ROLE_MATCH_THRESHOLDS = {
  HARD_BLOCK: 50,
  WARN: 70,
} as const;

export function isRoleMatch(value: unknown): value is RoleMatch {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { matchPercent, reason, missingSkills } = value as Record<string, unknown>;
  return (
    typeof matchPercent === "number" &&
    Number.isFinite(matchPercent) &&
    matchPercent >= 0 &&
    matchPercent <= 100 &&
    typeof reason === "string" &&
    reason.trim().length >= 5 &&
    reason.length <= 500 &&
    Array.isArray(missingSkills) &&
    missingSkills.length <= 5 &&
    missingSkills.every((skill) => typeof skill === "string" && skill.trim().length > 0 && skill.length <= 100)
  );
}

export const roleMatchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["matchPercent", "reason", "missingSkills"],
  properties: {
    matchPercent: { type: "number", minimum: 0, maximum: 100 },
    reason: { type: "string", minLength: 5, maxLength: 500 },
    missingSkills: { type: "array", maxItems: 5, items: { type: "string", minLength: 1, maxLength: 100 } }
  }
} as const;
