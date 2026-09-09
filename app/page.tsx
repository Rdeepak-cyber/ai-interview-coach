"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";

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

  function chooseFile(nextFile: File | null) {
    setError(null);
    setExtracted(null);

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
    if (inputRef.current) inputRef.current.value = "";
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
          <p className="confirmation-note">Confirm this looks accurate before we use it to understand your experience in Phase 2.</p>
        </section>
      )}
    </main>
  );
}
