"use client";

import { useState } from "react";
import type { FeedbackReport } from "../lib/feedback-report";
import type { InterviewQA } from "../lib/interview-session";

type FeedbackReportViewProps = {
  report: FeedbackReport;
  qaPairs: InterviewQA[];
  targetRole: string;
  onRestart?: () => void;
};

export default function FeedbackReportView({
  report,
  qaPairs,
  targetRole,
  onRestart,
}: FeedbackReportViewProps) {
  // Store set of expanded question indices. By default, open question 0.
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set([0]));

  function toggleQuestion(index: number) {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleAll() {
    if (expandedIndices.size === qaPairs.length) {
      setExpandedIndices(new Set());
    } else {
      setExpandedIndices(new Set(qaPairs.map((_, i) => i)));
    }
  }

  const allExpanded = expandedIndices.size === qaPairs.length;

  return (
    <section className="feedback-report" aria-labelledby="feedback-report-title">
      <div className="report-header">
        <div className="step-label">
          <span>05</span> AI FEEDBACK REPORT
        </div>
        <span className="session-status-badge completed">ANALYSIS READY</span>
      </div>

      <h2 id="feedback-report-title">Interview Feedback Report</h2>
      <p className="helper">
        Comprehensive evaluation for <strong>{targetRole}</strong> powered by Groq.
      </p>

      {/* Overall Executive Summary Card */}
      <article className="overall-summary-card">
        <p className="eyebrow">EXECUTIVE ASSESSMENT</p>
        <p className="overall-summary-text">{report.overallSummary}</p>

        <div className="summary-columns">
          <div className="summary-col strengths-col">
            <h3>Key Overall Strengths</h3>
            <ul>
              {report.overallStrengths.map((item, idx) => (
                <li key={`overall-strength-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="summary-col improvements-col">
            <h3>High-Priority Growth Areas</h3>
            <ul>
              {report.overallImprovements.map((item, idx) => (
                <li key={`overall-improvement-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      {/* Expandable Per-Question Breakdown */}
      <section className="per-question-section" aria-labelledby="breakdown-title">
        <div className="breakdown-header">
          <div>
            <p className="eyebrow">DETAILED BREAKDOWN</p>
            <h3 id="breakdown-title">Per-Question Feedback & STAR Assessment</h3>
          </div>
          <button type="button" className="secondary small-btn" onClick={toggleAll}>
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className="feedback-accordion">
          {qaPairs.map((qa, index) => {
            const isExpanded = expandedIndices.has(index);
            const questionFeedback = report.questionFeedback.find(
              (qf) => qf.questionIndex === index
            );

            return (
              <article
                key={`qf-${index}`}
                className={`feedback-card ${isExpanded ? "expanded" : "collapsed"}`}
              >
                <button
                  type="button"
                  className="feedback-card-header"
                  onClick={() => toggleQuestion(index)}
                  aria-expanded={isExpanded}
                >
                  <div className="feedback-header-left">
                    <span className="question-index">{String(index + 1).padStart(2, "0")}</span>
                    <h4 className="feedback-question-text">{qa.question}</h4>
                  </div>
                  <div className="feedback-header-right">
                    <div className="question-meta">
                      <span>{qa.type.replace("-", " ")}</span>
                      <span className={`difficulty ${qa.difficulty}`}>{qa.difficulty}</span>
                    </div>
                    <span className="accordion-chevron" aria-hidden="true">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="feedback-card-body">
                    {/* Candidate's submitted answer */}
                    <div className="feedback-candidate-answer">
                      <span className="sub-label">Candidate Answer Evaluated:</span>
                      <p>{qa.answer || <em>No answer provided</em>}</p>
                    </div>

                    {questionFeedback ? (
                      <>
                        <div className="feedback-grid">
                          <div className="feedback-box strengths-box">
                            <h5>Answer Strengths</h5>
                            <ul>
                              {questionFeedback.strengths.map((s, idx) => (
                                <li key={`q-${index}-s-${idx}`}>{s}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="feedback-box weaknesses-box">
                            <h5>Weak Spots & Gaps</h5>
                            <ul>
                              {questionFeedback.weaknesses.map((w, idx) => (
                                <li key={`q-${index}-w-${idx}`}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="feedback-box suggestions-box">
                          <h5>Actionable Coaching Suggestions</h5>
                          <ul>
                            {questionFeedback.suggestions.map((sug, idx) => (
                              <li key={`q-${index}-sug-${idx}`}>{sug}</li>
                            ))}
                          </ul>
                        </div>

                        {/* STAR Assessment if applicable */}
                        {questionFeedback.starAssessment.applicable && (
                          <div className="star-assessment-card">
                            <div className="star-header">
                              <span className="star-badge">STAR METHOD CHECK</span>
                              <p className="star-overview-feedback">
                                {questionFeedback.starAssessment.feedback}
                              </p>
                            </div>

                            <div className="star-grid">
                              <div className="star-pillar">
                                <span className="pillar-letter">S</span>
                                <span className="pillar-name">Situation</span>
                                <p>{questionFeedback.starAssessment.situation}</p>
                              </div>
                              <div className="star-pillar">
                                <span className="pillar-letter">T</span>
                                <span className="pillar-name">Task</span>
                                <p>{questionFeedback.starAssessment.task}</p>
                              </div>
                              <div className="star-pillar">
                                <span className="pillar-letter">A</span>
                                <span className="pillar-name">Action</span>
                                <p>{questionFeedback.starAssessment.action}</p>
                              </div>
                              <div className="star-pillar">
                                <span className="pillar-letter">R</span>
                                <span className="pillar-name">Result</span>
                                <p>{questionFeedback.starAssessment.result}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="muted-copy">No feedback available for this question.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Footer controls */}
      <div className="report-footer-bar">
        <button
          type="button"
          className="secondary"
          onClick={() => window.print()}
        >
          🖨️ Print / Save report
        </button>
        {onRestart && (
          <button type="button" onClick={onRestart}>
            Practice again
          </button>
        )}
      </div>
    </section>
  );
}

