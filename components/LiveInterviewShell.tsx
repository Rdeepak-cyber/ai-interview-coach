"use client";

import { useEffect, useId, useState } from "react";
import type { AdaptiveInterviewTurn, AdaptiveNextResponse } from "../lib/adaptive-interview";
import type { FeedbackReport } from "../lib/feedback-report";
import type { InterviewQuestion } from "../lib/interview-question";
import type { ResumeProfile } from "../lib/resume-profile";
import type { RoleMatch } from "../lib/role-match";
import { ROLE_MATCH_THRESHOLDS } from "../lib/role-match";
import { useVoice } from "../lib/voice";
import FeedbackReportView from "./FeedbackReportView";

type LiveInterviewShellProps = {
  targetRole: string;
  profile: ResumeProfile;
  onBack: (clearRole?: boolean) => void;
  onComplete?: (qaPairs: AdaptiveInterviewTurn[]) => void;
  onFeedbackGenerated?: (report: FeedbackReport) => void;
};

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function LiveInterviewShell({
  targetRole,
  profile,
  onBack,
  onComplete,
  onFeedbackGenerated
}: LiveInterviewShellProps) {
  const [history, setHistory] = useState<AdaptiveInterviewTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isCheckingMatch, setIsCheckingMatch] = useState(false);
  const [matchGate, setMatchGate] = useState<RoleMatch | null>(null);
  const [matchToken, setMatchToken] = useState<string | null>(null);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnswerFocused, setIsAnswerFocused] = useState(false);

  // Phase D time & wrap-up state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isWrappingUp, setIsWrappingUp] = useState(false);
  const [closingMessage, setClosingMessage] = useState<string | null>(null);
  const [feedbackReport, setFeedbackReport] = useState<FeedbackReport | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  const textareaId = useId();
  const voice = useVoice({ onTranscript: setAnswer, getCurrentText: () => answer });
  const avatarState = voice.isSpeaking
    ? "speaking"
    : voice.isListening || isAnswerFocused
    ? "listening"
    : "idle";
  const questionNumber = history.length + 1;

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  function startListeningForAnswer() {
    if (!voice.recognitionSupported) {
      setError("Voice input is unavailable in this browser. You can type your answer instead; Chrome on desktop has the best support.");
      return;
    }
    voice.startListening();
  }

  function speakText(text: string, onEnd?: () => void) {
    if (!voice.synthesisSupported) return;
    voice.stopListening();
    voice.speakText(text, {
      onEnd,
      onError: () => setError("Audio playback failed. You can still read the text and continue.")
    });
  }

  function speakQuestion(question: string, startListeningAfter = false) {
    speakText(question, () => {
      if (startListeningAfter) startListeningForAnswer();
    });
  }

  async function requestNextQuestion(
    nextHistory: AdaptiveInterviewTurn[],
    autoSpeak = !isMuted,
    tokenOverride?: string | null
  ) {
    setIsLoadingQuestion(true);
    setError(null);
    try {
      const activeToken = tokenOverride !== undefined ? tokenOverride : matchToken;
      const response = await fetch("/api/interview/adaptive/next", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          profile,
          history: nextHistory,
          token: activeToken ?? undefined,
          elapsedSeconds
        })
      });
      const data = (await response.json()) as (AdaptiveNextResponse & { error?: string }) | { question?: InterviewQuestion; error?: string };
      if (!response.ok) throw new Error(data.error || "We couldn't process the next interview step.");

      if ("action" in data && data.action === "wrap_up") {
        setHistory(nextHistory);
        setCurrentQuestion(null);
        setAnswer("");
        setIsTimerRunning(false);
        setIsWrappingUp(true);
        const closing = data.closingMessage || "Thank you for completing this live interview session!";
        setClosingMessage(closing);
        if (autoSpeak) speakText(closing);
        return;
      }

      const q = "question" in data && data.question ? data.question : undefined;
      if (!q) throw new Error("We couldn't create the next question.");
      setHistory(nextHistory);
      setCurrentQuestion(q);
      setAnswer("");
      setIsTimerRunning(true);
      if (autoSpeak) speakQuestion(q.question, true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "We couldn't create the next question.");
    } finally {
      setIsLoadingQuestion(false);
    }
  }

  async function handleStartInterview() {
    setIsCheckingMatch(true);
    setError(null);
    setMatchNotice(null);
    setMatchGate(null);
    try {
      const response = await fetch("/api/interview/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: targetRole, profile })
      });
      const data = (await response.json()) as { match?: RoleMatch | null; token?: string; error?: string };
      if (!response.ok || !data.match) {
        setMatchNotice("Could not verify role match right now. Starting your interview directly.");
        setIsCheckingMatch(false);
        const token = data.token ?? null;
        setMatchToken(token);
        void requestNextQuestion([], !isMuted, token);
        return;
      }
      const match = data.match;
      const token = data.token ?? null;
      setMatchToken(token);
      setIsCheckingMatch(false);

      if (match.matchPercent >= ROLE_MATCH_THRESHOLDS.WARN) {
        void requestNextQuestion([], !isMuted, token);
      } else {
        setMatchGate(match);
      }
    } catch {
      setMatchNotice("Could not verify role match right now. Starting your interview directly.");
      setIsCheckingMatch(false);
      void requestNextQuestion([], !isMuted, null);
    }
  }

  function submitAnswer() {
    if (!currentQuestion || !answer.trim()) return;
    voice.stopListening();
    voice.stopSpeaking();
    void requestNextQuestion([...history, { ...currentQuestion, answer: answer.trim() }]);
  }

  async function generateFeedback(qaList: AdaptiveInterviewTurn[]) {
    if (qaList.length === 0) return;
    setIsGeneratingFeedback(true);
    setError(null);
    voice.stopListening();
    voice.stopSpeaking();
    setIsTimerRunning(false);

    try {
      const response = await fetch("/api/feedback/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          qaPairs: qaList
        })
      });
      const data = (await response.json()) as { report?: FeedbackReport; error?: string };
      if (!response.ok || !data.report) throw new Error(data.error || "Failed to generate feedback report.");

      setFeedbackReport(data.report);
      onComplete?.(qaList);
      onFeedbackGenerated?.(data.report);

      if (profile) {
        try {
          await fetch("/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              targetRole,
              resumeProfile: profile,
              questions: qaList,
              answers: qaList,
              feedbackReport: data.report
            })
          });
        } catch (saveError) {
          console.warn("Could not save live interview session", saveError);
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to generate feedback report.");
    } finally {
      setIsGeneratingFeedback(false);
    }
  }

  function handleEndInterviewEarly() {
    if (window.confirm("End the interview now and view your feedback report based on questions answered so far?")) {
      void generateFeedback(history);
    }
  }

  function resetLiveInterview() {
    voice.stopListening();
    voice.stopSpeaking();
    setHistory([]);
    setCurrentQuestion(null);
    setAnswer("");
    setError(null);
    setIsMuted(false);
    setIsCheckingMatch(false);
    setMatchGate(null);
    setMatchToken(null);
    setMatchNotice(null);
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setIsWrappingUp(false);
    setClosingMessage(null);
    setFeedbackReport(null);
    setIsGeneratingFeedback(false);
  }

  if (feedbackReport) {
    return (
      <FeedbackReportView
        report={feedbackReport}
        qaPairs={history}
        targetRole={targetRole}
        onRestart={resetLiveInterview}
      />
    );
  }

  return (
    <section className="live-interview-shell" aria-labelledby="live-interview-title">
      <div className="live-session-header">
        <div>
          <p className="eyebrow">LIVE ADAPTIVE INTERVIEW</p>
          <h2 id="live-interview-title">Meet your AI interviewer</h2>
          <p className="screen-intro">Each follow-up is generated from your profile, role, and every answer you’ve given so far.</p>
        </div>
        <div className="live-header-right">
          <div className="live-timer" aria-label="Live adaptive interview session">
            <span aria-hidden="true">⏱</span> {formatTime(elapsedSeconds)} <small>/ ~10 min</small>
          </div>
          {history.length >= 1 && !isWrappingUp && (
            <button
              type="button"
              className="end-interview-btn"
              disabled={isGeneratingFeedback}
              onClick={handleEndInterviewEarly}
            >
              End interview
            </button>
          )}
        </div>
      </div>

      <div className="live-stage">
        <div className={`interviewer-avatar ${avatarState}`} aria-label={`AI interviewer is ${avatarState}`}>
          <span className="avatar-halo halo-one" />
          <span className="avatar-halo halo-two" />
          <span className="avatar-core">
            <span className="avatar-eye" />
            <span className="avatar-eye" />
          </span>
          <span className="avatar-status">
            {avatarState === "speaking"
              ? "Speaking"
              : avatarState === "listening"
              ? "Listening"
              : isCheckingMatch
              ? "Checking fit"
              : isGeneratingFeedback
              ? "Analyzing"
              : "Ready"}
          </span>
        </div>
        <div className="live-question-card">
          {isGeneratingFeedback ? (
            <>
              <p className="eyebrow">ANALYZING SESSION PERFORMANCE</p>
              <h3><span className="button-spinner" aria-hidden="true" /> Generating your feedback report…</h3>
              <p className="live-start-note">Synthesizing overall strengths, weak spots per answer, actionable suggestions, and STAR framework analysis.</p>
            </>
          ) : isWrappingUp ? (
            <div className="live-wrapup-box">
              <p className="eyebrow">INTERVIEW CONCLUDED</p>
              <h3>{closingMessage || "Thank you for completing this live interview session!"}</h3>
              <p className="live-start-note">
                You completed {history.length} question{history.length === 1 ? "" : "s"} in {formatTime(elapsedSeconds)}.
              </p>
              <div className="live-question-actions">
                {voice.synthesisSupported && closingMessage && (
                  <button
                    type="button"
                    className={`voice-listen-btn ${voice.isSpeaking ? "is-speaking" : ""}`}
                    onClick={() => (voice.isSpeaking ? voice.stopSpeaking() : speakText(closingMessage))}
                  >
                    <span aria-hidden="true">{voice.isSpeaking ? "⏸" : "🔊"}</span>
                    <span>{voice.isSpeaking ? "Stop audio" : "Replay message"}</span>
                  </button>
                )}
              </div>
              <div className="match-gate-actions" style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="match-continue-btn"
                  onClick={() => void generateFeedback(history)}
                >
                  View feedback report
                </button>
              </div>
            </div>
          ) : isLoadingQuestion ? (
            <>
              <p className="eyebrow">ADAPTING TO YOUR INTERVIEW</p>
              <h3>Preparing your next question…</h3>
            </>
          ) : isCheckingMatch ? (
            <>
              <p className="eyebrow">ROLE FIT EVALUATION</p>
              <h3><span className="button-spinner" aria-hidden="true" /> Checking role fit…</h3>
              <p className="live-start-note">Analyzing how your background aligns with &ldquo;{targetRole}&rdquo; before starting.</p>
            </>
          ) : matchGate ? (
            matchGate.matchPercent < ROLE_MATCH_THRESHOLDS.HARD_BLOCK ? (
              <div className="match-block-box">
                <p className="eyebrow hard-block-eyebrow">ROLE FIT: {matchGate.matchPercent}% MATCH</p>
                <h3>Role fit too low for this interview</h3>
                <p className="live-start-note">{matchGate.reason}</p>
                {matchGate.missingSkills.length > 0 && (
                  <div className="match-gate-skills">
                    <p className="match-skills-label">Missing core competencies:</p>
                    <div className="chips">
                      {matchGate.missingSkills.map((skill, index) => (
                        <span key={index}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="match-gate-actions">
                  <button type="button" className="match-block-btn" onClick={() => onBack(true)}>
                    Choose a different role
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="eyebrow">ROLE FIT: {matchGate.matchPercent}% MATCH</p>
                <h3>Role alignment notice</h3>
                <p className="live-start-note">{matchGate.reason}</p>
                {matchGate.missingSkills.length > 0 && (
                  <div className="match-gate-skills">
                    <p className="match-skills-label">Missing competencies to be aware of:</p>
                    <div className="chips">
                      {matchGate.missingSkills.map((skill, index) => (
                        <span key={index}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="match-gate-actions">
                  <button type="button" className="secondary match-change-btn" onClick={() => onBack(false)}>
                    Change role
                  </button>
                  <button
                    type="button"
                    className="match-continue-btn"
                    onClick={() => {
                      const token = matchToken;
                      setMatchGate(null);
                      void requestNextQuestion([], !isMuted, token);
                    }}
                  >
                    Continue anyway
                  </button>
                </div>
              </>
            )
          ) : currentQuestion ? (
            <>
              <p className="eyebrow">QUESTION {questionNumber} / LIVE</p>
              <h3>{currentQuestion.question}</h3>
              <div className="live-question-actions">
                {voice.synthesisSupported && (
                  <button
                    type="button"
                    className={`voice-listen-btn ${voice.isSpeaking ? "is-speaking" : ""}`}
                    onClick={() =>
                      voice.isSpeaking ? voice.stopSpeaking() : speakQuestion(currentQuestion.question, !isMuted)
                    }
                  >
                    <span aria-hidden="true">{voice.isSpeaking ? "⏸" : "🔊"}</span>
                    <span>{voice.isSpeaking ? "Stop audio" : "Replay question"}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="voice-listen-btn"
                  onClick={() => {
                    setIsMuted((muted) => !muted);
                    voice.stopSpeaking();
                  }}
                >
                  {isMuted ? "Enable auto audio" : "Mute auto audio"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">VOICE-FIRST LIVE INTERVIEW</p>
              <h3>Your interviewer will speak each question, then begin listening for your response.</h3>
              <p className="live-start-note">If question audio or microphone access is unavailable, you can still type and edit every answer.</p>
              <button type="button" onClick={handleStartInterview}>Start interview</button>
            </>
          )}
        </div>
      </div>

      {matchNotice && <div className="match-notice-banner" role="status">{matchNotice}</div>}

      {currentQuestion && !isLoadingQuestion && !isWrappingUp && !isGeneratingFeedback && (
        <div className="live-answer-preview">
          <div className="voice-input-header">
            <label htmlFor={textareaId}>Your answer</label>
            <div className="voice-actions">
              {voice.recognitionSupported && (
                <button
                  type="button"
                  className={`voice-record-btn ${voice.isListening ? "is-recording" : ""}`}
                  disabled={voice.isSpeaking}
                  onClick={() => (voice.isListening ? voice.stopListening() : startListeningForAnswer())}
                >
                  {voice.isListening ? "Stop voice recording" : "Start listening"}
                </button>
              )}
            </div>
          </div>
          {voice.isListening && (
            <div className="voice-live-banner" role="status">
              <span className="pulsing-mic-badge" aria-hidden="true">LIVE</span>
              <span>Listening to your answer… You can still edit the text below.</span>
            </div>
          )}
          {voice.speechError && <p className="voice-error-text" role="alert">{voice.speechError}</p>}
          <textarea
            id={textareaId}
            className="session-textarea"
            rows={6}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onFocus={() => setIsAnswerFocused(true)}
            onBlur={() => setIsAnswerFocused(false)}
            placeholder="Type your answer here or use voice input…"
          />
          <div className="live-preview-footer">
            <p>
              {history.length} completed question{history.length === 1 ? "" : "s"} in this live session.
            </p>
            <button type="button" disabled={!answer.trim() || isLoadingQuestion} onClick={submitAnswer}>
              Submit answer &amp; continue
            </button>
          </div>
        </div>
      )}

      {error && <p className="message error" role="alert">{error}</p>}
      <div className="live-shell-actions">
        <button type="button" className="secondary" onClick={() => onBack()}>
          Back to mode selection
        </button>
        {(history.length > 0 || currentQuestion) && (
          <button type="button" className="text-action-btn" onClick={resetLiveInterview}>
            Restart live interview
          </button>
        )}
      </div>
    </section>
  );
}

