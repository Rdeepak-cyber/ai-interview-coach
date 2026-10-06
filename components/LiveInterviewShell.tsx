"use client";

import { useId, useState } from "react";
import { useVoice } from "../lib/voice";

type LiveInterviewShellProps = { targetRole: string; onBack: () => void };

export default function LiveInterviewShell({ targetRole, onBack }: LiveInterviewShellProps) {
  const [previewAnswer, setPreviewAnswer] = useState("");
  const [isAnswerFocused, setIsAnswerFocused] = useState(false);
  const textareaId = useId();
  const openingQuestion = `Let’s begin. Could you briefly introduce yourself and explain what draws you to the ${targetRole} role?`;
  const voice = useVoice({ onTranscript: setPreviewAnswer, getCurrentText: () => previewAnswer });
  const avatarState = voice.isSpeaking ? "speaking" : isAnswerFocused ? "listening" : "idle";

  return (
    <section className="live-interview-shell" aria-labelledby="live-interview-title">
      <div className="live-session-header">
        <div>
          <p className="eyebrow">LIVE ADAPTIVE INTERVIEW</p>
          <h2 id="live-interview-title">Meet your AI interviewer</h2>
          <p className="screen-intro">A preview of the one-question-at-a-time experience. Adaptive follow-ups arrive in Phase C.</p>
        </div>
        <div className="live-timer" aria-label="Live interview timer preview"><span aria-hidden="true">◷</span> 00:00 <small>of ~10 min</small></div>
      </div>

      <div className="live-stage">
        <div className={`interviewer-avatar ${avatarState}`} aria-label={`AI interviewer is ${avatarState}`}>
          <span className="avatar-halo halo-one" /><span className="avatar-halo halo-two" />
          <span className="avatar-core"><span className="avatar-eye" /><span className="avatar-eye" /></span>
          <span className="avatar-status">{avatarState === "speaking" ? "Speaking" : avatarState === "listening" ? "Listening" : "Ready"}</span>
        </div>
        <div className="live-question-card">
          <p className="eyebrow">OPENING QUESTION / PREVIEW</p>
          <h3>{openingQuestion}</h3>
          {voice.synthesisSupported ? <button type="button" className={`voice-listen-btn ${voice.isSpeaking ? "is-speaking" : ""}`} onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speakText(openingQuestion)}><span aria-hidden="true">{voice.isSpeaking ? "⏸" : "🔊"}</span><span>{voice.isSpeaking ? "Stop preview" : "Preview interviewer voice"}</span></button> : <p className="voice-compat-note">Question audio preview is available in browsers that support text-to-speech.</p>}
        </div>
      </div>

      <div className="live-answer-preview">
        <label htmlFor={textareaId}>Your answer</label>
        <textarea id={textareaId} className="session-textarea" rows={6} value={previewAnswer} onChange={(event) => setPreviewAnswer(event.target.value)} onFocus={() => setIsAnswerFocused(true)} onBlur={() => setIsAnswerFocused(false)} placeholder="Type here to preview the live interview answer space…" />
        <div className="live-preview-footer"><p>Dynamic answer submission and tailored follow-ups will be enabled in Phase C.</p><button type="button" className="secondary" onClick={() => { voice.stopListening(); voice.stopSpeaking(); onBack(); }}>Back to mode selection</button></div>
      </div>
    </section>
  );
}
