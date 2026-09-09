"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
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

  function chooseFile(nextFile: File | null) {
    setError(null);
    setExtracted(null);
    setProfile(null);
    setUnderstandingError(null);

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
    if (inputRef.current) inputRef.current.value = "";
  }

  async function understandResume() {
    if (!extracted) return;

    setIsUnderstanding(true);
    setUnderstandingError(null);
    setProfile(null);

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
              <p className="confirmation-note">If the extracted text looks right, let Claude turn it into a structured experience profile.</p>
            </div>
            <button type="button" onClick={understandResume} disabled={isUnderstanding}>
              {isUnderstanding ? "Understanding resume…" : "Understand my resume"}
            </button>
          </div>
          {understandingError && <p className="message error" role="alert">{understandingError}</p>}
        </section>
      )}

      {profile && (
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
      )}
    </main>
  );
}
