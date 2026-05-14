import "server-only";

import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type RandomQuestionResult = {
  ok: boolean;
  question: {
    id: string;
    question_text: string;
    answerCount: number;
  } | null;
  message: string;
};

const randomQuestionSchema = z.object({
  activityId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
});

export async function getRandomQuestion(
  input: unknown,
): Promise<RandomQuestionResult> {
  const parsed = randomQuestionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      question: null,
      message: "참여 정보를 다시 확인해 주세요.",
    };
  }

  const { activityId, studentId } = parsed.data;
  const supabase = getServiceSupabaseClient();
  const { data: student } = await supabase
    .from("students")
    .select("id,activity_id")
    .eq("id", studentId)
    .single();

  if (!student || student.activity_id !== activityId) {
    return {
      ok: false,
      question: null,
      message: "참여 정보를 다시 확인해 주세요.",
    };
  }

  const { data: answeredQuestions } = await supabase
    .from("answers")
    .select("question_id")
    .eq("student_id", studentId);
  const answeredQuestionIds = new Set(
    (answeredQuestions ?? []).map((answer) => answer.question_id),
  );

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id,question_text")
    .eq("activity_id", activityId)
    .eq("status", "accepted")
    .neq("student_id", studentId);

  if (questionsError || !questions) {
    return {
      ok: false,
      question: null,
      message: "친구 질문을 불러오지 못했어요.",
    };
  }

  const candidates = questions.filter(
    (question) => !answeredQuestionIds.has(question.id),
  );

  if (!candidates.length) {
    return {
      ok: true,
      question: null,
      message: "아직 풀 수 있는 친구 질문이 없어요.",
    };
  }

  const { data: answers } = await supabase
    .from("answers")
    .select("question_id")
    .in(
      "question_id",
      candidates.map((question) => question.id),
    );

  const answerCounts = new Map<string, number>();

  for (const answer of answers ?? []) {
    answerCounts.set(
      answer.question_id,
      (answerCounts.get(answer.question_id) ?? 0) + 1,
    );
  }

  const lowestAnswerCount = Math.min(
    ...candidates.map((question) => answerCounts.get(question.id) ?? 0),
  );
  const leastAnsweredQuestions = candidates.filter(
    (question) => (answerCounts.get(question.id) ?? 0) === lowestAnswerCount,
  );
  const selectedQuestion =
    leastAnsweredQuestions[
      Math.floor(Math.random() * leastAnsweredQuestions.length)
    ];

  return {
    ok: true,
    question: {
      ...selectedQuestion,
      answerCount: lowestAnswerCount,
    },
    message: "친구 질문을 받았어요.",
  };
}
