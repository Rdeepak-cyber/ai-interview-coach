"use client";

import { useId, useState } from "react";
import FeedbackReportView from "./FeedbackReportView";
import type { FeedbackReport } from "../lib/feedback-report";
import type { InterviewQuestion } from "../lib/interview-question";
import { formatWordCount, type InterviewQA } from "../lib/interview-session";
import { useVoice } from "../lib/voice";
import type { ResumeProfile } from "../lib/resume-profile";

type InterviewSessionProps = {
  questions: InterviewQuestion[];
  targetRole: string;
  resumeProfile?: ResumeProfile;
  onComplete?: (qaPairs: InterviewQA[]) => void;
  onFeedbackGenerated?: () => void;
  onRestart?: () => void;
  showFeedbackOnly?: boolean;
};

export default function InterviewSession({
  questions,
  targetRole,
  resumeProfile,
  onComplete,
  onFeedbackGenerated,
  onRestart,
  showFeedbackOnly = false,
}: InterviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [feedbackReport, setFeedbackReport] = useState<FeedbackReport | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const textareaId = useId();

  const voice = useVoice({
    onTranscript: (updatedText) => {
      setAnswers((prev) => ({
        ...prev,
        [currentIndex]: updatedText,
      }));
    },
    getCurrentText: () => answers[currentIndex] ?? "",
  });

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
    voice.stopListening();
    voice.stopSpeaking();

    if (isLastQuestion) {
      finishInterview();
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      voice.stopListening();
      voice.stopSpeaking();
      setCurrentIndex((prev) => prev - 1);
    }
  }

  function handleSkip() {
    voice.stopListening();
    voice.stopSpeaking();

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
    voice.stopListening();
    voice.stopSpeaking();
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
    if (window.confirm("Are you sure you want to restart this interview session? Your answers and feedback report will be cleared.")) {
      setAnswers({});
      setCurrentIndex(0);
      setIsCompleted(false);
      setEditingIndex(null);
      setEditingText("");
      setFeedbackReport(null);
      setFeedbackError(null);
      setIsGeneratingFeedback(false);
      onRestart?.();
    }
  }

  async function handleGenerateFeedback() {
    // If an in-place edit is currently open, commit its latest value first
    let latestAnswers = { ...answers };
    if (editingIndex !== null && editingText.trim().length > 0) {
      latestAnswers[editingIndex] = editingText;
      setAnswers(latestAnswers);
      setEditingIndex(null);
    }

    const latestQAPairs: InterviewQA[] = questions.map((q, idx) => ({
      question: q.question,
      type: q.type,
      difficulty: q.difficulty,
      answer: (latestAnswers[idx] ?? "").trim(),
    }));

    // Notify parent of the latest answers (including all edits)
    onComplete?.(latestQAPairs);

    setIsGeneratingFeedback(true);
    setFeedbackError(null);

    try {
      const response = await fetch("/api/feedback/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          qaPairs: latestQAPairs,
        }),
      });

      const data = (await response.json()) as { report?: FeedbackReport; error?: string };
      if (!response.ok || !data.report) {
        throw new Error(data.error || "Failed to generate feedback report.");
      }

      setFeedbackReport(data.report);
      if (resumeProfile) {
        try {
          const saveResponse = await fetch("/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              targetRole,
              resumeProfile,
              questions,
              answers: latestQAPairs,
              feedbackReport: data.report,
            }),
          });
          if (!saveResponse.ok) console.error("Interview session was not saved.");
        } catch (saveError) {
          console.error("Interview session save failed", saveError);
        }
      }
      onFeedbackGenerated?.();
    } catch (caughtError) {
      setFeedbackError(caughtError instanceof Error ? caughtError.message : "Failed to generate feedback report.");
    } finally {
      setIsGeneratingFeedback(false);
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

  if (isCompleted && feedbackReport && showFeedbackOnly) {
    return (
      <FeedbackReportView
        report={feedbackReport}
        qaPairs={allQaPairs}
        targetRole={targetRole}
        onRestart={handleRestart}
      />
    );
  }

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
            <p className="eyebrow">05 AI FEEDBACK REPORT</p>
            <h3>Ready for AI Feedback</h3>
            <p className="muted-copy">
              All responses (including your latest edits) will be evaluated by Groq against the <strong>{targetRole}</strong> role. We’ll analyze overall strengths, weak spots, improvement suggestions, and perform a STAR-method check for behavioral answers.
            </p>
          </div>
          <div className="handoff-actions">
            <button type="button" className="secondary" onClick={handleRestart} disabled={isGeneratingFeedback}>
              Restart interview
            </button>
            <button
              type="button"
              onClick={handleGenerateFeedback}
              disabled={isGeneratingFeedback}
            >
              {isGeneratingFeedback ? "Generating feedback…" : "Generate feedback report"}
            </button>
          </div>
        </div>

        {feedbackError && <p className="message error" role="alert">{feedbackError}</p>}

        {feedbackReport && (
          <FeedbackReportView
            report={feedbackReport}
            qaPairs={allQaPairs}
            targetRole={targetRole}
            onRestart={handleRestart}
          />
        )}
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
          <div className="question-header-left">
            <span className="question-counter-badge">Question {currentIndex + 1}</span>
            {voice.synthesisSupported && (
              <button
                type="button"
                className={`voice-listen-btn ${voice.isSpeaking ? "is-speaking" : ""}`}
                onClick={() => {
                  if (voice.isSpeaking) {
                    voice.stopSpeaking();
                  } else {
                    voice.speakText(currentQuestion.question);
                  }
                }}
                title={voice.isSpeaking ? "Click to stop voice playback" : "Read question aloud"}
              >
                <span aria-hidden="true">{voice.isSpeaking ? "⏹️" : "🔊"}</span>
                <span>{voice.isSpeaking ? "Stop audio" : "Listen to question"}</span>
              </button>
            )}
          </div>
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
          <div className="voice-input-header">
            <label htmlFor={textareaId} className="answer-input-label">
              Your Answer:
            </label>
            <div className="voice-actions">
              {voice.recognitionSupported ? (
                <button
                  type="button"
                  className={`voice-record-btn ${voice.isListening ? "is-recording" : ""}`}
                  onClick={() => {
                    if (voice.isListening) {
                      voice.stopListening();
                    } else {
                      voice.startListening();
                    }
                  }}
                  title={voice.isListening ? "Click to stop recording" : "Dictate your answer with microphone"}
                >
                  <span className={`mic-status-indicator ${voice.isListening ? "pulsing" : ""}`} aria-hidden="true" />
                  <span aria-hidden="true">{voice.isListening ? "⏹️" : "🎙️"}</span>
                  <span>{voice.isListening ? "Stop voice recording" : "Answer with voice"}</span>
                </button>
              ) : (
                <span className="voice-compat-note" title="Web Speech API speech recognition is supported in Chrome, Edge, and Safari">
                  Voice STT: Chrome/Edge recommended
                </span>
              )}
            </div>
          </div>

          {voice.isListening && (
            <div className="voice-live-banner" role="status" aria-live="polite">
              <span className="pulsing-mic-badge" aria-hidden="true">🔴 LIVE</span>
              <span>Listening to your microphone... Speak clearly. Your words are added to the answer field below in real time.</span>
            </div>
          )}

          {voice.speechError && (
            <p className="voice-error-text" role="alert">
              ⚠️ {voice.speechError}
            </p>
          )}

          <textarea
            id={textareaId}
            className="session-textarea"
            rows={7}
            placeholder="Type your answer here or click 'Answer with voice' above to speak... You can edit by typing at any time."
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

