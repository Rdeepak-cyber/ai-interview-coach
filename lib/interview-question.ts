export const questionTypes = ["resume-specific", "role-standard", "behavioral"] as const;
export const difficulties = ["easy", "medium", "hard"] as const;

export type QuestionType = (typeof questionTypes)[number];
export type Difficulty = (typeof difficulties)[number];

export type InterviewQuestion = {
  question: string;
  type: QuestionType;
  difficulty: Difficulty;
};

const isQuestionType = (value: unknown): value is QuestionType =>
  typeof value === "string" && (questionTypes as readonly string[]).includes(value);
const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === "string" && (difficulties as readonly string[]).includes(value);

export function isInterviewQuestions(value: unknown): value is InterviewQuestion[] {
  if (!Array.isArray(value) || value.length < 8 || value.length > 10) return false;
  const normalizedQuestions = new Set<string>();

  return value.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const { question, type, difficulty } = item as Record<string, unknown>;
    if (typeof question !== "string" || question.trim().length < 12 || question.length > 500 || !isQuestionType(type) || !isDifficulty(difficulty)) return false;
    const normalized = question.trim().toLocaleLowerCase();
    if (normalizedQuestions.has(normalized)) return false;
    normalizedQuestions.add(normalized);
    return true;
  });
}

export const interviewQuestionsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      minItems: 8,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "type", "difficulty"],
        properties: {
          question: { type: "string", minLength: 12, maxLength: 500 },
          type: { type: "string", enum: [...questionTypes] },
          difficulty: { type: "string", enum: [...difficulties] }
        }
      }
    }
  }
} as const;
