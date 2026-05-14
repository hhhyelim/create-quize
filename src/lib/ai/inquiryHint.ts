import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

import type { MaterialAnalysis } from "@/lib/ai/gemini";
import { buildInquiryHintPrompt } from "@/lib/ai/prompts";

export const fallbackInquiryHint =
  "좋아요. 지금 질문에서 가장 궁금한 낱말을 하나 골라 보세요. 그리고 그 낱말에 대해 왜, 어떻게, 어떤 일이 생기는지 중 하나를 붙여 다시 써 보세요.";

const inquiryHintGenerationConfig = {
  maxOutputTokens: 320,
  temperature: 0.7,
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

export function buildFallbackInquiryHint(input: {
  analysis?: MaterialAnalysis | null;
  materialText?: string | null;
  previousTurns?: Array<{
    aiHint: string;
    studentText: string;
  }>;
  step?: number;
  studentText: string;
}) {
  const step = input.step ?? 1;
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
          ![
            "때문에",
            "있습니다",
            "더러운",
            "주변에",
            "들에게",
            "있어요",
          ].includes(word),
      )
      .slice(0, 2)
      .join(", ") || "자료에서 본 대상";

  if (step <= 1) {
    return `좋은 시작이에요. ${materialClue}처럼 자료에 나온 말을 떠올리면 질문이 더 또렷해져요. 어디에 있는 무엇인지 하나 골라 볼까요?`;
  }

  if (step === 2) {
    return "이제 대상이 더 분명해졌어요. 이번에는 궁금한 방향을 하나 고르면 좋아요. 왜 그런지 궁금한가요, 아니면 어떤 영향을 주는지가 궁금한가요?";
  }

  if (step === 3) {
    return "좋아요. 그 영향이 누구에게 가는지 하나 떠올리면 더 깊어질 수 있어요. 사람, 물고기, 식물, 주변 환경 중 무엇이 떠오르나요?";
  }

  if (studentText.length <= 8 && !/[?？]$/.test(studentText)) {
    return "좋아요. 그 대상을 중심에 두면 더 깊어질 수 있어요. 그 대상이 무엇의 영향을 받는지, 또는 어떤 변화가 생기는지 하나만 떠올려 볼까요?";
  }

  return "좋아요. 지금까지 고른 낱말들이 잘 모였어요. 그 낱말들을 넣어서 질문을 직접 다시 써 볼까요?";
}

export function normalizeInquiryHint(
  text: string,
  input: {
    analysis?: MaterialAnalysis | null;
    materialText?: string | null;
    previousTurns?: Array<{
      aiHint: string;
      studentText: string;
    }>;
    step?: number;
    studentText: string;
  },
) {
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
    /(요|다|까|까요|세요|해요|봐요|볼까요)$/.test(aiHint);

  return (
    /[*_`~]$/.test(aiHint) ||
    (aiHint.length < 80 && !hasNaturalEnding)
  );
}

function hasCoachingMove(text: string) {
  return /[?？]|볼까요|골라|떠올|써\s*볼까요|정해\s*볼까요/.test(text);
}

export async function repairInquiryHintIfNeeded(
  text: string,
  input: {
    analysis: MaterialAnalysis | null;
    materialText: string | null;
    previousTurns?: Array<{
      aiHint: string;
      studentText: string;
    }>;
    step?: number;
    studentText: string;
  },
) {
  const aiHint = text.trim();

  if (!looksIncompleteInquiryHint(aiHint)) {
    return aiHint;
  }

  try {
    const result = await getInquiryHintModel().generateContent(`아래 AI 코칭 응답이 쓰다 만 문장처럼 보입니다.
fallback으로 바꾸지 말고, 같은 뜻을 살려 초등학생에게 자연스러운 코칭 2~3문장으로 완성하세요.
완성된 질문 예시는 쓰지 말고, 학생이 직접 다시 쓰도록 도와주세요.

${buildInquiryHintContext(input)}

쓰다 만 응답:
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
    console.error("Gemini 탐구 질문 힌트 보정 실패. 기존 응답을 유지합니다.", error);
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

export function buildInquiryHintContext(input: {
  analysis: MaterialAnalysis | null;
  materialText: string | null;
  previousTurns?: Array<{
    aiHint: string;
    studentText: string;
  }>;
  step?: number;
  studentText: string;
}) {
  return buildInquiryHintPrompt(input);
}

export async function* streamInquiryHint(input: {
  analysis: MaterialAnalysis | null;
  materialText: string | null;
  previousTurns?: Array<{
    aiHint: string;
    studentText: string;
  }>;
  step?: number;
  studentText: string;
}) {
  const result = await getInquiryHintModel().generateContentStream(
    buildInquiryHintContext(input),
  );

  for await (const chunk of result.stream) {
    const text = chunk.text();

    if (text) {
      yield text;
    }
  }
}

export async function generateInquiryHint(input: {
  analysis: MaterialAnalysis | null;
  materialText: string | null;
  previousTurns?: Array<{
    aiHint: string;
    studentText: string;
  }>;
  step?: number;
  studentText: string;
}) {
  try {
    const result = await getInquiryHintModel().generateContent(
      buildInquiryHintContext(input),
    );

    return normalizeInquiryHint(result.response.text(), input);
  } catch (error) {
    console.error("Gemini 탐구 질문 힌트 실패. fallback 힌트로 진행합니다.", error);
    return buildFallbackInquiryHint(input);
  }
}
