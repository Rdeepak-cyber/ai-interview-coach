"use client";

import { useId, useState } from "react";
import type { AdaptiveInterviewTurn } from "../lib/adaptive-interview";
import type { InterviewQuestion } from "../lib/interview-question";
import type { ResumeProfile } from "../lib/resume-profile";
import type { RoleMatch } from "../lib/role-match";
import { useVoice } from "../lib/voice";

type LiveInterviewShellProps = { targetRole: string; profile: ResumeProfile; onBack: () => void };

export default function LiveInterviewShell({ targetRole, profile, onBack }: LiveInterviewShellProps) {
  const [history, setHistory] = useState<AdaptiveInterviewTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isCheckingMatch, setIsCheckingMatch] = useState(false);
  const [matchGate, setMatchGate] = useState<RoleMatch | null>(null);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnswerFocused, setIsAnswerFocused] = useState(false);
  const textareaId = useId();
  const voice = useVoice({ onTranscript: setAnswer, getCurrentText: () => answer });
  const avatarState = voice.isSpeaking ? "speaking" : voice.isListening || isAnswerFocused ? "listening" : "idle";
  const questionNumber = history.length + 1;

  function startListeningForAnswer() {
    if (!voice.recognitionSupported) {
      setError("Voice input is unavailable in this browser. You can type your answer instead; Chrome on desktop has the best support.");
      return;
    }
    voice.startListening();
  }

  function speakQuestion(question: string, startListeningAfter = false) {
    if (!voice.synthesisSupported) {
      setError("Question audio is unavailable in this browser. The interview has switched to text; you can still type or use voice input if available.");
      return;
    }
    voice.stopListening();
    voice.speakText(question, {
      onEnd: () => {
        if (startListeningAfter) startListeningForAnswer();
      },
      onError: () => setError("Question audio could not be played. You can read the question and type your answer instead.")
    });
  }

  async function requestNextQuestion(nextHistory: AdaptiveInterviewTurn[], autoSpeak = !isMuted) {
    setIsLoadingQuestion(true);
    setError(null);
    try {
      const response = await fetch("/api/interview/adaptive/next", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: targetRole, profile, history: nextHistory }) });
      const data = (await response.json()) as { question?: InterviewQuestion; error?: string };
      if (!response.ok || !data.question) throw new Error(data.error || "We couldn't create the next question.");
      setHistory(nextHistory);
      setCurrentQuestion(data.question);
      setAnswer("");
      if (autoSpeak) speakQuestion(data.question.question, true);
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
      const data = (await response.json()) as { match?: RoleMatch; error?: string };
      if (!response.ok || !data.match) {
        setMatchNotice("Could not verify role match right now. Starting your interview directly.");
        setIsCheckingMatch(false);
        void requestNextQuestion([]);
        return;
      }
      if (data.match.matchPercent >= 70) {
        setIsCheckingMatch(false);
        void requestNextQuestion([]);
      } else {
        setIsCheckingMatch(false);
        setMatchGate(data.match);
      }
    } catch {
      setMatchNotice("Could not verify role match right now. Starting your interview directly.");
      setIsCheckingMatch(false);
      void requestNextQuestion([]);
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
    setIsMuted(false);
    setIsCheckingMatch(false);
    setMatchGate(null);
    setMatchNotice(null);
  }

  return (
    <section className="live-interview-shell" aria-labelledby="live-interview-title">
      <div className="live-session-header">
        <div><p className="eyebrow">LIVE ADAPTIVE INTERVIEW</p><h2 id="live-interview-title">Meet your AI interviewer</h2><p className="screen-intro">Each follow-up is generated from your profile, role, and every answer you’ve given so far.</p></div>
        <div className="live-timer" aria-label="Live interview timing guidance"><span aria-hidden="true">◷</span> Live <small>timing guidance in Phase D</small></div>
      </div>

      <div className="live-stage">
        <div className={`interviewer-avatar ${avatarState}`} aria-label={`AI interviewer is ${avatarState}`}><span className="avatar-halo halo-one" /><span className="avatar-halo halo-two" /><span className="avatar-core"><span className="avatar-eye" /><span className="avatar-eye" /></span><span className="avatar-status">{avatarState === "speaking" ? "Speaking" : avatarState === "listening" ? "Listening" : isCheckingMatch ? "Checking fit" : "Ready"}</span></div>
        <div className="live-question-card">
          {isLoadingQuestion ? (
            <><p className="eyebrow">ADAPTING TO YOUR INTERVIEW</p><h3>Preparing your next question…</h3></>
          ) : isCheckingMatch ? (
            <><p className="eyebrow">ROLE FIT EVALUATION</p><h3><span className="button-spinner" aria-hidden="true" /> Checking role fit…</h3><p className="live-start-note">Analyzing how your background aligns with &ldquo;{targetRole}&rdquo; before starting.</p></>
          ) : matchGate ? (
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
                <button type="button" className="secondary match-change-btn" onClick={onBack}>Change role</button>
                <button type="button" onClick={() => { setMatchGate(null); void requestNextQuestion([]); }}>Continue anyway</button>
              </div>
            </>
          ) : currentQuestion ? (
            <>
              <p className="eyebrow">QUESTION {questionNumber} / LIVE</p>
              <h3>{currentQuestion.question}</h3>
              <div className="live-question-actions">
                {voice.synthesisSupported && (
                  <button type="button" className={`voice-listen-btn ${voice.isSpeaking ? "is-speaking" : ""}`} onClick={() => voice.isSpeaking ? voice.stopSpeaking() : speakQuestion(currentQuestion.question, !isMuted)}>
                    <span aria-hidden="true">{voice.isSpeaking ? "⏸" : "🔊"}</span>
                    <span>{voice.isSpeaking ? "Stop audio" : "Replay question"}</span>
                  </button>
                )}
                <button type="button" className="voice-listen-btn" onClick={() => { setIsMuted((muted) => !muted); voice.stopSpeaking(); }}>
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

      {currentQuestion && !isLoadingQuestion && <div className="live-answer-preview">
        <div className="voice-input-header"><label htmlFor={textareaId}>Your answer</label><div className="voice-actions">{voice.recognitionSupported && <button type="button" className={`voice-record-btn ${voice.isListening ? "is-recording" : ""}`} disabled={voice.isSpeaking} onClick={() => voice.isListening ? voice.stopListening() : startListeningForAnswer()}>{voice.isListening ? "Stop voice recording" : "Start listening"}</button>}</div></div>
        {voice.isListening && <div className="voice-live-banner" role="status"><span className="pulsing-mic-badge" aria-hidden="true">LIVE</span><span>Listening to your answer… You can still edit the text below.</span></div>}
        {voice.speechError && <p className="voice-error-text" role="alert">{voice.speechError}</p>}
        <textarea id={textareaId} className="session-textarea" rows={6} value={answer} onChange={(event) => setAnswer(event.target.value)} onFocus={() => setIsAnswerFocused(true)} onBlur={() => setIsAnswerFocused(false)} placeholder="Type your answer here or use voice input…" />
        <div className="live-preview-footer"><p>{history.length} completed question{history.length === 1 ? "" : "s"} in this live session.</p><button type="button" disabled={!answer.trim() || isLoadingQuestion} onClick={submitAnswer}>Submit answer &amp; continue</button></div>
      </div>}

      {error && <p className="message error" role="alert">{error}</p>}
      <div className="live-shell-actions"><button type="button" className="secondary" onClick={onBack}>Back to mode selection</button>{(history.length > 0 || currentQuestion) && <button type="button" className="text-action-btn" onClick={resetLiveInterview}>Restart live interview</button>}</div>
    </section>
  );
}
