import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

import type { MaterialAnalysis } from "@/lib/ai/gemini";
import { buildInquiryHintPrompt } from "@/lib/ai/prompts";

export const fallbackInquiryHint =
  "좋아요. 지금 질문에서 가장 궁금한 말을 하나 골라 보세요. 그리고 그 말에 대해 어떤 일이 생기는지 붙여 다시 써 볼까요?";

const inquiryHintGenerationConfig = {
  maxOutputTokens: 768,
  temperature: 0.7,
};

type InquiryHintInput = {
  analysis?: MaterialAnalysis | null;
  materialText?: string | null;
  previousTurns?: Array<{
    aiHint: string;
    studentText: string;
  }>;
  studentText: string;
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

export function buildFallbackInquiryHint(input: InquiryHintInput) {
  const studentText = input.studentText.trim();
  const materialClue =
    [
      ...(input.analysis?.main_elements ?? []),
      ...(input.analysis?.keywords ?? []),
    ]
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") ||
    input.materialText
      ?.match(/[가-힣A-Za-z0-9]{2,}/g)
      ?.filter(
        (word) =>
          !["합니다", "있습니다", "그리고", "자료", "학생"].includes(word),
      )
      .slice(0, 2)
      .join(", ") ||
    "자료에서 본 내용";

  if (studentText.length <= 3 && !/[?？]$/.test(studentText)) {
    return `내용이 조금 짧아요. ${materialClue} 중에서 더 알고 싶은 대상을 하나 고르고, 그 대상이 어떻게 달라지는지 붙여 볼까요?`;
  }

  if (input.previousTurns?.length) {
    return "좋아요. 지금까지 고른 말들이 잘 모였어요. 그 말들을 넣어서 스스로 궁금한 점을 한 문장 질문으로 다시 써 볼까요?";
  }

  return `좋은 시작이에요. ${materialClue}처럼 자료에서 나온 말을 떠올리면 질문이 더 또렷해져요. 어디에 있는 무엇이 궁금한지 하나 골라 볼까요?`;
}

export function normalizeInquiryHint(text: string, input: InquiryHintInput) {
  const aiHint = text.trim();

  if (!aiHint || aiHint.length < 5) {
    return buildFallbackInquiryHint(input);
  }

  return aiHint;
}

function looksIncompleteInquiryHint(text: string) {
  const aiHint = text.trim();

  if (!aiHint || aiHint.length < 5) {
    return false;
  }

  const hasNaturalEnding =
    /[.!?。？！]$/.test(aiHint) ||
    /(해요|돼요|볼까요|주세요|봅시다)$/.test(aiHint);

  return /[*_`~]$/.test(aiHint) || (aiHint.length < 80 && !hasNaturalEnding);
}

function hasCoachingMove(text: string) {
  return /[?？]|볼까요|골라|떠올|써 보|정해/.test(text);
}

export async function repairInquiryHintIfNeeded(
  text: string,
  input: InquiryHintInput,
) {
  const aiHint = text.trim();

  if (!looksIncompleteInquiryHint(aiHint)) {
    return aiHint;
  }

  try {
    const result = await getInquiryHintModel().generateContent(`아래 AI 코칭 응답이 덜 완성된 문장처럼 보입니다.
fallback으로 바꾸지 말고, 같은 뜻을 살려 초등학생에게 자연스러운 코칭 2~3문장으로 완성하세요.
완성된 질문 예시를 대신 써 주지 말고, 학생이 직접 다시 쓰도록 안내하세요.

${buildInquiryHintContext(input)}

덜 완성된 응답:
${aiHint}`);

    const repairedHint = normalizeInquiryHint(result.response.text(), input);

    if (
      looksIncompleteInquiryHint(repairedHint) ||
      !hasCoachingMove(repairedHint)
    ) {
      return buildFallbackInquiryHint(input);
    }

    return repairedHint;
  } catch (error) {
    console.error("Gemini inquiry hint repair failed. Keeping original.", error);
    return aiHint;
  }
}

function getInquiryHintModel() {
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());

  return genAI.getGenerativeModel({
    generationConfig: inquiryHintGenerationConfig,
    model: "gemini-2.5-flash",
  });
}

export function buildInquiryHintContext(input: InquiryHintInput) {
  return buildInquiryHintPrompt(input);
}

export async function* streamInquiryHint(input: InquiryHintInput) {
  const result = await getInquiryHintModel().generateContentStream(
    buildInquiryHintContext(input),
  );

  for await (const chunk of result.stream) {
    const candidate = chunk.candidates?.[0];
    const text =
      candidate?.content?.parts
        ?.map((part) => ("text" in part ? (part.text ?? "") : ""))
        .join("") ?? "";
    const finishReason = candidate?.finishReason;

    if (finishReason && finishReason !== "STOP") {
      console.warn("Gemini inquiry hint stream chunk finished early.", {
        finishMessage: candidate?.finishMessage,
        finishReason,
        safetyRatings: candidate?.safetyRatings,
      });
    }

    if (text) {
      yield text;
    }
  }

  try {
    const response = await result.response;
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (finishReason && finishReason !== "STOP") {
      console.warn("Gemini inquiry hint stream finished early.", {
        finishMessage: candidate?.finishMessage,
        finishReason,
        safetyRatings: candidate?.safetyRatings,
      });
    }
  } catch (error) {
    console.warn("Gemini inquiry hint stream response metadata failed.", error);
  }
}

export async function generateInquiryHint(input: InquiryHintInput) {
  try {
    const result = await getInquiryHintModel().generateContent(
      buildInquiryHintContext(input),
    );

    return normalizeInquiryHint(result.response.text(), input);
  } catch (error) {
    console.error("Gemini inquiry hint failed. Using fallback.", error);
    return buildFallbackInquiryHint(input);
  }
}

export async function generateInquiryHintStrict(input: InquiryHintInput) {
  const result = await getInquiryHintModel().generateContent(
    buildInquiryHintContext(input),
  );
  const aiHint = normalizeInquiryHint(result.response.text(), input);

  if (!aiHint) {
    throw new Error("Gemini returned an empty inquiry hint.");
  }

  return aiHint;
}
