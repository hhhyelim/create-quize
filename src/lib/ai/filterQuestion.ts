import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import type { MaterialAnalysis } from "@/lib/ai/gemini";
import { buildQuestionFilterPrompt } from "@/lib/ai/prompts";

const filterQuestionSchema = z.object({
  accepted: z.boolean(),
  reason: z.enum([
    "accepted",
    "unrelated",
    "unclear",
    "not_question",
    "harmful",
    "personal_info",
    "attack",
  ]),
  student_message: z.string(),
});

export type QuestionFilterReason = z.infer<typeof filterQuestionSchema>["reason"];

export type QuestionFilterResult = {
  accepted: boolean;
  reason: QuestionFilterReason;
  studentMessage: string;
};

function requireGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경변수가 없습니다. .env.local에 Gemini API 키를 추가해 주세요.",
    );
  }

  return apiKey;
}

function stripJsonCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseFilterResult(text: string): QuestionFilterResult {
  try {
    const parsed = filterQuestionSchema.parse(
      JSON.parse(stripJsonCodeFence(text)),
    );

    return {
      accepted: parsed.accepted,
      reason: parsed.reason,
      studentMessage: parsed.student_message,
    };
  } catch {
    throw new Error("Gemini 질문 검사 결과를 JSON으로 읽지 못했어요.");
  }
}

export async function filterQuestionWithGemini(input: {
  analysis: MaterialAnalysis;
  questionText: string;
}): Promise<QuestionFilterResult> {
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  const model = genAI.getGenerativeModel({
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
    model: "gemini-2.5-flash",
  });

  const result = await model.generateContent(buildQuestionFilterPrompt(input));

  return parseFilterResult(result.response.text());
}
