import { difficulties, questionTypes, type InterviewQuestion } from "./interview-question";
import type { InterviewQA } from "./interview-session";

export type AdaptiveInterviewTurn = InterviewQA;

export type AdaptiveNextResponse =
  | {
      action: "continue";
      question: InterviewQuestion;
      closingMessage?: string | null;
    }
  | {
      action: "wrap_up";
      closingMessage: string;
      question?: InterviewQuestion | null;
    };

export function isAdaptiveHistory(value: unknown): value is AdaptiveInterviewTurn[] {
  return (
    Array.isArray(value) &&
    value.length <= 25 &&
    value.every(
      (turn) =>
        typeof turn === "object" &&
        turn !== null &&
        typeof (turn as InterviewQA).question === "string" &&
        typeof (turn as InterviewQA).answer === "string" &&
        (turn as InterviewQA).question.trim().length >= 12 &&
        (turn as InterviewQA).answer.trim().length > 0 &&
        (turn as InterviewQA).answer.length <= 12_000 &&
        (questionTypes as readonly string[]).includes((turn as InterviewQA).type) &&
        (difficulties as readonly string[]).includes((turn as InterviewQA).difficulty)
    )
  );
}

export function isAdaptiveQuestion(value: unknown): value is InterviewQuestion {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { question, type, difficulty } = value as Record<string, unknown>;
  return (
    typeof question === "string" &&
    question.trim().length >= 12 &&
    question.length <= 500 &&
    typeof type === "string" &&
    (questionTypes as readonly string[]).includes(type) &&
    typeof difficulty === "string" &&
    (difficulties as readonly string[]).includes(difficulty)
  );
}

export function isAdaptiveNextResponse(value: unknown): value is AdaptiveNextResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { action, question, closingMessage } = value as Record<string, unknown>;
  if (action === "continue") {
    return isAdaptiveQuestion(question) && (closingMessage === null || closingMessage === undefined);
  }
  if (action === "wrap_up") {
    return (
      typeof closingMessage === "string" &&
      closingMessage.trim().length >= 5 &&
      closingMessage.length <= 500 &&
      (question === null || question === undefined)
    );
  }
  return false;
}

export const adaptiveNextSchema = {
  type: "object",
  additionalProperties: false,
  required: ["action", "question", "closingMessage"],
  properties: {
    action: { type: "string", enum: ["continue", "wrap_up"] },
    question: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["question", "type", "difficulty"],
      properties: {
        question: { type: "string", minLength: 12, maxLength: 500 },
        type: { type: "string", enum: [...questionTypes] },
        difficulty: { type: "string", enum: [...difficulties] }
      }
    },
    closingMessage: {
      type: ["string", "null"]
    }
  }
} as const;

export function calculateQuestionSimilarity(q1: string, q2: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const words1 = normalize(q1);
  const words2 = new Set<string>(normalize(q2));
  if (words1.length === 0 || words2.size === 0) return 0;

  let intersection = 0;
  const uniqueWords1 = new Set<string>();
  words1.forEach((w) => {
    if (!uniqueWords1.has(w)) {
      uniqueWords1.add(w);
      if (words2.has(w)) {
        intersection += 1;
      }
    }
  });

  const allWords = new Set<string>();
  uniqueWords1.forEach((w) => allWords.add(w));
  words2.forEach((w) => allWords.add(w));

  return allWords.size === 0 ? 0 : intersection / allWords.size;
}

export function isTooSimilarToHistory(candidateQuestion: string, history: AdaptiveInterviewTurn[]): boolean {
  for (const turn of history) {
    if (candidateQuestion.trim().toLowerCase() === turn.question.trim().toLowerCase()) {
      return true;
    }
    const similarity = calculateQuestionSimilarity(candidateQuestion, turn.question);
    if (similarity >= 0.7) {
      return true;
    }
  }
  return false;
}

