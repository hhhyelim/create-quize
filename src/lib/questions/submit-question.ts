import "server-only";

import { z } from "zod";

import { validateQuestionSafetyWithGemini } from "@/lib/ai/questionSafety";
import {
  questionInputMessages,
  validateQuestionInput,
  type QuestionInputValidationReason,
} from "@/lib/questions/question-input-validator";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type SubmitQuestionReason =
  | QuestionInputValidationReason
  | "server_error";

export type SubmitQuestionResult = {
  accepted: boolean;
  question?: {
    id: string;
    activity_id: string;
    student_id: string;
    question_text: string;
    status: "accepted";
    created_at: string;
  };
  reason: SubmitQuestionReason;
  rejectedCount: number;
  studentMessage: string;
  warningRequired: boolean;
};

const submitQuestionSchema = z.object({
  activityId: z.string().trim().min(1),
  questionText: z.string(),
  studentId: z.string().trim().min(1),
});

const studentMessages: Record<SubmitQuestionReason, string> = {
  Empty: questionInputMessages.Empty,
  HateSpeech: questionInputMessages.HateSpeech,
  Meaningless: questionInputMessages.Meaningless,
  Profanity: questionInputMessages.Profanity,
  server_error: "질문을 저장하지 못했어요. 다시 해 주세요.",
  Valid: questionInputMessages.Valid,
};

async function recordAttempt(input: {
  activityId: string;
  questionText: string;
  reason: SubmitQuestionReason | null;
  result: "accepted" | "rejected";
  studentId: string;
}) {
  const supabase = getServiceSupabaseClient();

  await supabase.from("question_attempts").insert({
    activity_id: input.activityId,
    attempted_text: input.questionText,
    reject_reason: input.reason,
    result: input.result,
    student_id: input.studentId,
  });
}

async function increaseRejectedCount(input: {
  currentRejectedCount: number | null;
  previousWarningShown: boolean | null;
  studentId: string;
}) {
  const nextRejectedCount = (input.currentRejectedCount ?? 0) + 1;
  const warningRequired =
    input.previousWarningShown !== true && nextRejectedCount >= 3;
  const supabase = getServiceSupabaseClient();
  const updateValues = warningRequired
    ? { rejected_count: nextRejectedCount, warning_shown: true }
    : { rejected_count: nextRejectedCount };
  const { error } = await supabase
    .from("students")
    .update(updateValues)
    .eq("id", input.studentId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    rejectedCount: nextRejectedCount,
    warningRequired,
  };
}

export async function submitQuickQuestion(
  body: unknown,
): Promise<SubmitQuestionResult> {
  const parsed = submitQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return {
      accepted: false,
      reason: "server_error",
      rejectedCount: 0,
      studentMessage: "참여 정보를 다시 확인해 주세요.",
      warningRequired: false,
    };
  }

  const { activityId, studentId } = parsed.data;
  const validationResult = validateQuestionInput(parsed.data.questionText);
  const questionText = validationResult.normalizedText;
  const supabase = getServiceSupabaseClient();

  if (!validationResult.isValid) {
    const { data: student } = await supabase
      .from("students")
      .select("id,activity_id,rejected_count,warning_shown")
      .eq("id", studentId)
      .single();

    if (!student || student.activity_id !== activityId) {
      return {
        accepted: false,
        reason: "server_error",
        rejectedCount: 0,
        studentMessage: "참여 정보를 다시 확인해 주세요.",
        warningRequired: false,
      };
    }

    await recordAttempt({
      activityId,
      questionText,
      reason: validationResult.reason,
      result: "rejected",
      studentId,
    });

    const rejectionState = await increaseRejectedCount({
      currentRejectedCount: student.rejected_count,
      previousWarningShown: student.warning_shown,
      studentId,
    });

    return {
      accepted: false,
      reason: validationResult.reason,
      rejectedCount: rejectionState.rejectedCount,
      studentMessage: validationResult.studentMessage,
      warningRequired: rejectionState.warningRequired,
    };
  }

  const [{ data: activity }, { data: student }] = await Promise.all([
    supabase.from("activities").select("id").eq("id", activityId).single(),
    supabase
      .from("students")
      .select("id,activity_id,rejected_count,warning_shown")
      .eq("id", studentId)
      .single(),
  ]);

  if (!activity || !student || student.activity_id !== activity.id) {
    return {
      accepted: false,
      reason: "server_error",
      rejectedCount: 0,
      studentMessage: "참여 정보를 다시 확인해 주세요.",
      warningRequired: false,
    };
  }

  try {
    const safetyResult = await validateQuestionSafetyWithGemini(questionText);

    if (!safetyResult.isValid) {
      await recordAttempt({
        activityId,
        questionText,
        reason: safetyResult.reason,
        result: "rejected",
        studentId,
      });

      const rejectionState = await increaseRejectedCount({
        currentRejectedCount: student.rejected_count,
        previousWarningShown: student.warning_shown,
        studentId,
      });

      return {
        accepted: false,
        reason: safetyResult.reason,
        rejectedCount: rejectionState.rejectedCount,
        studentMessage: safetyResult.studentMessage,
        warningRequired: rejectionState.warningRequired,
      };
    }
  } catch (error) {
    console.error("Gemini 질문 안전 필터 실패. 로컬 검증 결과로 진행합니다.", error);
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .insert({
      activity_id: activityId,
      question_text: questionText,
      status: "accepted",
      student_id: studentId,
    })
    .select("id,activity_id,student_id,question_text,status,created_at")
    .single();

  if (questionError || !question) {
    return {
      accepted: false,
      reason: "server_error",
      rejectedCount: student.rejected_count ?? 0,
      studentMessage: studentMessages.server_error,
      warningRequired: false,
    };
  }

  await recordAttempt({
    activityId,
    questionText,
    reason: null,
    result: "accepted",
    studentId,
  });

  return {
    accepted: true,
    question: {
      ...question,
      status: "accepted",
    },
    reason: "Valid",
    rejectedCount: student.rejected_count ?? 0,
    studentMessage: studentMessages.Valid,
    warningRequired: false,
  };
}
