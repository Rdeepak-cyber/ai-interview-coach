import { difficulties, questionTypes, type InterviewQuestion } from "./interview-question";
import type { InterviewQA } from "./interview-session";

export type AdaptiveInterviewTurn = InterviewQA;

export function isAdaptiveHistory(value: unknown): value is AdaptiveInterviewTurn[] {
  return Array.isArray(value) && value.length <= 25 && value.every((turn) => typeof turn === "object" && turn !== null && typeof (turn as InterviewQA).question === "string" && typeof (turn as InterviewQA).answer === "string" && (turn as InterviewQA).question.trim().length >= 12 && (turn as InterviewQA).answer.trim().length > 0 && (turn as InterviewQA).answer.length <= 12_000 && (questionTypes as readonly string[]).includes((turn as InterviewQA).type) && (difficulties as readonly string[]).includes((turn as InterviewQA).difficulty));
}

export function isAdaptiveQuestion(value: unknown): value is InterviewQuestion {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { question, type, difficulty } = value as Record<string, unknown>;
  return typeof question === "string" && question.trim().length >= 12 && question.length <= 500 && typeof type === "string" && (questionTypes as readonly string[]).includes(type) && typeof difficulty === "string" && (difficulties as readonly string[]).includes(difficulty);
}

export const adaptiveNextQuestionSchema = {
  type: "object", additionalProperties: false, required: ["question"],
  properties: { question: { type: "object", additionalProperties: false, required: ["question", "type", "difficulty"], properties: { question: { type: "string", minLength: 12, maxLength: 500 }, type: { type: "string", enum: [...questionTypes] }, difficulty: { type: "string", enum: [...difficulties] } } } }
} as const;
