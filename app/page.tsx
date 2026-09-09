"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import InterviewSession from "../components/InterviewSession";
import type { InterviewQuestion } from "../lib/interview-question";
import type { InterviewQA } from "../lib/interview-session";
import type { ResumeProfile } from "../lib/resume-profile";

type ParseResponse = {
  text: string;
  fileName: string;
  fileType: "pdf" | "docx";
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ParseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [understandingError, setUnderstandingError] = useState<string | null>(null);
  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [qaPairs, setQaPairs] = useState<InterviewQA[] | null>(null);

  function chooseFile(nextFile: File | null) {
    setError(null);
    setExtracted(null);
    setProfile(null);
    setUnderstandingError(null);
    setQuestions(null);
    setQuestionError(null);
    setIsInterviewStarted(false);
    setQaPairs(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") {
      setFile(null);
      setError("Please choose a PDF or DOCX resume.");
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("Your resume must be 10 MB or smaller.");
      return;
    }

    setFile(nextFile);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0] ?? null);
  }

  async function parseResume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a resume before continuing.");
      return;
    }

    setIsParsing(true);
    setError(null);
    setExtracted(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);
      const response = await fetch("/api/resume/parse", { method: "POST", body: formData });
      const data = (await response.json()) as ParseResponse & { error?: string };

      if (!response.ok) throw new Error(data.error || "We could not read that resume.");
      setExtracted(data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "We could not read that resume.");
    } finally {
      setIsParsing(false);
    }
  }

  function clearResume() {
    setFile(null);
    setExtracted(null);
    setError(null);
    setProfile(null);
    setUnderstandingError(null);
    setQuestions(null);
    setQuestionError(null);
    setIsInterviewStarted(false);
    setQaPairs(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function understandResume() {
    if (!extracted) return;

    setIsUnderstanding(true);
    setUnderstandingError(null);
    setProfile(null);
    setQuestions(null);
    setQuestionError(null);
    setIsInterviewStarted(false);
    setQaPairs(null);

    try {
      const response = await fetch("/api/resume/understand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeText: extracted.text })
      });
      const data = (await response.json()) as { profile?: ResumeProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "We could not understand that resume.");
      setProfile(data.profile);
    } catch (caughtError) {
      setUnderstandingError(caughtError instanceof Error ? caughtError.message : "We could not understand that resume.");
    } finally {
      setIsUnderstanding(false);
    }
  }

  async function generateQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setIsGeneratingQuestions(true);
    setQuestionError(null);
    setQuestions(null);
    setIsInterviewStarted(false);
    setQaPairs(null);
    try {
      const response = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: targetRole, profile })
      });
      const data = (await response.json()) as { questions?: InterviewQuestion[]; error?: string };
      if (!response.ok || !data.questions) throw new Error(data.error || "We could not generate questions.");
      setQuestions(data.questions);
    } catch (caughtError) {
      setQuestionError(caughtError instanceof Error ? caughtError.message : "We could not generate questions.");
    } finally {
      setIsGeneratingQuestions(false);
    }
  }

  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">AI INTERVIEW COACH</p>
        <h1 id="page-title">Start with the story your resume tells.</h1>
        <p className="intro">Upload your resume and confirm what we can read. Personalized practice comes next.</p>
      </section>

      <section className="workspace" aria-labelledby="upload-title">
        <div className="step-label"><span>01</span> RESUME INGESTION</div>
        <h2 id="upload-title">Add your resume</h2>
        <p className="helper">PDF and DOCX accepted · Maximum file size 10 MB</p>

        <form onSubmit={parseResume}>
          <label className={`dropzone ${file ? "has-file" : ""}`} htmlFor="resume">
            <input
              ref={inputRef}
              id="resume"
              name="resume"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFileChange}
            />
            <span className="file-icon" aria-hidden="true">↥</span>
            {file ? (
              <span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to extract</small></span>
            ) : (
              <span><strong>Choose a resume file</strong><small>or drag and drop it here</small></span>
            )}
          </label>

          {error && <p className="message error" role="alert">{error}</p>}

          <div className="actions">
            {file && <button type="button" className="secondary" onClick={clearResume}>Remove file</button>}
            <button type="submit" disabled={!file || isParsing}>{isParsing ? "Extracting text…" : "Extract resume text"}</button>
          </div>
        </form>
      </section>

      {extracted && (
        <section className="extraction" aria-labelledby="extraction-title">
          <div className="result-heading">
            <div>
              <p className="eyebrow">PARSING COMPLETE</p>
              <h2 id="extraction-title">Review extracted text</h2>
            </div>
            <span className="format-tag">{extracted.fileType.toUpperCase()}</span>
          </div>
          <p className="source-name">Source: {extracted.fileName}</p>
          <pre>{extracted.text}</pre>
          <div className="understanding-action">
            <div>
              <p className="eyebrow">02 RESUME UNDERSTANDING</p>
              <p className="confirmation-note">If the extracted text looks right, let AI turn it into a structured experience profile.</p>
            </div>
            <button type="button" onClick={understandResume} disabled={isUnderstanding}>
              {isUnderstanding ? "Understanding resume…" : "Understand my resume"}
            </button>
          </div>
          {understandingError && <p className="message error" role="alert">{understandingError}</p>}
        </section>
      )}

      {profile && (
        <>
        <section className="profile" aria-labelledby="profile-title">
          <p className="eyebrow">STRUCTURED PROFILE</p>
          <h2 id="profile-title">Your experience, organized</h2>
          <div className="profile-grid">
            <article>
              <h3>Skills</h3>
              <div className="chips">{profile.skills.length ? profile.skills.map((skill) => <span key={skill}>{skill}</span>) : <p>None listed</p>}</div>
            </article>
            <article>
              <h3>Experience</h3>
              <p className="big-number">{profile.yearsExperience}<small> years</small></p>
              <p className="muted-copy">Based only on dates stated in your resume.</p>
            </article>
          </div>
          <div className="profile-list">
            <h3>Work history</h3>
            {profile.workHistory.length ? profile.workHistory.map((role) => <article className="role" key={`${role.company}-${role.title}`}><h4>{role.title} · {role.company}</h4><p>{role.duration}</p>{role.highlights.length > 0 && <ul>{role.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>}</article>) : <p className="muted-copy">No work history identified.</p>}
          </div>
          <div className="profile-list">
            <h3>Projects</h3>
            {profile.projects.length ? profile.projects.map((project) => <article className="role" key={project.name}><h4>{project.name}</h4><p>{project.description}</p>{project.technologies.length > 0 && <p className="muted-copy">{project.technologies.join(" · ")}</p>}</article>) : <p className="muted-copy">No projects identified.</p>}
          </div>
          <div className="profile-list gaps">
            <h3>Notable gaps</h3>
            {profile.notableGaps.length ? <ul>{profile.notableGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p className="muted-copy">No clearly supported gaps identified.</p>}
          </div>
        </section>
        <section className="question-builder" aria-labelledby="questions-title">
          <p className="eyebrow">03 QUESTION GENERATION</p>
          <h2 id="questions-title">What role are you preparing for?</h2>
          <p className="helper">We’ll combine this with your verified resume profile to make an 8–10 question practice set.</p>
          <form onSubmit={generateQuestions}>
            <label htmlFor="target-role">Target role or job title</label>
            <div className="role-control">
              <input id="target-role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Senior Frontend Engineer" required minLength={2} maxLength={150} />
              <button type="submit" disabled={isGeneratingQuestions}>{isGeneratingQuestions ? "Building your set…" : "Generate questions"}</button>
            </div>
          </form>
          {questionError && <p className="message error" role="alert">{questionError}</p>}
        </section>
        {questions && (
          <>
            <section className="question-list" aria-labelledby="question-list-title">
              <div className="result-heading">
                <div>
                  <p className="eyebrow">PRACTICE SET READY</p>
                  <h2 id="question-list-title">Your interview questions</h2>
                </div>
                <span className="format-tag">{questions.length} QUESTIONS</span>
              </div>
              <ol>
                {questions.map((item, index) => (
                  <li key={`${index}-${item.question}`}>
                    <div>
                      <span className="question-index">{String(index + 1).padStart(2, "0")}</span>
                      <p>{item.question}</p>
                    </div>
                    <div className="question-meta">
                      <span>{item.type.replace("-", " ")}</span>
                      <span className={`difficulty ${item.difficulty}`}>{item.difficulty}</span>
                    </div>
                  </li>
                ))}
              </ol>

              {!isInterviewStarted ? (
                <div className="understanding-action">
                  <div>
                    <p className="eyebrow">04 TEXT-BASED INTERVIEW SESSION</p>
                    <p className="confirmation-note">
                      Practice answering these questions one at a time. Your responses will be saved in session state for your feedback report.
                    </p>
                  </div>
                  <button type="button" onClick={() => setIsInterviewStarted(true)}>
                    Start text interview
                  </button>
                </div>
              ) : (
                <p className="confirmation-note">
                  Interview session in progress below. Answer each question one by one.
                </p>
              )}
            </section>

            {isInterviewStarted && (
              <InterviewSession
                questions={questions}
                targetRole={targetRole || "Target Role"}
                onComplete={(qa) => setQaPairs(qa)}
              />
            )}
          </>
        )}
        </>
      )}
    </main>
  );
}
