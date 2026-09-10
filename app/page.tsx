"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import InterviewSession from "../components/InterviewSession";
import HeaderStepper, { type StepId } from "../components/HeaderStepper";
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
  const [isDragActive, setIsDragActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>(1);

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

  function onDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
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
      setCurrentStep(2);
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
      <HeaderStepper
        currentStep={currentStep}
        onSelectStep={setCurrentStep}
        canAccessStep={(step) => {
          if (step === 1) return true;
          if (step === 2 || step === 3) return Boolean(profile);
          if (step === 4) return Boolean(questions);
          return false;
        }}
      />

      {currentStep === 1 && (
        <section className="hero upload-hero" aria-labelledby="page-title">
          <div className="hero-kicker"><span className="hero-kicker-line" /> STEP 01 / RESUME INGESTION</div>
          <h1 id="page-title">Start with the story your resume tells.</h1>
          <p className="intro">Upload your resume and confirm what we can read. Personalized practice comes next.</p>
        </section>
      )}

      {currentStep === 1 && <section className="workspace" aria-labelledby="upload-title">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">YOUR STARTING POINT</p>
            <h2 id="upload-title">Add your resume</h2>
          </div>
          <span className="upload-format-note">PDF / DOCX<br /><small>Up to 10 MB</small></span>
        </div>
        <p className="helper">We use your resume to tailor every question to your experience.</p>

        <form onSubmit={parseResume}>
          <label
            className={`dropzone ${file ? "has-file" : ""} ${isDragActive ? "is-dragging" : ""}`}
            htmlFor="resume"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              id="resume"
              name="resume"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFileChange}
            />
            <span className="file-icon" aria-hidden="true"><span className="upload-arrow">↑</span></span>
            {file ? (
              <span className="dropzone-copy"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to extract</small></span>
            ) : (
              <span className="dropzone-copy"><strong>Choose a resume file</strong><small>or drag and drop it here</small></span>
            )}
            {!file && <span className="browse-hint">Browse files</span>}
          </label>

          {error && <p className="message error" id="resume-error" role="alert">{error}</p>}

          <div className="actions">
            {file && <button type="button" className="secondary" onClick={clearResume}>Remove file</button>}
            <button type="submit" disabled={!file || isParsing} aria-busy={isParsing}>{isParsing ? <><span className="button-spinner" aria-hidden="true" /> Extracting text...</> : "Extract resume text"}</button>
          </div>
        </form>
      </section>}

      {extracted && currentStep === 1 && (
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
        {currentStep === 2 && <section className="profile" aria-labelledby="profile-title">
          <div className="profile-heading">
            <div>
              <p className="eyebrow">STEP 02 / RESUME PROFILE</p>
              <h2 id="profile-title">Your experience, organized</h2>
              <p className="profile-intro">Review the profile we built from your resume. This is the context your interview questions will use.</p>
            </div>
            <span className="profile-status"><span /> AI PROFILE READY</span>
          </div>
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
          {currentStep === 2 && <div className="profile-continue">
            <div>
              <p className="eyebrow">NEXT STEP</p>
              <p className="confirmation-note">Your profile is ready. Choose the role you want to practice for next.</p>
            </div>
            <button type="button" onClick={() => setCurrentStep(3)}>Continue to target role</button>
          </div>}
        </section>}
        {currentStep === 3 && <section className="question-builder" aria-labelledby="questions-title">
          <div className="step-screen-heading">
            <div>
              <p className="eyebrow">STEP 03 / TARGET ROLE</p>
              <h2 id="questions-title">Set your interview direction</h2>
              <p className="screen-intro">Tell us which role you want to practice for. We’ll combine it with your resume profile to build a focused question set.</p>
            </div>
            <span className="step-screen-number">03</span>
          </div>
          <form onSubmit={generateQuestions}>
            <label htmlFor="target-role">Target role or job title</label>
            <div className="role-control">
              <input id="target-role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Senior Frontend Engineer" required minLength={2} maxLength={150} />
              <button type="submit" disabled={isGeneratingQuestions} aria-busy={isGeneratingQuestions}>{isGeneratingQuestions ? <><span className="button-spinner" aria-hidden="true" /> Building your set...</> : "Generate questions"}</button>
            </div>
          </form>
          {questionError && <p className="message error" role="alert">{questionError}</p>}
        </section>}
        {questions && currentStep === 3 && (
          <>
            <section className="question-list" aria-labelledby="question-list-title">
              <div className="result-heading">
                <div>
                  <p className="eyebrow">PRACTICE SET READY</p>
                  <h2 id="question-list-title">Your interview questions</h2>
                  <p className="question-set-context">Built for <strong>{targetRole}</strong> using your resume profile.</p>
                </div>
                <span className="format-tag question-count">{questions.length} QUESTIONS</span>
              </div>
              <ol>
                {questions.map((item, index) => (
                  <li key={`${index}-${item.question}`}>
                    <div>
                      <span className="question-index">{String(index + 1).padStart(2, "0")}</span>
                      <p>{item.question}</p>
                    </div>
                    <div className="question-meta">
                      <span className="question-type">{item.type.replace("-", " ")}</span>
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
                  <button type="button" onClick={() => { setIsInterviewStarted(true); setCurrentStep(4); }}>
                    Start text interview
                  </button>
                </div>
              ) : (
                <p className="confirmation-note">
                  Interview session in progress below. Answer each question one by one.
                </p>
              )}
            </section>

          </>
        )}
        {questions && isInterviewStarted && currentStep === 4 && (
          <InterviewSession
            questions={questions}
            targetRole={targetRole || "Target Role"}
            onComplete={(qa) => setQaPairs(qa)}
          />
        )}
        </>
      )}
    </main>
  );
}
