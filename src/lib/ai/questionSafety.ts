import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import {
  questionInputMessages,
  type QuestionInputValidationReason,
} from "@/lib/questions/question-input-validator";

const questionSafetySchema = z.object({
  is_safe: z.boolean(),
  reason: z.enum(["Profanity", "HateSpeech", "Valid"]),
  student_message: z.string().optional(),
});

export type QuestionSafetyReason = z.infer<
  typeof questionSafetySchema
>["reason"];

export type QuestionSafetyResult = {
  isValid: boolean;
  reason: Extract<QuestionInputValidationReason, QuestionSafetyReason>;
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

function buildQuestionSafetyPrompt(questionText: string) {
  return `너는 초등학교 교실에서 학생 질문을 공개하기 전에 확인하는 안전 필터다.

아래 학생 입력이 욕설, 모욕, 공격적인 표현, 혐오표현을 포함하는지만 판단한다.

중요:
- 질문 형태인지, 물음표가 있는지, 문장이 완성됐는지, 자료와 관련 있는지는 판단하지 않는다.
- "궁금해", "궁금하다", "궁금합니다", "알고 싶어", "알고 싶다" 같은 표현은 정상 표현이다.
- "왜 하늘은 파란지 궁금해" 같은 문장은 안전하면 Valid다.
- "바보", "멍청", "못생겼어"처럼 친구를 낮추는 말은 Profanity로 본다.
- 특정 집단을 비하하거나 배제하는 표현은 HateSpeech로 본다.

반드시 JSON만 출력한다.
{
  "is_safe": true 또는 false,
  "reason": "Profanity | HateSpeech | Valid",
  "student_message": "학생에게 보여줄 짧은 안내 문장"
}

학생 입력:
${questionText}`;
}

function parseQuestionSafetyResult(text: string): QuestionSafetyResult {
  const parsed = questionSafetySchema.parse(
    JSON.parse(stripJsonCodeFence(text)),
  );
  const reason = parsed.is_safe
    ? "Valid"
    : parsed.reason === "Valid"
      ? "Profanity"
      : parsed.reason;

  return {
    isValid: parsed.is_safe && reason === "Valid",
    reason,
    studentMessage:
      parsed.student_message ??
      questionInputMessages[reason] ??
      questionInputMessages.Valid,
  };
}

export async function validateQuestionSafetyWithGemini(
  questionText: string,
): Promise<QuestionSafetyResult> {
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  const model = genAI.getGenerativeModel({
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
    model: "gemini-2.5-flash",
  });

  const result = await model.generateContent(
    buildQuestionSafetyPrompt(questionText),
  );

  return parseQuestionSafetyResult(result.response.text());
}
