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
  onPastSessions?: () => void;
};

export default function HeaderStepper({
  currentStep,
  onSelectStep,
  canAccessStep,
  onReset,
  onPastSessions,
}: HeaderStepperProps) {
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
            <div className="account-actions">
              <button
                type="button"
                className="header-nav-button history-btn"
                aria-label="Past sessions"
                onClick={onPastSessions ?? (() => window.location.assign("/sessions"))}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2M4.5 7.5 3 6m0 0v3m0-3h3" />
                </svg>
                <span>Past sessions</span>
              </button>
              <button
                type="button"
                className="header-nav-button logout-btn"
                aria-label="Log out"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M10 5H5v14h5m5-3 4-4-4-4m4 4H9" />
                </svg>
                <span>{isSigningOut ? "Signing out..." : "Log out"}</span>
              </button>
            </div>
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
