import { NextResponse } from "next/server";
import { isFeedbackReport } from "../../../lib/feedback-report";
import { isInterviewQuestions, type InterviewQuestion } from "../../../lib/interview-question";
import { type InterviewQA } from "../../../lib/interview-session";
import { isResumeProfile } from "../../../lib/resume-profile";
import { createSupabaseServerClient } from "../../../lib/supabase-server";

export const runtime = "nodejs";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isInterviewAnswers(value: unknown): value is InterviewQA[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const { question, type, difficulty, answer } = item as Record<string, unknown>;
    return typeof question === "string" && typeof type === "string" && typeof difficulty === "string" && typeof answer === "string";
  });
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return error("You must be signed in to save an interview session.", 401);

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) return error("A valid interview session is required.", 400);

    const { targetRole, resumeProfile, questions, answers, feedbackReport } = body as Record<string, unknown>;
    if (typeof targetRole !== "string" || targetRole.trim().length < 2 || targetRole.trim().length > 150) {
      return error("A valid target role is required.", 400);
    }
    if (!isResumeProfile(resumeProfile)) return error("A valid resume profile is required.", 400);
    if (!isInterviewQuestions(questions)) return error("A valid question set is required.", 400);
    if (!isInterviewAnswers(answers)) return error("A valid answer set is required.", 400);
    if (!isFeedbackReport(feedbackReport)) return error("A valid feedback report is required.", 400);

    const { data, error: insertError } = await supabase
      .from("interview_sessions")
      .insert({
        user_id: user.id,
        target_role: targetRole.trim(),
        resume_profile: resumeProfile,
        questions: questions as InterviewQuestion[],
        answers,
        feedback_report: feedbackReport,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error("Session save failed", insertError);
      return error("We could not save this interview session.", 500);
    }

    return NextResponse.json({ session: data }, { status: 201 });
  } catch (caughtError) {
    console.error("Session save failed", caughtError);
    return error("We could not save this interview session.", 500);
  }
}
