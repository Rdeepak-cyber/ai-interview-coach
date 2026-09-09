import type { Difficulty, InterviewQuestion, QuestionType } from "./interview-question";

export type InterviewQA = {
  question: string;
  type: QuestionType;
  difficulty: Difficulty;
  answer: string;
};

export type InterviewSessionState = {
  currentIndex: number;
  answers: Record<number, string>;
  isCompleted: boolean;
};

export function formatWordCount(text: string): { words: number; chars: number } {
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  return { words, chars: text.length };
}

export function createInitialSessionState(): InterviewSessionState {
  return {
    currentIndex: 0,
    answers: {},
    isCompleted: false,
  };
}

