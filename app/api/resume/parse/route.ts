import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("resume");

    if (!(file instanceof File)) return error("Please attach a resume file.", 400);
    if (file.size === 0) return error("That file is empty.", 400);
    if (file.size > MAX_FILE_SIZE) return error("Your resume must be 10 MB or smaller.", 413);

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") {
      return error("Only PDF and DOCX files are supported.", 415);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;

    if (extension === "pdf") {
      const pdf = (await import("pdf-parse")).default;
      const parsed = await pdf(buffer);
      text = parsed.text;
    } else {
      const parsed = await mammoth.extractRawText({ buffer });
      text = parsed.value;
    }

    const cleanedText = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!cleanedText) {
      return error("No readable text was found in this file. If it is a scanned PDF, please upload a text-based PDF or DOCX.", 422);
    }

    return NextResponse.json({ text: cleanedText, fileName: file.name, fileType: extension });
  } catch (caughtError) {
    console.error("Resume parsing failed", caughtError);
    return error("We couldn't read that file. Please try another PDF or DOCX.", 500);
  }
}
