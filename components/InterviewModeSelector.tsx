"use client";

export type InterviewMode = "fixed" | "adaptive";

type InterviewModeSelectorProps = {
  targetRole: string;
  isLoading?: boolean;
  onSelect: (mode: InterviewMode) => void;
};

export default function InterviewModeSelector({ targetRole, isLoading = false, onSelect }: InterviewModeSelectorProps) {
  const canChoose = targetRole.trim().length >= 2 && !isLoading;

  return (
    <div className="mode-selector" aria-labelledby="mode-selector-title">
      <div className="mode-selector-heading">
        <p className="eyebrow">CHOOSE YOUR FORMAT</p>
        <h3 id="mode-selector-title">How would you like to practice?</h3>
      </div>
      <div className="mode-options">
        <article className="mode-option">
          <span className="mode-icon" aria-hidden="true">01</span>
          <h4>Practice Set</h4>
          <p>Generate a complete set of 8–10 questions before you begin. Move through them at your own pace.</p>
          <button type="button" disabled={!canChoose} onClick={() => onSelect("fixed")}>
            {isLoading ? "Building your set…" : "Choose Practice Set"}
          </button>
        </article>
        <article className="mode-option adaptive-option">
          <span className="mode-icon live" aria-hidden="true">◉</span>
          <span className="mode-label">ADAPTIVE</span>
          <h4>Live Interview</h4>
          <p>Meet one question at a time. The interviewer will adapt each follow-up to your answers in Phase C.</p>
          <button type="button" disabled={!canChoose} onClick={() => onSelect("adaptive")}>Choose Live Interview</button>
        </article>
      </div>
      {!canChoose && <p className="mode-helper">Enter a target role to choose an interview format.</p>}
    </div>
  );
}
