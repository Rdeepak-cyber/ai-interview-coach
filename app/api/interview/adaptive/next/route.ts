import { NextResponse } from "next/server";
import {
  adaptiveNextSchema,
  isAdaptiveHistory,
  isAdaptiveNextResponse,
  isTooSimilarToHistory
} from "../../../../../lib/adaptive-interview";
import { isResumeProfile } from "../../../../../lib/resume-profile";
import { verifyRoleMatchToken } from "../../../../../lib/role-match-token";
import { ROLE_MATCH_THRESHOLDS } from "../../../../../lib/role-match";

export const runtime = "nodejs";
const RESPONSE_SCHEMA_NAME = "adaptive_next_step";
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return error("Groq is not configured. Add GROQ_API_KEY to your .env.local file and restart the app.", 503);

  try {
    const body: unknown = await request.json();
    const role = typeof body === "object" && body !== null && "role" in body ? (body as { role?: unknown }).role : undefined;
    const profile = typeof body === "object" && body !== null && "profile" in body ? (body as { profile?: unknown }).profile : undefined;
    const history = typeof body === "object" && body !== null && "history" in body ? (body as { history?: unknown }).history : undefined;
    const token = typeof body === "object" && body !== null && "token" in body ? (body as { token?: unknown }).token : undefined;
    const elapsedSeconds =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { elapsedSeconds?: unknown }).elapsedSeconds === "number" &&
      (body as { elapsedSeconds: number }).elapsedSeconds >= 0
        ? (body as { elapsedSeconds: number }).elapsedSeconds
        : 0;

    if (typeof role !== "string" || role.trim().length < 2 || role.trim().length > 150) return error("Enter a target role between 2 and 150 characters.", 400);
    if (!isResumeProfile(profile)) return error("A valid resume profile is required before starting a live interview.", 400);
    if (!isAdaptiveHistory(history)) return error("The live interview history is invalid.", 400);

    // Turn 0: verify role-fit clearance token
    if (history.length === 0) {
      const verification = verifyRoleMatchToken(token, role);
      if (!verification.valid || (verification.matchPercent !== undefined && verification.matchPercent < ROLE_MATCH_THRESHOLDS.HARD_BLOCK)) {
        return error("This role has low alignment with your resume and cannot be used for a live interview.", 403);
      }
    }

    // Server-side backstop: force wrap-up past 14 minutes (840s) or past 12 questions
    if (elapsedSeconds >= 840 || history.length >= 12) {
      return NextResponse.json({
        action: "wrap_up",
        closingMessage:
          "Thank you for completing this comprehensive session! We've covered plenty of ground across your background. Let's see your detailed feedback report.",
        question: null
      });
    }

    const elapsedMinutes = (elapsedSeconds / 60).toFixed(1);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
            max_tokens: 750,
            messages: [
              {
                role: "system",
                content:
                  `You are conducting a live, adaptive interview. Determine the appropriate next step: either continue with another question, or wrap up the session.\n\n` +
                  `Pacing & timing guidelines:\n` +
                  `- Soft duration target: ~10 minutes (600 seconds).\n` +
                  `- Current session status: ${Math.round(elapsedSeconds)} seconds elapsed (~${elapsedMinutes} minutes), with ${history.length} completed question${history.length === 1 ? "" : "s"}.\n` +
                  `- DO NOT wrap up before at least 4 questions have been completed. If history has fewer than 4 questions, you MUST return action: "continue".\n` +
                  `- If at least 4 questions have been answered AND either elapsed time is around/past 10 minutes (~600s) or you have gained sufficient signal across core competencies for the role, return action: "wrap_up" with a warm, natural closingMessage (1-3 sentences) thanking the candidate, and set question to null.\n` +
                  `- When returning action: "continue", return exactly one concise, role-relevant question (with type and difficulty) and set closingMessage to null. Link candidate background and transferable skills to the target role. Never repeat or closely paraphrase a previous question.\n` +
                  `- When returning action: "wrap_up", return closingMessage and set question to null.`
              },
              {
                role: "user",
                content: `Target role: ${role.trim()}\n\nStructured resume profile:\n${JSON.stringify(profile)}\n\nConversation history (all turns so far):\n${JSON.stringify(history)}`
              }
            ],
            response_format: { type: "json_schema", json_schema: { name: RESPONSE_SCHEMA_NAME, strict: true, schema: adaptiveNextSchema } }
          })
        });

        const payload: unknown = await response.json();
        if (!response.ok) {
          console.error(`Groq adaptive step error (attempt ${attempt + 1})`, payload);
          continue;
        }

        const choices =
          typeof payload === "object" && payload !== null && "choices" in payload && Array.isArray((payload as { choices?: unknown }).choices)
            ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices
            : undefined;
        const content = choices?.[0]?.message?.content;
        if (typeof content !== "string") continue;

        let result: unknown;
        try {
          result = JSON.parse(content);
        } catch {
          continue;
        }

        if (!isAdaptiveNextResponse(result)) continue;

        if (result.action === "wrap_up") {
          // Guard: do not wrap up before 4 questions
          if (history.length < 4) {
            console.warn("Groq attempted to wrap up before 4 questions; retrying for a question.");
            continue;
          }
          return NextResponse.json({
            action: "wrap_up",
            closingMessage: result.closingMessage,
            question: null
          });
        }

        if (result.action === "continue") {
          // Similarity & repeat protection
          if (isTooSimilarToHistory(result.question.question, history)) {
            console.warn("Groq generated a duplicate or highly similar question; retrying.");
            continue;
          }
          return NextResponse.json({
            action: "continue",
            question: result.question,
            closingMessage: null
          });
        }
      } catch (err) {
        console.warn(`Groq adaptive next error on attempt ${attempt + 1}`, err);
      }
    }

    // If both attempts failed but user has answered at least 4 questions, wrap up gracefully
    if (history.length >= 4) {
      return NextResponse.json({
        action: "wrap_up",
        closingMessage: "Thank you for sharing your experience. We've gathered enough responses to build your feedback report.",
        question: null
      });
    }

    return error("Groq could not create the next step right now. Please try again.", 502);
  } catch (caughtError) {
    console.error("Adaptive next question failed", caughtError);
    return error("We couldn't process the next interview step. Please try again.", 500);
  }
}

