import { NextResponse } from "next/server";
import { interviewQuestionsSchema, isInterviewQuestions } from "../../../../lib/interview-question";
import { isResumeProfile } from "../../../../lib/resume-profile";

export const runtime = "nodejs";

const RESPONSE_SCHEMA_NAME = "interview_questions";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return error("Groq is not configured. Add GROQ_API_KEY to your .env.local file and restart the app.", 503);

  try {
    const body: unknown = await request.json();
    const role = typeof body === "object" && body !== null && "role" in body ? (body as { role?: unknown }).role : undefined;
    const profile = typeof body === "object" && body !== null && "profile" in body ? (body as { profile?: unknown }).profile : undefined;

    if (typeof role !== "string" || role.trim().length < 2 || role.trim().length > 150) return error("Enter a target role between 2 and 150 characters.", 400);
    if (!isResumeProfile(profile)) return error("A valid resume profile is required before generating questions.", 400);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content: "You are an expert interview coach. Create a focused, ordered interview plan. Return 8 to 10 unique questions. Include a balanced mix of resume-specific, role-standard, and behavioral questions. Ground resume-specific questions only in the provided profile. Sequence from introductory to more challenging."
          },
          {
            role: "user",
            content: `Target role: ${role.trim()}\n\nStructured resume profile:\n${JSON.stringify(profile)}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: RESPONSE_SCHEMA_NAME, strict: true, schema: interviewQuestionsSchema }
        }
      })
    });

    const payload: unknown = await response.json();
    if (!response.ok) {
      console.error("Groq API error", payload);
      return error("Groq could not generate questions right now. Please try again.", 502);
    }

    const choices =
      typeof payload === "object" && payload !== null && "choices" in payload && Array.isArray((payload as { choices?: unknown }).choices)
        ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices
        : undefined;
    const content = choices?.[0]?.message?.content;
    if (typeof content !== "string") return error("Groq returned an empty question set. Please try again.", 502);

    let result: unknown;
    try {
      result = JSON.parse(content);
    } catch {
      return error("Groq returned an invalid question set. Please try again.", 502);
    }

    const questions = typeof result === "object" && result !== null && "questions" in result ? (result as { questions?: unknown }).questions : undefined;
    if (!isInterviewQuestions(questions)) {
      console.error("Groq returned invalid interview questions", result);
      return error("Groq returned an invalid question set. Please try again.", 502);
    }

    return NextResponse.json({ questions });
  } catch (caughtError) {
    console.error("Question generation failed", caughtError);
    return error("We couldn't generate interview questions. Please try again.", 500);
  }
}
