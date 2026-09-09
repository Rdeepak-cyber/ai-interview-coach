import { NextResponse } from "next/server";
import { feedbackReportSchema, isFeedbackReport } from "../../../../lib/feedback-report";
import type { InterviewQA } from "../../../../lib/interview-session";

export const runtime = "nodejs";

const RESPONSE_SCHEMA_NAME = "feedback_report";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidQAPairs(val: unknown): val is InterviewQA[] {
  if (!Array.isArray(val) || val.length === 0) return false;
  return val.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const { question, type, difficulty, answer } = item as Record<string, unknown>;
    return (
      typeof question === "string" &&
      typeof type === "string" &&
      typeof difficulty === "string" &&
      typeof answer === "string"
    );
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return error("Groq is not configured. Add GROQ_API_KEY to your .env.local file and restart the app.", 503);
  }

  try {
    const body: unknown = await request.json();
    const role =
      typeof body === "object" && body !== null && "role" in body
        ? (body as { role?: unknown }).role
        : undefined;
    const qaPairs =
      typeof body === "object" && body !== null && "qaPairs" in body
        ? (body as { qaPairs?: unknown }).qaPairs
        : undefined;

    if (typeof role !== "string" || role.trim().length < 2 || role.trim().length > 150) {
      return error("Enter a target role between 2 and 150 characters.", 400);
    }

    if (!isValidQAPairs(qaPairs)) {
      return error("A valid list of interview questions and answers is required.", 400);
    }

    const formattedQAs = qaPairs
      .map((qa, i) => {
        return `[Question ${i + 1}] (${qa.type} - ${qa.difficulty})\nQuestion: ${qa.question}\nCandidate Answer: ${qa.answer.trim() || "[No answer provided]"}`;
      })
      .join("\n\n---\n\n");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        max_tokens: 3800,
        messages: [
          {
            role: "system",
            content:
              "You are an expert technical interview coach and hiring manager. Evaluate the candidate's interview session for the stated target role.\n\n" +
              "Provide constructive, rigorous, and candid feedback:\n" +
              "1. overallSummary: Executive summary of readiness, depth, and overall impressions.\n" +
              "2. overallStrengths: 3 to 5 notable strengths shown across answers.\n" +
              "3. overallImprovements: 3 to 5 high-priority areas to improve.\n" +
              "4. questionFeedback: For every single question in the set (matching its 0-based questionIndex):\n" +
              "   - strengths: What the candidate did well in this specific response.\n" +
              "   - weaknesses: Weak spots, vague explanations, missing technical depth, or omissions.\n" +
              "   - suggestions: Concrete, actionable advice on how to improve this exact answer.\n" +
              "   - starAssessment: If the question type is 'behavioral', set applicable: true and rigorously evaluate Situation, Task, Action, and Result, with specific feedback. If not behavioral, set applicable: false and use 'N/A' for situation, task, action, and result.",
          },
          {
            role: "user",
            content: `Target Role: ${role.trim()}\n\nInterview Questions & Candidate Answers:\n\n${formattedQAs}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: RESPONSE_SCHEMA_NAME,
            strict: true,
            schema: feedbackReportSchema,
          },
        },
      }),
    });

    const payload: unknown = await response.json();
    if (!response.ok) {
      console.error("Groq API error", payload);
      return error("Groq could not generate feedback right now. Please try again.", 502);
    }

    const choices =
      typeof payload === "object" &&
      payload !== null &&
      "choices" in payload &&
      Array.isArray((payload as { choices?: unknown }).choices)
        ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices
        : undefined;

    const content = choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return error("Groq returned an empty feedback report. Please try again.", 502);
    }

    let report: unknown;
    try {
      report = JSON.parse(content);
    } catch {
      return error("Groq returned an invalid feedback report. Please try again.", 502);
    }

    if (!isFeedbackReport(report)) {
      console.error("Groq returned invalid feedback report shape", report);
      return error("Groq returned an invalid feedback report format. Please try again.", 502);
    }

    return NextResponse.json({ report });
  } catch (caughtError) {
    console.error("Feedback generation failed", caughtError);
    return error("We couldn't generate the feedback report. Please try again.", 500);
  }
}

