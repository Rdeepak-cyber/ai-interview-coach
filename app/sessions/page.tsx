"use client";

import { useEffect, useState } from "react";
import FeedbackReportView from "../../components/FeedbackReportView";
import type { FeedbackReport } from "../../lib/feedback-report";
import type { InterviewQA } from "../../lib/interview-session";
import type { ResumeProfile } from "../../lib/resume-profile";

type SavedSession = {
  id: string;
  target_role: string;
  resume_profile: ResumeProfile;
  questions: unknown;
  answers: InterviewQA[];
  feedback_report: FeedbackReport;
  created_at: string;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<SavedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then(async (response) => {
        const data = (await response.json()) as { sessions?: SavedSession[]; error?: string };
        if (!response.ok) throw new Error(data.error || "We could not load your sessions.");
        setSessions(data.sessions ?? []);
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "We could not load your sessions."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main>
      <header className="app-header sessions-header">
        <div className="header-top-bar">
          <a className="brand-lockup brand-link" href="/" aria-label="Return to Interview Coach">
            <div className="brand-logo" aria-hidden="true">AI</div>
            <div>
              <span className="brand-title">Interview Coach</span>
              <span className="brand-subtitle">Personalized AI Practice</span>
            </div>
          </a>
          <a className="text-action-btn sessions-back-link" href="/">Back to practice</a>
        </div>
      </header>

      {!selectedSession ? (
        <section className="sessions-page" aria-labelledby="sessions-title">
          <div className="sessions-page-heading">
            <div>
              <p className="hero-kicker"><span className="hero-kicker-line" /> YOUR PRACTICE LIBRARY</p>
              <h1 id="sessions-title">Past sessions.</h1>
              <p className="screen-intro">Return to previous interviews and keep the coaching insights close.</p>
            </div>
            <span className="step-screen-number">∞</span>
          </div>

          {isLoading && <div className="sessions-state"><span className="button-spinner dark-spinner" /> Loading your sessions...</div>}
          {error && <p className="message error" role="alert">{error}</p>}
          {!isLoading && !error && sessions.length === 0 && (
            <div className="sessions-empty">
              <p className="eyebrow">NO SESSIONS YET</p>
              <h2>Your next practice session will appear here.</h2>
              <a className="button-link" href="/">Start an interview</a>
            </div>
          )}
          {!isLoading && !error && sessions.length > 0 && (
            <div className="session-history-list">
              {sessions.map((session) => (
                <button type="button" className="session-history-item" key={session.id} onClick={() => setSelectedSession(session)}>
                  <span className="session-history-date">{new Date(session.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
                  <span className="session-history-role">{session.target_role}</span>
                  <span className="session-history-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div>
          <button type="button" className="text-action-btn report-back-button" onClick={() => setSelectedSession(null)}>← Back to past sessions</button>
          <FeedbackReportView
            report={selectedSession.feedback_report}
            qaPairs={selectedSession.answers}
            targetRole={selectedSession.target_role}
          />
        </div>
      )}
    </main>
  );
}
