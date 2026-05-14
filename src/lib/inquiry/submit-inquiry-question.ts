import "server-only";

import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

import {
  inquirySafetyMessages,
  runInquirySafetyCheck,
  type InquirySafetyReason,
} from "./inquiry-common";

export type SubmitInquiryQuestionReason =
  | InquirySafetyReason
  | "server_error";

export type SubmitInquiryQuestionResult = {
  accepted: boolean;
  question?: {
    id: string;
    activity_id: string;
    student_id: string;
    question_text: string;
    status: "accepted";
    created_at: string;
  };
  reason: SubmitInquiryQuestionReason;
  studentMessage: string;
};

const submitInquiryQuestionSchema = z.object({
  activityId: z.string().trim().min(1),
  questionText: z.string(),
  studentId: z.string().trim().min(1),
});

export async function submitInquiryQuestion(
  body: unknown,
): Promise<SubmitInquiryQuestionResult> {
  const parsed = submitInquiryQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return {
      accepted: false,
      reason: "server_error",
      studentMessage: "참여 정보를 다시 확인해 주세요.",
    };
  }

  const { activityId, studentId } = parsed.data;
  const safetyResult = runInquirySafetyCheck(parsed.data.questionText);
  const questionText = safetyResult.normalizedText;

  if (!safetyResult.accepted) {
    return {
      accepted: false,
      reason: safetyResult.reason,
      studentMessage: safetyResult.studentMessage,
    };
  }

  const supabase = getServiceSupabaseClient();
  const [{ data: activity }, { data: student }] = await Promise.all([
    supabase.from("activities").select("id").eq("id", activityId).single(),
    supabase
      .from("students")
      .select("id,activity_id")
      .eq("id", studentId)
      .single(),
  ]);

  if (!activity || !student || student.activity_id !== activity.id) {
    return {
      accepted: false,
      reason: "server_error",
      studentMessage: "참여 정보를 다시 확인해 주세요.",
    };
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .insert({
      activity_id: activity.id,
      question_text: questionText,
      status: "accepted",
      student_id: student.id,
    })
    .select("id,activity_id,student_id,question_text,status,created_at")
    .single();

  if (questionError || !question) {
    return {
      accepted: false,
      reason: "server_error",
      studentMessage: "질문을 저장하지 못했어요. 다시 해 주세요.",
    };
  }

  await supabase.from("question_attempts").insert({
    activity_id: activity.id,
    attempted_text: questionText,
    reject_reason: null,
    result: "accepted",
    student_id: student.id,
  });

  return {
    accepted: true,
    question: {
      ...question,
      status: "accepted",
    },
    reason: "Valid",
    studentMessage: inquirySafetyMessages.Valid,
  };
}
