import { NextResponse } from "next/server";
import { adaptiveNextQuestionSchema, isAdaptiveHistory, isAdaptiveQuestion } from "../../../../../lib/adaptive-interview";
import { isResumeProfile } from "../../../../../lib/resume-profile";

export const runtime = "nodejs";
const RESPONSE_SCHEMA_NAME = "adaptive_next_question";
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return error("Groq is not configured. Add GROQ_API_KEY to your .env.local file and restart the app.", 503);
  try {
    const body: unknown = await request.json();
    const role = typeof body === "object" && body !== null && "role" in body ? (body as { role?: unknown }).role : undefined;
    const profile = typeof body === "object" && body !== null && "profile" in body ? (body as { profile?: unknown }).profile : undefined;
    const history = typeof body === "object" && body !== null && "history" in body ? (body as { history?: unknown }).history : undefined;
    if (typeof role !== "string" || role.trim().length < 2 || role.trim().length > 150) return error("Enter a target role between 2 and 150 characters.", 400);
    if (!isResumeProfile(profile)) return error("A valid resume profile is required before starting a live interview.", 400);
    if (!isAdaptiveHistory(history)) return error("The live interview history is invalid.", 400);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b", max_tokens: 700,
        messages: [
          { role: "system", content: "You are conducting a live, adaptive interview. Return exactly one concise next question. Use the candidate profile, target role, and every prior question and answer. If there is no history, begin with a warm, role-relevant opening question. If history exists, select an insightful follow-up or a new angle that avoids topics already covered. Do not repeat or substantially rephrase a previous question. Do not end the interview yet; wrap-up decisions are handled separately. Resume-specific questions must be grounded only in the profile." },
          { role: "user", content: `Target role: ${role.trim()}\n\nStructured resume profile:\n${JSON.stringify(profile)}\n\nConversation history (all turns so far):\n${JSON.stringify(history)}` }
        ],
        response_format: { type: "json_schema", json_schema: { name: RESPONSE_SCHEMA_NAME, strict: true, schema: adaptiveNextQuestionSchema } }
      })
    });
    const payload: unknown = await response.json();
    if (!response.ok) { console.error("Groq adaptive question error", payload); return error("Groq could not create the next question right now. Please try again.", 502); }
    const choices = typeof payload === "object" && payload !== null && "choices" in payload && Array.isArray((payload as { choices?: unknown }).choices) ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices : undefined;
    const content = choices?.[0]?.message?.content;
    if (typeof content !== "string") return error("Groq returned an empty question. Please try again.", 502);
    let result: unknown;
    try { result = JSON.parse(content); } catch { return error("Groq returned an invalid question. Please try again.", 502); }
    const question = typeof result === "object" && result !== null && "question" in result ? (result as { question?: unknown }).question : undefined;
    if (!isAdaptiveQuestion(question)) return error("Groq returned an invalid question. Please try again.", 502);
    if (history.some((turn) => turn.question.trim().toLocaleLowerCase() === question.question.trim().toLocaleLowerCase())) return error("Groq repeated a question. Please try again.", 502);
    return NextResponse.json({ question });
  } catch (caughtError) { console.error("Adaptive next question failed", caughtError); return error("We couldn't create the next question. Please try again.", 500); }
}
