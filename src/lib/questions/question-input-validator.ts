export type QuestionInputValidationReason =
  | "Empty"
  | "HateSpeech"
  | "Meaningless"
  | "Profanity"
  | "Valid";

export type QuestionInputValidationResult = {
  isValid: boolean;
  normalizedText: string;
  reason: QuestionInputValidationReason;
  studentMessage: string;
};

export const questionInputMessages: Record<
  QuestionInputValidationReason,
  string
> = {
  Empty: "질문을 입력해 주세요.",
  HateSpeech: "친구들이 함께 볼 수 있는 말로 바꿔 주세요.",
  Meaningless: "질문처럼 읽을 수 있는 말을 적어 주세요.",
  Profanity: "친구들이 함께 볼 수 있는 말로 바꿔 주세요.",
  Valid: "질문을 등록했어요.",
};

const profanityKeywords = [
  "시발",
  "씨발",
  "ㅅㅂ",
  "ㅆㅂ",
  "병신",
  "ㅂㅅ",
  "개새끼",
  "새끼",
  "지랄",
  "ㅈㄹ",
  "꺼져",
  "닥쳐",
  "죽어",
  "죽이고",
  "죽일",
];

const hateSpeechKeywords = [
  "장애인비하",
  "장애인은",
  "장애인들은",
  "여혐",
  "남혐",
  "인종차별",
  "혐오",
];

function normalizeForKeywordCheck(text: string) {
  return text.replace(/\s/g, "").toLowerCase();
}

function includesKeyword(text: string, keywords: string[]) {
  const normalized = normalizeForKeywordCheck(text);

  return keywords.some((keyword) =>
    normalized.includes(normalizeForKeywordCheck(keyword)),
  );
}

function isMeaninglessInput(text: string) {
  const compact = text.replace(/\s/g, "");

  if (compact.length < 2) {
    return true;
  }

  if (/^[^\p{L}\p{N}]+$/u.test(compact)) {
    return true;
  }

  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(compact)) {
    return true;
  }

  if (compact.length >= 3 && /^(.)(\1)+$/u.test(compact)) {
    return true;
  }

  return false;
}

export function validateQuestionInput(
  questionText: string,
): QuestionInputValidationResult {
  const normalizedText = questionText.trim();

  if (!normalizedText) {
    return {
      isValid: false,
      normalizedText,
      reason: "Empty",
      studentMessage: questionInputMessages.Empty,
    };
  }

  if (includesKeyword(normalizedText, profanityKeywords)) {
    return {
      isValid: false,
      normalizedText,
      reason: "Profanity",
      studentMessage: questionInputMessages.Profanity,
    };
  }

  if (includesKeyword(normalizedText, hateSpeechKeywords)) {
    return {
      isValid: false,
      normalizedText,
      reason: "HateSpeech",
      studentMessage: questionInputMessages.HateSpeech,
    };
  }

  if (isMeaninglessInput(normalizedText)) {
    return {
      isValid: false,
      normalizedText,
      reason: "Meaningless",
      studentMessage: questionInputMessages.Meaningless,
    };
  }

  return {
    isValid: true,
    normalizedText,
    reason: "Valid",
    studentMessage: questionInputMessages.Valid,
  };
}
