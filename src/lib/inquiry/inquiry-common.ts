import type { MaterialAnalysis } from "@/lib/ai/gemini";

export type InquirySafetyReason =
  | "accepted"
  | "attack"
  | "empty"
  | "harmful"
  | "personal_info"
  | "too_short";

export const inquirySafetyMessages: Record<InquirySafetyReason, string> = {
  accepted: "질문이 등록되었어요.",
  attack: "친구를 공격하는 말은 쓸 수 없어요.",
  empty: "궁금한 점을 문장으로 써 주세요.",
  harmful: "친구들이 함께 볼 수 있는 말로 써 주세요.",
  personal_info: "개인정보를 묻는 질문은 쓸 수 없어요.",
  too_short: "조금 더 길게 써 주세요.",
};

const unsafePatterns = [
  {
    message: inquirySafetyMessages.harmful,
    reason: "harmful" as const,
    words: ["죽어", "죽이고", "죽일", "때려", "패고", "폭력", "자살"],
  },
  {
    message: inquirySafetyMessages.personal_info,
    reason: "personal_info" as const,
    words: ["전화번호", "주소", "비밀번호", "주민번호", "집 어디", "사는 곳"],
  },
  {
    message: inquirySafetyMessages.attack,
    reason: "attack" as const,
    words: ["바보", "멍청", "못생", "싫어", "꺼져", "왕따"],
  },
];

export function parseMaterialAnalysis(value: unknown): MaterialAnalysis | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const analysis = value as Partial<MaterialAnalysis>;

  if (
    typeof analysis.summary !== "string" ||
    !Array.isArray(analysis.keywords) ||
    !Array.isArray(analysis.main_elements) ||
    !Array.isArray(analysis.related_scopes) ||
    !Array.isArray(analysis.unrelated_scopes) ||
    typeof analysis.teacher_note !== "string"
  ) {
    return null;
  }

  return analysis as MaterialAnalysis;
}

export function runInquirySafetyCheck(questionText: string): {
  accepted: boolean;
  reason: InquirySafetyReason;
  studentMessage: string;
} {
  if (!questionText) {
    return {
      accepted: false,
      reason: "empty",
      studentMessage: inquirySafetyMessages.empty,
    };
  }

  if (questionText.length < 2) {
    return {
      accepted: false,
      reason: "too_short",
      studentMessage: inquirySafetyMessages.too_short,
    };
  }

  const normalized = questionText.replace(/\s/g, "").toLowerCase();
  const unsafeMatch = unsafePatterns.find((pattern) =>
    pattern.words.some((word) => normalized.includes(word.replace(/\s/g, ""))),
  );

  if (unsafeMatch) {
    return {
      accepted: false,
      reason: unsafeMatch.reason,
      studentMessage: unsafeMatch.message,
    };
  }

  return {
    accepted: true,
    reason: "accepted",
    studentMessage: inquirySafetyMessages.accepted,
  };
}
