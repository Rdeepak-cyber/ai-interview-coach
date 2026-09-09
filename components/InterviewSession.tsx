"use client";

import { useId, useState } from "react";
import type { InterviewQuestion } from "../lib/interview-question";
import { formatWordCount, type InterviewQA } from "../lib/interview-session";

type InterviewSessionProps = {
  questions: InterviewQuestion[];
  targetRole: string;
  onComplete?: (qaPairs: InterviewQA[]) => void;
};

export default function InterviewSession({
  questions,
  targetRole,
  onComplete,
}: InterviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const textareaId = useId();

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] ?? "";
  const { words, chars } = formatWordCount(currentAnswer);

  const totalQuestions = questions.length;
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const hasAnswer = currentAnswer.trim().length > 0;

  function handleAnswerChange(value: string) {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: value,
    }));
  }

  function handleNext() {
    if (!hasAnswer) return;

    if (isLastQuestion) {
      finishInterview();
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  function handleSkip() {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: "[Skipped by candidate]",
    }));

    if (isLastQuestion) {
      finishInterview({
        ...answers,
        [currentIndex]: "[Skipped by candidate]",
      });
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
    }
  }

  function finishInterview(finalAnswers = answers) {
    setIsCompleted(true);
    const qaPairs: InterviewQA[] = questions.map((q, idx) => ({
      question: q.question,
      type: q.type,
      difficulty: q.difficulty,
      answer: (finalAnswers[idx] ?? "").trim(),
    }));
    onComplete?.(qaPairs);
  }

  function handleRestart() {
    if (window.confirm("Are you sure you want to restart this interview session? Your answers will be cleared.")) {
      setAnswers({});
      setCurrentIndex(0);
      setIsCompleted(false);
      setEditingIndex(null);
    }
  }

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditingText(answers[index] ?? "");
  }

  function saveEdit(index: number) {
    const updatedAnswers = {
      ...answers,
      [index]: editingText,
    };
    setAnswers(updatedAnswers);
    setEditingIndex(null);

    const qaPairs: InterviewQA[] = questions.map((q, idx) => ({
      question: q.question,
      type: q.type,
      difficulty: q.difficulty,
      answer: (updatedAnswers[idx] ?? "").trim(),
    }));
    onComplete?.(qaPairs);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditingText("");
  }

  function getQuestionTip(type: InterviewQuestion["type"]): string {
    switch (type) {
      case "behavioral":
        return "💡 Tip: Structure your answer using STAR — Situation, Task, Action, and Result.";
      case "resume-specific":
        return "💡 Tip: Cite specific projects, technical decisions, and measurable outcomes from your resume.";
      case "role-standard":
        return "💡 Tip: Focus on fundamental concepts, practical trade-offs, and industry best practices.";
      default:
        return "💡 Tip: Be concise, clear, and substantiate your points with concrete examples.";
    }
  }

  // Calculate stats for completion view
  const allQaPairs: InterviewQA[] = questions.map((q, idx) => ({
    question: q.question,
    type: q.type,
    difficulty: q.difficulty,
    answer: (answers[idx] ?? "").trim(),
  }));

  const totalWords = allQaPairs.reduce((sum, item) => sum + formatWordCount(item.answer).words, 0);

  if (isCompleted) {
    return (
      <section className="interview-session completed-session" aria-labelledby="session-complete-title">
        <div className="session-header">
          <div className="step-label">
            <span>04</span> TEXT-BASED INTERVIEW SESSION
          </div>
          <span className="session-status-badge completed">SESSION COMPLETED</span>
        </div>

        <h2 id="session-complete-title">Interview Completed!</h2>
        <p className="helper">
          All {totalQuestions} questions for <strong>{targetRole}</strong> have been answered. You can review or edit your answers below before generating your feedback report.
        </p>

        <div className="session-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Questions Answered</span>
            <strong className="stat-value">{totalQuestions} of {totalQuestions}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Words Written</span>
            <strong className="stat-value">{totalWords}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg. Words / Answer</span>
            <strong className="stat-value">{totalQuestions > 0 ? Math.round(totalWords / totalQuestions) : 0}</strong>
          </div>
        </div>

        <div className="qa-review-list">
          <h3>Saved Responses</h3>
          {allQaPairs.map((qa, index) => {
            const isEditing = editingIndex === index;
            const qaWords = formatWordCount(qa.answer).words;

            return (
              <article key={`${index}-${qa.question.slice(0, 20)}`} className="qa-review-card">
                <div className="qa-card-header">
                  <div className="qa-question-title">
                    <span className="question-index">{String(index + 1).padStart(2, "0")}</span>
                    <h4>{qa.question}</h4>
                  </div>
                  <div className="question-meta">
                    <span>{qa.type.replace("-", " ")}</span>
                    <span className={`difficulty ${qa.difficulty}`}>{qa.difficulty}</span>
                  </div>
                </div>

                {isEditing ? (
                  <div className="inline-edit-wrapper">
                    <label htmlFor={`edit-input-${index}`} className="edit-label">
                      Edit your answer:
                    </label>
                    <textarea
                      id={`edit-input-${index}`}
                      className="session-textarea inline-edit-textarea"
                      rows={5}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                    />
                    <div className="inline-edit-actions">
                      <button
                        type="button"
                        className="secondary small-btn"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="small-btn"
                        disabled={!editingText.trim()}
                        onClick={() => saveEdit(index)}
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="qa-answer-container">
                    <p className="qa-answer-text">
                      {qa.answer || <em>No answer provided</em>}
                    </p>
                    <div className="qa-answer-footer">
                      <span className="muted-copy">{qaWords} words</span>
                      <button
                        type="button"
                        className="text-action-btn"
                        onClick={() => startEditing(index)}
                      >
                        Edit answer
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="phase-handoff-card">
          <div>
            <p className="eyebrow">READY FOR PHASE 5</p>
            <h3>Next: AI Feedback Report</h3>
            <p className="muted-copy">
              All responses are stored in session state. Phase 5 will send these answers to Groq to generate strengths, weak spots, STAR methodology evaluation, and targeted improvement suggestions.
            </p>
          </div>
          <div className="handoff-actions">
            <button type="button" className="secondary" onClick={handleRestart}>
              Restart interview
            </button>
            <button type="button" disabled title="Phase 5 is the next phase to build">
              Generate feedback report (Phase 5)
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="interview-session" aria-labelledby="session-title">
      <div className="session-header">
        <div className="step-label">
          <span>04</span> TEXT-BASED INTERVIEW SESSION
        </div>
        <span className="session-status-badge in-progress">
          QUESTION {currentIndex + 1} OF {totalQuestions}
        </span>
      </div>

      <div className="progress-container">
        <div className="progress-bar-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-legend">
          <span>Progress: {progressPercent}%</span>
          <span>{totalQuestions - (currentIndex + 1)} question{totalQuestions - (currentIndex + 1) === 1 ? "" : "s"} remaining</span>
        </div>
      </div>

      <div className="interview-active-card">
        <div className="active-question-header">
          <span className="question-counter-badge">Question {currentIndex + 1}</span>
          <div className="question-meta">
            <span>{currentQuestion.type.replace("-", " ")}</span>
            <span className={`difficulty ${currentQuestion.difficulty}`}>
              {currentQuestion.difficulty}
            </span>
          </div>
        </div>

        <h3 id="session-title" className="active-question-text">
          {currentQuestion.question}
        </h3>

        <aside className="tip-box" aria-label="Answering tip">
          <p>{getQuestionTip(currentQuestion.type)}</p>
        </aside>

        <div className="answer-input-container">
          <label htmlFor={textareaId} className="answer-input-label">
            Your Answer:
          </label>
          <textarea
            id={textareaId}
            className="session-textarea"
            rows={7}
            placeholder="Type your answer here in detail... Focus on concrete examples and results."
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
          />

          <div className="answer-meta-bar">
            <span className="word-count">
              {words} word{words === 1 ? "" : "s"} · {chars} character{chars === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="text-action-btn"
              onClick={handleSkip}
            >
              Skip question
            </button>
          </div>
        </div>

        <div className="session-navigation-bar">
          <button
            type="button"
            className="secondary"
            disabled={currentIndex === 0}
            onClick={handlePrev}
          >
            ← Previous Question
          </button>

          <div className="nav-right-actions">
            <button
              type="button"
              disabled={!hasAnswer}
              onClick={handleNext}
            >
              {isLastQuestion ? "Finish Interview ✓" : "Next Question →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

