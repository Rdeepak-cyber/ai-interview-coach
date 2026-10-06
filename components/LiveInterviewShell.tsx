"use client";

import { useId, useState } from "react";
import type { AdaptiveInterviewTurn } from "../lib/adaptive-interview";
import type { InterviewQuestion } from "../lib/interview-question";
import type { ResumeProfile } from "../lib/resume-profile";
import { useVoice } from "../lib/voice";

type LiveInterviewShellProps = { targetRole: string; profile: ResumeProfile; onBack: () => void };

export default function LiveInterviewShell({ targetRole, profile, onBack }: LiveInterviewShellProps) {
  const [history, setHistory] = useState<AdaptiveInterviewTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnswerFocused, setIsAnswerFocused] = useState(false);
  const textareaId = useId();
  const voice = useVoice({ onTranscript: setAnswer, getCurrentText: () => answer });
  const avatarState = voice.isSpeaking ? "speaking" : voice.isListening || isAnswerFocused ? "listening" : "idle";
  const questionNumber = history.length + 1;

  async function requestNextQuestion(nextHistory: AdaptiveInterviewTurn[]) {
    setIsLoadingQuestion(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/adaptive/next", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: targetRole, profile, history: nextHistory }) });
      const data = (await response.json()) as { question?: InterviewQuestion; error?: string };
      if (!response.ok || !data.question) throw new Error(data.error || "We couldn't create the next question.");
      setHistory(nextHistory);
      setCurrentQuestion(data.question);
      setAnswer("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "We couldn't create the next question.");
    } finally {
      setIsLoadingQuestion(false);
    }
  }

  function submitAnswer() {
    if (!currentQuestion || !answer.trim()) return;
    voice.stopListening();
    voice.stopSpeaking();
    void requestNextQuestion([...history, { ...currentQuestion, answer: answer.trim() }]);
  }

  function resetLiveInterview() {
    voice.stopListening();
    voice.stopSpeaking();
    setHistory([]);
    setCurrentQuestion(null);
    setAnswer("");
    setError(null);
  }

  return (
    <section className="live-interview-shell" aria-labelledby="live-interview-title">
      <div className="live-session-header">
        <div><p className="eyebrow">LIVE ADAPTIVE INTERVIEW</p><h2 id="live-interview-title">Meet your AI interviewer</h2><p className="screen-intro">Each follow-up is generated from your profile, role, and every answer you’ve given so far.</p></div>
        <div className="live-timer" aria-label="Live interview timing guidance"><span aria-hidden="true">◷</span> Live <small>timing guidance in Phase D</small></div>
      </div>

      <div className="live-stage">
        <div className={`interviewer-avatar ${avatarState}`} aria-label={`AI interviewer is ${avatarState}`}><span className="avatar-halo halo-one" /><span className="avatar-halo halo-two" /><span className="avatar-core"><span className="avatar-eye" /><span className="avatar-eye" /></span><span className="avatar-status">{avatarState === "speaking" ? "Speaking" : avatarState === "listening" ? "Listening" : "Ready"}</span></div>
        <div className="live-question-card">
          {isLoadingQuestion ? <><p className="eyebrow">ADAPTING TO YOUR INTERVIEW</p><h3>Preparing your next question…</h3></> : currentQuestion ? <><p className="eyebrow">QUESTION {questionNumber} / LIVE</p><h3>{currentQuestion.question}</h3>{voice.synthesisSupported && <button type="button" className={`voice-listen-btn ${voice.isSpeaking ? "is-speaking" : ""}`} onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speakText(currentQuestion.question)}><span aria-hidden="true">{voice.isSpeaking ? "⏸" : "🔊"}</span><span>{voice.isSpeaking ? "Stop audio" : "Listen to question"}</span></button>}</> : <><p className="eyebrow">READY WHEN YOU ARE</p><h3>Start the interview to receive your first personalized question.</h3><button type="button" onClick={() => void requestNextQuestion([])}>Start live interview</button></>}
        </div>
      </div>

      {currentQuestion && !isLoadingQuestion && <div className="live-answer-preview">
        <div className="voice-input-header"><label htmlFor={textareaId}>Your answer</label>{voice.recognitionSupported && <button type="button" className={`voice-record-btn ${voice.isListening ? "is-recording" : ""}`} onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}>{voice.isListening ? "Stop voice recording" : "Answer with voice"}</button>}</div>
        {voice.speechError && <p className="voice-error-text" role="alert">{voice.speechError}</p>}
        <textarea id={textareaId} className="session-textarea" rows={6} value={answer} onChange={(event) => setAnswer(event.target.value)} onFocus={() => setIsAnswerFocused(true)} onBlur={() => setIsAnswerFocused(false)} placeholder="Type your answer here or use voice input…" />
        <div className="live-preview-footer"><p>{history.length} completed question{history.length === 1 ? "" : "s"} in this live session.</p><button type="button" disabled={!answer.trim() || isLoadingQuestion} onClick={submitAnswer}>Submit answer &amp; continue</button></div>
      </div>}

      {error && <p className="message error" role="alert">{error}</p>}
      <div className="live-shell-actions"><button type="button" className="secondary" onClick={onBack}>Back to mode selection</button>{(history.length > 0 || currentQuestion) && <button type="button" className="text-action-btn" onClick={resetLiveInterview}>Restart live interview</button>}</div>
    </section>
  );
}
