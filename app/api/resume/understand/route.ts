import { NextResponse } from "next/server";
import { isResumeProfile, resumeProfileSchema } from "../../../../lib/resume-profile";

export const runtime = "nodejs";

const MAX_RESUME_TEXT_LENGTH = 100_000;
const RESPONSE_SCHEMA_NAME = "resume_profile";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return error("Groq is not configured. Add GROQ_API_KEY to your .env.local file and restart the app.", 503);

  try {
    const body: unknown = await request.json();
    const resumeText = typeof body === "object" && body !== null && "resumeText" in body ? (body as { resumeText?: unknown }).resumeText : undefined;

    if (typeof resumeText !== "string" || !resumeText.trim()) return error("Resume text is required.", 400);
    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) return error("This resume is too long to analyze. Please upload a shorter version.", 413);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        max_tokens: 1600,
        messages: [
          {
            role: "system",
            content: "You are a precise resume analyst. Only use facts explicitly supported by the resume. Do not infer or invent employers, dates, skills, projects, or experience. Use an empty list when information is absent. Describe gaps only when dates clearly support one; otherwise return an empty list."
          },
          { role: "user", content: `Analyze this resume:\n\n${resumeText}` }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: RESPONSE_SCHEMA_NAME,
            strict: true,
            schema: resumeProfileSchema
          }
        }
      })
    });

    const payload: unknown = await response.json();
    if (!response.ok) {
      console.error("Groq API error", payload);
      return error("Groq could not analyze this resume right now. Please try again.", 502);
    }

    const choices =
      typeof payload === "object" &&
      payload !== null &&
      "choices" in payload &&
      Array.isArray((payload as { choices?: unknown }).choices)
        ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices
        : undefined;
    const content = choices?.[0]?.message?.content;

    if (typeof content !== "string") return error("Groq returned an empty profile. Please try again.", 502);

    let profile: unknown;
    try {
      profile = JSON.parse(content);
    } catch {
      return error("Groq returned an invalid profile. Please try again.", 502);
    }

    if (!isResumeProfile(profile)) {
      console.error("Groq returned an invalid resume profile", profile);
      return error("Groq returned an invalid profile. Please try again.", 502);
    }

    return NextResponse.json({ profile });
  } catch (caughtError) {
    console.error("Resume understanding failed", caughtError);
    return error("We couldn't analyze that resume. Please try again.", 500);
  }
}
