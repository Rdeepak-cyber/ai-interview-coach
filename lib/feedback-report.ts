export type StarAssessment = {
  applicable: boolean;
  feedback: string;
  situation: string;
  task: string;
  action: string;
  result: string;
};

export type QuestionFeedback = {
  questionIndex: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  starAssessment: StarAssessment;
};

export type FeedbackReport = {
  overallSummary: string;
  overallStrengths: string[];
  overallImprovements: string[];
  questionFeedback: QuestionFeedback[];
};

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isStarAssessment(val: unknown): val is StarAssessment {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.applicable === "boolean" &&
    typeof obj.feedback === "string" &&
    typeof obj.situation === "string" &&
    typeof obj.task === "string" &&
    typeof obj.action === "string" &&
    typeof obj.result === "string"
  );
}

function isQuestionFeedback(val: unknown): val is QuestionFeedback {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.questionIndex === "number" &&
    isStringArray(obj.strengths) &&
    isStringArray(obj.weaknesses) &&
    isStringArray(obj.suggestions) &&
    isStarAssessment(obj.starAssessment)
  );
}

export function isFeedbackReport(val: unknown): val is FeedbackReport {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.overallSummary === "string" &&
    obj.overallSummary.trim().length > 0 &&
    isStringArray(obj.overallStrengths) &&
    isStringArray(obj.overallImprovements) &&
    Array.isArray(obj.questionFeedback) &&
    obj.questionFeedback.length > 0 &&
    obj.questionFeedback.every(isQuestionFeedback)
  );
}

export const feedbackReportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overallSummary",
    "overallStrengths",
    "overallImprovements",
    "questionFeedback",
  ],
  properties: {
    overallSummary: {
      type: "string",
      description: "Comprehensive summary evaluating candidate performance against the target role.",
    },
    overallStrengths: {
      type: "array",
      items: { type: "string" },
      description: "Key themes and strengths demonstrated across all answers.",
    },
    overallImprovements: {
      type: "array",
      items: { type: "string" },
      description: "High-priority areas for improvement across the session.",
    },
    questionFeedback: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "questionIndex",
          "strengths",
          "weaknesses",
          "suggestions",
          "starAssessment",
        ],
        properties: {
          "questionIndex": {
            type: "integer",
            description: "0-based index of the question in the interview set.",
          },
          "strengths": {
            type: "array",
            items: { type: "string" },
            description: "Specific strengths and good elements identified in this response.",
          },
          "weaknesses": {
            type: "array",
            items: { type: "string" },
            description: "Weak spots, missing elements, or gaps in this answer.",
          },
          "suggestions": {
            type: "array",
            items: { type: "string" },
            description: "Concrete and actionable recommendations to improve this answer.",
          },
          "starAssessment": {
            type: "object",
            additionalProperties: false,
            required: [
              "applicable",
              "feedback",
              "situation",
              "task",
              "action",
              "result",
            ],
            properties: {
              "applicable": {
                type: "boolean",
                description: "True if question is behavioral and warrants STAR evaluation, false otherwise.",
              },
              "feedback": {
                type: "string",
                description: "Overall critique of STAR structure or N/A.",
              },
              "situation": {
                type: "string",
                description: "Critique of the context/situation setup, or N/A.",
              },
              "task": {
                type: "string",
                description: "Critique of the task/objective clarification, or N/A.",
              },
              "action": {
                type: "string",
                description: "Critique of specific actions described, or N/A.",
              },
              "result": {
                type: "string",
                description: "Critique of the quantified outcome/impact described, or N/A.",
              },
            },
          },
        },
      },
    },
  },
} as const;

