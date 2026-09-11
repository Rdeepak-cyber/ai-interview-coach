"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase-browser";

export type StepId = 1 | 2 | 3 | 4 | 5;

type StepConfig = {
  id: StepId;
  label: string;
  shortLabel: string;
  description: string;
};

const STEPS: StepConfig[] = [
  { id: 1, label: "Upload Resume", shortLabel: "Upload", description: "Upload PDF or DOCX" },
  { id: 2, label: "Resume Profile", shortLabel: "Profile", description: "Review experience" },
  { id: 3, label: "Target Role", shortLabel: "Questions", description: "Generate questions" },
  { id: 4, label: "Interview", shortLabel: "Practice", description: "Voice & text session" },
  { id: 5, label: "Feedback", shortLabel: "Report", description: "Executive report" },
];

type HeaderStepperProps = {
  currentStep: StepId;
  onSelectStep: (step: StepId) => void;
  canAccessStep: (step: StepId) => boolean;
  onReset?: () => void;
};

export default function HeaderStepper({
  currentStep,
  onSelectStep,
  canAccessStep,
  onReset,
}: HeaderStepperProps) {
  const currentConfig = STEPS.find((s) => s.id === currentStep) ?? STEPS[0];
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(Boolean(data.user)));
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <header className="app-header">
      <div className="header-top-bar">
        <div className="brand-lockup">
          <div className="brand-logo" aria-hidden="true">
            <span>AI</span>
          </div>
          <div>
            <span className="brand-title">Interview Coach</span>
            <span className="brand-subtitle">Personalized AI Practice</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="current-step-pill">
            <span className="step-indicator-dot" />
            <span>
              Step {currentStep} of {STEPS.length}: <strong>{currentConfig.label}</strong>
            </span>
          </div>
          {onReset && currentStep > 1 && (
            <button
              type="button"
              className="text-action-btn reset-btn"
              onClick={onReset}
              title="Start a new interview session from scratch"
            >
              Start over
            </button>
          )}
          {isAuthenticated && (
            <button type="button" className="text-action-btn logout-btn" onClick={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? "Signing out..." : "Log out"}
            </button>
          )}
        </div>
      </div>

      <nav className="stepper-nav" aria-label="Interview Progress">
        <ol className="stepper-list">
          {STEPS.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            const isAccessible = canAccessStep(step.id);

            let stateClass = "disabled";
            if (isActive) stateClass = "active";
            else if (isCompleted) stateClass = "completed";
            else if (isAccessible) stateClass = "accessible";

            return (
              <li
                key={step.id}
                className={`stepper-item ${stateClass}`}
                aria-current={isActive ? "step" : undefined}
              >
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={!isAccessible && !isActive}
                  onClick={() => isAccessible && onSelectStep(step.id)}
                  title={
                    isAccessible
                      ? `Navigate to ${step.label}`
                      : `Complete earlier steps to unlock ${step.label}`
                  }
                >
                  <span className="stepper-circle">
                    {isCompleted ? "✓" : String(step.id)}
                  </span>
                  <span className="stepper-label-group">
                    <span className="stepper-number">0{step.id}</span>
                    <span className="stepper-name">{step.shortLabel}</span>
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <span
                    className={`stepper-connector ${step.id < currentStep ? "filled" : ""}`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}
