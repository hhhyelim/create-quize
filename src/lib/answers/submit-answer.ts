import "server-only";

import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type SubmitAnswerReason =
  | "accepted"
  | "already_answered"
  | "empty"
  | "invalid_question"
  | "invalid_student"
  | "own_question"
  | "server_error"
  | "too_short";

export type SubmitAnswerResult = {
  accepted: boolean;
  answer?: {
    id: string;
    question_id: string;
    student_id: string;
    answer_text: string;
    created_at: string;
  };
  reason: SubmitAnswerReason;
  studentMessage: string;
};

const submitAnswerSchema = z.object({
  answerText: z.string(),
  questionId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
});

const studentMessages: Record<SubmitAnswerReason, string> = {
  accepted: "답변을 저장했어요.",
  already_answered: "이미 답한 질문이에요.",
  empty: "답변을 써 주세요.",
  invalid_question: "질문을 다시 받아 주세요.",
  invalid_student: "참여 정보를 다시 확인해 주세요.",
  own_question: "내가 만든 질문에는 답할 수 없어요.",
  server_error: "답변을 저장하지 못했어요. 다시 해 주세요.",
  too_short: "조금 더 길게 써 주세요.",
};

export async function submitAnswer(
  body: unknown,
): Promise<SubmitAnswerResult> {
  const parsed = submitAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return {
      accepted: false,
      reason: "invalid_student",
      studentMessage: studentMessages.invalid_student,
    };
  }

  const { questionId, studentId } = parsed.data;
  const answerText = parsed.data.answerText.trim();

  if (!answerText) {
    return {
      accepted: false,
      reason: "empty",
      studentMessage: studentMessages.empty,
    };
  }

  if (answerText.length < 2) {
    return {
      accepted: false,
      reason: "too_short",
      studentMessage: studentMessages.too_short,
    };
  }

  const supabase = getServiceSupabaseClient();
  const [{ data: student }, { data: question }] = await Promise.all([
    supabase
      .from("students")
      .select("id,activity_id")
      .eq("id", studentId)
      .single(),
    supabase
      .from("questions")
      .select("id,activity_id,student_id,status")
      .eq("id", questionId)
      .single(),
  ]);

  if (!student) {
    return {
      accepted: false,
      reason: "invalid_student",
      studentMessage: studentMessages.invalid_student,
    };
  }

  if (!question || question.status !== "accepted") {
    return {
      accepted: false,
      reason: "invalid_question",
      studentMessage: studentMessages.invalid_question,
    };
  }

  if (student.activity_id !== question.activity_id) {
    return {
      accepted: false,
      reason: "invalid_question",
      studentMessage: studentMessages.invalid_question,
    };
  }

  if (question.student_id === student.id) {
    return {
      accepted: false,
      reason: "own_question",
      studentMessage: studentMessages.own_question,
    };
  }

  const { data: existingAnswer } = await supabase
    .from("answers")
    .select("id")
    .eq("question_id", question.id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (existingAnswer) {
    return {
      accepted: false,
      reason: "already_answered",
      studentMessage: studentMessages.already_answered,
    };
  }

  const { data: answer, error: answerError } = await supabase
    .from("answers")
    .insert({
      answer_text: answerText,
      question_id: question.id,
      student_id: student.id,
    })
    .select("id,question_id,student_id,answer_text,created_at")
    .single();

  if (answerError || !answer) {
    return {
      accepted: false,
      reason: "server_error",
      studentMessage: studentMessages.server_error,
    };
  }

  return {
    accepted: true,
    answer,
    reason: "accepted",
    studentMessage: studentMessages.accepted,
  };
}
