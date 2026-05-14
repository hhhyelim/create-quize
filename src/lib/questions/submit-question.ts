import "server-only";

import { z } from "zod";

import {
  filterQuestionWithGemini,
  type QuestionFilterReason,
} from "@/lib/ai/filterQuestion";
import type { MaterialAnalysis } from "@/lib/ai/gemini";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type SubmitQuestionReason =
  | QuestionFilterReason
  | "empty"
  | "too_short"
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

const unsafePatterns = [
  {
    message: "친구들이 함께 볼 수 있는 말로 써 주세요.",
    reason: "harmful" as const,
    words: ["죽어", "죽이고", "죽일", "때려", "패고", "폭력", "자살"],
  },
  {
    message: "개인정보를 묻는 질문은 쓸 수 없어요.",
    reason: "personal_info" as const,
    words: ["전화번호", "주소", "비밀번호", "주민번호", "집 어디", "사는 곳"],
  },
  {
    message: "친구를 공격하는 말은 쓸 수 없어요.",
    reason: "attack" as const,
    words: ["바보", "멍청", "못생", "싫어", "꺼져", "왕따"],
  },
];

const studentMessages: Record<SubmitQuestionReason, string> = {
  accepted: "질문이 등록되었어요.",
  attack: "친구를 공격하는 말은 쓸 수 없어요.",
  empty: "궁금한 점을 문장으로 써 주세요.",
  harmful: "친구들이 함께 볼 수 있는 말로 써 주세요.",
  not_question: "질문 모양으로 써 주세요.",
  personal_info: "개인정보를 묻는 질문은 쓸 수 없어요.",
  server_error: "질문을 저장하지 못했어요. 다시 해 주세요.",
  too_short: "조금 더 길게 써 주세요.",
  unclear: "뜻이 잘 보이도록 다시 써 주세요.",
  unrelated: "자료를 보고 궁금한 점을 써 주세요.",
};

function isQuestionLike(questionText: string) {
  const trimmed = questionText.trim();

  return /[?？]$/.test(trimmed) || /(까|나요|가요|까요|왜|어떻게|무엇|누가|언제|어디|얼마나)/.test(trimmed);
}

function runLocalQuestionFilter(questionText: string): {
  accepted: boolean;
  reason: SubmitQuestionReason;
  studentMessage: string;
} {
  if (!questionText) {
    return {
      accepted: false,
      reason: "empty",
      studentMessage: studentMessages.empty,
    };
  }

  if (questionText.length < 2) {
    return {
      accepted: false,
      reason: "too_short",
      studentMessage: studentMessages.too_short,
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

  if (!isQuestionLike(questionText)) {
    return {
      accepted: false,
      reason: "not_question",
      studentMessage: studentMessages.not_question,
    };
  }

  return {
    accepted: true,
    reason: "accepted",
    studentMessage: studentMessages.accepted,
  };
}

function parseMaterialAnalysis(value: unknown): MaterialAnalysis | null {
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

async function getQuestionFilter(input: {
  analysis: MaterialAnalysis | null;
  questionText: string;
}) {
  const localResult = runLocalQuestionFilter(input.questionText);

  if (!localResult.accepted) {
    return localResult;
  }

  if (!input.analysis) {
    return localResult;
  }

  try {
    const aiResult = await filterQuestionWithGemini({
      analysis: input.analysis,
      questionText: input.questionText,
    });

    return {
      accepted: aiResult.accepted,
      reason: aiResult.reason,
      studentMessage:
        studentMessages[aiResult.reason] ?? aiResult.studentMessage,
    };
  } catch (error) {
    console.error("Gemini 질문 필터 실패. 기본 검증으로 진행합니다.", error);
    return localResult;
  }
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
  const questionText = parsed.data.questionText.trim();
  const supabase = getServiceSupabaseClient();
  const localResult = runLocalQuestionFilter(questionText);

  if (!localResult.accepted) {
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
      reason: localResult.reason,
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
      reason: localResult.reason,
      rejectedCount: rejectionState.rejectedCount,
      studentMessage: localResult.studentMessage,
      warningRequired: rejectionState.warningRequired,
    };
  }

  const [{ data: activity }, { data: student }] = await Promise.all([
    supabase
      .from("activities")
      .select("id,ai_material_analysis")
      .eq("id", activityId)
      .single(),
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

  const filterResult = await getQuestionFilter({
    analysis: parseMaterialAnalysis(activity.ai_material_analysis),
    questionText,
  });

  if (!filterResult.accepted) {
    await recordAttempt({
      activityId,
      questionText,
      reason: filterResult.reason,
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
      reason: filterResult.reason,
      rejectedCount: rejectionState.rejectedCount,
      studentMessage: filterResult.studentMessage,
      warningRequired: rejectionState.warningRequired,
    };
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
    reason: "accepted",
    rejectedCount: student.rejected_count ?? 0,
    studentMessage: studentMessages.accepted,
    warningRequired: false,
  };
}
