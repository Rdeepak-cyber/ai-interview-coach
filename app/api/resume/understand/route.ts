import { NextResponse } from "next/server";
import { isResumeProfile, resumeProfileSchema } from "../../../../lib/resume-profile";

export const runtime = "nodejs";

const MAX_RESUME_TEXT_LENGTH = 100_000;
const TOOL_NAME = "extract_resume_profile";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error("Claude is not configured. Add ANTHROPIC_API_KEY to your .env.local file and restart the app.", 503);

  try {
    const body: unknown = await request.json();
    const resumeText = typeof body === "object" && body !== null && "resumeText" in body ? (body as { resumeText?: unknown }).resumeText : undefined;

    if (typeof resumeText !== "string" || !resumeText.trim()) return error("Resume text is required.", 400);
    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) return error("This resume is too long to analyze. Please upload a shorter version.", 413);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 1600,
        system: "You are a precise resume analyst. Only use facts explicitly supported by the resume. Do not infer or invent employers, dates, skills, projects, or experience. Use an empty list when information is absent. Describe gaps only when dates clearly support one; otherwise return an empty list.",
        messages: [{ role: "user", content: `Analyze this resume:\n\n${resumeText}` }],
        tools: [{
          name: TOOL_NAME,
          description: "Return the complete normalized resume profile.",
          input_schema: resumeProfileSchema
        }],
        tool_choice: { type: "tool", name: TOOL_NAME }
      })
    });

    const payload: unknown = await response.json();
    if (!response.ok) {
      console.error("Claude API error", payload);
      return error("Claude could not analyze this resume right now. Please try again.", 502);
    }

    const content = typeof payload === "object" && payload !== null && "content" in payload ? (payload as { content?: unknown }).content : undefined;
    const toolCall = Array.isArray(content)
      ? content.find((block) => typeof block === "object" && block !== null && (block as { type?: unknown }).type === "tool_use" && (block as { name?: unknown }).name === TOOL_NAME)
      : undefined;
    const profile = toolCall && typeof toolCall === "object" ? (toolCall as { input?: unknown }).input : undefined;

    if (!isResumeProfile(profile)) {
      console.error("Claude returned an invalid resume profile", profile);
      return error("Claude returned an invalid profile. Please try again.", 502);
    }

    return NextResponse.json({ profile });
  } catch (caughtError) {
    console.error("Resume understanding failed", caughtError);
    return error("We couldn't analyze that resume. Please try again.", 500);
  }
}
