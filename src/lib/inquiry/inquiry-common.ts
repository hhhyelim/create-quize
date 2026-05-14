import type { MaterialAnalysis } from "@/lib/ai/gemini";
import {
  questionInputMessages,
  validateQuestionInput,
  type QuestionInputValidationReason,
} from "@/lib/questions/question-input-validator";

export type InquirySafetyReason = QuestionInputValidationReason;

export const inquirySafetyMessages: Record<InquirySafetyReason, string> = {
  Empty: questionInputMessages.Empty,
  HateSpeech: questionInputMessages.HateSpeech,
  Meaningless: questionInputMessages.Meaningless,
  Profanity: questionInputMessages.Profanity,
  Valid: questionInputMessages.Valid,
};

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
  normalizedText: string;
  reason: InquirySafetyReason;
  studentMessage: string;
} {
  const result = validateQuestionInput(questionText);

  return {
    accepted: result.isValid,
    normalizedText: result.normalizedText,
    reason: result.reason,
    studentMessage: result.studentMessage,
  };
}
