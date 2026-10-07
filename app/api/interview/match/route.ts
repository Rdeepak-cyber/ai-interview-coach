import { NextResponse } from "next/server";
import { isRoleMatch, roleMatchSchema, ROLE_MATCH_THRESHOLDS } from "../../../../lib/role-match";
import { createRoleMatchToken } from "../../../../lib/role-match-token";
import { isResumeProfile } from "../../../../lib/resume-profile";

export const runtime = "nodejs";

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Fail open with token if Groq is unconfigured
    return NextResponse.json({
      match: null,
      token: createRoleMatchToken("general", ROLE_MATCH_THRESHOLDS.WARN),
      error: "Groq is not configured."
    });
  }

  try {
    const body: unknown = await request.json();
    const role = typeof body === "object" && body !== null && "role" in body ? (body as { role?: unknown }).role : undefined;
    const profile = typeof body === "object" && body !== null && "profile" in body ? (body as { profile?: unknown }).profile : undefined;
    if (typeof role !== "string" || role.trim().length < 2 || role.trim().length > 150) return error("Enter a target role between 2 and 150 characters.", 400);
    if (!isResumeProfile(profile)) return error("A valid resume profile is required before checking role fit.", 400);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
            max_tokens: 500,
            messages: [
              {
                role: "system",
                content: "Assess the candidate's fit for the target role based only on the structured resume profile. Address the candidate directly in the second person ('you', 'your resume', 'your background') rather than 'the candidate'. Be realistic but constructive. The percentage reflects transferable experience and relevant skills, not only exact job-title matches. Missing skills must be concrete, role-relevant, and limited to the five most important."
              },
              { role: "user", content: `Target role: ${role.trim()}\n\nStructured resume profile:\n${JSON.stringify(profile)}` }
            ],
            response_format: { type: "json_schema", json_schema: { name: "role_match", strict: true, schema: roleMatchSchema } }
          })
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          console.error(`Groq role match error (attempt ${attempt + 1})`, payload);
          continue;
        }
        const choices = typeof payload === "object" && payload !== null && "choices" in payload && Array.isArray((payload as { choices?: unknown }).choices) ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices : undefined;
        const content = choices?.[0]?.message?.content;
        const parsed: unknown = typeof content === "string" ? JSON.parse(content) : undefined;
        if (isRoleMatch(parsed)) {
          const clamped = {
            ...parsed,
            matchPercent: Math.round(Math.min(100, Math.max(0, parsed.matchPercent)))
          };
          const token = clamped.matchPercent >= ROLE_MATCH_THRESHOLDS.HARD_BLOCK
            ? createRoleMatchToken(role, clamped.matchPercent)
            : undefined;
          return NextResponse.json({ match: clamped, token });
        }
      } catch (err) {
        console.warn(`Groq role match parse/fetch failure on attempt ${attempt + 1}`, err);
      }
    }
    // Fail-open response with clearance token if Groq fails
    const failOpenToken = createRoleMatchToken(role, ROLE_MATCH_THRESHOLDS.WARN);
    return NextResponse.json({
      match: null,
      token: failOpenToken,
      error: "Groq returned an invalid role-fit result."
    });
  } catch (caughtError) {
    console.error("Role match check failed", caughtError);
    return error("We couldn't check role fit right now.", 500);
  }
}
